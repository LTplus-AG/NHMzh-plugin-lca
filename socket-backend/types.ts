// Define interfaces for LCA Calculation Service and Kafka data

export interface LcaImpact {
  gwp: number;
  ubp: number;
  penr: number;
}

// Input data for a material instance calculation
export interface MaterialInstanceInput {
  element_global_id: string;
  material_name: string;
  kbob_id: string | null;
  kbob_material: any | null; // Consider a specific KbobMaterial type
  volume: number;
  ebkp_code: string | null;
  sequence: number;
}

// Result data for a single material instance, including calculated impacts
export interface MaterialInstanceResult {
  id: string; // Corresponds to element_global_id
  sequence: number;
  material_name: string; // Original material name
  kbob_id: string | null;
  kbob_name: string; // Name from KBOB data
  ebkp_code: string | null;
  amortization_years: number; // The lifetime used for this instance
  gwp_absolute: number;
  ubp_absolute: number;
  penr_absolute: number;
  gwp_relative: number; // Calculated relative value (per m²·year)
  ubp_relative: number; // Calculated relative value (per m²·year)
  penr_relative: number; // Calculated relative value (per m²·year)
}

// Overall calculation result structure
export interface LcaCalculationResult {
  materialInstances: MaterialInstanceResult[];
  totalImpact: LcaImpact;
  numberOfInstancesProcessed: number;
  numberOfInstancesWithErrors: number;
}

// QTO Element interface (ensure properties field is included)
export interface QtoElement {
  _id: any; // Using 'any' for flexibility with ObjectId/string
  project_id: any;
  global_id?: string;

  properties?: { [key: string]: any };
  materials?: {
    name: string;
    volume: string | number;
    unit?: string;
    fraction?: number;
  }[];
  // Add other necessary fields from your existing QtoElement definition
  [key: string]: any; // Allow other properties
}

// KBOB Material interface
export interface KbobMaterial {
  id: string;
  nameDE: string;
  density?: number;
  gwp?: number;
  ubp?: number;
  penr?: number;
  [key: string]: any;
}

// Kafka data interface
export interface LcaData {
  id: string;
  sequence: number;
  mat_kbob: string;
  gwp_relative: number;
  gwp_absolute: number;
  penr_relative: number;
  penr_absolute: number;
  ubp_relative: number;
  ubp_absolute: number;
}

// Interface for the Kafka message metadata
export interface KafkaMetadata {
  project: string;
  filename: string;
  timestamp: string; // ISO string from fileProcessingTimestamp
  fileId: string;
}

// Interface for the complete Kafka message structure
export interface IfcFileData {
  project: string;
  filename: string;
  timestamp: string;
  fileId: string;
  data?: LcaData[];
}
