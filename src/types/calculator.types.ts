// Shared types for LCA Calculator components

export interface MaterialOption {
  value: string;
  label: string;
  isDisabled?: boolean;
  className?: string;
}

export interface MaterialOptionGroup {
  label: string;
  options: MaterialOption[];
}

export interface IFCMaterial {
  name: string;
  volume: number;
}

export interface IFCResult {
  projectId: string;
  ifcData: {
    materials?: IFCMaterial[];
    elements?: any[]; // Using any to avoid circular dependency with LcaElement
    totalImpact?: {
      gwp: number;
      ubp: number;
      penr: number;
    };
  };
  materialMappings: Record<string, string>;
}

export interface ProjectOption {
  value: string;
  label: string;
}

export interface CalculatorProjectMetadata {
  filename: string;
  upload_timestamp: string;
  element_count?: number;
} 