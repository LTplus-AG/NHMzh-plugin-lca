import axios, { AxiosInstance, AxiosResponse } from 'axios';
import logger from '../utils/logger';

// Store the auth token getter function
let getAuthToken: (() => Promise<string | null>) | null = null;

/**
 * Set the auth token getter function
 * This should be called once when the app initializes with authentication
 */
export const setAuthTokenGetter = (getter: () => Promise<string | null>) => {
  getAuthToken = getter;
};

/**
 * Create authenticated axios instance
 */
const createAuthenticatedAxios = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: process.env.NODE_ENV === 'production' 
      ? '/api' 
      : 'http://localhost:3003',
    timeout: 30000,
  });

  // Request interceptor to add auth token
  instance.interceptors.request.use(
    async (config) => {
      // Get the auth token
      const token = getAuthToken ? await getAuthToken() : null;
      
      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Log the request for debugging
      logger.debug(`Making authenticated request to: ${config.url}`);
      
      return config;
    },
    (error) => {
      logger.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle auth errors
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    (error) => {
      if (error.response?.status === 401) {
        logger.warn('Received 401 Unauthorized response');
        // The auth provider should handle token refresh or re-login
      } else if (error.response?.status === 403) {
        logger.warn('Received 403 Forbidden response - insufficient permissions');
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

/**
 * Authenticated LCA API Client
 */
export class AuthenticatedLCAApiClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = createAuthenticatedAxios();
  }

  /**
   * Get list of projects filtered by user permissions
   * @returns List of project names the user has access to
   */
  async getProjects(): Promise<string[]> {
    try {
      const response = await this.axiosInstance.get('/projects');
      logger.info(`User has access to ${response.data.length} projects`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        logger.error('Access denied to projects list');
        throw new Error('You don\'t have permission to access projects');
      }
      logger.error('Error fetching projects:', error);
      throw error;
    }
  }

  /**
   * Get LCA calculations for a specific project
   * @param projectId - The ID of the project
   * @returns LCA calculation data
   */
  async getLCACalculations(projectId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/projects/${encodeURIComponent(projectId)}/lca`);
      logger.info(`Successfully retrieved LCA calculations for project: ${projectId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        logger.error(`Access denied to project: ${projectId}`);
        throw new Error(`You don't have permission to access project: ${projectId}`);
      }
      logger.error(`Error fetching LCA calculations for project '${projectId}':`, error);
      throw error;
    }
  }

  /**
   * Save LCA calculations for a project
   * @param projectId - The ID of the project
   * @param calculations - The LCA calculation data
   * @returns Response with operation status
   */
  async saveLCACalculations(projectId: string, calculations: any): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        `/projects/${encodeURIComponent(projectId)}/lca`,
        calculations
      );
      logger.info(`Successfully saved LCA calculations for project: ${projectId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error(`You don't have permission to modify LCA data for project: ${projectId}`);
      }
      logger.error(`Error saving LCA calculations for project '${projectId}':`, error);
      throw error;
    }
  }

  /**
   * Get KBOB indicators
   * @returns KBOB indicator data
   */
  async getKBOBIndicators(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/kbob/indicators');
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching KBOB indicators:', error);
      throw error;
    }
  }

  /**
   * Get EBKP classifications
   * @returns EBKP classification data
   */
  async getEBKPClassifications(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/ebkp/classifications');
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching EBKP classifications:', error);
      throw error;
    }
  }

  /**
   * Export LCA results to Excel
   * @param projectId - The ID of the project
   * @param format - Export format ('xlsx' or 'csv')
   * @returns Blob data for download
   */
  async exportLCAResults(projectId: string, format: 'xlsx' | 'csv' = 'xlsx'): Promise<Blob> {
    try {
      const response = await this.axiosInstance.get(
        `/projects/${encodeURIComponent(projectId)}/lca/export`,
        {
          params: { format },
          responseType: 'blob'
        }
      );
      logger.info(`Successfully exported LCA results for project: ${projectId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error(`You don't have permission to export LCA data for project: ${projectId}`);
      }
      logger.error(`Error exporting LCA results for project '${projectId}':`, error);
      throw error;
    }
  }

  /**
   * Delete LCA calculations for a project
   * @param projectId - The ID of the project
   * @returns Response with operation status
   */
  async deleteLCACalculations(projectId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.delete(
        `/projects/${encodeURIComponent(projectId)}/lca`
      );
      logger.info(`Successfully deleted LCA calculations for project: ${projectId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error(`You don't have permission to delete LCA data for project: ${projectId}`);
      }
      logger.error(`Error deleting LCA calculations for project '${projectId}':`, error);
      throw error;
    }
  }

  /**
   * Get project materials and quantities from QTO service
   * @param projectId - The ID of the project
   * @returns Material and quantity data
   */
  async getProjectMaterials(projectId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/projects/${encodeURIComponent(projectId)}/materials`);
      logger.info(`Successfully retrieved materials for project: ${projectId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        logger.error(`Access denied to project materials: ${projectId}`);
        throw new Error(`You don't have permission to access materials for project: ${projectId}`);
      }
      logger.error(`Error fetching materials for project '${projectId}':`, error);
      throw error;
    }
  }

  /**
   * Health check endpoint
   * @returns Health status of the API
   */
  async getHealth(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/health');
      return response.data;
    } catch (error: any) {
      logger.error('Health check failed:', error);
      throw error;
    }
  }
}

// Create and export a default authenticated instance
const authenticatedLCAApiClient = new AuthenticatedLCAApiClient();
export default authenticatedLCAApiClient;
