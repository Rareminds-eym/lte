# LTE SSO Implementation Plan

## Goal

Implement the `SkillPassport -> LTE -> Dashboard` flow using SSO as the source of truth, authorization code handoff, LTE host-only refresh cookie, in-memory LTE access token, and only two local SSO-backed LTE tables.

## Final Flow

1. User is authenticated in SkillPassport.
2. User clicks `Go to LTE`.
3. SkillPassport backend asks SSO for a one-time LTE authorization code.
4. Browser navigates to LTE with `code` and `state`.
5. LTE frontend posts `code`, `state`, and `redirectUri` to LTE backend.
6. LTE backend exchanges the code through SSO RPC.
7. SSO validates and consumes the code, then returns LTE access token, LTE refresh token, and user claims.
8. LTE backend sets `__Host-lte_refresh` as an HttpOnly host-only cookie.
9. LTE backend syncs only `users_shadow` and `subscription_cache`.
10. LTE frontend stores access token and user in Zustand.
11. LTE frontend redirects to `/dashboard`.

## LTE Local Tables

`users_shadow` - Local reference row for the SSO user so LTE domain tables can safely reference `user_id`.

`subscription_cache` - Read-only local snapshot of the user subscription/product entitlement needed for LTE feature access.

## Data Sync

`SSO users -> LTE users_shadow` - Sync `id`, `email`, `is_email_verified`, and minimal profile metadata needed by LTE.

`SSO subscription/product entitlement -> LTE subscription_cache` - Sync active plan, product, status, features, and expiry needed by LTE access checks.

`SSO JWT claims -> LTE Zustand state` - Use verified claims for current user, roles, products, org, and membership status.

## Tables Not Required

`lte_memberships` - Not needed because membership status and org come from SSO claims.

`lte_roles` - Not needed because runtime roles come from the verified SSO/LTE JWT.

`lte_products` - Not needed because product access comes from JWT claims and subscription cache.

`lte_sessions` - Not needed in LTE DB because refresh-token session truth remains in SSO.

## LTE Files To Create

`wrangler.toml` - Configure LTE Pages Functions, `SSO_SERVICE` binding, Supabase vars, and compatibility settings.

`functions/api/auth/sso/exchange.ts` - Exchange `code + state` with SSO, set LTE refresh cookie, sync local cache rows, and return access token plus user.

`functions/api/auth/me.ts` - Return the current LTE user from the verified LTE access token.

`functions/api/auth/refresh.ts` - Refresh LTE access token using the `__Host-lte_refresh` cookie through SSO.

`functions/api/auth/logout.ts` - Clear the LTE refresh cookie and revoke the SSO-backed LTE refresh session.

`functions/lib/sso-client.ts` - Typed wrapper for LTE calls to SSO RPC methods.

`functions/lib/cookies.ts` - Build and clear `__Host-lte_refresh` cookie consistently.

`functions/lib/supabase.ts` - Create the server-side Supabase client for LTE cache sync.

`functions/lib/sync-shadow.ts` - Sync `users_shadow` and `subscription_cache` from SSO exchange data.

`functions/lib/auth.ts` - Verify LTE access token and produce backend auth context.

`src/shared/api/authApi.ts` - Call LTE auth endpoints from the frontend.

`src/app/store/authStore.ts` - Zustand store for LTE access token, user, auth status, loading, refresh, logout, and initialization.

`src/pages/auth/SSOCallback.tsx` - Read `code + state`, call LTE exchange endpoint, update auth store, and redirect to dashboard.

`src/app/router/guards/ProtectedRoute.tsx` - Protect dashboard routes using LTE auth store state.

`src/app/router/AppRouter.tsx` - Add `/auth/callback`, `/dashboard`, and protected routing.

`src/shared/types/auth.ts` - Define LTE auth user, claims, and API response types.

`src/shared/lib/roleFlags.ts` - Derive UI role flags from verified JWT roles.

`supabase/migrations/<timestamp>_create_users_shadow.sql` - Create LTE `users_shadow` table.

`supabase/migrations/<timestamp>_create_subscription_cache.sql` - Create LTE `subscription_cache` table.

## LTE Files To Update

`functions/middleware/auth.ts` - Replace mock auth verification with real LTE access-token verification.

`functions/users/getUser.ts` - Read from `users_shadow` instead of mock data.

`src/pages/Dashboard.tsx` - Load dashboard from authenticated LTE user state.

`src/app/store/index.ts` - Export the LTE auth store.

`src/shared/api/index.ts` - Keep shared fetch helpers aligned with auth API usage.

## SSO Worker Requirements

`generateAuthorizationCode` RPC - Create a one-time LTE authorization code and state for an authenticated SkillPassport user.

`exchangeAuthorizationCode` RPC - Validate, consume, and exchange the code for LTE tokens and user claims.

Durable Object storage - Store authorization code records for 60 seconds and enforce single use.

Refresh-token storage - Store LTE refresh token hashes in SSO session storage, not LTE DB.

Product access check - Confirm the user has `lte` entitlement before issuing the code or LTE tokens.

## SkillPassport Requirements

`functions/api/auth/generate-lte-code.ts` - Authenticated endpoint that asks SSO for an LTE authorization code.

`functions/lib/sso-client.ts` - Add typed wrapper for `generateAuthorizationCode`.

`src/features/auth/lib/navigateToLTE.ts` - Call SkillPassport backend, receive redirect URL, and navigate to LTE.

Dashboard/header menu action - Wire `Go to LTE` to `navigateToLTE`.

## Cookie Rules

`__Host-lte_refresh` - LTE refresh cookie name.

`HttpOnly` - Refresh token is not readable by JavaScript.

`Secure` - Cookie is sent only over HTTPS.

`SameSite=Lax` - Allows normal top-level navigation flow while limiting CSRF exposure.

`Path=/` - Required for `__Host-` cookies.

No `Domain` attribute - Required for host-only `__Host-` cookies.

## Frontend State Rules

Access token - Store only in Zustand memory.

Refresh token - Never store in Zustand, localStorage, sessionStorage, or response body.

User profile - Persist only non-sensitive display state if needed.

Roles - Derive from verified claims, not local tables.

Products/features - Use claims for immediate access and `subscription_cache` for LTE feature checks.

## Dashboard Entry Conditions

Authorization code exists and is not expired.

State matches.

Code has not already been consumed.

Redirect URI matches LTE callback URI.

User is active and email verification rules pass.

User has `lte` product entitlement.

LTE `users_shadow` sync succeeds or fails safely based on dashboard dependency.

LTE `subscription_cache` sync succeeds or falls back to SSO response for first render.

LTE access token is stored in memory.

LTE refresh cookie is set successfully.

## Implementation Order

1. Add LTE `users_shadow` and `subscription_cache` migrations.
2. Add LTE `wrangler.toml` with `SSO_SERVICE`.
3. Add LTE backend SSO client, cookie helper, Supabase helper, and shadow sync helper.
4. Add LTE `/api/auth/sso/exchange`.
5. Add LTE `/api/auth/me`, `/api/auth/refresh`, and `/api/auth/logout`.
6. Add LTE frontend auth API wrapper.
7. Add LTE Zustand auth store.
8. Add LTE `/auth/callback` page.
9. Protect LTE dashboard route.
10. Add SSO Worker authorization-code RPC and Durable Object storage.
11. Add SkillPassport generate-code endpoint and frontend navigation action.
12. Verify full flow from SkillPassport dashboard to LTE dashboard.

## Verification Checklist

SkillPassport login succeeds.

`Go to LTE` generates only `code` and `state`.

LTE URL never contains access or refresh tokens.

Authorization code cannot be reused.

Expired authorization code fails.

Wrong `state` fails.

Wrong `redirectUri` fails.

LTE refresh cookie is host-only and HttpOnly.

LTE refresh token is never returned in JSON.

LTE access token is lost on full refresh and restored via refresh cookie.

LTE dashboard loads after successful exchange.

LTE dashboard blocks unauthenticated users.

`users_shadow` contains the SSO user.

`subscription_cache` contains the active LTE entitlement.
