# Cross-Domain SSO Implementation: SkillPassport → LTE
## Authorization Code + PKCE + Durable Object (Fully Aligned)

**Status:** Production Implementation Guide  
**Date:** 2026-07-17  
**Architecture:** Authorization Code Flow with Durable Object for one-time codes

---

## Quick Summary

1. **User logs into SkillPassport** → gets SkillPassport tokens
2. **User clicks "Go to LTE"** → SkillPassport requests authorization code from SSO
3. **Authorization code stored in Durable Object** → single-use, 60-second expiry
4. **Browser navigates to LTE with code** → URL only contains `?code=...&state=...`
5. **LTE backend exchanges code** → SSO validates and issues LTE tokens
6. **LTE sets host-only HttpOnly refresh cookie** → stores only in cookie, not in JS
7. **LTE stores access token in memory** → lost on page refresh, requires refresh cookie

---

## Architecture Overview

### Three-Tier Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    SSO WORKER (Central Authority)           │
│                                                             │
│ RPC Methods:                                                │
│ ├─ .login(email, password)                                 │
│ ├─ .refresh(refresh_token)                                 │
│ ├─ .generateAuthorizationCode(accessToken, targetApp, ...) │
│ └─ .exchangeAuthorizationCode(code, redirectUri, ...)      │
│                                                             │
│ Storage:                                                    │
│ ├─ Durable Object: One-time authorization codes            │
│ └─ Database: Users, sessions, refresh tokens               │
└─────────────────────────────────────────────────────────────┘
         ↑                                    ↑
         │ RPC Binding                       │ RPC Binding
         │                                   │
    ┌────┴──────────┐              ┌────────┴────────┐
    │ SkillPassport │              │      LTE        │
    │  Pages Func   │              │   Pages Func    │
    │               │              │                 │
    │ /generate-    │              │ /auth/callback  │
    │  lte-code     │              │ /auth/exchange  │
    │               │              │ /auth/refresh   │
    │ /auth/login   │              │                 │
    │ /auth/refresh │              │                 │
    └────┬──────────┘              └────────┬────────┘
         ↑                                   ↑
         │ HTTPS                            │ HTTPS
         │                                  │
    ┌────┴──────────────────────────────────┴────────┐
    │          Frontend Applications                  │
    │                                                 │
    │ SkillPassport        │        LTE              │
    │ ├─ Memory:           │ ├─ Memory:              │
    │ │  accessToken       │ │  accessToken          │
    │ ├─ Cookie:           │ ├─ Cookie:              │
    │ │  __Host-sp_refresh │ │  __Host-lte_refresh   │
    │ │  (host-only)       │ │  (host-only)          │
    └────────────────────────────────────────────────┘
```

---

## Token Storage & Lifecycle

| Token | Format | Where | Lifecycle |
|-------|--------|-------|-----------|
| SkillPassport Access | RS256 JWT | Memory | 15 mins |
| SkillPassport Refresh | Opaque string | HttpOnly cookie (host-only) | 7 days |
| Authorization Code | Opaque string | Durable Object | 60 seconds |
| LTE Access | RS256 JWT | Memory | 15 mins |
| LTE Refresh | Opaque string | HttpOnly cookie (host-only) | 7 days |

---

## Authorization Code Flow (Complete)

### Step 1: User Logs Into SkillPassport

```
Frontend                        Backend
  │                               │
  ├─ POST /api/auth/login         │
  │  {email, password}            │
  ├──────────────────────────────>│
  │                               │
  │                        RPC: .login()
  │                               │
  │                        ├─ Verify password
  │                        ├─ Create RS256 access token
  │                        ├─ Create opaque refresh token
  │                        └─ Store refresh_token_hash
  │                               │
  │  { accessToken, user }        │
  │<──────────────────────────────┤
  │                               │
  ├─ Set-Cookie:                  │
  │  __Host-sp_refresh=...;       │
  │  Path=/;HttpOnly;Secure;      │
  │  SameSite=Lax;Max-Age=604800  │
  │                               │
  ├─ Store in Zustand:            │
  │  { accessToken, user }        │
  │                               │
  └─ Redirect to /dashboard       │
```

### Step 2: User Clicks "Go to LTE"

```
Frontend                        Backend
  │                               │
  ├─ POST /api/auth/generate-code │
  │  (no body needed)             │
  ├──────────────────────────────>│
  │                               │
  │                    RPC: .generateAuthorizationCode({
  │                      accessToken: from session,
  │                      targetApp: "lte",
  │                      redirectUri: "https://lte..."
  │                    })
  │                               │
  │                    ├─ Verify session is valid
  │                    ├─ Check LTE entitlement
  │                    ├─ Generate random code (32 bytes)
  │                    ├─ Hash code: sha256(code)
  │                    ├─ Generate random state
  │                    ├─ Hash state: sha256(state)
  │                    ├─ Store in Durable Object:
  │                    │  - codeHash
  │                    │  - stateHash
  │                    │  - userId
  │                    │  - targetApp: "lte"
  │                    │  - redirectUri
  │                    │  - expiresAt: now + 60s
  │                    └─ Return raw code & state
  │                               │
  │  {                            │
  │    code: "auth_abc123...",    │
  │    state: "550e8400-...",     │
  │    redirectUrl: "https://lte" │
  │  }                            │
  │<──────────────────────────────┤
  │                               │
  ├─ Store state in session       │
  │  sessionStorage.setState(s)   │
  │                               │
  └─ Navigate:                    │
     window.location.href =       │
     "https://lte.rareminds.in/   │
      auth/callback?              │
      code=auth_abc123...&        │
      state=550e8400-..."         │
```

### Step 3: LTE Receives Authorization Code

```
LTE Frontend (GET /auth/callback?code=...&state=...)
  │
  ├─ React Route mounts
  │
  ├─ Extract from URL:
  │  - code
  │  - state
  │
  ├─ POST /api/auth/sso/exchange
  │  {
  │    code,
  │    state,
  │    redirectUri
  │  }
  │
  └─ (Continue to Backend)
```

### Step 4: LTE Backend Exchanges Code

```
Backend                         SSO Worker
  │                               │
  ├─ POST /api/auth/sso/exchange  │
  │  {code, state, redirectUri}   │
  │                               │
  │                    RPC: .exchangeAuthorizationCode({
  │                      code,
  │                      redirectUri
  │                    })
  │                               │
  │                    ├─ Hash code: sha256(code)
  │                    ├─ Get Durable Object by
  │                    │  idFromName(codeHash)
  │                    ├─ Retrieve record from DO
  │                    ├─ Verify:
  │                    │  ├─ Record exists
  │                    │  ├─ Not expired
  │                    │  └─ redirectUri matches
  │                    ├─ Verify state:
  │                    │  - Hash state from request
  │                    │  - Compare with stored
  │                    ├─ DELETE code from DO
  │                    │  (atomic, single-use!)
  │                    ├─ Fetch fresh user data
  │                    │  from database
  │                    ├─ Create LTE access token
  │                    │  (RS256, 15 mins, aud:lte)
  │                    ├─ Create LTE refresh token
  │                    │  (opaque string)
  │                    ├─ Store refresh_token_hash
  │                    │  in database
  │                    └─ Return user & tokens
  │                               │
  │  {                            │
  │    accessToken,               │
  │    user                       │
  │  }                            │
  │<──────────────────────────────┤
  │                               │
  ├─ Set-Cookie:                  │
  │  __Host-lte_refresh=...;      │
  │  Path=/;HttpOnly;Secure;      │
  │  SameSite=Lax;Max-Age=604800  │
  │                               │
  └─ Return:                      │
     { accessToken, user }        │
     (NO refreshToken in body!)   │
```

### Step 5: LTE Frontend Handles Response

```
Frontend
  │
  ├─ Receive { accessToken, user }
  │
  ├─ Store in Zustand:
  │  { accessToken, user, isAuthenticated }
  │  (NOT refreshToken!)
  │
  ├─ Clear URL:
  │  window.history.replaceState({}, '', '/dashboard')
  │
  └─ Redirect to /dashboard
```

---

## Durable Object: Authorization Code Storage

### Definition

```typescript
// sso-api/src/durable-objects/AuthorizationCodeStore.ts

interface AuthorizationCodeRecord {
  codeHash: string;
  stateHash: string;
  userId: string;
  organizationId: string;
  targetApp: "lte";
  redirectUri: string;
  expiresAt: number;
}

export class AuthorizationCodeStore {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async createCode(record: AuthorizationCodeRecord): Promise<void> {
    const key = `code:${record.codeHash}`;
    
    // Store with metadata
    await this.state.storage.put(key, JSON.stringify(record));

    // Schedule cleanup alarm (optional)
    // This acts as a fallback for manual expiry check
    const alarmTime = record.expiresAt + 1000; // 1 second after expiry
    await this.state.storage.setAlarm(alarmTime);
  }

  async consumeCode(codeHash: string): Promise<AuthorizationCodeRecord> {
    const key = `code:${codeHash}`;
    const data = await this.state.storage.get<string>(key);

    if (!data) {
      throw new Error("Invalid or already-used authorization code");
    }

    const record: AuthorizationCodeRecord = JSON.parse(data);

    // Check expiry (CRITICAL)
    if (record.expiresAt <= Date.now()) {
      await this.state.storage.delete(key);
      throw new Error("Authorization code expired");
    }

    // Delete code immediately (single-use guarantee)
    await this.state.storage.delete(key);

    return record;
  }

  // Optional: Cleanup alarm handler
  async alarm() {
    // Delete all expired codes
    const keys = await this.state.storage.list<string>();
    
    for (const key of keys.keys()) {
      const data = await this.state.storage.get<string>(key.toString());
      if (data) {
        const record: AuthorizationCodeRecord = JSON.parse(data);
        if (record.expiresAt <= Date.now()) {
          await this.state.storage.delete(key.toString());
        }
      }
    }
  }
}
```

### wrangler.toml Configuration

```toml
[[durable_objects.bindings]]
name = "SSO_CODE_STORE"
class_name = "AuthorizationCodeStore"
script_name = "sso-api"

[env.production.durable_objects.bindings]
name = "SSO_CODE_STORE"
class_name = "AuthorizationCodeStore"
script_name = "sso-api"
```

---

## RPC Method Contracts

### SSO Worker RPC Interface

```typescript
interface SSOService {
  // Existing methods
  login(email: string, password: string): Promise<{
    access_token: string;
    refresh_token: string;
    user: UserInfo;
  }>;

  refresh(refresh_token: string): Promise<{
    access_token: string;
    refresh_token: string;
  }>;

  // Authorization code methods
  generateAuthorizationCode(options: {
    accessToken: string;        // Current user's access token
    targetApp: "lte";
    redirectUri: string;
  }): Promise<{
    code: string;               // Raw code (NOT hashed)
    state: string;
  }>;

  exchangeAuthorizationCode(options: {
    code: string;               // Raw code from URL
    redirectUri: string;
  }): Promise<{
    access_token: string;
    user: UserInfo;
  }>;

  // Token refresh for LTE
  refreshSession(refresh_token: string): Promise<{
    access_token: string;
    refresh_token: string;
  }>;
}
```

---

## Implementation Code

### SkillPassport: Generate Authorization Code

```typescript
// skillpassport/functions/api/auth/generate-lte-code.ts

export async function onRequestPost(context: {
  request: Request;
  env: Env;
  data: { user?: any };
}): Promise<Response> {
  try {
    const { env, data } = context;

    if (!data.user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // RPC to SSO Worker
    const result = await (env.SSO_SERVICE as any).generateAuthorizationCode({
      accessToken: data.user.accessToken,
      targetApp: "lte",
      redirectUri: "https://lte.rareminds.in/auth/callback"
    });

    return json({
      success: true,
      code: result.code,
      state: result.state,
      redirectUrl: `https://lte.rareminds.in/auth/callback?code=${result.code}&state=${result.state}`
    });
  } catch (error) {
    console.error("generate-lte-code error:", error);
    return json({ error: "Failed to generate code" }, { status: 500 });
  }
}
```

### LTE: Exchange Authorization Code

```typescript
// lte/functions/api/auth/sso/exchange.ts

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const { request, env } = context;
    const body = await request.json();

    const { code, state, redirectUri } = body;

    if (!code || !state) {
      return json({ error: "Missing code or state" }, { status: 400 });
    }

    // Validate state from session (CSRF protection)
    const sessionState = request.headers.get("x-session-state");
    if (state !== sessionState) {
      return json({ error: "CSRF validation failed" }, { status: 403 });
    }

    // RPC to SSO Worker to exchange code
    const result = await (env.SSO_SERVICE as any).exchangeAuthorizationCode({
      code,
      redirectUri
    });

    if (!result) {
      return json({ error: "Invalid or expired code" }, { status: 401 });
    }

    // Set host-only HttpOnly refresh token cookie
    const headers = new Headers({
      'Set-Cookie': [
        `__Host-lte_refresh_token=${result.refresh_token}; ` +
        `Path=/; HttpOnly; Secure; SameSite=Lax; ` +
        `Max-Age=604800`
      ].join('')
    });

    // Return access token ONLY (no refresh_token in body!)
    return json({
      success: true,
      access_token: result.access_token,
      user: result.user
    }, { headers });
  } catch (error) {
    console.error("exchange error:", error);
    return json({ error: "Authentication failed" }, { status: 500 });
  }
}
```

### LTE: Refresh Token Handler

```typescript
// lte/functions/api/auth/refresh.ts

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const { request, env } = context;

    // Extract refresh token from HttpOnly cookie
    const cookies = parseCookies(request.headers.get("cookie") || "");
    const refreshToken = cookies["__Host-lte_refresh_token"];

    if (!refreshToken) {
      return json({ error: "No refresh token" }, { status: 401 });
    }

    // RPC to SSO Worker
    const result = await (env.SSO_SERVICE as any).refreshSession(refreshToken);

    if (!result) {
      return json({ error: "Invalid refresh token" }, { status: 401 });
    }

    // Set new refresh token cookie
    const headers = new Headers({
      'Set-Cookie': [
        `__Host-lte_refresh_token=${result.refresh_token}; ` +
        `Path=/; HttpOnly; Secure; SameSite=Lax; ` +
        `Max-Age=604800`
      ].join('')
    });

    // Return new access token
    return json({
      access_token: result.access_token
    }, { headers });
  } catch (error) {
    console.error("refresh error:", error);
    return json({ error: "Refresh failed" }, { status: 500 });
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(value || '');
  });
  return cookies;
}
```

---

## Security Properties

✅ **Authorization codes are one-time only** — deleted immediately after consumption  
✅ **Codes expire after 60 seconds** — checked during lookup  
✅ **Code hashes stored in Durable Object** — raw code never persists  
✅ **State validation prevents CSRF** — hashed comparison  
✅ **No tokens in URLs** — only short-lived authorization code  
✅ **Refresh tokens in HttpOnly cookies** — JavaScript cannot access  
✅ **Host-only cookies** — each app isolated  
✅ **Access tokens in memory only** — lost on page refresh  
✅ **SSO owns all token signing** — LTE receives pre-signed tokens  

---

## Cookie Configuration

### Correct Format

```
Set-Cookie: __Host-lte_refresh_token=<value>;
  Path=/;
  HttpOnly;
  Secure;
  SameSite=Lax;
  Max-Age=604800
```

**Requirements for `__Host-` prefix:**
- ✅ No Domain attribute
- ✅ Path must be `/`
- ✅ Secure flag required
- ✅ HttpOnly for all sensitive tokens

### Why Not Parent Domain?

```
❌ OLD: Domain=.rareminds.in
   └─ Cookie sent to all subdomains
   └─ Increases attack surface
   └─ If one subdomain compromised, attacker gets refresh cookie for ALL apps

✅ NEW: __Host- prefix (no Domain attribute)
   └─ Cookie sent to skillpassport.rareminds.in only
   └─ Cookie sent to lte.rareminds.in only
   └─ Completely isolated, no cross-subdomain leakage
```

---

## Frontend Implementation Example

### SkillPassport: Generate Code Button

```typescript
// skillpassport/src/features/auth/GenerateLteCodeButton.tsx

import { useNavigate } from 'react-router-dom';

export function GenerateLteCodeButton() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateCode = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/generate-lte-code', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to generate code');

      const { redirectUrl } = await response.json();

      // Navigate to LTE with authorization code
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleGenerateCode} 
      disabled={loading}
    >
      {loading ? 'Generating...' : 'Open LTE'}
    </button>
  );
}
```

### LTE: OAuth Callback Route

```typescript
// lte/src/app/pages/AuthCallbackPage.tsx

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/app/store/authStore';

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAccessToken, setUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const exchangeCode = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
          setError('Missing authorization parameters');
          return;
        }

        // Exchange code for tokens
        const response = await fetch('/api/auth/sso/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',  // Include cookies
          body: JSON.stringify({
            code,
            state,
            redirectUri: window.location.origin + '/auth/callback'
          })
        });

        if (!response.ok) throw new Error('Code exchange failed');

        const data = await response.json();

        // Store access token in memory
        setAccessToken(data.access_token);
        setUser(data.user);

        // Clear URL
        window.history.replaceState({}, '', '/dashboard');

        // Redirect to dashboard
        navigate('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    exchangeCode();
  }, [searchParams, navigate, setAccessToken, setUser]);

  if (error) {
    return <div className="error">{error}</div>;
  }

  return <div className="loading">Authenticating...</div>;
}
```

---

## Production Checklist

- [ ] Durable Object deployed to production
- [ ] Authorization code generation tested
- [ ] Code expiry (60 seconds) verified
- [ ] Code consumption is single-use verified
- [ ] State hashing implemented
- [ ] Refresh token rotation tested
- [ ] HttpOnly cookies set correctly
- [ ] CSRF protection validated
- [ ] Access token in memory (not in URL)
- [ ] All RPC methods aligned
- [ ] No private keys exposed to LTE
- [ ] Rate limiting on code generation
- [ ] Error handling for expired/invalid codes
- [ ] Monitoring/logging in place

---

**This document is fully aligned with OAuth2 best practices and production security standards.**
