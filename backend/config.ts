import dotenv from "dotenv";

dotenv.config();

// Ensure authSource=admin is used for MongoDB authentication
let MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  try {
    const url = new URL(MONGODB_URI);
    if (!url.searchParams.has('authSource') || url.searchParams.get('authSource') === 'cost') {
      url.searchParams.set('authSource', 'admin');
    }
    MONGODB_URI = url.toString();
  } catch (error) {
    console.error('Invalid MongoDB URI format:', error);
    throw new Error('Invalid MongoDB URI format');
  }
}

export const config = {
  http: { port: parseInt(process.env.HTTP_PORT || "8002") },
  mongodb: {
    uri:
      process.env.MONGODB_URI ||
      `mongodb://${process.env.MONGODB_USERNAME || "admin"}:${process.env.MONGODB_PASSWORD || "admin"}@mongodb:27017/?authSource=admin`, // Fallback URI
    database: process.env.MONGODB_DATABASE || "lca",
    qtoDatabase: process.env.MONGODB_QTO_DATABASE || "qto",
    collections: {
      lcaElements: process.env.MONGODB_LCA_ELEMENTS_COLLECTION || "lcaElements",
      lcaResults: process.env.MONGODB_LCA_RESULTS_COLLECTION || "lcaResults",
      materialLibrary: process.env.MONGODB_MATERIAL_LIBRARY_COLLECTION || "materialLibrary",
    },
    auth: {
      username: process.env.MONGODB_USERNAME || process.env.MONGODB_USERNAME || "admin",
      password: process.env.MONGODB_PASSWORD || process.env.MONGODB_PASSWORD || "admin",
    },
  },
  kafka: {
    // Add Kafka config if needed by other parts, keep minimal for now
    broker: process.env.KAFKA_BROKER || "broker:29092",
    lcaTopic: process.env.KAFKA_TOPIC_LCA || "lca-data",
    // Add other topics if needed
  },
};

// Validate required environment variables for MongoDB URI construction
if (!config.mongodb.uri) {
  console.error(`ERROR: Missing required environment variable: MONGODB_URI`);
  throw new Error(`Missing required environment variable: MONGODB_URI`);
}

console.log(
  `Configured MongoDB URI: ${config.mongodb.uri.replace(/:[^:]*@/, ":****@")}`
);
console.log(`Configured LCA DB: ${config.mongodb.database}`);
console.log(`Configured QTO DB: ${config.mongodb.qtoDatabase}`);
