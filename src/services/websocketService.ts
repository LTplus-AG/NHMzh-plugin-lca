// HTTP-based service for LCA plugin
// Replaces WebSocket with REST API calls following best practices

// API base URL from environment or default
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8002";

// Validate API_URL format
function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Ensure it's HTTP or HTTPS protocol
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Validate the API URL and use a safe fallback if invalid
const VALIDATED_API_URL = (() => {
  if (validateUrl(API_URL)) {
    return API_URL;
  }
  console.error(`Invalid API URL: ${API_URL}. Falling back to default.`);
  return "http://localhost:8002";
})();

// Use VALIDATED_API_URL for all API calls
const API_BASE = VALIDATED_API_URL;

// Connection status enum
export enum ConnectionStatus {
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  ERROR = "ERROR",
}

// Project data interface
export interface ProjectData {
  projectId: string;
  name: string;
  metadata: {
    filename: string;
    upload_timestamp: string;
  };
  ifcData: {
    materials?: {
      name: string;
      volume: number;
    }[];
    elements?: {
      id: string;
      element_type: string;
      quantity: number;
      properties: {
        level?: string;
        is_structural?: boolean;
        is_external?: boolean;
      };
      materials: {
        name: string;
        volume: number;
        unit: string;
      }[];
      impact?: {
        gwp: number;
        ubp: number;
        penr: number;
      };
    }[];
    totalImpact?: {
      gwp: number;
      ubp: number;
      penr: number;
    };
  };
  materialMappings: Record<string, string>;
  ebf?: number | null;
}

// Connection status (simulated for backward compatibility)
let connectionStatus: ConnectionStatus = ConnectionStatus.CONNECTED;

// Event handlers
const statusChangeHandlers: ((status: ConnectionStatus) => void)[] = [];

/**
 * Initialize connection (simulated for backward compatibility)
 */
export async function initWebSocket(): Promise<void> {
  try {
    // Test API connectivity
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      connectionStatus = ConnectionStatus.CONNECTED;
      notifyStatusChange(connectionStatus);
    } else {
      connectionStatus = ConnectionStatus.ERROR;
      notifyStatusChange(connectionStatus);
    }
  } catch (error) {
    console.error("Failed to connect to API:", error);
    connectionStatus = ConnectionStatus.ERROR;
    notifyStatusChange(connectionStatus);
  }
}

/**
 * Notify all status change handlers
 */
function notifyStatusChange(status: ConnectionStatus) {
  statusChangeHandlers.forEach((handler) => {
    try {
      handler(status);
    } catch (error) {
      console.error("Error in status change handler:", error);
    }
  });
}

/**
 * Register a status change handler
 */
export function onStatusChange(handler: (status: ConnectionStatus) => void) {
  statusChangeHandlers.push(handler);
  handler(connectionStatus);
  return () => {
    const index = statusChangeHandlers.indexOf(handler);
    if (index !== -1) {
      statusChangeHandlers.splice(index, 1);
    }
  };
}

/**
 * Register a message handler (deprecated - kept for compatibility)
 */
export function onMessage(handler: (data: any) => void) {
  // No-op for compatibility
  return () => {};
}

/**
 * Get project materials from the server
 */
export async function getProjectMaterials(projectId: string): Promise<ProjectData> {
  try {
    console.log(`[getProjectMaterials] Fetching materials for project: ${projectId}`);
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/materials`);
    
    console.log(`[getProjectMaterials] Response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[getProjectMaterials] Response data:`, data);
    return data;
  } catch (error) {
    console.error(`[getProjectMaterials] Error getting project materials for ${projectId}:`, error);
    throw error;
  }
}

/**
 * Save project materials to the server
 */
export async function saveProjectMaterials(
  projectId: string,
  data: {
    materialMappings: Record<string, string>;
    ebfValue?: string;
  }
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/materials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        materialMappings: data.materialMappings,
        ebfValue: data.ebfValue,
      }),
    });
    
    if (response.status === 413) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Request payload too large. Please contact support if this persists.');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        // If not JSON, use the text
        if (errorText) {
          errorMessage = errorText;
        }
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('Project materials saved successfully:', result);
  } catch (error) {
    console.error(`Error saving project materials for ${projectId}:`, error);
    throw error;
  }
}

/**
 * Get available projects from the server
 */
export async function getProjects(): Promise<{ id: string; name: string }[]> {
  try {
    console.log(`[getProjects] Fetching projects from: ${API_BASE}/api/projects`);
    const response = await fetch(`${API_BASE}/api/projects`);
    
    console.log(`[getProjects] Response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[getProjects] Response data:`, data);
    return data.projects || [];
  } catch (error) {
    console.error("[getProjects] Error getting projects:", error);
    throw error;
  }
}

/**
 * Check if connected (always returns true for HTTP)
 */
export function isConnected(): boolean {
  return connectionStatus === ConnectionStatus.CONNECTED;
}

/**
 * Get the current connection status
 */
export function getConnectionStatus(): ConnectionStatus {
  return connectionStatus;
}

/**
 * Send test Kafka message (via HTTP)
 */
export function sendTestKafkaMessage() {
  return fetch(`${API_BASE}/api/test-kafka`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messageId: `test_kafka_${Date.now()}`,
    }),
  }).then(response => response.json());
}

/**
 * Get WebSocket instance (deprecated - returns null)
 */
export function getWebSocket(): WebSocket | null {
  return null;
}

/**
 * Send request (deprecated - for compatibility)
 */
export function sendRequest(type: string, data: any, timeout?: number): Promise<any> {
  // Map old WebSocket request types to HTTP endpoints
  switch (type) {
    case 'get_project_materials':
      return getProjectMaterials(data.projectId);
    case 'save_project_materials':
      return saveProjectMaterials(data.projectId, data);
    case 'get_projects':
      return getProjects().then(projects => ({ projects }));
    case 'send_test_kafka':
      return sendTestKafkaMessage();
    default:
      return Promise.reject(new Error(`Unknown request type: ${type}`));
  }
}
