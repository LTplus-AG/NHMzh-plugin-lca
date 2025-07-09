import {
  ProjectData,
  KbobMaterial,
  Project,
} from "../types/lca.types";
import logger from '../utils/logger';

const API_BASE_URL =
  import.meta.env.VITE_LCA_BACKEND_URL || "http://localhost:8002";

// Add proper type definition for LcaInstance
export interface LcaInstance {
  id: string;
  sequence: number;
  mat_kbob: string;
  kbob_name: string;
  project?: string;
  filename?: string;
  fileId?: string;
  gwp_absolute: number;
  gwp_relative: number;
  ubp_absolute: number;
  ubp_relative: number;
  penr_absolute: number;
  penr_relative: number;
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE_URL}/api/projects`);
  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }
  const data = await response.json();
  return data.projects || [];
}

export async function getProjectMaterials(
  projectId: string
): Promise<ProjectData> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/materials`);
  if (!response.ok) {
    throw new Error("Failed to fetch project materials");
  }
  return response.json();
}

export async function saveProjectMaterials(
  projectId: string,
  data: {
    materialMappings: Record<string, string>;
    ebfValue: number;
    materialDensities: Record<string, number>;
    lcaData: {
      project: string;
      filename: string;
      timestamp: string;
      fileId: string;
      data: LcaInstance[];
    };
  }
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/confirm-lca`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logger.error(`Failed to save project materials: ${response.status}`, errorData);
    throw new Error("Failed to save project materials");
  }
}

export async function getKbobMaterials(): Promise<KbobMaterial[]> {
  const response = await fetch(`${API_BASE_URL}/api/kbob/materials`);
  if (!response.ok) {
    throw new Error("Failed to fetch KBOB materials");
  }
  return response.json();
}

export async function confirmLCA(
  projectId: string,
  lcaData: LcaInstance[],
  materialMappings: Record<string, string>,
  ebfValue: number,
  materialDensities: Record<string, number>
): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/confirm-lca`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lcaData: {
            project: lcaData[0]?.project || projectId,
            filename: lcaData[0]?.filename || 'unknown',
            timestamp: new Date().toISOString(),
            fileId: lcaData[0]?.fileId || projectId,
            data: lcaData
          },
          materialMappings,
          ebfValue,
          materialDensities,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.success || false;
  } catch (error) {
    logger.error("Error confirming LCA:", error);
    return false;
  }
} 