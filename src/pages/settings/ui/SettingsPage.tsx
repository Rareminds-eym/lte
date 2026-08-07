import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useRef, useState } from "react";
import { useAuthStore } from "@/entities/session";
import {
  useAccountAction,
  useChangePassword,
  useSettingsProfile,
  useUpdateProfile,
} from "@/entities/settings";
import { Button, TextField, ToggleSwitch, toast } from "@/shared/ui";
import { SettingsPageSkeleton } from "./SettingsPageSkeleton";

// ─── Section Icon Components ────────────────────────────────────────────────

/** Settings gear icon for page header */
const SettingsHeaderIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-5 h-5 text-brand-600"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/** Person icon for Profile section header */
const ProfileIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/** Lock/shield icon for Account & Security section header */
const SecurityIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/** Warning triangle icon for Danger Zone section header */
const WarningIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/** Camera icon for avatar edit overlay */
const CameraIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

/** Graduation cap icon for institution info */
const GraduationIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-4 h-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 10 3 12 0v-5" />
  </svg>
);

/** Checkmark icon for verified badge */
const CheckIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─── Tab Button Types ───────────────────────────────────────────────────────

type TabId = "profile" | "account-security" | "danger-zone";

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  isDanger?: boolean;
}

const TABS: TabConfig[] = [
  { id: "profile", label: "Profile", icon: <ProfileIcon /> },
  { id: "account-security", label: "Account & Security", icon: <SecurityIcon /> },
  { id: "danger-zone", label: "Danger Zone", icon: <WarningIcon />, isDanger: true },
];

// ─── Main Settings Page ─────────────────────────────────────────────────────

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError, refetch } = useSettingsProfile();
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();
  const accountActionMutation = useAccountAction();

  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // Section refs for scroll-into-view on tab click
  const profileRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);
  const dangerRef = useRef<HTMLDivElement>(null);

  // User edits for profile inputs (overrides fetched DB profile data)
  const [profileEdits, setProfileEdits] = useState<Record<string, string>>({});

  const fullName = profileEdits["fullName"] ?? profile?.fullName ?? "";
  const phone = profileEdits["phone"] ?? profile?.phone ?? "";
  const program = profileEdits["program"] ?? profile?.program ?? "";
  const gradeSemester = profileEdits["gradeSemester"] ?? profile?.gradeSemester ?? "";

  // Form state — Account & Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Danger zone confirmation modal
  const [confirmModal, setConfirmModal] = useState<"deactivate" | null>(null);

  /** Handle tab click — scroll to matching section */
  const handleTabClick = (tabId: TabId) => {
    setActiveTab(tabId);
    const refMap: Record<TabId, React.RefObject<HTMLDivElement | null>> = {
      profile: profileRef,
      "account-security": securityRef,
      "danger-zone": dangerRef,
    };
    refMap[tabId]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** Handle Save Profile submit */
  const handleSaveProfile = () => {
    updateProfileMutation.mutate(
      {
        fullName,
        phone,
        program,
        gradeSemester,
      },
      {
        onSuccess: () => {
          toast("Profile updated successfully!");
          setProfileEdits({});
        },
        onError: (err) => {
          toast(err.message || "Failed to update profile");
        },
      },
    );
  };

  /** Handle Reset Profile form */
  const handleCancelProfile = () => {
    setProfileEdits({});
  };

  /** Handle Change Password submit */
  const handleUpdatePassword = () => {
    if (!currentPassword) {
      toast("Please enter your current password");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("New password and confirm password do not match");
      return;
    }

    changePasswordMutation.mutate(
      {
        current_password: currentPassword,
        new_password: newPassword,
      },
      {
        onSuccess: (res) => {
          toast(res.message || "Password updated successfully!");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (err) => {
          toast(err.message || "Failed to update password");
        },
      },
    );
  };

  /** Handle Account Action (deactivate) */
  const handleConfirmAccountAction = () => {
    if (!confirmModal) return;
    const action = confirmModal;
    accountActionMutation.mutate(
      { action },
      {
        onSuccess: async (res) => {
          toast(res.message || "Account deactivated successfully");
          setConfirmModal(null);
          queryClient.clear();
          await useAuthStore.getState().logout();
        },
        onError: (err) => {
          toast(err.message || "Failed to deactivate account");
          setConfirmModal(null);
        },
      },
    );
  };

  if (isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (isError || !profile) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-line-default max-w-lg mx-auto my-12 shadow-sm">
        <h2 className="text-lg font-bold text-content-primary mb-2">Unable to load Settings</h2>
        <p className="text-xs text-content-secondary mb-4">
          There was an error loading your settings profile from the database. Please try again.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 bg-brand-600 text-white font-semibold text-xs rounded-lg hover:bg-brand-700 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  // Derive initials for avatar
  const initials = profile.fullName
    ? profile.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "RA";

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* ─── Page Header ──────────────────────────────────────────────── */}
      <header>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 mt-1">
              <SettingsHeaderIcon />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-content-primary leading-tight">Settings</h1>
              <p className="text-sm text-content-secondary mt-0.5">
                Manage your profile information, account security, and notification preferences.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Tab Navigation ───────────────────────────────────────────── */}
      <div
        className="flex items-center gap-6 border-b border-line-default"
        role="tablist"
        aria-label="Settings sections"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`section-${tab.id}`}
              onClick={() => handleTabClick(tab.id)}
              className={`relative pb-3 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
                tab.isDanger
                  ? isActive
                    ? "text-danger-600 font-semibold"
                    : "text-content-secondary hover:text-danger-600"
                  : isActive
                    ? "text-brand-600 font-semibold"
                    : "text-content-secondary hover:text-content-primary"
              }`}
            >
              <span
                className={`${
                  tab.isDanger
                    ? isActive
                      ? "text-danger-600"
                      : "text-content-secondary"
                    : isActive
                      ? "text-brand-600"
                      : "text-content-secondary"
                }`}
              >
                {tab.icon}
              </span>
              {tab.label}
              {isActive && (
                <span
                  className={`absolute -bottom-px left-0 right-0 h-0.5 rounded-full z-10 ${
                    tab.isDanger ? "bg-danger-600" : "bg-brand-600"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Section 1: Profile ──────────────────────────────────────── */}
      <section
        ref={profileRef}
        id="section-profile"
        aria-labelledby="heading-profile"
        className="bg-white rounded-2xl border border-line-default p-6 md:p-8 mb-8"
      >
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-600">
            <ProfileIcon />
          </span>
          <div>
            <h2 id="heading-profile" className="text-base font-bold text-content-primary">
              Profile
            </h2>
            <p className="text-xs text-content-secondary">Your personal and academic information</p>
          </div>
        </div>

        {/* ─── Avatar + Info Banner ─────────────────────────────────── */}
        <div className="bg-surface-secondary rounded-xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-white text-xl font-bold select-none">
              {initials}
            </div>
            <button
              type="button"
              aria-label="Change profile photo"
              className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-brand-600 border-2 border-white flex items-center justify-center text-white cursor-pointer hover:bg-brand-700 transition-colors"
            >
              <CameraIcon />
            </button>
          </div>

          {/* Name + Meta */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-content-primary truncate">
              {profile.fullName || "Learner"}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-content-secondary mt-0.5">
              <GraduationIcon />
              <span>
                {[profile.college, profile.program, profile.section].filter(Boolean).join(" · ") ||
                  "Learner Profile"}
              </span>
            </div>
          </div>

          {/* Profile Strength */}
          <div className="shrink-0 w-40">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-content-secondary">Profile Strength</span>
              <span className="text-xs font-bold text-success-600">{profile.profileStrength}%</span>
            </div>
            <div className="w-full h-2 bg-surface-emphasis rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-success-500 to-success-400"
                style={{ width: `${profile.profileStrength}%` }}
              />
            </div>
          </div>
        </div>

        {/* ─── Profile Form Fields ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mb-6">
          {/* Full Name */}
          <TextField
            id="settings-fullname"
            label="Full Name"
            type="text"
            value={fullName}
            onChange={(e) => setProfileEdits((prev) => ({ ...prev, fullName: e.target.value }))}
          />

          {/* Email Address */}
          <TextField
            id="settings-email"
            label="Email Address"
            type="email"
            value={profile.email}
            readOnly
          />

          {/* Phone Number */}
          <TextField
            id="settings-phone"
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setProfileEdits((prev) => ({ ...prev, phone: e.target.value }))}
          />

          {/* Program */}
          <TextField
            id="settings-program"
            label="Program"
            type="text"
            value={program}
            onChange={(e) => setProfileEdits((prev) => ({ ...prev, program: e.target.value }))}
          />

          {/* Grade / Semester */}
          <TextField
            id="settings-grade"
            label="Grade / Semester"
            type="text"
            value={gradeSemester}
            onChange={(e) =>
              setProfileEdits((prev) => ({ ...prev, gradeSemester: e.target.value }))
            }
          />

          {/* Learner ID (read-only) */}
          <TextField
            id="settings-learnerid"
            label="Learner ID"
            type="text"
            value={profile.learnerId}
            readOnly
          />
        </div>

        {/* ─── Info Badges / Pills ─────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-content-primary bg-surface-secondary border border-line-default rounded-lg">
            College: <span className="font-bold">{profile.college || "N/A"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-content-primary bg-surface-secondary border border-line-default rounded-lg">
            Section: <span className="font-bold">{profile.section || "N/A"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-content-primary bg-surface-secondary border border-line-default rounded-lg">
            <CheckIcon />
            Skill Passport:{" "}
            <span className="font-bold">
              {profile.skillPassportVerified ? "Verified" : "Pending"}
            </span>
          </span>
        </div>

        {/* ─── Profile Action Buttons ──────────────────────────────── */}
        <div className="flex justify-end gap-3">
          <Button type="button" onClick={handleCancelProfile} variant="outline" size="md">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSaveProfile}
            disabled={updateProfileMutation.isPending}
            variant="primary"
            size="md"
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </section>

      {/* ─── Section 2: Account & Security ───────────────────────────── */}
      <section
        ref={securityRef}
        id="section-account-security"
        aria-labelledby="heading-security"
        className="bg-white rounded-2xl border border-line-default p-6 md:p-8 mb-8"
      >
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-600">
            <SecurityIcon />
          </span>
          <div>
            <h2 id="heading-security" className="text-base font-bold text-content-primary">
              Account & Security
            </h2>
            <p className="text-xs text-content-secondary">
              Manage your password and account protection
            </p>
          </div>
        </div>

        {/* Current Password */}
        <div className="mb-5">
          <TextField
            id="settings-current-password"
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••••"
          />
        </div>

        {/* New Password + Confirm (2 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mb-2">
          <TextField
            id="settings-new-password"
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />
          <TextField
            id="settings-confirm-password"
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
          />
        </div>
        <p className="text-xs text-content-muted italic mb-6">
          Minimum 8 characters, one number and one symbol.
        </p>

        {/* Toggle: Two-Factor Authentication */}
        <ToggleSwitch
          id="settings-2fa"
          checked={false}
          onChange={() => toast("Two-Factor Authentication is coming soon")}
          label="Two-Factor Authentication"
          description="Add an extra layer of security using an authenticator app or SMS."
          comingSoon
        />

        {/* Divider */}
        <div className="border-t border-line-subtle my-1" />

        {/* Toggle: Login Alerts */}
        <ToggleSwitch
          id="settings-login-alerts"
          checked={false}
          onChange={() => toast("Login Alerts is coming soon")}
          label="Login Alerts"
          description="Get notified by email when a new device signs in to your account."
          comingSoon
        />

        {/* Update Password Button */}
        <div className="flex justify-end mt-6">
          <Button
            type="button"
            onClick={handleUpdatePassword}
            disabled={changePasswordMutation.isPending}
            variant="primary"
            size="md"
          >
            {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </section>

      {/* ─── Section 3: Danger Zone ──────────────────────────────────── */}
      <section
        ref={dangerRef}
        id="section-danger-zone"
        aria-labelledby="heading-danger"
        className="bg-white rounded-2xl border border-danger-200 p-6 md:p-8"
      >
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-danger-50 text-danger-500">
            <WarningIcon />
          </span>
          <div>
            <h2 id="heading-danger" className="text-base font-bold text-danger-600">
              Danger Zone
            </h2>
            <p className="text-xs text-content-secondary">
              Deactivation is temporary — you can reactivate anytime by signing back in.
            </p>
          </div>
        </div>

        {/* Deactivate Account */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4">
          <div className="mb-3 sm:mb-0 flex-1 min-w-0 mr-4">
            <h3 className="text-sm font-bold text-content-primary">Deactivate Account</h3>
            <p className="text-xs text-content-secondary mt-0.5 leading-relaxed">
              Temporarily hide your profile and pause all notifications. You can reactivate anytime
              by logging back in.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setConfirmModal("deactivate")}
            variant="outline"
            size="sm"
            className="text-danger-600 border-danger-300 hover:bg-danger-50 shrink-0"
          >
            Deactivate
          </Button>
        </div>
      </section>

      {/* ─── Confirmation Modal ─────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-line-default">
            <h3 className="text-lg font-bold text-content-primary mb-2">Deactivate Account?</h3>
            <p className="text-xs text-content-secondary leading-relaxed mb-6">
              Your profile will be hidden and notifications paused. You can reactivate anytime by
              signing in again.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => setConfirmModal(null)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAccountAction}
                disabled={accountActionMutation.isPending}
                variant="primary"
                size="sm"
                className="bg-danger-600 hover:bg-danger-700 text-white"
              >
                {accountActionMutation.isPending ? "Processing..." : "Confirm Deactivation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
