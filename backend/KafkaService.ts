import { Kafka, Producer, Admin, Consumer } from "kafkajs";
import dotenv from "dotenv";
import {
  LcaData,
  KafkaMetadata,
  IfcFileData,
  MaterialInstanceResult,
  LcaImpact,
} from "./types";
import logger from "./logger";

dotenv.config();

// Define LcaElementData interface for backward compatibility with test code
export interface LcaElementData {
  id: string;
  category: string;
  level: string;
  is_structural: boolean;
  materials: {
    name: string;
    volume: number;
    impact?: LcaImpact;
  }[];
  impact: LcaImpact;
  sequence?: number;
  primaryKbobId?: string;
}

// Re-export types from the types module for backward compatibility
export type { LcaImpact, KafkaMetadata };

class KafkaService {
  private kafka: Kafka;
  private producer: Producer;
  private admin: Admin;
  private consumer: Consumer | null = null;
  private isConnected: boolean = false;
  private isProducerConnected: boolean = false;
  private lcaTopicReady: boolean = false;

  // Configuration
  private config = {
    clientId: "plugin-lca",
    broker: process.env.KAFKA_BROKER || "broker:29092",
    qtoTopic: process.env.KAFKA_TOPIC_QTO || "qto-elements",
    lcaTopic: process.env.KAFKA_TOPIC_LCA || "lca-data",
    groupId: process.env.KAFKA_GROUP_ID || "lca-plugin-group",
  };

  constructor() {
    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: [this.config.broker],
      retry: {
        initialRetryTime: 1000,
        retries: 10,
      },
    });
    this.producer = this.kafka.producer();
    this.admin = this.kafka.admin();
  }

  /**
   * Initialize Kafka connection
   */
  async initialize(): Promise<boolean> {
    try {
      await this.admin.connect();
      logger.info(`Connected to Kafka admin on broker: ${this.config.broker}`);
      await this.ensureTopicExists(this.config.qtoTopic);
      await this.ensureTopicExists(this.config.lcaTopic);
      this.lcaTopicReady = true;
      await this.admin.disconnect();
      await this.producer.connect();
      logger.info(`Producer connected to Kafka broker: ${this.config.broker}`);
      this.isProducerConnected = true;
      this.isConnected = true;
      return true;
    } catch (error) {
      logger.error("Failed to initialize Kafka:", error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Create consumer to listen for QTO elements
   */
  async createConsumer(
    messageHandler: (message: any) => Promise<void>
  ): Promise<boolean> {
    try {
      this.consumer = this.kafka.consumer({ groupId: this.config.groupId });
      await this.consumer.connect();
      logger.info(`Consumer connected to Kafka broker: ${this.config.broker}`);
      await this.consumer.subscribe({
        topic: this.config.qtoTopic,
        fromBeginning: false,
      });
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const messageValue = message.value?.toString();
            if (messageValue) {
              logger.info(
                `Received message from Kafka topic ${topic}:`,
                messageValue.substring(0, 200) + "..."
              );
              const messageData = JSON.parse(messageValue);
              await messageHandler(messageData);
            }
          } catch (err) {
            logger.error("Error processing Kafka message:", err);
          }
        },
      });
      return true;
    } catch (error) {
      logger.error("Failed to create Kafka consumer:", error);
      return false;
    }
  }

  /**
   * Batch send pre-calculated LCA data to Kafka.
   * Accepts an array of MaterialInstanceResult containing absolute and relative values.
   */
  async sendLcaBatchToKafka(
    materialInstanceResults: MaterialInstanceResult[],
    kafkaMetadata: KafkaMetadata
  ): Promise<boolean> {
    try {
      if (!materialInstanceResults || materialInstanceResults.length === 0) {
        logger.info("[Kafka Send] No pre-calculated LCA instances to send.");
        return true; // Not an error if there's nothing to send
      }
      if (!kafkaMetadata) {
        logger.error("[Kafka Send] Incomplete metadata provided.");
        return false;
      }

      // Ensure topic exists and producer is connected
      if (!this.lcaTopicReady) {
        await this.ensureTopicExists(this.config.lcaTopic);
        this.lcaTopicReady = true;
      }
      if (!this.isProducerConnected) {
        await this.producer.connect();
        this.isProducerConnected = true;
      }

      const BATCH_SIZE = 200;
      const batches: MaterialInstanceResult[][] = [];
      for (let i = 0; i < materialInstanceResults.length; i += BATCH_SIZE) {
        batches.push(materialInstanceResults.slice(i, i + BATCH_SIZE));
      }

      logger.info(
        `[Kafka Send] Sending ${materialInstanceResults.length} instances in ${batches.length} batches (Project: ${kafkaMetadata.project}, File: ${kafkaMetadata.filename})`
      );

      let allBatchesSentSuccessfully = true;
      const sentKeys = new Set<string>(); // Still useful for duplicate checks within a fileId batch

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        // Map pre-calculated data directly to Kafka LcaData format
        const kafkaLcaData: LcaData[] = [];

        batch.forEach((instanceResult) => {
          const uniqueKey = `${instanceResult.id}::${instanceResult.sequence}`;
          if (sentKeys.has(uniqueKey)) {
            logger.warn(
              `[Kafka Send] Skipping duplicate key for file ${kafkaMetadata.fileId}: id='${instanceResult.id}', sequence='${instanceResult.sequence}', KBOB Name='${instanceResult.kbob_name}'`
            );
            return; // Skip duplicate within this submission batch
          }
          sentKeys.add(uniqueKey);

          // Directly map fields
          kafkaLcaData.push({
            id: instanceResult.id, // Use element ID
            sequence: instanceResult.sequence,
            mat_kbob: instanceResult.kbob_name, // Use KBOB Name field
            gwp_relative: instanceResult.gwp_relative, // Use pre-calculated value
            gwp_absolute: instanceResult.gwp_absolute, // Use pre-calculated value
            penr_relative: instanceResult.penr_relative, // Use pre-calculated value
            penr_absolute: instanceResult.penr_absolute, // Use pre-calculated value
            ubp_relative: instanceResult.ubp_relative, // Use pre-calculated value
            ubp_absolute: instanceResult.ubp_absolute, // Use pre-calculated value
          });
        }); // End batch.forEach

        if (kafkaLcaData.length === 0) {
          logger.info(
            `[Kafka Send] Batch ${i + 1}/${
              batches.length
            } empty after filtering duplicates, skipping.`
          );
          continue;
        }

        // Create the IfcFileData message for this batch
        const lcaMessage: IfcFileData = {
          project: kafkaMetadata.project,
          filename: kafkaMetadata.filename,
          timestamp: kafkaMetadata.timestamp,
          fileId: kafkaMetadata.fileId,
          data: kafkaLcaData,
        };
        const messageKey = kafkaMetadata.fileId;

        try {
          // console.log(`[Kafka Send] Sending Batch ${i + 1}/${batches.length}, Key: ${messageKey}, Size: ${kafkaLcaData.length}`); // Simplified log
          // Limit log size for potentially large messages
          const logPayload = JSON.stringify(lcaMessage);
          logger.info(
            `[Kafka Send] Sending Batch ${i + 1}/${
              batches.length
            } - Payload: ${logPayload.substring(0, 500)}${
              logPayload.length > 500 ? "..." : ""
            }`
          );

          await this.producer.send({
            topic: this.config.lcaTopic,
            messages: [{ value: logPayload, key: messageKey }],
          });
          // console.log(`[Kafka Send] Batch ${i + 1}/${batches.length} sent successfully.`); // Success log per batch can be verbose
        } catch (sendError) {
          logger.error(
            `[Kafka Send] Error sending batch ${i + 1}/${batches.length}:`,
            sendError
          );
          this.isProducerConnected = false; // Attempt reconnect on next send
          allBatchesSentSuccessfully = false;
          // Consider whether to break or continue trying other batches
          break; // Stop sending if one batch fails
        }

        // Optional delay
        if (batches.length > 1 && i < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } // End batch loop

      if (allBatchesSentSuccessfully)
        logger.info(
          `[Kafka Send] All ${batches.length} batches sent successfully for fileId ${kafkaMetadata.fileId}.`
        );
      else
        logger.error(
          `[Kafka Send] Failed to send one or more batches for fileId ${kafkaMetadata.fileId}.`
        );

      return allBatchesSentSuccessfully;
    } catch (error) {
      logger.error(
        "[Kafka Send] Unexpected error in sendLcaBatchToKafka:",
        error
      );
      return false;
    }
  }

  /**
   * @deprecated Use the new sendLcaBatchToKafka method that takes pre-calculated values
   * This method is kept for compatibility with existing code
   */
  async sendLcaBatchToKafkaLegacy(
    elements: LcaElementData[],
    kafkaMetadata: KafkaMetadata,
    totals: { totalGwp: number; totalUbp: number; totalPenr: number }
  ): Promise<boolean> {
    logger.warn(
      "Using deprecated method sendLcaBatchToKafkaLegacy - please update your code"
    );
    // Convert the old format to the new format for backward compatibility
    const materialInstanceResults: MaterialInstanceResult[] = elements.map(
      (element, index) => {
        const impact = element.impact || { gwp: 0, ubp: 0, penr: 0 };
        return {
          id: element.id,
          sequence: element.sequence || index,
          material_name: element.materials?.[0]?.name || "Unknown",
          kbob_id: element.primaryKbobId || null,
          kbob_name: "Unknown KBOB", // We don't have this in the old format
          ebkp_code: null, // We don't have this in the old format
          amortization_years: 45, // Use default 45 years
          gwp_absolute: impact.gwp,
          ubp_absolute: impact.ubp,
          penr_absolute: impact.penr,
          gwp_relative: impact.gwp / 45, // Simple approximation - not accurate!
          ubp_relative: impact.ubp / 45,
          penr_relative: impact.penr / 45,
        };
      }
    );

    return this.sendLcaBatchToKafka(materialInstanceResults, kafkaMetadata);
  }

  /**
   * Check if Kafka topic exists, create if not
   */
  async ensureTopicExists(topic: string): Promise<boolean> {
    try {
      try {
        await this.admin.listTopics();
      } catch (error) {
        await this.admin.connect();
      }
      const topics = await this.admin.listTopics();
      logger.info(`Available Kafka topics: ${topics.join(", ")}`);
      if (!topics.includes(topic)) {
        logger.info(`Topic '${topic}' does not exist. Creating it...`);
        await this.admin.createTopics({
          topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
        });
        logger.info(`Created topic: ${topic}`);
      } else {
        logger.info(`Topic '${topic}' already exists`);
      }
      return true;
    } catch (error) {
      logger.error(`Error checking/creating Kafka topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    try {
      if (this.consumer) {
        await this.consumer.disconnect();
        logger.info("Kafka consumer disconnected");
      }
      if (this.isProducerConnected) {
        await this.producer.disconnect();
        logger.info("Kafka producer disconnected");
        this.isProducerConnected = false;
      }
      try {
        await this.admin.disconnect();
        logger.info("Kafka admin disconnected");
      } catch (error) {
        /* Ignore */
      }
      this.isConnected = false;
    } catch (error) {
      logger.error("Error disconnecting from Kafka:", error);
    }
  }

  /**
   * Check if Kafka is connected
   */
  isKafkaConnected(): boolean {
    return this.isConnected;
  }
}

// Export a singleton instance
export const kafkaService = new KafkaService();
