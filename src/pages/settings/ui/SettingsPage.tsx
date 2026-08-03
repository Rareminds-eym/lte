import type React from "react";
import { useRef, useState } from "react";
import {
  useAccountAction,
  useChangePassword,
  useSettingsProfile,
  useUpdateProfile,
} from "@/entities/settings";
import { RouteContentSkeleton, toast } from "@/shared/ui";

// ─── Section Icon Components ────────────────────────────────────────────────

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

// ─── Toggle Switch Component ────────────────────────────────────────────────

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked,
  onChange,
  label,
  description,
}) => (
  <div className="flex items-center justify-between py-3">
    <div className="flex-1">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-content-primary cursor-pointer"
      >
        {label}
      </label>
      <p className="text-xs text-content-secondary mt-0.5">{description}</p>
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
        checked ? "bg-brand-600" : "bg-content-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  </div>
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
  const { data: profile, isLoading, isError, refetch } = useSettingsProfile();
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();
  const accountActionMutation = useAccountAction();

  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // Section refs for scroll-into-view on tab click
  const profileRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);
  const dangerRef = useRef<HTMLDivElement>(null);

  // User edits for profile inputs (null means fallback to fetched DB profile data)
  const [fullNameOverride, setFullNameOverride] = useState<string | null>(null);
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const [programOverride, setProgramOverride] = useState<string | null>(null);
  const [gradeSemesterOverride, setGradeSemesterOverride] = useState<string | null>(null);

  const fullName = fullNameOverride ?? profile?.fullName ?? "";
  const phone = phoneOverride ?? profile?.phone ?? "";
  const program = programOverride ?? profile?.program ?? "";
  const gradeSemester = gradeSemesterOverride ?? profile?.gradeSemester ?? "";

  // Account & Security overrides
  const [twoFactorOverride, setTwoFactorOverride] = useState<boolean | null>(null);
  const [loginAlertsOverride, setLoginAlertsOverride] = useState<boolean | null>(null);

  const twoFactorEnabled = twoFactorOverride ?? profile?.twoFactorEnabled ?? false;
  const loginAlertsEnabled = loginAlertsOverride ?? profile?.loginAlertsEnabled ?? true;

  // Form state — Account & Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Danger zone confirmation modal
  const [confirmModal, setConfirmModal] = useState<"deactivate" | "delete" | null>(null);

  const handleToggleTwoFactor = (checked: boolean) => {
    setTwoFactorOverride(checked);
    updateProfileMutation.mutate(
      { twoFactorEnabled: checked },
      {
        onSuccess: () => {
          toast(`Two-Factor Authentication ${checked ? "enabled" : "disabled"}`);
          setTwoFactorOverride(null);
        },
        onError: (err) => {
          toast(err.message || "Failed to update Two-Factor settings");
          setTwoFactorOverride(null);
        },
      },
    );
  };

  const handleToggleLoginAlerts = (checked: boolean) => {
    setLoginAlertsOverride(checked);
    updateProfileMutation.mutate(
      { loginAlertsEnabled: checked },
      {
        onSuccess: () => {
          toast(`Login alerts ${checked ? "enabled" : "disabled"}`);
          setLoginAlertsOverride(null);
        },
        onError: (err) => {
          toast(err.message || "Failed to update Login alerts settings");
          setLoginAlertsOverride(null);
        },
      },
    );
  };

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
          setFullNameOverride(null);
          setPhoneOverride(null);
          setProgramOverride(null);
          setGradeSemesterOverride(null);
        },
        onError: (err) => {
          toast(err.message || "Failed to update profile");
        },
      },
    );
  };

  /** Handle Reset Profile form */
  const handleCancelProfile = () => {
    setFullNameOverride(null);
    setPhoneOverride(null);
    setProgramOverride(null);
    setGradeSemesterOverride(null);
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

  /** Handle Account Action (deactivate / delete) */
  const handleConfirmAccountAction = () => {
    if (!confirmModal) return;
    const action = confirmModal;
    accountActionMutation.mutate(
      { action },
      {
        onSuccess: (res) => {
          toast(res.message || `Account ${action}d successfully`);
          setConfirmModal(null);
        },
        onError: (err) => {
          toast(err.message || `Failed to ${action} account`);
          setConfirmModal(null);
        },
      },
    );
  };

  if (isLoading) {
    return <RouteContentSkeleton />;
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
    <div className="max-w-3xl mx-auto pb-12">
      {/* ─── Page Header ──────────────────────────────────────────────── */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-content-primary tracking-tight">Settings</h1>
        <p className="text-sm text-content-secondary mt-1">
          Manage your profile and account security. Changes are saved per section.
        </p>
      </header>

      {/* ─── Tab Navigation ───────────────────────────────────────────── */}
      <div
        className="flex gap-1 border-b border-line-default mb-8"
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
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
                tab.isDanger
                  ? isActive
                    ? "border-danger-500 text-danger-600"
                    : "border-transparent text-content-secondary hover:text-danger-500"
                  : isActive
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-content-secondary hover:text-content-primary"
              }`}
            >
              <span
                className={`${
                  tab.isDanger
                    ? isActive
                      ? "text-danger-500"
                      : "text-content-secondary"
                    : isActive
                      ? "text-brand-600"
                      : "text-content-secondary"
                }`}
              >
                {tab.icon}
              </span>
              {tab.label}
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
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${profile.profileStrength}%`,
                  background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── Profile Form Fields ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mb-6">
          {/* Full Name */}
          <div>
            <label
              htmlFor="settings-fullname"
              className="block text-xs font-semibold text-content-primary mb-1.5"
            >
              Full Name
            </label>
            <input
              id="settings-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullNameOverride(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm text-content-primary bg-white border border-line-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
            />
          </div>

          {/* Email Address */}
          <div>
            <label
              htmlFor="settings-email"
              className="block text-xs font-semibold text-content-primary mb-1.5"
            >
              Email Address
            </label>
            <input
              id="settings-email"
              type="email"
              value={profile.email}
              readOnly
              className="w-full px-3.5 py-2.5 text-sm text-content-secondary bg-surface-secondary border border-line-default rounded-lg cursor-not-allowed"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label
              htmlFor="settings-phone"
              className="block text-xs font-semibold text-content-primary mb-1.5"
            >
              Phone Number
            </label>
            <input
              id="settings-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhoneOverride(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm text-content-primary bg-white border border-line-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
            />
          </div>

          {/* Program */}
          <div>
            <label
              htmlFor="settings-program"
              className="block text-xs font-semibold text-content-primary mb-1.5"
            >
              Program
            </label>
            <input
              id="settings-program"
              type="text"
              value={program}
              onChange={(e) => setProgramOverride(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm text-content-primary bg-white border border-line-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
            />
          </div>

          {/* Grade / Semester */}
          <div>
            <label
              htmlFor="settings-grade"
              className="block text-xs font-semibold text-content-primary mb-1.5"
            >
              Grade / Semester
            </label>
            <input
              id="settings-grade"
              type="text"
              value={gradeSemester}
              onChange={(e) => setGradeSemesterOverride(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm text-content-primary bg-white border border-line-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
            />
          </div>

          {/* Learner ID (read-only) */}
          <div>
            <label
              htmlFor="settings-learnerid"
              className="block text-xs font-semibold text-content-primary mb-1.5"
            >
              Learner ID
            </label>
            <input
              id="settings-learnerid"
              type="text"
              value={profile.learnerId}
              readOnly
              className="w-full px-3.5 py-2.5 text-sm text-content-secondary bg-surface-secondary border border-line-default rounded-lg cursor-not-allowed"
            />
          </div>
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
          <button
            type="button"
            onClick={handleCancelProfile}
            className="px-5 py-2.5 text-sm font-semibold text-content-primary bg-white border border-line-default rounded-lg hover:bg-surface-secondary transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={updateProfileMutation.isPending}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
          </button>
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
          <label
            htmlFor="settings-current-password"
            className="block text-xs font-semibold text-content-primary mb-1.5"
          >
            Current Password
          </label>
          <input
            id="settings-current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••••"
            className="w-full max-w-sm px-3.5 py-2.5 text-sm text-content-primary bg-white border border-line-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
          />
        </div>

        {/* New Password + Confirm (2 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mb-2">
          <div>
            <label
              htmlFor="settings-new-password"
              className="block text-xs font-semibold text-content-primary mb-1.5"
            >
              New Password
            </label>
            <input
              id="settings-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3.5 py-2.5 text-sm text-content-primary bg-white border border-line-default rounded-lg placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
            />
          </div>
          <div>
            <label
              htmlFor="settings-confirm-password"
              className="block text-xs font-semibold text-content-primary mb-1.5"
            >
              Confirm New Password
            </label>
            <input
              id="settings-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 text-sm text-content-primary bg-white border border-line-default rounded-lg placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
            />
          </div>
        </div>
        <p className="text-xs text-content-muted italic mb-6">
          Minimum 8 characters, one number and one symbol.
        </p>

        {/* Toggle: Two-Factor Authentication */}
        <ToggleSwitch
          id="settings-2fa"
          checked={twoFactorEnabled}
          onChange={handleToggleTwoFactor}
          label="Two-Factor Authentication"
          description="Add an extra layer of security using an authenticator app or SMS."
        />

        {/* Divider */}
        <div className="border-t border-line-subtle my-1" />

        {/* Toggle: Login Alerts */}
        <ToggleSwitch
          id="settings-login-alerts"
          checked={loginAlertsEnabled}
          onChange={handleToggleLoginAlerts}
          label="Login Alerts"
          description="Get notified by email when a new device signs in to your account."
        />

        {/* Update Password Button */}
        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={handleUpdatePassword}
            disabled={changePasswordMutation.isPending}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
          >
            {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
          </button>
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
              These actions are permanent and cannot be undone
            </p>
          </div>
        </div>

        {/* Deactivate Account */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 border-b border-line-subtle">
          <div className="mb-3 sm:mb-0 flex-1 min-w-0 mr-4">
            <h3 className="text-sm font-bold text-content-primary">Deactivate Account</h3>
            <p className="text-xs text-content-secondary mt-0.5 leading-relaxed">
              Temporarily hide your profile and pause all notifications. You can reactivate anytime
              by logging back in.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmModal("deactivate")}
            className="px-5 py-2 text-sm font-semibold text-danger-600 bg-white border border-danger-300 rounded-lg hover:bg-danger-50 transition-colors cursor-pointer shrink-0"
          >
            Deactivate
          </button>
        </div>

        {/* Delete Account Permanently */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4">
          <div className="mb-3 sm:mb-0 flex-1 min-w-0 mr-4">
            <h3 className="text-sm font-bold text-content-primary">Delete Account Permanently</h3>
            <p className="text-xs text-content-secondary mt-0.5 leading-relaxed">
              Permanently delete your account, Skill Passport, certificates and learning history.
              This cannot be reversed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmModal("delete")}
            className="px-5 py-2 text-sm font-semibold text-white bg-danger-600 rounded-lg hover:bg-danger-700 transition-colors cursor-pointer shrink-0"
          >
            Delete Account
          </button>
        </div>
      </section>

      {/* ─── Confirmation Modal ─────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-line-default">
            <h3 className="text-lg font-bold text-content-primary mb-2">
              {confirmModal === "deactivate"
                ? "Deactivate Account?"
                : "Delete Account Permanently?"}
            </h3>
            <p className="text-xs text-content-secondary leading-relaxed mb-6">
              {confirmModal === "deactivate"
                ? "Your profile will be hidden and notifications paused. You can reactivate anytime by signing in again."
                : "This action is PERMANENT. All your certificates, learning progress, and Skill Passport history will be permanently deleted."}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-semibold text-content-primary bg-white border border-line-default rounded-lg hover:bg-surface-secondary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAccountAction}
                disabled={accountActionMutation.isPending}
                className="px-4 py-2 text-xs font-semibold text-white bg-danger-600 rounded-lg hover:bg-danger-700 disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
              >
                {accountActionMutation.isPending
                  ? "Processing..."
                  : confirmModal === "deactivate"
                    ? "Confirm Deactivation"
                    : "Confirm Permanent Deletion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
