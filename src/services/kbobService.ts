import { KbobMaterial } from "../types/lca.types";
import logger from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8002";

export const kbobService = {
  async getAllMaterials(): Promise<KbobMaterial[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/kbob/materials`);
      if (!response.ok) {
        throw new Error(`Failed to fetch materials: ${response.statusText}`);
      }
      const materials = await response.json();
      return materials;
    } catch (error) {
      logger.error("Failed to fetch KBOB materials from API:", error);
      return [];
    }
  },

  async getMaterialById(id: string): Promise<KbobMaterial | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/kbob/materials/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch material: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      logger.error("Failed to fetch KBOB material by ID:", error);
      return null;
    }
  },

  async searchMaterials(query: string): Promise<KbobMaterial[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/kbob/materials/search?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error(`Failed to search materials: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      logger.error("Failed to search KBOB materials:", error);
      return [];
    }
  },
};
