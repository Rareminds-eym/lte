export interface SettingsProfile {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  program: string;
  gradeSemester: string;
  learnerId: string;
  college: string;
  section: string;
  skillPassportVerified: boolean;
  twoFactorEnabled: boolean;
  loginAlertsEnabled: boolean;
  profileStrength: number;
}

export interface UpdateProfilePayload {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  program?: string;
  gradeSemester?: string;
  college?: string;
  section?: string;
  twoFactorEnabled?: boolean;
  loginAlertsEnabled?: boolean;
}

export interface SettingsProfileResponse {
  success: boolean;
  profile: SettingsProfile;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface AccountActionPayload {
  action: "deactivate";
}
