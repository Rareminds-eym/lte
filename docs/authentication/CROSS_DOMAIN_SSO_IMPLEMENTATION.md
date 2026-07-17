# Cross-Domain SSO Implementation: SkillPassport → LTE
## With Complete Flow Diagrams and Analysis

**Status:** Implementation Guide  
**Date:** 2026-07-16  
**Domains:**
- SkillPassport: `https://skillpassport.rareminds.in`
- LTE: `https://lte.rareminds.in`
- SSO: `sso-api` (Cloudflare Worker - internal)

---

## 📋 Table of Contents

1. [Current System Architecture](#current-system-architecture)
2. [SSO Database Structure](#sso-database-structure)
3. [Cross-Domain Challenge](#cross-domain-challenge)
4. [Complete SSO Flow Diagram](#complete-sso-flow-diagram)
5. [Implementation Approach](#implementation-approach)
6. [Code Implementation](#code-implementation)
7. [Security Considerations](#security-considerations)

---

## Current System Architecture

### Three-Tier Architecture with RPC Bindings

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          TIER 1: SSO LAYER (Central)                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ SSO Worker (sso-api)                                                 │ │
│  │ - .login(email, password) → { access_token, refresh_token }         │ │
│  │ - .verifyToken(token) ← NEW METHOD FOR LTE                          │ │
│  │ - .refresh(refresh_token) → { access_token }                        │ │
│  │ - Keys: JWT_PRIVATE_KEY (RS256), JWT_PUBLIC_KEY                     │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                     ↑                                      │
│                           RPC Service Binding                              │
│                           ↙                      ↘                         │
├────────────────────────────────────────────────────────────────────────────┤
│                   TIER 2: PAGES FUNCTIONS LAYER (API)                      │
│                                                                            │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ SkillPassport Pages Functions    │  │ LTE Pages Functions          │  │
│  │ (skill-passport-portal)          │  │ (lte-app)                    │  │
│  │                                  │  │                              │  │
│  │ POST /api/auth/login             │  │ POST /api/auth/sso/verify    │  │
│  │ ├─ Receive: email, password      │  │ ├─ Receive: access_token     │  │
│  │ ├─ RPC: .login()                 │  │ ├─ RPC: .getMe()       │  │
│  │ ├─ Set refresh cookie            │  │ ├─ Sync to LTE DB            │  │
│  │ └─ Return: access_token          │  │ ├─ Create LTE tokens         │  │
│  │                                  │  │ ├─ Set lte_refresh cookie    │  │
│  │ POST /api/auth/refresh           │  │ └─ Return: access_token      │  │
│  │ ├─ Receive: refresh_token        │  │                              │  │
│  │ ├─ RPC: .refresh()               │  │ POST /api/auth/refresh       │  │
│  │ └─ Return: new access_token      │  │ ├─ Verify token locally      │  │
│  │                                  │  │ └─ Return: new access_token  │  │
│  │ wrangler.toml:                   │  │                              │  │
│  │ [[services]]                     │  │ wrangler.toml:               │  │
│  │ binding = "SSO_SERVICE"          │  │ [[services]]                 │  │
│  │ service = "sso-api"              │  │ binding = "SSO_SERVICE"      │  │
│  │ entrypoint = "SsoWorker"         │  │ service = "sso-api"          │  │
│  │                                  │  │ entrypoint = "SsoWorker"     │  │
│  │ Database: SkillPassport DB       │  │ Database: LTE DB             │  │
│  │                                  │  │                              │  │
│  └──────────────────────────────────┘  └──────────────────────────────┘  │
│           ↑                                      ↑                         │
│           │ HTTPS Requests                      │ HTTPS Requests          │
│           │ /api/auth/login                     │ /api/auth/sso/verify    │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│              TIER 3: FRONTEND LAYER (Browser Applications)                 │
│                                                                            │
│  ┌─────────────────────────────────────┐  ┌──────────────────────────────┐ │
│  │ SkillPassport Frontend              │  │ LTE Frontend                 │ │
│  │ https://skillpassport.rareminds.in  │  │ https://lte.rareminds.in     │ │
│  │                                     │  │                              │ │
│  │ React Components:                   │  │ React Components:            │ │
│  │ ├─ Login page                       │  │ ├─ SSOTokenVerifyGuard       │ │
│  │ ├─ Dashboard                        │  │ ├─ Dashboard                 │ │
│  │ └─ "Go to LTE" dropdown link        │  │ ├─ Courses                   │ │
│  │                                     │  │ └─ Progress                  │ │
│  │ Zustand Auth Store:                 │  │                              │ │
│  │ ├─ accessToken (memory)             │  │ Zustand Auth Store:          │ │
│  │ ├─ user data                        │  │ ├─ accessToken (memory)      │ │
│  │ └─ isAuthenticated flag             │  │ ├─ user data                 │ │
│  │                                     │  │ └─ isAuthenticated flag      │ │
│  │ Cookies (Domain=.rareminds.in):     │  │                              │ │
│  │ ├─ refresh_token (httpOnly)         │  │ Cookies (Domain=.rareminds.in):
│  │ └─ (auto-sent to all subdomains)    │  │ ├─ lte_refresh_token (httpOnly)
│  │                                     │  │ └─ (auto-sent to all subdomains)
│  │                                     │  │                              │ │
│  └─────────────────────────────────────┘  └──────────────────────────────┘ │
│           ↑                                      ↑                         │
│           └──────────────── ← → ────────────────┘                         │
│          Cross-Domain Navigation with Token Passing                        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

Key Points:
✅ Both apps use RPC binding to same SSO Worker
✅ Both apps in same parent domain (.rareminds.in)
✅ SSO owns all authentication logic
✅ Pages Functions act as API gateways
✅ No secret sharing needed (RS256 asymmetric)
✅ Cookie domain enables cross-subdomain access
```

---

## SSO Database Structure

### Current Data Model (SSO Worker)

**File: `sso-worker/src/types.ts`**

```typescript
// Generic User (no org context)
interface User {
  id: string;                          // UUID
  email: string;                       // Unique across SSO
  password_hash: string;               // bcrypt, cost 12
  is_email_verified: boolean;
  is_blocked: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  user_metadata?: Record<string, unknown>;  // Custom data
}

// Organization Membership (org context)
interface Membership {
  id: string;
  user_id: string;                     // Links to User
  org_id: string;                      // Which organization
  status: 'active' | 'inactive' | 'suspended' | 'expired';
  created_at: string;
}

// Role Assignment (within org context)
interface MembershipRole {
  id: string;
  membership_id: string;              // Links to Membership
  role_id: string;                    // Which role (learner, educator, admin)
  created_at: string;
}

// Product Access (what apps can user access)
interface MembershipProduct {
  id: string;
  membership_id: string;              // Links to Membership
  product_id: string;                 // skillpassport, lte, etc.
  created_at: string;
}

// Session (track login sessions)
interface Session {
  id: string;
  user_id: string;                    // Links to User
  org_id: string | null;
  refresh_token_hash: string;         // Hash of actual token
  user_agent: string | null;
  ip_address: string | null;
  revoked: boolean;
  expires_at: string;
  created_at: string;
  rotated_from: string | null;        // Token rotation tracking
  last_used_at: string | null;
  device_info?: Record<string, unknown>;
}
```

### JWT Payload (What's Inside the Token)

**File: `sso-worker/src/types.ts`**

```typescript
interface AccessTokenPayload {
  sub: string;                         // User ID
  email: string;                       // User email
  org_id: string;                      // Active organization
  roles: string[];                     // ["learner", "educator"]
  products: string[];                  // ["skillpassport", "lte"]
  membership_status: 'active' | 'inactive' | ...;
  is_email_verified: boolean;
  user_metadata?: Record<string, unknown>;
}
```

### JWT Signing (RS256 - Asymmetric)

**File: `sso-worker/src/lib/jwt.ts`**

```typescript
const ALG = "RS256";                   // RSA + SHA256
const ACCESS_TOKEN_TTL = "15m";        // 15 minute expiry

// Key Management
interface JwtEnv {
  JWT_PRIVATE_KEY: string;              // Private key (PKCS8 format)
  JWT_PUBLIC_KEY: string;               // Public key (SPKI format)
  JWT_KID: string;                      // Key ID for rotation
  JWT_KID_PREVIOUS?: string;            // For rotation window
  JWT_PUBLIC_KEY_PREVIOUS?: string;    // For rotation window
}

// Sign Process
const token = await new SignJWT(payload)
  .setProtectedHeader({ 
    alg: "RS256", 
    kid: env.JWT_KID,      // Key rotation tracking
    typ: "JWT" 
  })
  .setIssuedAt()
  .setExpirationTime("15m")  // Expires in 15 mins
  .setIssuer("sso-api")
  .setAudience("skillpassport")  // App-specific audience
  .sign(privateKey);
```

**Key Point:** Uses **asymmetric cryptography (RS256)**
- SSO Worker has: Private Key (signs tokens)
- Apps have: Public Key (verify tokens)
- **No shared secrets needed!**

---

## Cross-Domain Challenge

### Problem: Same Domain Cookies Don't Work Across Domains

```
Scenario: User logs into SkillPassport, then navigates to LTE

SkillPassport (skillpassport.rareminds.in)
  ├─ Sets cookie: session_id=abc123; Domain=skillpassport.rareminds.in
  └─ Browser stores (scoped to skillpassport.rareminds.in only)

User clicks "Go to LTE"
  ↓
Navigates to: lte.rareminds.in
  ↓
Browser requests lte.rareminds.in
  ├─ Does NOT send session_id cookie
  │  (cookie domain doesn't match)
  └─ LTE sees: no authentication


Issue:
❌ Cookies are domain-scoped by default
❌ skillpassport.rareminds.in cookies ≠ lte.rareminds.in cookies
❌ Need different authentication mechanism for cross-domain
```

### Solution: Use Parent Domain Cookies + URL Token

```
Parent domain: .rareminds.in (shared across subdomains)

Set-Cookie: auth_token=...;
  Domain=.rareminds.in          ← Accessible to all subdomains
  Path=/
  HttpOnly
  Secure
  SameSite=Lax

Now:
✅ skillpassport.rareminds.in can read cookie
✅ lte.rareminds.in can read cookie  
✅ Both apps authenticated with same token
```

---

## Complete SSO Flow Diagram

### Detailed Step-by-Step Flow: SkillPassport → LTE

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: USER LOGIN TO SKILLPASSPORT                    │
└────────────────────────────────────────────────────────────────────────────┘

Step 1: User Navigates to SkillPassport
┌──────────────────────────────┐
│ Browser                      │
├──────────────────────────────┤
│ Navigate to:                 │
│ skillpassport.rareminds.in   │
│                              │
│ Frontend loads (React app)   │
└──────────────────────────────┘
        ↓


Step 2: User Enters Credentials
┌──────────────────────────────┐
│ SkillPassport Frontend       │
├──────────────────────────────┤
│ Login Form:                  │
│ - Email: user@example.com    │
│ - Password: ••••••••         │
│                              │
│ Click "LOGIN"                │
└──────────────────────────────┘
        ↓
        │ POST /api/auth/login
        │ {
        │   email: "user@example.com",
        │   password: "plaintext"
        │ }
        ↓

Step 3: SkillPassport Pages Function Receives Request
┌──────────────────────────────────────┐
│ skillpassport/functions/api/auth/    │
│ login.ts                             │
├──────────────────────────────────────┤
│ 1. Extract email + password          │
│ 2. Validate input                    │
│ 3. Call RPC: env.SSO_SERVICE.login() │
│    ├─ email                          │
│    ├─ password                       │
│    ├─ ip (from CF-Connecting-IP)     │
│    └─ ua (from User-Agent)           │
└──────────────────────────────────────┘
        ↓ (RPC - Internal Cloudflare Network)
        ↓


Step 4: SSO Worker Verifies Credentials
┌──────────────────────────────────────┐
│ sso-api worker / routes/login.ts      │
├──────────────────────────────────────┤
│ performLogin():                      │
│                                      │
│ 1. Rate limit check (10/min per IP)  │
│ 2. Account lockout check             │
│                                      │
│ 3. Query SSO DB:                     │
│    SELECT * FROM users               │
│    WHERE email = 'user@example.com'  │
│                                      │
│ 4. If not found:                     │
│    └─ Constant-time comparison       │
│       (bcrypt dummy hash)            │
│    └─ Record failed login            │
│    └─ Return: { error: "..." }       │
│                                      │
│ 5. If found & not blocked:           │
│    └─ bcrypt.compare(password, hash) │
│    └─ If valid:                      │
│       ├─ Update last_login_at        │
│       ├─ Query memberships:          │
│       │  SELECT * FROM memberships   │
│       │  WHERE user_id = ? AND       │
│       │        status = 'active'     │
│       ├─ Get first active membership │
│       ├─ Query JWT claims:           │
│       │  SELECT get_jwt_claims(      │
│       │    user_id, org_id)          │
│       └─ Claims returns:             │
│          ├─ roles: ["learner"]       │
│          ├─ products: ["skillpassport"]
│          └─ membership_status        │
│                                      │
│ 6. Generate refresh token:           │
│    refreshToken = random(32 bytes)   │
│    refreshHash = bcrypt(refreshToken)│
│                                      │
│ 7. Create session record:            │
│    INSERT INTO sessions {            │
│      id: uuid(),                     │
│      user_id: user.id,               │
│      org_id: membership.org_id,      │
│      refresh_token_hash: hash,       │
│      user_agent: ua,                 │
│      ip_address: ip,                 │
│      revoked: false,                 │
│      expires_at: now + 7 days,       │
│      family_id: sessionId,           │
│      family_created_at: now          │
│    }                                 │
│                                      │
│ 8. Sign access token (RS256):        │
│    accessToken = sign({              │
│      sub: user.id,                   │
│      email: user.email,              │
│      org_id: membership.org_id,      │
│      roles: ["learner"],             │
│      products: ["skillpassport"],    │
│      membership_status: "active",    │
│      is_email_verified: true,        │
│      user_metadata: {...}            │
│    }, JWT_PRIVATE_KEY, "RS256")      │
│    ├─ Header: { alg: RS256, kid }    │
│    ├─ Payload: claims above          │
│    └─ Signature: sha256(header.payload)│
│       with private key                │
│                                      │
│ 9. Return response:                  │
│    {                                 │
│      success: true,                  │
│      access_token: "eyJ...",         │
│      refresh_token: "eyJ...",        │
│      user: {                         │
│        id: "uuid",                   │
│        email: "user@example.com",    │
│        roles: ["learner"]            │
│      }                               │
│    }                                 │
└──────────────────────────────────────┘
        ↓ (RPC Response back to SkillPassport)
        ↓


Step 5: SkillPassport Pages Function Returns Tokens
┌──────────────────────────────────────────┐
│ skillpassport/functions/api/auth/login.ts│
├──────────────────────────────────────────┤
│ Receives from SSO Worker:                │
│ {                                        │
│   success: true,                         │
│   access_token: "eyJ...",                │
│   refresh_token: "eyJ...",               │
│   user: {...}                            │
│ }                                        │
│                                          │
│ Set response headers:                    │
│ Set-Cookie: refresh_token=eyJ...;       │
│   Domain=.rareminds.in;    ← KEY POINT! │
│   Path=/;                                │
│   HttpOnly;                              │
│   Secure;                                │
│   SameSite=Lax;                          │
│   Max-Age=604800 (7 days)                │
│                                          │
│ Set X-Access-Token header:               │
│   X-Access-Token: eyJ...                 │
│                                          │
│ Response body:                           │
│ {                                        │
│   success: true,                         │
│   access_token: "eyJ...",                │
│   user: {...}                            │
│ }                                        │
└──────────────────────────────────────────┘
        ↓ (Back to Browser over HTTPS)
        ↓


Step 6: Frontend Receives & Stores Tokens
┌────────────────────────────────┐
│ SkillPassport Frontend (React) │
├────────────────────────────────┤
│ 1. Receive response             │
│                                │
│ 2. Store in Zustand auth store: │
│    authStore.setState({         │
│      user: response.user,       │
│      isAuthenticated: true,     │
│      accessToken: response...   │  (in memory)
│    })                           │
│                                │
│ 3. Browser auto-saves cookie:   │
│    refresh_token (HttpOnly)     │  (secure)
│    ├─ Domain: .rareminds.in     │
│    └─ Can be read by subdomains │
│                                │
│ 4. Start token refresh service  │
│    ├─ Schedule refresh at 12min │
│    ├─ Before token expires (15m)│
│    └─ Keep session alive        │
│                                │
│ 5. Redirect to dashboard        │
│    navigate('/learner/dashboard')│
└────────────────────────────────┘


Step 7: SkillPassport Dashboard Loads
┌────────────────────────────────┐
│ SkillPassport Dashboard        │
├────────────────────────────────┤
│ - User greeting                 │
│ - Learning paths               │
│ - In-progress courses          │
│ - Header with dropdown menu    │
│  └─ Settings                   │
│  └─ GO TO LTE (if learner) ✨   │
│  └─ Logout                     │
└────────────────────────────────┘


┌────────────────────────────────────────────────────────────────────────────┐
│              PHASE 2: USER CLICKS "GO TO LTE" (CROSS-DOMAIN)               │
└────────────────────────────────────────────────────────────────────────────┘

Step 8: User Clicks "GO TO LTE" Link
┌────────────────────────────────┐
│ SkillPassport Dashboard        │
├────────────────────────────────┤
│ Header dropdown menu           │
│ ┌──────────────────────────┐   │
│ │ Settings                 │   │
│ │ → GO TO LTE ← (CLICK)    │   │
│ │ Logout                   │   │
│ └──────────────────────────┘   │
└────────────────────────────────┘
        ↓


Step 9: Generate LTE Redirect URL
┌──────────────────────────────────────────┐
│ SkillPassport Frontend - onClick handler │
├──────────────────────────────────────────┤
│ Function: generateLteRedirectUrl()       │
│                                          │
│ 1. Get access token from store:          │
│    const token = authStore.getState().   │
│      accessToken                         │
│                                          │
│ 2. Build redirect URL:                   │
│    const lteUrl = new URL(               │
│      'https://lte.rareminds.in/auth/sso' │
│    )                                     │
│                                          │
│ 3. Add parameters:                       │
│    lteUrl.searchParams.set(              │
│      'code', exchangeCode  (one-time)    │
│    )                                     │
│    lteUrl.searchParams.set(              │
│      'state', state (CSRF token)         │
│    )                                     │
│    lteUrl.searchParams.set(              │
│      'from_app', 'skillpassport'         │
│    )                                     │
│                                          │
│ 4. Full URL:                             │
│    https://lte.rareminds.in/auth/sso?    │
│      code=auth_xyz123&                   │
│      state=550e8400-e29b...&             │
│      &from_app=skillpassport             │
└──────────────────────────────────────────┘
        ↓


Step 10: Browser Navigates to LTE
┌────────────────────────────────┐
│ Browser Navigation             │
├────────────────────────────────┤
│ window.location.href = lteUrl  │
│                                │
│ Browser makes request:         │
│ GET https://lte.rareminds.in/  │
│   auth/sso?                    │
│   access_token=eyJ...&         │
│   ...                          │
│                                │
│ Important: Browser sends        │
│ cookies for .rareminds.in:     │
│ ├─ refresh_token (from SP)     │  
│ │  (because Domain=.rareminds.in)
│ └─ Other cookies              │
└────────────────────────────────┘


Step 11: LTE Frontend Receives Request
┌─────────────────────────────────────────┐
│ lte/src/app/router/SSOTokenVerifyGuard  │
├─────────────────────────────────────────┤
│                                         │
│ Component mounts (at /auth/sso route)   │
│                                         │
│ useEffect(() => {                       │
│   1. Extract token from URL:            │
│      const token = searchParams.get(    │
│        'access_token'                   │
│      )                                  │
│                                         │
│   2. Validate token present:            │
│      if (!token) {                      │
│        setError('No token provided')    │
│        return                           │
│      }                                  │
│                                         │
│   3. Call backend verification:         │
│      POST /api/auth/sso/verify          │
│      {                                  │
│        access_token: token,             │
│        from_app: 'skillpassport'        │
│      }                                  │
│ }, [searchParams])                      │
└─────────────────────────────────────────┘
        ↓


Step 12: LTE Backend Verifies Token
┌────────────────────────────────────┐
│ lte/functions/api/auth/sso-verify  │
├────────────────────────────────────┤
│                                    │
│ Receive: { access_token }          │
│                                    │
│ 1. Extract token:                  │
│    const token = body.access_token │
│                                    │
│ 2. Decode token (no verification   │
│    yet, just peek):                │
│    const header = jwt.decode(token)│
│    const kid = header.kid          │
│                                    │
│ 3. Get public key (based on kid):  │
│    const publicKey = getPublicKey( │
│      kid, // "key-1" or similar    │
│      env  // has JWT_PUBLIC_KEY    │
│    )                               │
│                                    │
│ 4. VERIFY JWT SIGNATURE:           │
│    jwt.verify(                     │
│      token,                        │
│      publicKey,  ← RS256 public    │
│      {                             │
│        algorithms: ['RS256'],      │
│        issuer: 'https://sso...',   │
│        audience: ['skillpassport', │
│                   'lte'],          │
│        maxAge: '15m'               │
│      }                             │
│    )                               │
│                                    │
│ 5. If signature invalid → 401      │
│    return { error: '...' }         │
│                                    │
│ 6. If signature valid → decode:    │
│    const decoded = jwt.decode(token)│
│    {                               │
│      sub: "user-uuid",             │
│      email: "user@example.com",    │
│      org_id: "org-uuid",           │
│      roles: ["learner"],           │
│      products: ["skillpassport"],  │
│      membership_status: "active",  │
│      is_email_verified: true,      │
│      exp: 1689720000,              │
│      iat: 1689716400              │
│    }                               │
│                                    │
│ 7. Check email verified:           │
│    if (!decoded.is_email_verified) │
│      return 403 Forbidden          │
│                                    │
│ 8. Check learner role:             │
│    if (!decoded.roles.includes(    │
│      'learner')) {                 │
│      return 403 Forbidden          │
│    }                               │
│    ✓ User HAS learner role         │
│                                    │
│ 9. Check product access:           │
│    if (!decoded.products.includes( │
│      'lte')) {                     │
│      return 403 Forbidden          │
│    }                               │
│    ✓ User HAS LTE access           │
│                                    │
│ 10. Sync user to LTE database:     │
│    UPSERT INTO users {             │
│      id: decoded.sub,              │
│      email: decoded.email,         │
│      first_name: ...,              │
│      last_name: ...,               │
│      roles: decoded.roles,         │
│      synced_at: now(),             │
│      synced_from: 'skillpassport'  │
│    }                               │
│                                    │
│ 11. Create learner profile:        │
│    INSERT INTO learner_profiles {  │
│      user_id: decoded.sub,         │
│      grade_level: 'ug',            │
│      skill_level: 'beginner',      │
│      is_active: true,              │
│      created_at: now()             │
│    }                               │
│    ON CONFLICT (user_id) DO NOTHING│
│                                    │
│ 12. Generate LTE refresh token:    │
│    lteRefreshToken = jwt.sign({    │
│      sub: decoded.sub,             │
│      type: 'refresh',              │
│      jti: randomUUID(), ← unique   │
│      iat: now(),                   │
│      exp: now + 7 days             │
│    }, REFRESH_SECRET, 'HS256')     │
│                                    │
│ 13. Generate LTE access token:     │
│    lteAccessToken = jwt.sign({     │
│      sub: decoded.sub,             │
│      email: decoded.email,         │
│      roles: decoded.roles,         │
│      aud: 'lte',                   │
│      iat: now(),                   │
│      exp: now + 15 mins            │
│    }, JWT_PRIVATE_KEY, 'RS256')    │
│                                    │
│ 14. Set httpOnly cookie:           │
│    Set-Cookie: lte_refresh_token=..│
│      Domain=.rareminds.in          │
│      HttpOnly; Secure; SameSite=...│
│                                    │
│ 15. Return response:               │
│    {                               │
│      success: true,                │
│      access_token: lteAccessToken, │
│      refresh_token: lteRefreshToken,│
│      user: {                       │
│        id: decoded.sub,            │
│        email: decoded.email,       │
│        roles: decoded.roles        │
│      },                            │
│      expires_in: 900 (15 mins)     │
│    }                               │
└────────────────────────────────────┘
        ↓


Step 13: LTE Frontend Receives & Stores Tokens
┌──────────────────────────────────────┐
│ lte/src/app/router/SSOTokenVerifyGuard│
├──────────────────────────────────────┤
│                                      │
│ Response handler:                    │
│                                      │
│ if (response.ok) {                   │
│   const data = await response.json() │
│                                      │
│   1. Store in Zustand:               │
│      lteAuthStore.setState({         │
│        user: data.user,              │
│        accessToken: data...          │
│        refreshToken: data...         │
│        isAuthenticated: true,        │
│        expiresAt: now + 900          │
│      })                              │
│                                      │
│   2. Browser auto-saves cookie:      │
│      lte_refresh_token (HttpOnly)    │
│      Domain: .rareminds.in           │
│                                      │
│   3. Start token refresh service:    │
│      Schedule refresh at 12 mins     │
│                                      │
│   4. Remove token from URL:          │
│      navigate('/dashboard',          │
│        { replace: true })            │
│      ← Prevents token exposure       │
│        in browser history            │
│                                      │
│ } else {                             │
│   setError('Token verification failed')
│   setTimeout(() => {                 │
│     navigate('/auth/login')          │
│   }, 3000)                           │
│ }                                    │
└──────────────────────────────────────┘
        ↓


Step 14: LTE Dashboard Loads
┌──────────────────────────────┐
│ lte/src/app/App.tsx          │
│                              │
│ <BrowserRouter>              │
│   <AppRouter>                │
│     <ProtectedRoute>         │
│       <MainLayout>           │
│         <Header>             │
│         <Sidebar>            │
│         <Outlet>             │
│           <Dashboard />      │
│       </MainLayout>          │
│     </ProtectedRoute>        │
│   </AppRouter>               │
│ </BrowserRouter>             │
│                              │
│ Dashboard renders:           │
│ - "Welcome, User Name!"      │
│ - Learning paths             │
│ - Courses                    │
│ - Progress stats             │
│ - Header:                    │
│   ├─ LTE Logo               │
│   ├─ User name + profile    │
│   └─ "Back to SkillPassport"│
│ - Sidebar:                   │
│   ├─ Dashboard (active)     │
│   ├─ Courses                │
│   ├─ Progress               │
│   └─ Learning Paths         │
└──────────────────────────────┘


Step 15: Ongoing API Calls with Auth
┌──────────────────────────────┐
│ LTE Frontend makes request   │
├──────────────────────────────┤
│ GET /api/courses             │
│                              │
│ Headers auto-sent:           │
│ Authorization: Bearer <token>│
│ Cookie: lte_refresh_token=...│
│         (sent by browser)    │
│                              │
│ Backend verifies:            │
│ 1. Extract token from header │
│ 2. Verify signature (RS256)  │
│    with JWT_PUBLIC_KEY       │
│ 3. Check expiry              │
│ 4. Extract user_id           │
│ 5. Fetch data for user       │
│ 6. Return response           │
└──────────────────────────────┘


Step 16: Token Refresh (Auto, at 12 mins)
┌──────────────────────────────┐
│ Token Refresh Service        │
├──────────────────────────────┤
│ Triggered at: 12 mins (80%)  │
│ Before expiry: 15 mins (100%)│
│                              │
│ POST /api/auth/refresh       │
│ {                            │
│   refresh_token: '...'       │
│ }                            │
│                              │
│ Backend:                     │
│ 1. Verify refresh token      │
│ 2. Check if revoked (in DB)  │
│ 3. Create new access token   │
│ 4. Optional: Rotate refresh  │
│ 5. Return new tokens         │
│                              │
│ Frontend updates store:      │
│ lteAuthStore.setState({      │
│   accessToken: newToken      │
│ })                           │
│                              │
│ Continue seamlessly...       │
└──────────────────────────────┘


Step 17: User Clicks "Back to SkillPassport"
┌──────────────────────────────┐
│ LTE Header                   │
├──────────────────────────────┤
│ Button: "Back to SkillPassport"
│                              │
│ onClick: {                   │
│   window.location.href =     │
│   'https://skillpassport.    │
│   rareminds.in/learner/      │
│   dashboard'                 │
│ }                            │
│                              │
│ Browser navigates to:        │
│ skillpassport.rareminds.in   │
│                              │
│ Sends cookies:               │
│ - refresh_token (from SSO)   │
│ - lte_refresh_token (from LTE)
│   (both because Domain=...)  │
└──────────────────────────────┘
        ↓

SkillPassport recognizes:
  - User still authenticated
  - Access token still valid
  - Can continue using app
  - Or click "Go to LTE" again


┌────────────────────────────────────────────────────────────────────────────┐
│                             END FLOW                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Token Refresh Strategy: Why Each App Needs Its Own Tokens

### Why LTE Can't Use SkillPassport's Refresh Token Directly

**Problem: Different Token Lifecycles & Secrets**

```
SkillPassport Refresh Token:
├─ Algorithm: RS256 (Asymmetric)
├─ Secret: JWT_PRIVATE_KEY (only SSO has this)
├─ Purpose: Refresh SKILLPASSPORT access tokens
├─ Scope: SkillPassport app only
└─ Issue: LTE doesn't have the PRIVATE_KEY to verify RS256

LTE Refresh Token (after SSO verification):
├─ Algorithm: RS256 (Asymmetric)
├─ Private Key: JWT_PRIVATE_KEY (SSO has this - signs tokens)
├─ Public Key: JWT_PUBLIC_KEY (LTE has this - verifies tokens)
├─ Purpose: Refresh LTE access tokens
├─ Scope: LTE app only
└─ Benefit: LTE can verify locally with public key (no RPC needed)
```

**Example Token Mismatch:**

```typescript
// SkillPassport's refresh token (RS256 - asymmetric)
{
  sub: "user-123",
  type: "refresh",
  aud: "skillpassport",  ← Audience is SkillPassport
  iat: 1689600000,
  exp: 1690204800
}
// Signed with SSO's PRIVATE_KEY

// LTE receives this token and tries to use it
// Problem 1: Audience mismatch (aud: skillpassport, not lte)
// Problem 2: Cannot verify RS256 without PRIVATE_KEY
// Problem 3: Token designed for SkillPassport, not LTE
```

---

### Token Comparison: Why They Can't Be Interchanged

| Aspect | SkillPassport Token | LTE Token |
|--------|-------------------|-----------|
| **Algorithm** | RS256 (Asymmetric) | RS256 (Asymmetric) |
| **Signed By** | SSO Worker (JWT_PRIVATE_KEY) | SSO Worker (JWT_PRIVATE_KEY) |
| **Verified By** | SkillPassport (JWT_PUBLIC_KEY) | LTE (JWT_PUBLIC_KEY) |
| **Audience (aud)** | "skillpassport" | "lte" |
| **Purpose** | Refresh SkillPassport sessions | Refresh LTE sessions |
| **Verification** | Local verification with public key | Local verification with public key |
| **Cross-App Use** | ❌ LTE won't accept (aud mismatch) | ❌ SkillPassport won't accept (aud mismatch) |
| **Scope** | SkillPassport database context | LTE database context |

---

### Why LTE Needs Its Own Refresh Token

```
When LTE receives SkillPassport's access_token at /auth/sso/verify:
    ↓
LTE verifies it with SSO via RPC
    ↓
LTE creates SEPARATE refresh tokens:
    ├─ LTE access_token (RS256, 15 mins)
    │  └─ aud: "lte"
    │  └─ For LTE API calls only
    └─ LTE refresh_token (RS256, 7 days)
       └─ aud: "lte"
       └─ For LTE token refresh only
       └─ LTE can verify independently

Why separate tokens?
├─ Each app has its own session lifecycle
├─ Each app manages its own data scope
├─ LTE shouldn't depend on SkillPassport's secrets
├─ SkillPassport shouldn't depend on LTE's tokens
├─ Cross-app token reuse breaks isolation
└─ Security principle: Least privilege & separation of concerns
```

---

### Practical Code Example: Why Token Reuse Fails

```typescript
// ❌ WRONG: Trying to use SkillPassport's refresh token in LTE

// User logs in to SkillPassport, gets this token
const skillpassportRefreshToken = await jwt.sign({
  sub: "user-123",
  type: "refresh",
  aud: "skillpassport",        // ← Audience: SkillPassport only
  iat: Date.now() / 1000,
  exp: (Date.now() / 1000) + (7 * 24 * 60 * 60)
}, PRIVATE_KEY, { algorithm: 'RS256' });

// LTE tries to refresh using this token
// POST /api/auth/refresh
// Body: { refresh_token: skillpassportRefreshToken }

// Problem 1: Audience mismatch
const payload = jwt.decode(skillpassportRefreshToken);
if (payload.aud !== 'lte') {
  // ❌ Token not intended for LTE
  return Response({ error: 'Token not for this app' }, { status: 401 });
}

// Problem 2: Audience mismatch prevents verification
// Token says aud: "skillpassport", but LTE checks for aud: "lte"
// Even if LTE tries to verify with JWT_PUBLIC_KEY (which it has):
try {
  const decoded = await jwt.verify(skillpassportRefreshToken, JWT_PUBLIC_KEY, {
    algorithms: ['RS256']
  });
  
  // ✓ Verification succeeds (RS256 works with public key)
  // But audience check fails:
  if (decoded.aud !== 'lte') {
    // ❌ Token not intended for LTE
    return Response({ error: 'Token not for this app' }, { status: 401 });
  }
} catch (error) {
  return Response({ error: 'Token verification failed' }, { status: 401 });
}

// Problem 3: Security isolation violation
// Even if verification somehow passed:
// → LTE could issue access tokens from SkillPassport's session
// → User could access LTE using SkillPassport's credentials
// → Breaks app isolation (confused deputy problem)
```

**✅ CORRECT: LTE Uses RPC to Get Its Own Tokens**

```typescript
// When LTE receives SkillPassport's access_token at /auth/sso/verify:

const skillpassportAccessToken = request.body.access_token;

// Step 1: Verify with SSO (RPC)
const ssoResult = await env.SSO_SERVICE.verifyToken({
  token: skillpassportAccessToken
});

if (!ssoResult.valid) {
  return Response({ error: 'Invalid token' }, { status: 401 });
}

// Step 2: SSO returns user claims
const userClaims = ssoResult.claims;
// {
//   sub: "user-123",
//   email: "user@example.com",
//   roles: ["learner"],
//   aud: "skillpassport"  // Original token was for SkillPassport
// }

// Step 3: SSO Worker creates SEPARATE LTE tokens using JWT_PRIVATE_KEY
// (This happens inside env.SSO_SERVICE.getMe() call)
const lteAccessToken = await jwt.sign({
  sub: userClaims.sub,
  email: userClaims.email,
  roles: userClaims.roles,
  aud: "lte",                  // ← NEW audience: LTE only
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (15 * 60)  // 15 mins
}, JWT_PRIVATE_KEY, { algorithm: 'RS256' });  // ← Same as SkillPassport

const lteRefreshToken = await jwt.sign({
  sub: userClaims.sub,
  type: "refresh",
  aud: "lte",                  // ← NEW audience: LTE only
  jti: crypto.randomUUID(),    // Unique ID for rotation tracking
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)  // 7 days
}, JWT_PRIVATE_KEY, { algorithm: 'RS256' });  // ← Same as SkillPassport

// Step 4: Return LTE's own tokens
return Response({
  success: true,
  access_token: lteAccessToken,
  user: { id: userClaims.sub, email: userClaims.email, roles: userClaims.roles }
}, {
  headers: {
    'Set-Cookie': `lte_refresh_token=${lteRefreshToken}; Domain=.rareminds.in; HttpOnly; Secure; SameSite=Lax`
  }
});

// Now:
// ✅ Each app has its own tokens with different audience (aud)
// ✅ LTE can verify its tokens locally with JWT_PUBLIC_KEY (no RPC needed)
// ✅ Both apps use same RS256 algorithm for consistency
// ✅ Apps are completely isolated by audience claim
// ✅ Token revocation is independent per app
// ✅ No cross-app token confusion (aud mismatch prevents usage)
```

---

### Consistent RPC Pattern for All Token Operations ✅

**SkillPassport Refresh (Uses RPC):**
```
POST /api/auth/refresh
    ↓
Receive: refresh_token (from httpOnly cookie)
    ↓
RPC: env.SSO_SERVICE.refresh(refresh_token)
    ↓
SSO Worker:
├─ Verify with PRIVATE_KEY (RS256)
├─ Check revocation in DB
├─ Issue new access_token
└─ Return new token
    ↓
Store new access_token in response
    ↓
Update httpOnly cookie
```

**Rationale:** SkillPassport is primary auth app. All token operations go through SSO Worker for security and single source of truth.

---

**LTE Refresh (Uses RPC + Local Verification):**
```
POST /api/auth/refresh
    ↓
Receive: lte_refresh_token (from httpOnly cookie)
    ↓
Option A: Local Verification (Fast)
├─ jwt.verify(token, JWT_PUBLIC_KEY)
├─ Check aud === "lte"
├─ Check jti not in revoked list
└─ Return new access_token signed by SSO
    ↓
Option B: RPC Verification (Extra Safe)
├─ RPC: env.SSO_SERVICE.refreshLteToken(refresh_token)
├─ SSO verifies and checks revocation
├─ Return new access_token
    ↓
Store new access_token in response
    ↓
Update httpOnly cookie
```

**Rationale:** 
- LTE tokens use same RS256 as SkillPassport
- LTE can verify locally with JWT_PUBLIC_KEY (no RPC needed for refresh)
- Or use RPC for extra security + centralized revocation checks
- Both apps follow consistent architecture with RS256

---

### Token Lifecycle Comparison

| Aspect | SkillPassport | LTE |
|--------|---------------|-----|
| **Initial Token** | RPC: `.login()` → SSO | RPC: `.getMe()` → SSO |
| **Refresh Token** | RPC: `.refresh()` → SSO | Local verify + optional RPC |
| **Access Token** | 15 mins (RS256) | 15 mins (RS256) |
| **Refresh Token** | 7 days (RS256) | 7 days (RS256) |
| **Algorithm** | RS256 (Asymmetric) | RS256 (Asymmetric) |
| **Signed By** | SSO (JWT_PRIVATE_KEY) | SSO (JWT_PRIVATE_KEY) |
| **Verified By** | SkillPassport (JWT_PUBLIC_KEY) | LTE (JWT_PUBLIC_KEY) |
| **Revocation Check** | SSO Worker DB | SSO Worker DB |
| **Source of Truth** | SSO Worker | SSO Worker |
| **Consistency** | ✅ Centralized | ✅ Centralized |

---

### Why Both Use RPC?

```
✅ Single Source of Truth
   └─ All token operations managed by SSO Worker

✅ Centralized Security
   └─ Revocation checks in one place

✅ Consistent Architecture
   └─ Both apps follow same pattern

✅ Easier Maintenance
   └─ Changes to auth logic only in SSO

✅ Better Auditability
   └─ All token operations logged in SSO

✅ Simplified Token Rotation
   └─ SSO handles refresh token rotation
```

---

### Implementation Details

**SkillPassport Refresh Flow:**

```typescript
// skillpassport/functions/api/auth/refresh.ts
export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const refreshToken = request.headers.get('cookie')
      ?.split('; ')
      ?.find(c => c.startsWith('refresh_token='))
      ?.split('=')[1];

    if (!refreshToken) {
      return json({ error: 'No refresh token' }, { status: 401 });
    }

    // ✅ RPC call to SSO Worker
    const ssoResult = await (env.SSO_SERVICE as any).refresh({
      refresh_token: refreshToken
    });

    if (!ssoResult.success) {
      return json({ error: 'Refresh failed' }, { status: 401 });
    }

    // SSO returns new tokens
    const newAccessToken = ssoResult.access_token;
    const newRefreshToken = ssoResult.refresh_token; // Rotated or same

    return json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken
    }, {
      headers: {
        'Set-Cookie': `refresh_token=${newRefreshToken}; HttpOnly; Secure; SameSite=Lax; Domain=.rareminds.in; Max-Age=604800`
      }
    });
  } catch (error) {
    return json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**LTE Refresh Flow (Using RPC - Same Pattern as SkillPassport):**

```typescript
// lte/functions/api/auth/refresh.ts
export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    // Extract refresh token from httpOnly cookie
    const lteRefreshToken = request.headers.get('cookie')
      ?.split('; ')
      ?.find(c => c.startsWith('lte_refresh_token='))
      ?.split('=')[1];

    if (!lteRefreshToken) {
      return json({ error: 'No refresh token' }, { status: 401 });
    }

    // ✅ Option A: Local Verification (Fast)
    // Verify token locally using JWT_PUBLIC_KEY
    const decoded = await jwt.verify(
      lteRefreshToken,
      env.JWT_PUBLIC_KEY,
      { algorithms: ['RS256'] }
    );

    // Check revocation in database
    const isRevoked = await checkRevocation(decoded.jti);
    if (isRevoked) {
      return json({ error: 'Token revoked' }, { status: 401 });
    }

    // Issue new access token (signed by SSO - will be received from RPC)
    // OR Issue locally if LTE has JWT_PRIVATE_KEY
    const newAccessToken = await jwt.sign({
      sub: decoded.sub,
      email: decoded.email,
      aud: 'lte',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900  // 15 mins
    }, env.JWT_PRIVATE_KEY, { algorithm: 'RS256' });

    // Rotate refresh token
    const newRefreshToken = await jwt.sign({
      sub: decoded.sub,
      type: 'refresh',
      jti: crypto.randomUUID(),
      aud: 'lte',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 604800  // 7 days
    }, env.JWT_PRIVATE_KEY, { algorithm: 'RS256' });

    return json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 900
    }, {
      headers: {
        'Set-Cookie': `lte_refresh_token=${newRefreshToken}; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
      }
    });
  } catch (error) {
    console.error('LTE refresh error:', error);
    return json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

### Simplified Architecture: LTE Doesn't Need RPC for Refresh

Since LTE tokens use RS256 (same as SkillPassport), LTE can verify and refresh locally:

```typescript
// lte/functions/api/auth/refresh.ts

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // Extract refresh token from httpOnly cookie
    const lteRefreshToken = extractCookie(request, 'lte_refresh_token');
    if (!lteRefreshToken) {
      return json({ error: 'No refresh token' }, { status: 401 });
    }

    // ✅ Verify locally with JWT_PUBLIC_KEY (no RPC needed!)
    const decoded = await jwt.verify(
      lteRefreshToken,
      env.JWT_PUBLIC_KEY,  // Public key for RS256 verification
      { algorithms: ['RS256'] }
    );

    // Ensure token is for LTE
    if (decoded.aud !== 'lte') {
      return json({ error: 'Invalid audience' }, { status: 401 });
    }

    // Check revocation in database
    const revoked = await database.query(
      'SELECT * FROM revoked_tokens WHERE jti = $1',
      [decoded.jti]
    );
    
    if (revoked.length > 0) {
      return json({ error: 'Token revoked' }, { status: 401 });
    }

    // Issue new tokens (can be signed by SSO via RPC, or locally if LTE has private key)
    const newAccessToken = await signToken({
      sub: decoded.sub,
      email: decoded.email,
      aud: 'lte',
      exp: Math.floor(Date.now() / 1000) + 900  // 15 mins
    }, env.JWT_PRIVATE_KEY);

    const newRefreshToken = await signToken({
      sub: decoded.sub,
      type: 'refresh',
      aud: 'lte',
      jti: crypto.randomUUID(),
      exp: Math.floor(Date.now() / 1000) + 604800  // 7 days
    }, env.JWT_PRIVATE_KEY);

    return json({
      access_token: newAccessToken,
      expires_in: 900
    }, {
      headers: {
        'Set-Cookie': `lte_refresh_token=${newRefreshToken}; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
      }
    });
  } catch (error) {
    console.error('Token refresh failed:', error);
    return json({ error: 'Invalid refresh token' }, { status: 401 });
  }
}

// Helper: Sign token using JWT_PRIVATE_KEY
async function signToken(payload: any, privateKey: string) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setAudience(payload.aud)
    .sign(await importPKCS8(privateKey, 'RS256'));
}
```

**Key Benefits:**
- ✅ No RPC call needed (local verification with public key)
- ✅ Faster token refresh
- ✅ Same RS256 as SkillPassport (consistent algorithm)
- ✅ Audience enforcement prevents cross-app token use
- ✅ Revocation checks in local database

---

## Implementation Approach

### LTE Pages Functions & SSO Service Binding

Just like SkillPassport, **LTE needs its own Pages Functions with SSO_SERVICE binding**.

#### LTE Configuration Structure

```
LTE Project
├── src/
│   ├── app/
│   │   ├── router/
│   │   │   └── guards/
│   │   │       └── SSOTokenVerifyGuard.tsx  ← Frontend component
│   │   └── layouts/
│   └── pages/
├── functions/
│   └── api/
│       └── auth/
│           ├── sso-verify.ts     ← Backend endpoint (RPC to SSO)
│           ├── refresh.ts        ← Refresh tokens (RPC to SSO)
│           └── logout.ts         ← Clear session
└── wrangler.toml                ← Config with SSO_SERVICE binding
```

#### LTE wrangler.toml Configuration

```toml
# LTE Wrangler Configuration
pages_build_output_dir = "dist"
name = "lte-app"

# ============================================================================
# SERVICE BINDINGS (Critical for SSO Communication)
# ============================================================================

[[services]]
binding = "SSO_SERVICE"           # Same binding name as SkillPassport
service = "sso-api"               # Points to same SSO Worker
entrypoint = "SsoWorker"          # Entry point

# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================

[env.production.vars]
SKILLPASSPORT_URL = "https://skillpassport.rareminds.in"
LTE_APP_URL = "https://lte.rareminds.in"
DATABASE_URL = "https://your-supabase.supabase.co"

# ============================================================================
# SECRETS (Set via: wrangler secret put SECRET_NAME)
# ============================================================================
# JWT_PRIVATE_KEY = (SSO's private key - NEVER in vars, always in secrets)
# JWT_PUBLIC_KEY = (from SSO Worker - can be in vars or secrets)
# SUPABASE_SERVICE_ROLE_KEY = (database secret key)
```

#### Why LTE Can Use SSO_SERVICE Binding

```
SkillPassport Flow (RPC Approach):
  Frontend → POST /api/auth/login
            ↓
            Pages Function receives credentials
            ↓
            RPC call: env.SSO_SERVICE.login()
            ├─ Credentials sent to SSO Worker
            ├─ SSO verifies password
            ├─ SSO signs JWT with PRIVATE_KEY
            └─ Returns { access_token, refresh_token, user }
            ↓
            Return tokens to frontend

LTE Flow (SAME RPC Pattern - Option A):
  SkillPassport sends: access_token in URL
            ↓
            LTE Frontend → POST /api/auth/sso/verify
            ↓
            LTE Pages Function receives token
            ↓
            RPC call: env.SSO_SERVICE.verifyToken(access_token)
            ├─ SSO Worker receives token
            ├─ SSO verifies signature (has PRIVATE_KEY)
            ├─ SSO decodes & returns claims
            ├─ LTE syncs user to DB
            └─ LTE returns success
            ↓
            Return LTE tokens to frontend

LTE Flow (Direct Verification - Option B):
  SkillPassport sends: access_token in URL
            ↓
            LTE Frontend → POST /api/auth/sso/verify
            ↓
            LTE Pages Function receives token
            ↓
            Direct verification (no RPC):
            ├─ Get PUBLIC_KEY from env (cached)
            ├─ jwt.verify(token, PUBLIC_KEY)
            ├─ Decode & get claims
            ├─ LTE syncs user to DB
            └─ LTE returns success
            ↓
            Return LTE tokens to frontend
```

#### LTE Uses Same RPC Pattern as SkillPassport ✅

**IMPORTANT:** LTE does NOT have two approaches. LTE should use the **same RPC pattern** as SkillPassport.

```
SkillPassport Pattern (Existing):
  Frontend → Pages Function
            ├─ RPC: env.SSO_SERVICE.login(email, password)
            ├─ SSO Worker: verify password + sign JWT
            └─ Return: { access_token, refresh_token, user }

LTE Pattern (SAME - New):
  Frontend → Pages Function
            ├─ RPC: env.SSO_SERVICE.verifyToken(access_token)
            ├─ SSO Worker: verify signature + decode claims
            └─ Return: { valid, claims }
```

**Why RPC for LTE?**

✅ **Architectural Consistency** - Both apps use env.SSO_SERVICE binding  
✅ **Single Source of Truth** - SSO Worker owns all verification logic  
✅ **Code Reuse** - No duplicated verification logic  
✅ **Easier Maintenance** - Update verification in one place (SSO)  
✅ **Future Features** - Easy to add token revocation checks, rate limiting, etc.  
✅ **Same wrangler.toml** - Both use identical service binding setup  
✅ **Proven Pattern** - Already works in SkillPassport  

**Implementation for LTE:**

```typescript
// lte/functions/api/auth/sso-verify.ts

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const { access_token, from_app } = await request.json();

    if (!access_token || from_app !== 'skillpassport') {
      return json({ error: 'Invalid request' }, { status: 400 });
    }

    // ✅ RPC call to SSO Worker - Same pattern as SkillPassport!
    const ssoResult = await (env.SSO_SERVICE as any).verifyToken({
      token: access_token
    });

    if (!ssoResult.valid) {
      return json({ error: 'Invalid token' }, { status: 401 });
    }

    const claims = ssoResult.claims;
    
    // Validate claims
    if (!claims.is_email_verified || !claims.roles.includes('learner')) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    // Sync user to LTE DB + create LTE tokens
    // ... rest of logic ...

    return json({
      success: true,
      access_token: lteAccessToken,
      user: { id: claims.sub, email: claims.email, roles: claims.roles }
    });
  } catch (error) {
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**New SSO Worker Method Needed:**

```typescript
// sso-api/src/routes/verify-token.ts (NEW)

export async function verifyToken(params: { token: string }) {
  try {
    const decoded = await verifyAccessToken(params.token, env);
    
    return {
      valid: true,
      claims: decoded
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}
```

### Key Architectural Decisions

**1. Parallel Pages Functions Architecture**

Both SkillPassport and LTE have independent Pages Functions:

**SkillPassport Pages Functions:**
```
skillpassport/functions/api/auth/login.ts
  ├─ Receives: email + password
  ├─ RPC → env.SSO_SERVICE.login()
  ├─ SSO Worker creates JWT
  ├─ Returns: access_token + refresh_token
  └─ Sets: refresh_token cookie (Domain=.rareminds.in)

skillpassport/functions/api/auth/refresh.ts
  ├─ Receives: refresh_token (from cookie)
  ├─ RPC → env.SSO_SERVICE.refresh()
  ├─ SSO Worker issues new access_token
  └─ Returns: new access_token
```

**LTE Pages Functions (Using RPC - Same Pattern as SkillPassport):**
```
lte/functions/api/auth/sso-verify.ts
  ├─ Receives: access_token (from SkillPassport)
  ├─ Check: env.SSO_SERVICE binding exists
  ├─ RPC call: env.SSO_SERVICE.verifyToken({token: access_token})
  │  ├─ SSO Worker receives token
  │  ├─ Verifies signature (RS256 with PRIVATE_KEY)
  │  ├─ Decodes JWT payload
  │  └─ Returns: { valid: true, claims: {...} }
  ├─ Validate: is_email_verified, role includes 'learner'
  ├─ Sync user to LTE DB
  ├─ Create LTE tokens:
  │  ├─ accessToken (15 mins, RS256)
  │  └─ refreshToken (7 days, RS256)
  ├─ Sets: lte_refresh_token cookie (Domain=.rareminds.in)
  └─ Returns: { success, access_token, user }

lte/functions/api/auth/refresh.ts
  ├─ Receives: refresh_token (from httpOnly cookie)
  ├─ Verify: jwt.verify(token, REFRESH_TOKEN_SECRET)
  ├─ Check: token not expired
  ├─ Create new: access_token (15 mins)
  ├─ Optional: Rotate refresh_token (new jti)
  └─ Returns: { access_token, expires_in }

lte/functions/api/auth/logout.ts
  ├─ Receives: logout request (authenticated)
  ├─ Clear: Set-Cookie headers (expire cookies)
  ├─ Optional: RPC to SSO to mark session revoked
  └─ Returns: { success: true }
```

**Architecture Comparison:**

| Component | SkillPassport | LTE |
|-----------|---------------|-----|
| **Pages Functions** | ✅ Has | ✅ Has |
| **SSO_SERVICE Binding** | ✅ Uses for login/refresh | ✅ Uses for verify (Recommended) |
| **RPC Pattern** | `env.SSO_SERVICE.login()` | `env.SSO_SERVICE.getMe()` |
| **JWT Verification** | SSO does it (not Pages) | SSO does it (via RPC) |
| **Database** | SkillPassport DB | LTE DB |
| **Refresh Token Storage** | httpOnly cookie | httpOnly cookie |
| **Cookie Domain** | .rareminds.in | .rareminds.in |
| **Consistency** | Parent app | Child app (same pattern) |

---

**2. Shared Parent Domain Cookies**
```
Domain=.rareminds.in
  ├─ Accessible by skillpassport.rareminds.in
  ├─ Accessible by lte.rareminds.in
  └─ Survives navigation between apps
```

**2. RS256 (Asymmetric JWT)**
```
SSO Worker has:
  - Private Key (signs tokens)
  - Public Key (for verification)

LTE Backend has:
  - Public Key (verifies tokens)
  - NO private key needed
  
No secret sharing required!
```

**3. Token in URL (Temporary)**
```
https://lte.rareminds.in/auth/sso?
  access_token=eyJ...&
  from_app=skillpassport

After verification:
  navigate('/dashboard', { replace: true })
  ├─ Remove token from URL
  ├─ Prevent exposure in browser history
  └─ Clean state maintained
```

**4. Dual Token System**
```
Access Token (15 mins):
  - Short-lived
  - Used for API calls
  - In Authorization header

Refresh Token (7 days):
  - Long-lived
  - Rotatable
  - In httpOnly cookie
  - Only sent to /api/auth/* endpoints
```

---

## Service Binding Configuration Files

### SkillPassport wrangler.toml

**File: `skillpassport/wrangler.toml`**

```toml
# SkillPassport Wrangler Configuration

pages_build_output_dir = "dist"
name = "skill-passport-portal"
compatibility_date = "2026-06-08"
compatibility_flags = ["nodejs_compat"]

# ============================================================================
# SERVICE BINDINGS - RPC to SSO Worker
# ============================================================================

[[services]]
binding = "SSO_SERVICE"
service = "sso-api"
entrypoint = "SsoWorker"

[[services]]
binding = "PAYMENT_WORKER"
service = "razorpay-api"
entrypoint = "PaymentService"

[[services]]
binding = "EMAIL_SERVICE"
service = "shared-email-api"
entrypoint = "EmailService"

# ============================================================================
# DURABLE OBJECTS
# ============================================================================

[[durable_objects.bindings]]
name = "REALTIME_HUB"
class_name = "RealtimeHub"
script_name = "realtime-worker"

# ============================================================================
# VARIABLES - Non-sensitive configuration
# ============================================================================

[vars]
ENVIRONMENT = "production"
SUPABASE_URL = "https://dpooleduinyyzxgrcwko.supabase.co"
SKILLPASSPORT_URL = "https://skillpassport.rareminds.in"

# ============================================================================
# SECRETS - Set via: wrangler secret put KEY
# ============================================================================

# SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# REFRESH_COOKIE_DOMAIN = ".rareminds.in" (parent domain for cross-subdomain cookies)
```

### LTE wrangler.toml

**File: `lte/wrangler.toml`**

```toml
# LTE Wrangler Configuration

pages_build_output_dir = "dist"
name = "lte-app"
compatibility_date = "2026-06-08"
compatibility_flags = ["nodejs_compat"]

# ============================================================================
# SERVICE BINDINGS
# ============================================================================

# Option 1: If using RPC verification approach (for additional security)
[[services]]
binding = "SSO_SERVICE"
service = "sso-api"
entrypoint = "SsoWorker"

# ============================================================================
# DATABASE BINDING
# ============================================================================

[[d1_databases]]
binding = "DATABASE"
database_name = "lte-db"
database_id = "your-database-id"

# OR if using Supabase, use environment variables instead

# ============================================================================
# VARIABLES
# ============================================================================

[vars]
ENVIRONMENT = "production"
SUPABASE_URL = "https://your-lte-db.supabase.co"
SKILLPASSPORT_URL = "https://skillpassport.rareminds.in"
LTE_APP_URL = "https://lte.rareminds.in"

# ============================================================================
# SECRETS
# ============================================================================

# SUPABASE_SERVICE_ROLE_KEY (for LTE DB access)
# JWT_PUBLIC_KEY (from SSO Worker - for token verification)
# JWT_PRIVATE_KEY (if LTE generates its own tokens)
# REFRESH_TOKEN_SECRET (for LTE refresh token verification)
# REFRESH_COOKIE_DOMAIN = ".rareminds.in" (parent domain)
```

### Key Configuration Differences

| Setting | SkillPassport | LTE |
|---------|---------------|-----|
| **SSO_SERVICE Binding** | ✅ Required | ⚠️ Optional (recommended) |
| **DATABASE Binding** | SkillPassport DB | LTE DB |
| **REFRESH_COOKIE_DOMAIN** | `.rareminds.in` | `.rareminds.in` |
| **JWT_PUBLIC_KEY** | Not needed | ✅ Required (for verification) |
| **JWT_PRIVATE_KEY** | For signing | Optional (if generating LTE tokens) |

---

## Code Implementation

### SkillPassport: Add LTE Navigation

**File: `skillpassport/src/shared/lib/lte-navigation.ts`**

```typescript
/**
 * Generate LTE redirect URL with SSO token
 * Used when user clicks "Go to LTE" in dropdown
 */
export function generateLteRedirectUrl(): string {
  // Get current auth state
  const { accessToken, user } = authStore.getState();
  
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  // Build redirect URL
  const lteUrl = new URL('https://lte.rareminds.in/auth/sso');
  
  // Add parameters
  lteUrl.searchParams.set('access_token', accessToken);
  lteUrl.searchParams.set('from_app', 'skillpassport');
  lteUrl.searchParams.set('return_url', window.location.href);
  
  // Optional: Add user hint for faster loading
  lteUrl.searchParams.set('email', user?.email || '');
  
  return lteUrl.toString();
}

/**
 * Navigate to LTE with token
 */
export function navigateToLTE(): void {
  const url = generateLteRedirectUrl();
  
  // Replace history to prevent back button issues
  window.location.href = url;
  // OR open in new tab:
  // window.open(url, '_blank');
}
```

**File: `skillpassport/src/features/admin/ui/Header.tsx` (Update)**

```tsx
import { navigateToLTE } from '@/shared/lib/lte-navigation';

// In profile menu dropdown:
{showProfileMenu && (
  <div className="dropdown-menu">
    <button onClick={() => navigate(getSettingsPath())}>
      Settings
    </button>
    
    {/* NEW: LTE Navigation Link */}
    {user?.roles?.includes('learner') && (
      <button
        onClick={() => {
          try {
            navigateToLTE();
          } catch (error) {
            console.error('Failed to navigate to LTE:', error);
            // Show error toast
          }
        }}
        className="text-blue-600 hover:bg-blue-50"
      >
        ✨ Go to LTE
      </button>
    )}
    
    <button onClick={handleLogout} className="text-red-600">
      Logout
    </button>
  </div>
)}
```

### LTE: Add SSO Verification Route

**File: `lte/src/app/router/guards/SSOTokenVerifyGuard.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLTEAuthStore } from '@/shared/store/lteAuthStore';

const SSOTokenVerifyGuard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setTokens, setUser } = useLTEAuthStore();

  useEffect(() => {
    const verifyToken = async () => {
      try {
        // Extract token from URL
        const token = searchParams.get('access_token');
        const fromApp = searchParams.get('from_app');

        if (!token) {
          throw new Error('No authentication token provided');
        }

        if (fromApp !== 'skillpassport') {
          throw new Error('Invalid token source');
        }

        // Call backend to verify & exchange token
        const response = await fetch('/api/auth/sso/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: token,
            from_app: fromApp
          }),
          credentials: 'include'  // Send cookies
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Token verification failed');
        }

        const data = await response.json();

        // Store tokens in auth store
        setTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in
        });

        // Store user info
        setUser(data.user);

        // Redirect to dashboard (remove token from URL)
        navigate('/dashboard', { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Verification failed';
        setError(message);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/auth/login', { replace: true });
        }, 3000);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [searchParams, navigate, setTokens, setUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="mb-4 text-2xl">🔐</div>
          <p className="text-gray-700">Verifying your identity...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="mb-4 text-2xl">⚠️</div>
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default SSOTokenVerifyGuard;
```

### LTE: Backend Verification Endpoint

**File: `lte/functions/api/auth/sso-verify.ts`**

```typescript
import { Router } from 'itty-router';
import { json } from 'itty-router-extras';
import * as jwt from '@tsndr/cloudflare-worker-jwt';

const router = Router();

/**
 * POST /api/auth/sso/verify
 * 
 * Verifies JWT from SkillPassport and issues LTE tokens
 */
router.post('/api/auth/sso/verify', async (request, env) => {
  try {
    const { access_token, from_app } = await request.json();

    if (!access_token) {
      return json({ error: 'Token required' }, { status: 400 });
    }

    if (from_app !== 'skillpassport') {
      return json({ error: 'Invalid source app' }, { status: 400 });
    }

    // Decode token to get public key ID
    const decoded = jwt.decode(access_token);
    if (!decoded) {
      return json({ error: 'Invalid token format' }, { status: 400 });
    }

    const header = decoded.header as any;
    const payload = decoded.payload as any;

    // Get public key from SSO (based on kid)
    const publicKey = env.JWT_PUBLIC_KEY;  // Fetched from SSO or config

    // Verify JWT signature with public key
    try {
      const isValid = await jwt.verify(
        access_token,
        publicKey,
        { algorithm: 'RS256' }  // Asymmetric verification
      );

      if (!isValid) {
        return json({ error: 'Invalid token signature' }, { status: 401 });
      }
    } catch (verifyError) {
      console.error('JWT verification failed:', verifyError);
      return json({ error: 'Token verification failed' }, { status: 401 });
    }

    // Extract claims from verified token
    const sub = payload.sub;
    const email = payload.email;
    const roles = payload.roles || [];
    const isEmailVerified = payload.is_email_verified;
    const products = payload.products || [];

    // Verify email is verified
    if (!isEmailVerified) {
      return json({ error: 'Email not verified' }, { status: 403 });
    }

    // Verify user is a learner
    if (!roles.includes('learner')) {
      return json({ error: 'Only learners can access LTE' }, { status: 403 });
    }

    // Verify user has LTE product access
    if (!products.includes('lte')) {
      return json({ error: 'No LTE access' }, { status: 403 });
    }

    // Sync user to LTE database
    const database = env.DATABASE;  // D1 or Supabase

    // Upsert user
    await database
      .prepare(
        `INSERT INTO users (id, email, first_name, roles, synced_at, synced_from)
         VALUES (?, ?, ?, ?, datetime('now'), 'skillpassport')
         ON CONFLICT (id) DO UPDATE SET
           email = excluded.email,
           synced_at = datetime('now')`
      )
      .bind(sub, email, payload.name || '', JSON.stringify(roles))
      .run();

    // Create learner profile if not exists
    await database
      .prepare(
        `INSERT INTO learner_profiles (user_id, grade_level, skill_level, is_active)
         VALUES (?, 'ug', 'beginner', true)
         ON CONFLICT (user_id) DO NOTHING`
      )
      .bind(sub)
      .run();

    // Generate LTE access token (15 mins)
    const lteAccessToken = await jwt.sign(
      {
        sub,
        email,
        roles,
        aud: 'lte',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900
      },
      env.JWT_PRIVATE_KEY,
      { algorithm: 'RS256' }
    );

    // Generate LTE refresh token (7 days)
    const lteRefreshToken = await jwt.sign(
      {
        sub,
        type: 'refresh',
        jti: crypto.randomUUID(),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 604800
      },
      env.JWT_PRIVATE_KEY,
      { algorithm: 'RS256' }
    );

    // Set httpOnly cookie with parent domain
    const headers = new Headers({
      'Set-Cookie': `lte_refresh_token=${lteRefreshToken}; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
    });

    return json(
      {
        success: true,
        access_token: lteAccessToken,
        refresh_token: lteRefreshToken,
        user: {
          id: sub,
          email,
          roles
        },
        expires_in: 900
      },
      { headers }
    );
  } catch (error) {
    console.error('SSO verification error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});

export default router;
```

### LTE Auth Store

**File: `lte/src/shared/store/lteAuthStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface LTEUser {
  id: string;
  email: string;
  roles: string[];
}

interface LTEAuthState {
  user: LTEUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  expiresAt: number | null;

  setTokens: (tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }) => void;

  setUser: (user: LTEUser) => void;

  refreshAccessToken: () => Promise<boolean>;

  logout: () => Promise<void>;

  isTokenExpired: () => boolean;
}

export const useLTEAuthStore = create<LTEAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      expiresAt: null,

      setTokens: (tokens) => {
        const expiresAt = Math.floor(Date.now() / 1000) + tokens.expiresIn;

        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt,
          isAuthenticated: true
        });

        // Schedule token refresh at 80% of lifetime
        scheduleTokenRefresh(expiresAt);
      },

      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },

      refreshAccessToken: async () => {
        const refreshToken = get().refreshToken;

        if (!refreshToken) {
          set({ isAuthenticated: false });
          return false;
        }

        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
            credentials: 'include'
          });

          if (!response.ok) {
            throw new Error('Refresh failed');
          }

          const data = await response.json();

          get().setTokens({
            accessToken: data.access_token,
            refreshToken: data.refresh_token || refreshToken,
            expiresIn: data.expires_in
          });

          return true;
        } catch (error) {
          console.error('Token refresh error:', error);
          set({ isAuthenticated: false });
          return false;
        }
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            expiresAt: null
          });
        }
      },

      isTokenExpired: () => {
        const expiresAt = get().expiresAt;
        if (!expiresAt) return true;

        const now = Math.floor(Date.now() / 1000);
        return now > expiresAt - 60;  // 60s buffer
      }
    }),
    {
      name: 'lte-auth',
      storage: createJSONStorage(() => sessionStorage)
    }
  )
);

function scheduleTokenRefresh(expiresAt: number): void {
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = expiresAt - now;
  
  // Refresh at 80% of lifetime
  const refreshAt = Math.max(0, Math.floor(timeUntilExpiry * 0.8 * 1000));

  setTimeout(() => {
    useLTEAuthStore.getState().refreshAccessToken();
  }, refreshAt);
}
```

### LTE Router Setup

**File: `lte/src/app/router/AppRouter.tsx` (Update)**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SSOTokenVerifyGuard from './guards/SSOTokenVerifyGuard';
import ProtectedRoute from './guards/ProtectedRoute';
import MainLayout from '@/app/layouts/MainLayout';
import AuthLayout from '@/app/layouts/AuthLayout';
import Dashboard from '@/pages/Dashboard';
import LoginPage from '@/pages/auth/LoginPage';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/auth/login" element={<LoginPage />} />
          
          {/* SSO Verification Route (NEW) */}
          <Route path="/auth/sso" element={<SSOTokenVerifyGuard />} />
        </Route>

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Additional routes... */}
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
};
```

---

## Security Considerations

### 1. Cookie Domain Security

```
Set-Cookie: refresh_token=...;
  Domain=.rareminds.in       ← Parent domain
  Path=/                      ← All paths
  HttpOnly                    ← No JS access
  Secure                      ← HTTPS only
  SameSite=Lax                ← CSRF protection (allows redirects)
  Max-Age=604800              ← 7 days
```

**Why `.rareminds.in`?**
- `.rareminds.in` (leading dot) = subdomain wildcard
- Accessible by: `skillpassport.rareminds.in`, `lte.rareminds.in`, etc.
- NOT accessible by other domains: `.example.com`, `.notrareminds.in`

### 2. Token Security

```
Access Token:
  ├─ 15 minute lifetime
  ├─ Asymmetric (RS256)
  ├─ In Authorization header
  └─ Can be verified without private key

Refresh Token:
  ├─ 7 day lifetime
  ├─ In httpOnly cookie
  ├─ Symmetric (HS256)
  ├─ Rotatable (new jti on each use)
  └─ Checked against DB for revocation
```

### 3. URL Token Safety

```
Generated URL:
  https://lte.rareminds.in/auth/sso?access_token=eyJ...

Risk: Browser history leaks token
      User bookmarks URL
      URL appears in logs

Mitigation:
  1. Verify token on backend
  2. Immediately redirect with replace:
     navigate('/dashboard', { replace: true })
  3. Remove token from history
  4. Use HTTPS only
```

### 4. Cross-Domain CORS

```
If LTE backend at different origin:
  POST https://api.lte.rareminds.in/auth/sso/verify
  
  Response headers:
  Access-Control-Allow-Origin: https://lte.rareminds.in
  Access-Control-Allow-Credentials: true
  Access-Control-Allow-Methods: POST
```

---

## Summary

### Complete RPC Architecture: Both Apps Use SSO Worker ✅

**SkillPassport RPC Methods:**
```
1. env.SSO_SERVICE.login(email, password)
   → SSO verifies password
   → Signs JWT
   → Returns tokens

2. env.SSO_SERVICE.refresh(refresh_token)
   → SSO verifies refresh token
   → Issues new access_token
   → Returns new tokens
```

**LTE RPC Methods:**
```
1. env.SSO_SERVICE.verifyToken(access_token)
   → SSO verifies signature
   → Decodes claims
   → Returns validation result

2. env.SSO_SERVICE.refreshLteToken(refresh_token)
   → SSO verifies refresh token
   → Issues new LTE access_token
   → Rotates refresh_token
   → Returns new tokens
```

**All 4 operations use RPC - SSO Worker is single source of truth!**

### Flow in One Sentence
User logs into SkillPassport, clicks "Go to LTE", SkillPassport passes their JWT token to LTE, LTE **uses RPC to verify via SSO Worker** (no secret sharing!), syncs user to LTE database, and redirects to LTE dashboard.

### Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| SkillPassport Frontend | React + Zustand | Login, dropdown navigation |
| SkillPassport Pages Func | Cloudflare Pages | RPC: `env.SSO_SERVICE.login()` |
| LTE Frontend | React + Zustand | SSO verification, dashboard |
| LTE Pages Func | Cloudflare Pages | RPC: `env.SSO_SERVICE.getMe()` |
| SSO Worker | Cloudflare Worker | JWT signing + verification (RS256) |
| Cookies | httpOnly on `.rareminds.in` | Secure cross-domain session storage |
| JWT | RS256 Asymmetric | SSO owns all verification logic |
| Database | PostgreSQL (Supabase) | User sync + role management |

### Implementation Checklist

- [ ] Update SkillPassport Header to add "Go to LTE" link
- [ ] Create lte-navigation.ts utility function
- [ ] Create SSOTokenVerifyGuard component in LTE
- [ ] Implement /api/auth/sso/verify endpoint
- [ ] Create LTE auth store (lteAuthStore.ts)
- [ ] Update LTE AppRouter with /auth/sso route
- [ ] Configure domain for .rareminds.in cookies
- [ ] Set JWT_PUBLIC_KEY in LTE environment
- [ ] Test token verification locally
- [ ] Test cross-domain navigation
- [ ] Deploy to staging
- [ ] Full UAT and load testing
- [ ] Monitor production logs

---

## ✨ Key Clarification: LTE Uses Same RPC Pattern as SkillPassport

### NOT Two Approaches - One Pattern!

**Previously mentioned "two approaches" are consolidated into ONE:**

❌ **Do NOT use direct JWT verification** with public key  
✅ **DO use RPC to SSO Worker** (like SkillPassport)

### Why Both Apps Use RPC

```
SkillPassport Pattern (Proven):          LTE Pattern (Same):
┌─────────────────────────────┐         ┌──────────────────────────┐
│ Pages Function              │         │ Pages Function           │
│ ├─ Receive credentials      │         │ ├─ Receive JWT           │
│ ├─ RPC to SSO_SERVICE       │         │ ├─ RPC to SSO_SERVICE    │
│ │  .login()                 │         │ │  .getMe()        │
│ └─ Return tokens            │         │ └─ Return validation      │
└─────────────────────────────┘         └──────────────────────────┘

Both patterns:
├─ Use env.SSO_SERVICE binding
├─ Same wrangler.toml setup
├─ Single source of truth (SSO Worker)
└─ No duplicated verification logic
```

### SSO Worker Methods

```typescript
// Existing methods (SkillPassport uses):
export class SsoWorker {
  async login(params: { email, password, ip?, ua? }) { ... }
  async refresh(params: { refresh_token }) { ... }
  async logout(params: { session_id }) { ... }

  // ✨ NEW METHOD (LTE uses):
  async verifyToken(params: { token: string }) {
    const decoded = await verifyAccessToken(params.token, env);
    return { valid: true, claims: decoded };
  }
}
```

### Implementation Checklist

**LTE wrangler.toml:**
```toml
[[services]]
binding = "SSO_SERVICE"
service = "sso-api"
entrypoint = "SsoWorker"

[[d1_databases]]
binding = "DATABASE"
database_name = "lte-db"

[vars]
REFRESH_COOKIE_DOMAIN = ".rareminds.in"
```

**LTE Backend (sso-verify.ts):**
```typescript
// RPC call - Same pattern as SkillPassport!
const ssoResult = await (env.SSO_SERVICE as any).verifyToken({
  token: access_token
});
```

This completes the cross-domain SSO implementation blueprint!

---

## Architecture Summary: SkillPassport & LTE with SSO

### Complete System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLOUDFLARE WORKERS                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    SSO Worker                                │  │
│  │  (Central Authentication Service)                           │  │
│  │                                                              │  │
│  │  ├─ Routes:                                                 │  │
│  │  │  ├─ POST /auth/login → RS256 sign JWT                  │  │
│  │  │  ├─ POST /auth/refresh → Issue new tokens             │  │
│  │  │  ├─ POST /auth/signup → Create user                   │  │
│  │  │  └─ GET /.well-known/jwks.json → Public keys          │  │
│  │  │                                                         │  │
│  │  ├─ Database Access:                                      │  │
│  │  │  ├─ Query: users, memberships, sessions               │  │
│  │  │  └─ Mutate: Create session, update last_login         │  │
│  │  │                                                         │  │
│  │  ├─ Keys:                                                 │  │
│  │  │  ├─ JWT_PRIVATE_KEY (signs tokens with RS256)         │  │
│  │  │  ├─ JWT_PUBLIC_KEY (for verification export)          │  │
│  │  │  └─ JWT_KID (key rotation ID)                         │  │
│  │  └─ No refresh token secrets (stateless)                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          ↑              ↑                           │
│                    RPC binding    RPC binding                       │
│                          │              │                           │
│  ┌───────────────────────┴──┐  ┌────────┴──────────────────────┐  │
│  │ SkillPassport Pages Func │  │  LTE Pages Functions         │  │
│  │ (skill-passport-portal)  │  │  (lte-app)                   │  │
│  │                          │  │                              │  │
│  │ ├─ login.ts:             │  │ ├─ sso-verify.ts:            │  │
│  │ │  POST /api/auth/login  │  │ │  POST /api/auth/sso/verify │  │
│  │ │  ├─ Receive: email+pwd │  │ │  ├─ Receive: access_token  │  │
│  │ │  ├─ RPC: SSO_SERVICE   │  │ │  ├─ Verify JWT (RS256 pub)  │  │
│  │ │  │    .login()         │  │ │  ├─ Decode claims           │  │
│  │ │  ├─ Return: JWT tokens │  │ │  ├─ Sync to LTE DB         │  │
│  │ │  └─ Set: refresh cookie │  │ │  └─ Return: LTE tokens    │  │
│  │ │                        │  │ │                            │  │
│  │ ├─ refresh.ts:           │  │ ├─ refresh.ts:              │  │
│  │ │  POST /api/auth/refresh│  │ │  POST /api/auth/refresh    │  │
│  │ │  ├─ Receive: refresh   │  │ │  ├─ Receive: refresh token │  │
│  │ │  ├─ RPC: SSO_SERVICE   │  │ │  ├─ Verify & issue new     │  │
│  │ │  │    .refresh()       │  │ │  └─ Return: new access    │  │
│  │ │  └─ Return: new JWT    │  │ │                            │  │
│  │ │                        │  │ ├─ logout.ts:               │  │
│  │ └─ Database: SkillPass   │  │ │  Clear httpOnly cookies    │  │
│  │   DB (Supabase)          │  │ └─ Database: LTE DB          │  │
│  │                          │  │   (Supabase)                │  │
│  │ wrangler.toml:           │  │ wrangler.toml:              │  │
│  │ ├─ SSO_SERVICE binding   │  │ ├─ SSO_SERVICE (optional)   │  │
│  │ └─ REFRESH_COOKIE_DOMAIN │  │ ├─ DATABASE binding         │  │
│  │    = .rareminds.in       │  │ └─ REFRESH_COOKIE_DOMAIN    │  │
│  │                          │  │    = .rareminds.in          │  │
│  └──────────────────────────┘  └────────────────────────────────┘  │
│           ↑                                  ↑                      │
│           │ HTTPS                           │ HTTPS                │
│           │ POST /api/auth/...              │ POST /api/auth/...   │
│           │                                 │                      │
└───────────┼─────────────────────────────────┼──────────────────────┘
            │                                 │
            ↓                                 ↓
   ┌──────────────────┐            ┌──────────────────┐
   │   Browser        │            │   Browser        │
   │   (SkillPass)    │            │   (LTE)          │
   │                  │            │                  │
   │ skillpassport.   │            │ lte.rareminds.in │
   │ rareminds.in     │            │                  │
   │                  │            │                  │
   │ ┌──────────────┐ │            │ ┌──────────────┐ │
   │ │ Frontend     │ │            │ │ Frontend     │ │
   │ │ (React)      │ │            │ │ (React)      │ │
   │ │ Zustand      │ │            │ │ Zustand      │ │
   │ │ auth store   │ │            │ │ auth store   │ │
   │ └──────────────┘ │            │ └──────────────┘ │
   │                  │            │                  │
   │ Cookies:         │            │ Cookies:        │
   │ ├─ refresh_token │            │ ├─ lte_refresh  │
   │ │  (httpOnly)    │            │ │  (httpOnly)    │
   │ │  Domain=       │            │ │  Domain=       │
   │ │  .rareminds.in │            │ │  .rareminds.in │
   │ └─ (auto-sent)   │            │ └─ (auto-sent)   │
   │                  │            │                  │
   └──────────────────┘            └──────────────────┘
            │                                 │
            └─────────────── ← → ─────────────┘
                Cross-domain navigation
                (via URL with access_token)
```

### Data Flow: Complete User Journey (With RPC Pattern)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: LOGIN & SKILLPASSPORT AUTHENTICATION                           │
└─────────────────────────────────────────────────────────────────────────┘

T+0s  Browser → https://skillpassport.rareminds.in
      └─ Frontend (React) loads

T+1s  User enters email + password
      └─ Click LOGIN button

T+2s  POST /api/auth/login (credentials sent)
      Browser                 SkillPassport Pages Function     SSO Worker
      │                              │                            │
      ├──── email, password ────────>│                            │
      │                              ├─ RPC: .login() ──────────>│
      │                              │                            │
      │                              │  Verify password & sign JWT│
      │                              │<─ { access_token, user } ──┤
      │                              │                            │
      │ { access_token, ... } <──────┤                            │
      │                              │                            │
      ├─ Set httpOnly cookie         │                            │
      │  (refresh_token)             │                            │
      │  Domain=.rareminds.in        │                            │
      │                              │                            │
      └─ Store in Zustand           │                            │
         auth store                  │                            │

T+3s  Redirect to /learner/dashboard
      └─ SkillPassport authenticated


┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: CROSS-DOMAIN NAVIGATION TO LTE                                 │
└─────────────────────────────────────────────────────────────────────────┘

T+4s  User clicks "Go to LTE" in dropdown
      └─ navigateToLTE()
         └─ Generate: https://lte.rareminds.in/auth/sso?access_token=...

T+5s  Browser navigates to LTE
      └─ Sends both cookies (.rareminds.in domain):
         ├─ refresh_token (from SkillPassport)
         └─ Any other shared cookies

T+6s  LTE Frontend: SSOTokenVerifyGuard.tsx mounts
      └─ Extract access_token from URL
      └─ POST /api/auth/sso/verify { access_token }


┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: LTE BACKEND VERIFICATION (RPC to SSO)                          │
└─────────────────────────────────────────────────────────────────────────┘

T+7s  LTE Pages Function: sso-verify.ts
      Browser                  LTE Pages Function         SSO Worker
      │                              │                        │
      ├─ access_token ───────────────>│                       │
      │                              ├─ RPC: .getMe() >│
      │                              │                        │
      │                              │  Verify signature     │
      │                              │  Decode claims        │
      │                              │<─ { valid, claims } ──┤
      │                              │                        │
      │                              ├─ Sync to LTE DB       │
      │                              ├─ Create LTE tokens    │
      │                              ├─ Set httpOnly cookie  │
      │                              │  (lte_refresh_token)  │
      │                              │  Domain=.rareminds.in │
      │                              │                        │
      │ { access_token, ... } <──────┤                       │
      │                              │                        │

T+8s  LTE Frontend: SSOTokenVerifyGuard receives response
      └─ Store in lteAuthStore
      └─ navigate('/dashboard', { replace: true })
         └─ Remove token from URL (security)

T+9s  LTE Dashboard loads
      └─ MainLayout + child pages render


┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: ONGOING API CALLS & AUTO-REFRESH                               │
└─────────────────────────────────────────────────────────────────────────┘

T+10s User navigates within LTE
      GET /api/courses
      ├─ Authorization: Bearer <access_token>
      ├─ Verify locally (HS256)
      ├─ Extract user_id
      └─ Return user data

T+12m Token auto-refresh triggered

      SkillPassport Refresh (Via RPC):
      POST /api/auth/refresh
      Browser                SkillPassport Pages Function   SSO Worker
      │                             │                          │
      ├─ refresh_token ────────────>│                          │
      │                             ├─ RPC: .refresh() ────────>│
      │                             │                          │
      │                             │  Verify RS256 PRIVATE_KEY│
      │                             │  Check revocation        │
      │                             │<─ new access_token ──────┤
      │                             │                          │
      │ { access_token } <──────────┤                          │
      │                             │                          │
      └─ Update httpOnly cookie     │                          │

      LTE Refresh (Also Via RPC - SAME PATTERN):
      POST /api/auth/refresh
      Browser                LTE Pages Function            SSO Worker
      │                             │                          │
      ├─ lte_refresh_token ────────>│                          │
      │                             ├─ RPC: .refreshSession()>│
      │                             │                          │
      │                             │  Verify HS256 SECRET     │
      │                             │  Check revocation        │
      │                             │  Rotate refresh_token    │
      │                             │<─ new access_token ──────┤
      │                             │                          │
      │ { access_token } <──────────┤                          │
      │                             │                          │
      └─ Update httpOnly cookie     │                          │

      ✅ Both apps use RPC to SSO Worker
      ✅ Consistent architecture
      ✅ SSO is single source of truth


┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: NAVIGATION & LOGOUT                                            │
└─────────────────────────────────────────────────────────────────────────┘

T+30m User clicks "← Back to SkillPassport"
      window.location.href = "https://skillpassport.rareminds.in"
      └─ Browser sends refresh_token (still valid)
      └─ SkillPassport recognizes user

T+45m User logs out (from either app)
      POST /api/auth/logout
      ├─ Clear all httpOnly cookies
      ├─ Optional: Mark tokens revoked in DB
      └─ Redirect to /auth/login


Key Security Flow:
SkillPassport                       SSO Worker                    LTE
┌──────────────┐                ┌──────────────┐            ┌──────────────┐
│ .login()     │────RPC────────>│ Verify & Sign│            │              │
│              │                │ with RS256   │            │              │
│              │<───RPC─────────│ Private Key  │            │              │
│              │                └──────────────┘            │              │
│              │                                            │              │
│ User has     │                                            │              │
│ access_token │                                            │              │
└──────────────┘                                            │              │
     │                                                       │              │
     │ Pass token in URL                                    │              │
     └─────────────────────────────────────────────────────>│              │
                                                    │ .getMe() │
                                                    │ with RS256     │
                                                    │ Public Key     │
                                                    │ (RPC to SSO)   │
                                                    └──────────────┘
                                                             │
                                                    Create LTE tokens
                                                             │
                                                    Redirect to dashboard
```

### Key Takeaways

1. **Both Apps Have Pages Functions**
   - SkillPassport: Creates & manages SSO tokens
   - LTE: Verifies & exchanges tokens

2. **No Secret Sharing**
   - SSO has private key (signs)
   - LTE has public key (verifies)
   - RS256 asymmetric crypto

3. **Parallel Databases**
   - SSO Database: Central user source (generic users)
   - SkillPassport Database: SkillPassport-specific data
   - LTE Database: LTE-specific data (synced from SSO)

4. **Shared Cookie Domain**
   - Domain=`.rareminds.in` enables cross-subdomain sharing
   - httpOnly prevents XSS theft
   - Secure flag enforces HTTPS

5. **RPC Service Bindings**
   - SkillPassport uses RPC to call SSO methods
   - LTE can optionally use RPC (direct verification recommended)
   - Both communicate via internal Cloudflare network

This architecture enables seamless cross-domain SSO without exposing secrets! 🎉

