import type { z } from "zod";
import type { GetCapabilitiesRequestSchema } from "./schemas";

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
export type GetCapabilitiesRequest = z.infer<typeof GetCapabilitiesRequestSchema>;

export interface GetCapabilitiesResponse {
  success: boolean;
  capabilities: Capability[];
  error?: string;
  count?: number;
}

export interface GetCapabilitiesBatchRequest {
  roleIds: string[];
}

export interface UserCapability {
  id: string;
  name: string;
  description: string;
  code?: string;
  level?: string;
  priority?: string;
  step?: number;
  totalLevels: number;
  currentLevel: number;
  status: string;
  progress: number;
}

export interface UserCapabilitiesResponse {
  success: boolean;
  capabilities: UserCapability[];
  count?: number;
  error?: string;
}

export interface GetCapabilitiesBatchResponse {
  success: boolean;
  capabilities: Record<string, Capability[]>;
  error?: string;
}

export interface CapabilityLevel {
  id: string;
  levelNumber: number;
  code: string;
  title: string;
  description: string;
  deliverables: string[];
  durationMinutes: number;
  difficulty: string;
  status: string;
}

export interface CapabilityLevelsResponse {
  success: boolean;
  capability: { id: string; code: string; name: string };
  levels: CapabilityLevel[];
  count?: number;
  error?: string;
}
