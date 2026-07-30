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

export interface ActiveLearningPath {
  learningPathId: string;
  learningTrackId: string;
  roleId: string;
  track: string;
  fit: string;
  matchScore: number;
}

export interface ActiveLearningPathResponse {
  success: boolean;
  data: ActiveLearningPath | null;
}
