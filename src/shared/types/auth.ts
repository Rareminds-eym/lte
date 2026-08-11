export type MembershipStatus = "active" | "inactive" | "suspended" | "expired";

export interface AuthUser {
  id: string;
  email: string;
  org_id: string;
  roles: string[];
  products: string[];
  membership_status: MembershipStatus;
  is_email_verified: boolean;
  user_metadata: Record<string, unknown>;
}

export interface AuthSuccessResponse {
  access_token: string;
  user: AuthUser;
  expires_in: number;
}

export interface MeResponse {
  user: AuthUser;
}

export interface RefreshResponse {
  access_token: string;
  expires_in: number;
}

export interface LogoutResponse {
  success: boolean;
}

export interface ActiveTrackRole {
  roleId: string;
  roleName: string;
  learningPathId: string;
  readinessScore: number;
  status: string;
  updatedAt: string;
}

export interface CareerTrackItem {
  id: string;
  title: string;
  matchPercentage?: number;
  isExplore?: boolean;
  isSelected?: boolean;
  fit?: string;
}

export interface ActiveTrackDetail {
  learningTrackId: string;
  track: string;
  fit: string;
  matchScore: number;
  whyItFits?: string;
  roles: ActiveTrackRole[];
  tracks?: CareerTrackItem[];
  overallProgress?: number;
  completionCount?: number;
}

export interface ActiveLearningPathResponse {
  success: boolean;
  data: ActiveTrackDetail | null;
  needsAssessment?: boolean;
}
