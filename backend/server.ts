import express from "express";
import { createServer } from "http";
import { MongoClient, ObjectId, Db } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { body, param, validationResult } from "express-validator";
import timeout from "connect-timeout";
import { kafkaService, KafkaMetadata } from "./KafkaService";
import { seedKbobData } from "./dbSeeder";
import { config } from "./config";
import { QtoElement as QtoElementType } from "./types";
import logger from "./logger";
import { Request, Response } from "express";
import { Kafka, Producer } from "kafkajs";

let lcaDbInstance: Db | null = null;
let qtoDbInstance: Db | null = null;
let mongoClientInstance: MongoClient | null = null;

dotenv.config();

const app = express();
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5004"];

// --- Security Middleware ---
// Add helmet for security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable for API
}));

// Add request timeout handling (30 seconds)
app.use(timeout('30s'));

// --- Rate Limiting ---
// Default rate limiter - 100 requests per 15 minutes per IP
const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for write operations - 20 requests per 15 minutes per IP
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: "Too many write requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply default rate limiting to all routes
app.use(defaultLimiter);

app.use(cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes("*") || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

// --- Input Validation Middleware ---
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// --- Error Handling for Timeouts ---
const haltOnTimedout = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.timedout) next();
};

// --- API Endpoints ---

app.get("/health", (req, res) => res.status(200).json({ 
  status: "healthy",
  timestamp: new Date().toISOString() 
}));

// --- Debug Endpoint: View Last Kafka Messages ---
app.get("/debug/kafka-messages", async (req, res) => {
  res.status(200).json({
    service: "lca-service",
    kafka_topic: process.env.KAFKA_TOPIC_LCA || "lca-data",
    total_stored: kafkaService.getLastKafkaMessages().length,
    messages: kafkaService.getLastKafkaMessages()
  });
});

app.get("/api/kbob/materials", haltOnTimedout, async (req, res) => {
  if (!lcaDbInstance) return res.status(503).json({ message: "Database not available" });
  try {
    const materials = await lcaDbInstance.collection(config.mongodb.collections.materialLibrary).find({}).toArray();
    res.status(200).json(materials);
  } catch (error) {
    logger.error("Error fetching materials:", error);
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});

app.get("/api/projects", haltOnTimedout, async (req, res) => {
  if (!qtoDbInstance) return res.status(503).json({ message: "Database not available" });
  try {
    const projects = await qtoDbInstance.collection("projects").find({}).toArray();
    const formattedProjects = projects.map((p: any) => ({ id: p._id.toString(), name: p.name }));
    res.json({ projects: formattedProjects });
  } catch (error) {
    logger.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

app.get("/api/projects/:projectId/materials",
  param('projectId').isMongoId().withMessage('Invalid project ID format'),
  handleValidationErrors,
  haltOnTimedout,
  async (req, res) => {
    const { projectId } = req.params;
    if (!qtoDbInstance || !lcaDbInstance) return res.status(503).json({ message: "Database not available" });

    try {
      const projectObjectId = new ObjectId(projectId);
      const project = await qtoDbInstance.collection("projects").findOne({ _id: projectObjectId });
      if (!project) return res.status(404).json({ error: "Project not found" });

      const savedLcaData = await lcaDbInstance.collection(config.mongodb.collections.lcaResults).findOne({ projectId });
      const projectElements = await qtoDbInstance.collection("elements").find({ project_id: projectObjectId, status: "active" }).toArray();

      const materialMap = new Map<string, number>();
      projectElements.forEach((element: any) => {
        (element.materials || []).forEach((mat: any) => {
          if (mat.name && mat.volume > 0) {
            const name = mat.name.replace(/\s*\(\d+\)\s*$/, "");
            materialMap.set(name, (materialMap.get(name) || 0) + mat.volume);
          }
        });
      });
      const materials = Array.from(materialMap.entries()).map(([name, volume]) => ({ name, volume }));

      res.json({
        projectId,
        name: project.name,
        metadata: project.metadata,
        ifcData: { materials, elements: projectElements },
        materialMappings: savedLcaData?.materialMappings || {},
        materialDensities: savedLcaData?.materialDensities || {},
        ebf: savedLcaData?.ebf || null,
      });
    } catch (error) {
      logger.error("Error fetching project materials:", error);
      res.status(500).json({ error: "Failed to fetch project materials" });
    }
  }
);

app.post("/api/projects/:projectId/confirm-lca",
  strictLimiter, // Apply strict rate limiting for write operations
  param('projectId').isMongoId().withMessage('Invalid project ID format'),
  body('lcaData').isObject().withMessage('lcaData must be an object'),
  body('lcaData.data').isArray().withMessage('lcaData.data must be an array'),
  body('materialMappings').isObject().withMessage('materialMappings must be an object'),
  body('ebfValue').isNumeric().withMessage('ebfValue must be a number'),
  body('materialDensities').isObject().withMessage('materialDensities must be an object'),
  handleValidationErrors,
  haltOnTimedout,
  async (req, res) => {
    const { projectId } = req.params;
    const { lcaData, materialMappings, ebfValue, materialDensities } = req.body;

    try {
      if (lcaDbInstance) {
        await lcaDbInstance.collection(config.mongodb.collections.lcaResults).updateOne(
          { projectId },
          { $set: { projectId, materialMappings, materialDensities, ebf: ebfValue, lastUpdated: new Date() } },
          { upsert: true }
        );
      }
      
      const kafkaMetadata: KafkaMetadata = {
        project: lcaData.project,
        filename: lcaData.filename,
        timestamp: lcaData.timestamp,
        fileId: lcaData.fileId,
      };
      const success = await kafkaService.sendLcaBatchToKafka(lcaData.data, kafkaMetadata);

      if (success) {
        res.status(200).json({ success: true, message: "LCA data sent." });
      } else {
        res.status(500).json({ success: false, error: "Failed to send to Kafka" });
      }
    } catch (error) {
      logger.error(`Error in /confirm-lca for project ${projectId}:`, error);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);



// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// --- Global Error Handler ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN') {
    res.status(403).json({ error: 'Invalid CSRF token' });
  } else if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'CORS policy violation' });
  } else if (req.timedout) {
    res.status(503).json({ error: 'Request timeout' });
  } else {
    logger.error('Unhandled error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

const server = createServer(app);

async function connectToDatabases(maxRetries = 3, retryDelay = 5000) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      logger.info(`Attempting to connect to MongoDB (attempt ${retries + 1}/${maxRetries})...`);
      const client = new MongoClient(config.mongodb.uri);
      await client.connect();
      lcaDbInstance = client.db(config.mongodb.database);
      qtoDbInstance = client.db(config.mongodb.qtoDatabase);
      mongoClientInstance = client;
      await seedKbobData(lcaDbInstance);
      logger.info("MongoDB connected successfully for LCA service.");
      return; // Success, exit the function
    } catch (error) {
      retries++;
      logger.error(`MongoDB connection failed (attempt ${retries}/${maxRetries}):`, error);
      
      if (retries >= maxRetries) {
        throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
      }
      
      logger.info(`Retrying in ${retryDelay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

async function initializeKafka(maxRetries = 3, retryDelay = 5000) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      logger.info(`Attempting to initialize Kafka (attempt ${retries + 1}/${maxRetries})...`);
      await kafkaService.initialize();
      logger.info("Kafka service initialized successfully.");
      return; // Success, exit the function
    } catch (error) {
      retries++;
      logger.error(`Kafka initialization failed (attempt ${retries}/${maxRetries}):`, error);
      
      if (retries >= maxRetries) {
        throw new Error(`Failed to initialize Kafka after ${maxRetries} attempts`);
      }
      
      logger.info(`Retrying in ${retryDelay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

async function startServer() {
  try {
    // Connect to MongoDB with retries
    await connectToDatabases();

    // Initialize Kafka with retries
    await initializeKafka();

    // Start HTTP server
    app.listen(config.http.port, () => {
      logger.info(`LCA HTTP server listening on port ${config.http.port}`);
    });

  } catch (error) {
    logger.error("Failed to start LCA server:", error);
    process.exit(1);
  }
}

startServer().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await kafkaService.disconnect();
  if (mongoClientInstance) await mongoClientInstance.close();
  server.close(() => process.exit(0));
});
