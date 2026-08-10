import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authLogger } from "../shared/logger";
import type { SsoSubscriptionSnapshot } from "./types";

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  status: "active" | "inactive" | "suspended" | "deleted";
  last_activity_at: string;
  metadata: Record<string, unknown>;
  updated_at: string;
}

interface SubscriptionCacheRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  plan_id: string | null;
  plan_code: string | null;
  plan_name: string | null;
  plan_type: string | null;
  plan_amount: number | null;
  billing_cycle: string | null;
  status: string;
  features: unknown[];
  product_code: string;
  product_id: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  synced_at: string;
  auth_updated_at: string | null;
}

function getTrimmedMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function syncUsers(supabase: SupabaseClient, user: AuthUser): Promise<void> {
  const metadata = user.user_metadata ?? {};
  const email = user.email.trim().toLowerCase();
  const emailPrefix = email.split("@")[0] || "User";
  const fullName =
    getTrimmedMetadataString(metadata, "full_name") ?? getTrimmedMetadataString(metadata, "name");

  const firstName =
    getTrimmedMetadataString(metadata, "first_name") ??
    getTrimmedMetadataString(metadata, "firstName") ??
    getTrimmedMetadataString(metadata, "given_name") ??
    (fullName ? fullName.split(" ")[0] : null) ??
    emailPrefix;

  const lastName =
    getTrimmedMetadataString(metadata, "last_name") ??
    getTrimmedMetadataString(metadata, "lastName") ??
    getTrimmedMetadataString(metadata, "family_name") ??
    (fullName?.includes(" ") ? fullName.split(" ").slice(1).join(" ") : null) ??
    "User";

  const phone =
    getTrimmedMetadataString(metadata, "phone") ??
    getTrimmedMetadataString(metadata, "phone_number") ??
    getTrimmedMetadataString(metadata, "phoneNumber");

  const now = new Date().toISOString();
  const enrichedMetadata = {
    ...metadata,
    firstName,
    lastName,
    phone,
  };

  const row: UserRow = {
    id: user.sub,
    email,
    first_name: firstName,
    last_name: lastName,
    phone,
    status: "active",
    last_activity_at: now,
    metadata: enrichedMetadata,
    updated_at: now,
  };

  const { error } = await supabase.from("users").upsert(row, { onConflict: "id" });
  if (error) {
    authLogger.error("Failed to sync users table", error, { userId: user.sub, email });
    throw new Error(`Failed to sync users: ${error.message}`);
  }

  authLogger.info("Successfully synced user to public.users", {
    userId: user.sub,
    email,
    firstName,
    lastName,
  });
}

export const syncUsersShadow = syncUsers;

export async function syncSubscriptionCache(
  supabase: SupabaseClient,
  subscription: SsoSubscriptionSnapshot | null,
): Promise<void> {
  if (!subscription) {
    authLogger.debug("No subscription to sync");
    return;
  }

  let planAmount: number | null = null;
  if (typeof subscription.plan_amount === "number") {
    planAmount = subscription.plan_amount;
  } else if (typeof subscription.plan_amount === "string") {
    const parsed = Number.parseFloat(subscription.plan_amount);
    planAmount = Number.isFinite(parsed) ? parsed : null;
  }

  const row: SubscriptionCacheRow = {
    id: subscription.id,
    user_id: subscription.user_id,
    organization_id: subscription.organization_id ?? null,
    plan_id: subscription.plan_id ?? null,
    plan_code: subscription.plan_code ?? null,
    plan_name: subscription.plan_name ?? null,
    plan_type: subscription.plan_type ?? null,
    plan_amount: planAmount,
    billing_cycle: subscription.billing_cycle ?? null,
    status: subscription.status || "active",
    features: Array.isArray(subscription.features) ? subscription.features : [],
    product_code: subscription.product_code || "lte",
    product_id: subscription.product_id ?? null,
    subscription_start_date: subscription.subscription_start_date ?? null,
    subscription_end_date: subscription.subscription_end_date ?? null,
    synced_at: new Date().toISOString(),
    auth_updated_at: subscription.updated_at ?? null,
  };

  const { error } = await supabase.from("subscription_cache").upsert(row, { onConflict: "id" });
  if (error) {
    authLogger.error("Failed to sync subscription_cache", error, {
      subscriptionId: subscription.id,
      userId: subscription.user_id,
      errorCode: error.code,
      errorDetails: error.details,
    });
    throw new Error(`Failed to sync subscription_cache: ${error.message}`);
  }

  authLogger.info("Successfully synced subscription cache", {
    subscriptionId: subscription.id,
    userId: subscription.user_id,
    planName: subscription.plan_name,
  });
}

export async function syncSsoShadowData(
  supabase: SupabaseClient,
  user: AuthUser,
  subscription: SsoSubscriptionSnapshot | null,
): Promise<void> {
  // 1. Check if user record already exists in LTE DB
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.sub)
    .maybeSingle();
  if (!existingUser) {
    authLogger.info("[Option 1 Applied] User data not found in LTE DB. Provisioning...", {
      userId: user.sub,
    });
    await syncUsers(supabase, user);
  } else {
    authLogger.info("[Option 2 Applied] User already exists in LTE DB. Skipping user sync.", {
      userId: user.sub,
    });
  }

  // 2. Check if subscription_cache record already exists in LTE DB
  if (subscription) {
    const { data: existingSub } = await supabase
      .from("subscription_cache")
      .select("id")
      .eq("id", subscription.id)
      .maybeSingle();
    if (!existingSub) {
      authLogger.info(
        "[Option 1 Applied] Subscription cache not found in LTE DB. Provisioning...",
        { subscriptionId: subscription.id },
      );
      await syncSubscriptionCache(supabase, subscription);
    } else {
      authLogger.info(
        "[Option 2 Applied] Subscription cache already exists in LTE DB. Skipping subscription sync.",
        { subscriptionId: subscription.id },
      );
    }
  }
}
