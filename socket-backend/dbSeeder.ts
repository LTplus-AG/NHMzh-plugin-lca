import { Db } from "mongodb";
import fs from "fs";
import path from "path";
// Import the shared config
import { config } from "./config";

// Interface for the raw KBOB data item from JSON
interface RawKbobItem {
  KBOB_ID: number | string;
  Name: string;
  GWP?: number | string | null;
  UBP?: number | string | null;
  PENRE?: number | string | null;
  "kg/unit"?: number | string | null;
  "min density"?: number | string | null;
  "max density"?: number | string | null;
  uuid?: any;
}

// Interface for the transformed data to be inserted
interface MaterialLibraryItem {
  id: string;
  nameDE: string;
  gwp: number;
  ubp: number;
  penr: number;
  density?: number;
  densityRange?: { min: number; max: number };
  unit: string;
  source: string;
  uuid_kbob?: string;
}

/**
 * Seeds the materialLibrary collection with KBOB data from JSON if it's empty.
 * @param lcaDb - The MongoDB Db object for the LCA database.
 */
export async function seedKbobData(lcaDb: Db): Promise<void> {
  if (!lcaDb) {
    console.error("LCA Database handle is not available for seeding.");
    return;
  }
  // Use collection name from imported config
  const materialLibraryCollection = lcaDb.collection(
    config.mongodb.collections.materialLibrary
  );
  try {
    const materialCount = await materialLibraryCollection.countDocuments();

    if (materialCount === 0) {
      console.log(
        `'${config.mongodb.collections.materialLibrary}' collection is empty. Seeding from JSON file...`
      );
      // Corrected path relative to dbSeeder.ts within socket-backend
      const jsonFilePath = path.join(
        __dirname,
        "./data/indicatorsKBOB_v6.json"
      );
      console.log(`Attempting to read KBOB data from: ${jsonFilePath}`);

      if (!fs.existsSync(jsonFilePath)) {
        throw new Error(`KBOB JSON file not found at ${jsonFilePath}.`);
      }

      const jsonData = fs.readFileSync(jsonFilePath, "utf-8");
      const kbobDataArray: RawKbobItem[] = JSON.parse(jsonData);
      console.log(`Read ${kbobDataArray.length} items from JSON file.`);

      if (Array.isArray(kbobDataArray) && kbobDataArray.length > 0) {
        const transformedData: MaterialLibraryItem[] = kbobDataArray
          .map((item: RawKbobItem): MaterialLibraryItem | null => {
            const densityStr = item["kg/unit"];
            const minDensityStr = item["min density"];
            const maxDensityStr = item["max density"];
            let density: number | undefined = undefined;
            if (densityStr && !isNaN(parseFloat(densityStr.toString()))) {
              density = parseFloat(densityStr.toString());
            }
            let densityRange: { min: number; max: number } | undefined =
              undefined;
            if (
              minDensityStr &&
              maxDensityStr &&
              !isNaN(parseFloat(minDensityStr.toString())) &&
              !isNaN(parseFloat(maxDensityStr.toString()))
            ) {
              densityRange = {
                min: parseFloat(minDensityStr.toString()),
                max: parseFloat(maxDensityStr.toString()),
              };
            }
            const kbobId = item.KBOB_ID?.toString();
            if (!kbobId) return null;
            return {
              id: kbobId,
              nameDE: item.Name,
              gwp: parseFloat(item.GWP?.toString() || "0"),
              ubp: parseFloat(item.UBP?.toString() || "0"),
              penr: parseFloat(item.PENRE?.toString() || "0"),
              density: density,
              densityRange: densityRange,
              unit: "kg",
              source: "KBOB_v6_JSON_Seed",
              uuid_kbob: item.uuid?.$binary?.base64 || item.uuid,
            };
          })
          .filter((item): item is MaterialLibraryItem => item !== null);

        console.log(
          `Transformed ${transformedData.length} valid items for seeding.`
        );

        if (transformedData.length > 0) {
          const insertResult = await materialLibraryCollection.insertMany(
            transformedData
          );
          console.log(
            `Successfully seeded ${insertResult.insertedCount} KBOB materials into '${config.mongodb.collections.materialLibrary}'.`
          );
        } else {
          console.log("No valid data transformed from JSON to seed.");
        }
      } else {
        console.log("KBOB JSON file was empty or not an array.");
      }
    } else {
      console.log(
        `'${config.mongodb.collections.materialLibrary}' collection already contains ${materialCount} documents. Skipping seed.`
      );
    }
  } catch (seedError) {
    console.error("Error during KBOB data seeding:", seedError);
    // Log error and continue
  }
}
