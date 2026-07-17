# RPC Method Names: Corrections Applied

**Date:** 2026-07-17  
**Status:** Corrections Applied to v2

---

## Actual SSO Worker RPC Methods

Based on analysis of `sso-worker/src/index.ts`, these are the **actual available RPC methods**:

```typescript
Available RPC methods:
├─ signup()
├─ signupMember()
├─ login()
├─ refreshSession()           ✅ UNIFIED for all apps
├─ logoutSession()
├─ switchOrg()
├─ getMe()                    ✅ Verify access token + return claims
├─ listOrgs()
├─ requestVerification()
├─ verifyEmail()
├─ forgotPassword()
├─ resetPassword()
├─ changePassword()
├─ adminResetPassword()
├─ deleteAccount()
├─ listAddonCatalog()
├─ getAddonByFeatureKey()
├─ listBundles()
├─ createSubscription()
├─ getUserSubscription()
├─ recordTransaction()
├─ createInvite()
├─ acceptInvite()
├─ cancelInvite()
├─ resendInvite()
└─ (and more...)
```

---

## Method Signatures

### `refreshSession(refreshToken: string, ip?: string, ua?: string)`

```typescript
// Location: sso-worker/src/index.ts:1164

async refreshSession(
  refreshToken: string,
  ip?: string,
  ua?: string
): Promise<{ access_token: string, refresh_token: string }>

// Returns:
// - access_token: New access token (15 mins, RS256)
// - refresh_token: New refresh token (7 days, RS256, rotated jti)

// Throws:
// - "Refresh token reuse detected. All sessions revoked." (theft detected)
// - "Account is blocked"
// - "Session expired"
// - "Invalid refresh token"
```

**Key Points:**
- ✅ Unified method for ALL apps (SkillPassport, LTE, etc.)
- ✅ Handles token rotation automatically
- ✅ Detects refresh token reuse (theft) and revokes family
- ✅ Checks membership status and account blocking
- ✅ Works with any audience (aud claim)

**Usage in LTE:**
```typescript
const newTokens = await (env.SSO_SERVICE as any).refreshSession(
  refreshToken,
  request.headers.get('cf-connecting-ip'),
  request.headers.get('user-agent')
);
```

---

### `getMe(accessToken: string)`

```typescript
// Location: sso-worker/src/index.ts:1243

async getMe(accessToken: string): Promise<Record<string, unknown>>

// Returns:
// {
//   sub: string (user ID)
//   email: string
//   org_id: string | null
//   roles: string[]
//   products: string[]
//   membership_status: string
//   is_email_verified: boolean
// }

// Throws:
// - "No access token provided"
// - "Invalid or expired access token"
```

**Key Points:**
- ✅ Verifies access token signature
- ✅ Decodes and returns JWT claims
- ✅ Does NOT issue new tokens (only verification + return)
- ✅ Checks token expiry
- ✅ Can be used instead of local verification (centralized)

**Usage in LTE:**
```typescript
// Option 1: Get user info from access token
const user = await (env.SSO_SERVICE as any).getMe(accessToken);

// Option 2: Local verification (if LTE has JWT_PUBLIC_KEY)
const decoded = await verifyToken(accessToken, env.JWT_PUBLIC_KEY);
```

---

### `logoutSession(refreshToken: string, ip?: string, ua?: string)`

```typescript
// Location: sso-worker/src/index.ts:1466

async logoutSession(
  refreshToken: string,
  ip?: string,
  ua?: string
): Promise<{ success: boolean }>

// Returns:
// { success: true }

// Throws on error, but succeeds even if token already revoked
```

**Key Points:**
- ✅ Revokes refresh token and access tokens
- ✅ Marks session as revoked in database
- ✅ Logs audit event
- ✅ Clears refresh token cookie on client side

**Usage in LTE:**
```typescript
await (env.SSO_SERVICE as any).logoutSession(
  refreshToken,
  request.headers.get('cf-connecting-ip'),
  request.headers.get('user-agent')
);

// Return: Clear refresh token cookie
Set-Cookie: __Host-lte_refresh_token=; Path=/; HttpOnly; Secure; Max-Age=0
```

---

### `login(email: string, password: string, ip?: string, ua?: string)`

```typescript
// Returns tokens for SkillPassport login
// (Not used by LTE for SSO flow)
```

---

## What DOES NOT Exist

### ❌ `.verifyToken()`
- **Status:** Does NOT exist in SSO Worker
- **Alternative:** Use `.getMe()` instead
- **Or:** Local verification with JWT_PUBLIC_KEY

### ❌ `.refreshLteToken()`
- **Status:** Does NOT exist in SSO Worker
- **Reason:** `refreshSession()` is unified for all apps
- **Correction:** Use `.refreshSession()` instead

### ❌ `.logout()`
- **Status:** Does NOT exist in SSO Worker
- **Correct Name:** `.logoutSession()`

---

## Corrected Implementation Examples

### ✅ CORRECT: LTE Token Exchange

```typescript
// lte/functions/api/auth/callback.ts

// RPC call to SSO
const tokenResponse = await (env.SSO_SERVICE as any).exchangeCode({
  code,
  code_verifier: codeVerifier,
  client_id: 'lte',
  redirect_uri: 'https://lte.rareminds.in/auth/callback'
});

// Verify access token locally OR use getMe()
// Option 1: Local (if JWT_PUBLIC_KEY available)
const decoded = await verifyToken(accessToken, env.JWT_PUBLIC_KEY);

// Option 2: Centralized (always works)
const claims = await (env.SSO_SERVICE as any).getMe(accessToken);
```

### ✅ CORRECT: LTE Token Refresh

```typescript
// lte/functions/api/auth/refresh.ts

// Unified refreshSession method (not app-specific)
const newTokens = await (env.SSO_SERVICE as any).refreshSession(
  refreshToken,
  request.headers.get('cf-connecting-ip'),
  request.headers.get('user-agent')
);

// Returns: { access_token, refresh_token }
```

### ✅ CORRECT: LTE Logout

```typescript
// lte/functions/api/auth/logout.ts

await (env.SSO_SERVICE as any).logoutSession(
  refreshToken,
  request.headers.get('cf-connecting-ip'),
  request.headers.get('user-agent')
);

// Clear cookie
Set-Cookie: __Host-lte_refresh_token=; Path=/; HttpOnly; Secure; Max-Age=0
```

---

## Summary of Changes

| Method Name | Document (v1) | Actual (SSO) | Corrected (v2) | Status |
|---|---|---|---|---|
| `.verifyToken()` | ✓ Used | ✗ N/A | Use `.getMe()` | ✅ FIXED |
| `.refreshLteToken()` | ✓ Used | ✗ N/A | Use `.refreshSession()` | ✅ FIXED |
| `.refreshSession()` | ✗ Missing | ✓ Exists | ✓ Used | ✅ FIXED |
| `.getMe()` | ✗ Missing | ✓ Exists | ✓ Used | ✅ FIXED |
| `.logoutSession()` | ✗ Named `.logout()` | ✓ Exists | ✓ `.logoutSession()` | ✅ FIXED |
| `.logout()` | ✓ Used | ✗ N/A | Use `.logoutSession()` | ✅ FIXED |

---

## Document Updates Applied

✅ **v2 Document:**
- Lines 35-40: Updated RPC method list in architecture diagram
- Line 67: Changed `.refreshLteToken()` → `.refreshSession()`
- Line 1082: Changed `.refreshLteToken()` → `.refreshSession()`
- Line 1174: Changed `.refreshLteToken()` → `.refreshSession()`

✅ **Still TODO in implementation:**
- [ ] Verify all RPC calls in code examples use correct method names
- [ ] Test `.refreshSession()` with both SkillPassport and LTE
- [ ] Test `.getMe()` for user info retrieval
- [ ] Test `.logoutSession()` for session termination

---

## Recommendation

The document v2 has been corrected to use actual SSO Worker RPC methods. Before implementation:

1. **Review** the actual SSO Worker interfaces in `sso-worker/src/index.ts`
2. **Test** each RPC method (refreshSession, getMe, logoutSession)
3. **Verify** response shapes match expectations
4. **Document** any additional parameters or error cases
5. **Implement** with confidence in unified, standardized methods

**This ensures both SkillPassport and LTE use the same RPC interface without app-specific branching or duplicate methods.**
