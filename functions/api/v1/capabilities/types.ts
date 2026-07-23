// Domain Models
export interface Capability {
  id: string;
  name: string;
  description: string;
  code?: string;
  level?: string;
  priority?: string;
  step?: number;
}

// Database Models
export interface CapabilityRow {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface RoleCapabilitySequenceRow {
  id: string;
  sequence_step: number;
  required_level: string | null;
  capability_priority: string | null;
  capabilities: CapabilityRow | CapabilityRow[];
}

// Request/Response Models
export interface GetCapabilitiesRequest {
  roleId: string;
}

export interface GetCapabilitiesResponse {
  success: boolean;
  capabilities: Capability[];
  error?: string;
  count?: number;
}

export interface GetCapabilitiesBatchRequest {
  roleIds: string[];
}

export interface GetCapabilitiesBatchResponse {
  success: boolean;
  capabilities: Record<string, Capability[]>;
  error?: string;
}
