// Output format enums and types
export enum OutputFormats {
  GWP = "GWP",
  UBP = "UBP",
  PENR = "PENR",
}

export const OutputFormatLabels: Record<OutputFormats, string> = {
  [OutputFormats.GWP]: "Treibhausgasemissionen (kg CO2-eq)",
  [OutputFormats.UBP]: "Umweltbelastungspunkte (UBP)",
  [OutputFormats.PENR]:
    "Primärenergie, nicht erneuerbar (Graue Energie) (kWh oil-eq)",
};

// Separate labels for units only
export const OutputFormatUnits: Record<OutputFormats, string> = {
  [OutputFormats.GWP]: "kg CO₂-eq",
  [OutputFormats.UBP]: "UBP",
  [OutputFormats.PENR]: "kWh",
};

// Material types and interfaces
export enum MaterialTypes {
  WOOD = "wood",
  STEEL = "steel",
  CONCRETE = "concrete",
  GLASS = "glass",
}

interface ImpactFactor {
  co2: number;
  energy: number;
}

export const ImpactFactors: Record<MaterialTypes, ImpactFactor> = {
  [MaterialTypes.WOOD]: { co2: 1.6, energy: 10 },
  [MaterialTypes.STEEL]: { co2: 2.8, energy: 25 },
  [MaterialTypes.CONCRETE]: { co2: 0.9, energy: 1.5 },
  [MaterialTypes.GLASS]: { co2: 1.5, energy: 15 },
};

// Core interfaces
export interface Material {
  id: string;
  name: string;
  volume: number;
  unit?: string;
  density?: number;
  kbobMaterialId?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface MaterialCSVImport {
  id: string;
  ebkph: string;
  mat_ifc: string;
  netvolume: number;
  isUnmodelled?: boolean;
}

export interface UnmodelledMaterial {
  id: string;
  name: string;
  volume: number | string;
  ebkp: string;
  kbobId: string;
  density?: number;
}

export interface KbobMaterial {
  id: string;
  nameDE: string;
  density: number;
  densityRange?: {
    min: number;
    max: number;
  };
  gwp: number;
  ubp: number;
  penr: number;
  unit: string;
}

export interface ImpactResults {
  gwp: number;
  ubp: number;
  penr: number;
  modelledMaterials: number;
  unmodelledMaterials: number;
  totalElementCount?: number;
}

export interface MaterialImpact {
  gwp: number;
  ubp: number;
  penr: number;
}

export interface ElementImpact extends MaterialImpact {
  amortizationYears?: number;
}

export interface ProjectMetadata {
  filename?: string;
  upload_timestamp?: string;
  file_id?: string;
  model?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface NewMaterial {
  kbobId: string;
  name: string;
  volume: string;
  ebkp?: string;
}

// EBKP codes with descriptions
export const EBKPCodes = {
  C: "Konstruktion Gebäude",
  C1: "Fundamente, Unterboden",
  C2: "Wände",
  C3: "Stützen",
  C4: "Decken, Böden",
  D: "Technik Gebäude",
  D1: "Elektroanlagen",
  D2: "Heizung, Lüftung, Klima",
  D3: "Sanitäranlagen",
  D4: "Förderanlagen",
  E: "Äussere Wandbekleidung Gebäude",
  E1: "Aussenwandbekleidungen",
  E2: "Fenster, Aussentüren",
  E3: "Sonnenschutz",
  E4: "Dachbeläge",
} as const;

export type EBKPCode = keyof typeof EBKPCodes;

export const ModelledMaterials: Material[] = [];

export const UnmodelledMaterials: UnmodelledMaterial[] = [];

export interface FormData {
  ebkp: string;
}

export interface ProjectData {
  projectId: string;
  name: string;
  metadata?: ProjectMetadata;
  ifcData?: {
    materials: Material[];
    elements?: LcaElement[];
  };
  materialMappings?: Record<string, string>;
  materialDensities?: Record<string, number>;
  ebf?: number;
}

// Define LcaElement centrally
export interface LcaElement {
  _id?: string;
  guid: string;
  name: string;
  ifc_class: string;
  element_type?: string;
  type_name?: string;
  quantity?: number;
  ebkp?: string;
  materials: Material[];
  impact?: ElementImpact;
  properties?: {
    ebkp_code?: string;
    ebkp_name?: string;
    level?: string;
    is_structural?: boolean;
    is_external?: boolean;
    area?: number;
    length?: number;
    volume?: number;
  };
  amortization_years?: number;
  updated_at?: string;
  created_at?: string;
}

export interface LcaEbkpGroup {
  code: string;
  name: string;
  elements: LcaElement[];
  totalQuantity: number;
  totalImpact: MaterialImpact;
  elementCount: number;
}

export interface HierarchicalLcaEbkpGroup {
  mainGroup: string;
  mainGroupName: string;
  subGroups: LcaEbkpGroup[];
  totalElements: number;
  totalQuantity: number;
  totalImpact: MaterialImpact;
}

export interface Project {
  id: string;
  name: string;
  ebf?: number | null;
}
