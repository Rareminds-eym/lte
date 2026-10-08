# Backend Functions (Serverless/Cloud Functions)

## Description
The **functions** folder contains serverless backend functions (AWS Lambda, Firebase Functions, Netlify Functions, etc.) that handle server-side logic, API endpoints, and business operations. These functions are organized by domain and purpose, providing a clean separation between frontend and backend concerns.

## Purpose
- Implement backend API endpoints and business logic
- Handle authentication and authorization
- Process data operations (CRUD)
- Manage file uploads and storage
- Send notifications and emails
- Validate and sanitize data
- Integrate with external services and databases
- Provide middleware for request/response processing

## Architecture Pattern

This follows a **modular serverless architecture** where:
- Each folder represents a domain or feature area
- Functions are independently deployable
- Shared code and middleware are reusable
- Clear separation of concerns

## Directory Structure

```
functions/
├── README.md                      # This file
│
├── api/                           # Cloudflare Pages API Endpoints (/api/v1/*)
│   └── (All /api/auth/* and /api/v1/auth/* browser routes delegated to Auth Core handleBrowserRequest)
│
├── lib/                           # Serverless helper functions & clients
│   ├── env.ts                     # Environment validation helpers
│   ├── http.ts                    # HTTP request parsing & error helpers
│   ├── logger.ts                  # Serverless function logger utility
│   ├── supabase.ts                # Service Supabase client
│   └── sync-shadow.ts             # SSO user shadow profile syncing
│
├── middleware/                    # Reusable middleware
│   ├── auth.ts                    # Authentication middleware (createAuth + requireProduct)
│   ├── errorHandler.ts            # Error handling
│   └── cors.ts                    # CORS configuration
│
├── schemas/                       # Validation schemas
│   └── index.ts                   # Schema exports
│
└── shared/                        # Shared utilities & definitions
    ├── index.ts                   # Utility & type exports
    └── types.ts                   # Backend TypeScript interfaces & types


```

**Rules**:
- Keep utilities generic and reusable
- No business logic in shared utilities
- Proper error handling
- Type-safe implementations
- Export clean APIs

---

## Best Practices

### 1. **Error Handling**
- Always wrap function logic in try-catch blocks
- Return appropriate HTTP status codes (200, 400, 401, 403, 404, 500)
- Provide clear error messages
- Log errors for debugging
- Never expose sensitive data in errors

### 2. **Security**
- Validate and sanitize all inputs
- Protect sensitive endpoints with authentication
- Implement rate limiting to prevent abuse
- Use HTTPS for all communications
- Store secrets in environment variables
- Implement CORS properly
- Hash passwords with bcrypt or similar
- Use prepared statements to prevent SQL injection

### 3. **Performance**
- Use database connection pooling
- Implement caching where appropriate
- Optimize database queries
- Use pagination for large datasets
- Lazy load resources
- Minimize cold starts (keep functions warm)

### 4. **Code Organization**
- One function per file
- Group related functions in folders
- Use clear, descriptive names
- Keep functions focused and small
- Separate business logic from HTTP handling
- Reuse code through shared utilities

### 5. **Testing**
- Write unit tests for business logic
- Write integration tests for endpoints
- Mock external dependencies
- Test error scenarios
- Test authentication and authorization
- Use test databases

### 6. **Logging & Monitoring**
- Log all important events
- Log errors with stack traces
- Use structured logging (JSON)
- Monitor function performance
- Set up alerts for errors
- Track API usage metrics

### 7. **Environment Management**
- Use environment variables for configuration
- Never commit secrets to version control
- Use different configs for dev/staging/production
- Validate environment variables on startup
- Document required environment variables

### 8. **API Design**
- Follow RESTful conventions
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Return consistent response formats
- Include pagination for lists
- Version your APIs (/api/v1/)
- Document endpoints (OpenAPI/Swagger)

### 9. **Database Operations**
- Always release database connections
- Use transactions for multi-step operations
- Handle connection failures gracefully
- Optimize queries (use indexes)
- Avoid N+1 queries
- Use migrations for schema changes

### 10. **Documentation**
- Document function purpose and parameters
- Document environment variables
- Document API endpoints
- Provide examples in comments
- Keep documentation up to date

## Common Patterns

### Request/Response Flow
```
1. Receive HTTP request
2. Extract and validate authentication
3. Validate request data against schema
4. Perform business logic
5. Interact with database/external services
6. Format response
7. Return HTTP response with appropriate status code
```

### Error Response Format
```json
{
  "error": "Error message",
  "statusCode": 400,
  "details": {} // Optional validation errors
}
```

### Success Response Format
```json
{
  "data": {},
  "message": "Success message", // Optional
  "pagination": {} // For list endpoints
}
```

## Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# AWS/Storage
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET=your-bucket

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password
EMAIL_FROM=noreply@yourdomain.com

# Frontend
FRONTEND_URL=http://localhost:3000

# Other
NODE_ENV=development
```

## Deployment

### Platform-Specific Notes

**AWS Lambda**:
- Configure API Gateway
- Set memory and timeout limits
- Use Lambda layers for dependencies
- Enable CloudWatch logging

**Firebase Functions**:
- Use Firebase CLI for deployment
- Configure regions
- Set runtime options (memory, timeout)
- Use Firebase emulator for testing

**Netlify Functions**:
- Functions go in `netlify/functions/`
- Auto-deploys with Git
- Environment variables in Netlify dashboard
- Limited execution time (10s for free tier)

**Vercel Functions**:
- Functions go in `api/` folder
- Serverless function format
- Environment variables in Vercel dashboard
- Edge functions for better performance

## Related Documentation
- [Architecture Documentation](../docs/ARCHITECTURE.md)
- [API Documentation](../docs/API.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)
- [Frontend Documentation](../src/README.md)

## Certificates

Implementation: `lib/certificates/`. Decision record: `../.kiro/adr/2026-10-08-certificate-system.md`.

Configure `BROWSER_RENDERING_API_TOKEN` (account-level Browser Rendering – Edit), `CF_ACCOUNT_ID` (32-hex account identifier), and `CERTIFICATE_VERIFY_BASE_URL` before deploying. Keep the existing `SKILLPASSPORT_INTERNAL_SECRET` and `RATE_LIMIT_KV`. The URL is printed permanently on generated PDFs: production is `https://skillpassport.rareminds.in/verify`, development uses `http://localhost:8788/verify`. Build SkillPassport with `VITE_LTE_APP_URL` set to the matching LTE origin. Set Pages secrets with `wrangler pages secret put BROWSER_RENDERING_API_TOKEN --project-name <target-project>`, selecting the intended environment; never use the Workers secret command. Confirm the target project and its database before applying the four `20261008100*` migrations. Certificates go live immediately after deployment.

Learner routes require the existing auth-core authentication and enforce ownership:

- `GET /api/v1/certificates?type=course_completion|role_readiness&levelId=<uuid>` returns `{certificates:[summary]}` and reconciles missed/historical completions. Optional filters; 60 requests/min/user.
- `GET /api/v1/certificates/:credentialId` returns an owned summary or 404. Summaries expose type, status, title, subtitle, levelLabel, badge, completionDate, issuedAt, levelId, roleId, verifyUrl, and downloadable. `verifyUrl` is null unless issued.
- `GET /api/v1/certificates/:credentialId/download` streams a cached or newly rendered PDF; 10/min/user. Name required: 409 `NAME_REQUIRED`; revoked: 410 `CERTIFICATE_REVOKED`; renderer busy: 503 `PDF_RENDER_BUSY` with `Retry-After` and `error.details.retryAfterMs`; other renderer failures: 503 `PDF_RENDER_UNAVAILABLE`. All PDF responses use private/no-store, attachment disposition and nosniff.

`GET /api/v1/public/certificates/:credentialId` is unauthenticated, with OPTIONS support. Only the origin of `SKILLPASSPORT_INTERNAL_URL` receives CORS headers. Limit: 60/min/IP. Malformed IDs return 400; absent or pending IDs return `{status:"not_found",credentialId,issuer:"Rareminds LTE"}`. Valid responses contain learnerName, title, subtitle, certificateType, levelLabel, badge, completionDate, issuedAt. Revoked responses contain only status, credentialId, issuer, revokedAt. Cache lifetime: 60 seconds. Names, emails and tokens are never included in logs.

### SkillPassport pull contract

Use `Authorization: Bearer <HS256 service token>` signed with SkillPassport's existing `LTE_INTERNAL_SECRET` (same value as LTE's `SKILLPASSPORT_INTERNAL_SECRET`). Header `{alg:"HS256",typ:"svc"}`; payload `{app:"skillpassport",actions:["certificates.read"],iat:<seconds>,exp:<seconds>,nbf?:<seconds>}`. Expiration must be in the future, iat must not be in the future, lifetime must be 1–300 seconds, and optional nbf must have passed. Missing/bad/expired tokens return 401; wrong app/action returns 403. `app:"lte"` tokens are rejected. App-wide limit: 600/min; PDF calls additionally share the owner download limit.

- `GET /api/v1/internal/certificates?userId=<SSO uuid>&limit=100&cursor=<opaque>`
- `GET /api/v1/internal/certificates?updatedSince=<ISO timestamp>&limit=100&cursor=<opaque>`
- `GET /api/v1/internal/certificates/:credentialId/pdf`

Provide exactly one of userId/updatedSince. List limits range from 1 to 100; default 100. Success: `{ok:true,data:{items:InternalCertificate[],nextCursor:string|null}}`. Error: `{ok:false,error:{code,message},requestId}`. PDF success is binary; errors use the internal JSON envelope. Lists contain issued and revoked records, never pending names.

| InternalCertificate | SkillPassport destination / meaning |
| --- | --- |
| credentialId | credential_id; globally unguessable public ID |
| userId | SSO UUID; never email |
| certificateType | course_completion or role_readiness |
| title, issuer | title; issuer is Rareminds LTE |
| level | level label, nullable |
| link | public SkillPassport verification URL |
| issuedOn | issued_on, YYYY-MM-DD |
| description | subtitle, nullable |
| status | active or revoked |
| platform, category | LTE; certificate type |
| documentUrl | relative internal PDF endpoint; service token required |
| badge, revokedAt, updatedAt | certificate facts and synchronization timestamps |

Order is ascending `(updated_at,id)`. Cursors are base64 JSON `{updatedAt,id}`, strictly validated and limited to 512 characters. Retain `updatedSince`/userId while following cursors. A full final page can produce a cursor followed by an empty page; stop when nextCursor is null. Persist the incremental watermark only after consuming all pages; overlap timestamps and deduplicate by credentialId. Cache writes/finalization/revocation update timestamps, so repeat delivery is expected. Revocations must be imported even when a certificate already exists. No events or SkillPassport import implementation are supplied.

### Operations and verification

- `npm run certificates:test:local` runs SQL assertions and completion → course/role issuance → real PDF → cached download → public verification → signed internal pull → immutability → revocation → atomic replacement against local Supabase. It uses real local workerd R2/KV bindings. Requires all four migrations, `.dev.vars` with a localhost SUPABASE_URL, and local Docker container `supabase_db_lte`. It creates unique synthetic fixtures and removes them in `finally`; it never resets the database.
- `npm run certificates:test:local -- --browser` additionally drives the production LTE certificate page through local sign-in, completion, listing, and PDF download, then opens the exact generated PDF URI through the real SkillPassport router while logged out. It runs desktop and mobile Chrome plus axe WCAG 2 A/AA checks. Requires sibling SkillPassport dependencies and `google-chrome` (or `CHROME_BIN`). Uses ports 18788–18789 and dynamically allocated API ports. Artifacts are written under `/tmp/lte-certificate-*`; fixtures are erased afterward, so their links subsequently return not_found.
- `npm run certificates:test:local -- --performance` measures 30 local PostgreSQL/workerd samples (10 real first renders), checks every §12.1 p95 target, and writes `/tmp/lte-certificate-performance.json`.
- `npm run certificates:sample` renders a real PDF through Cloudflare using `.dev.vars`, writes `/tmp/lte-certificate-sample.pdf` and its HTML. The synthetic credential does not verify as issued. Inspect the PDF's clickable annotation as well as its text.
- Execute `supabase/tests/certificates.sql` with ON_ERROR_STOP against an isolated migrated database. Fixtures roll back. It covers uniqueness, constraints, immutable display/identity, status transitions, PDF updates, provenance cleanup, learner/actor erasure, grants and XP enum insertion.
- `revokeCertificate(source,{certificateId,reason,actorId})` is an ops-only function in `lib/certificates/revocation.ts`. It only updates issued rows and is idempotent. `replaceCertificate(source,{certificateId,actorId,reason,corrections})` in `replacement.ts` atomically revokes the old credential and creates one issued replacement through the service-role-only `replace_certificate` RPC. The correction allowlist is learner name, title, subtitle, level label, badge, completion date, and metadata. The old snapshot remains frozen and verifiable as revoked; `supersedes_id` records immutable lineage; retries return the same replacement; no extra XP is awarded. Neither operation has an HTTP route.
- Bump `CERTIFICATE_TEMPLATE_VERSION` to lazily refresh PDFs. Superseded or concurrent-render orphan objects require later cleanup.
- Erasure: remove **all** R2 objects under `certificates/users/<SSO-user-id>/`, including old versions/orphans, and delete the user (certificate rows cascade). Coordinate erasure with in-flight renders; the renderer cleans up its own object if its cache update loses an erasure race. Purge any object inventory export containing the user prefix. Confirm verify links report not_found after the 60-second public cache window. A database cascade alone does not erase PDFs.
- Emit/monitor `certificate.issued`, `certificate.replaced`, `certificate.issue_failed`, `certificate.immutability_violation`, `certificate.render`, `certificate.verify`, `certificate.internal_read`. Each event has a requestId; content/PII and tokens are excluded. Replacement logs contain only certificate IDs; render events include durationMs, bytes on success, templateVersion, and outcome. `ops/certificates/alerts.json` defines a 15-minute window, any immutability violation, more than 10 issuance failures, and render failures above 5%. Pipe the structured log stream through `npm run certificates:monitor`; it emits deduplicated firing/resolved JSON transitions for the deployment log pipeline's notification sink.
- Preview demo: complete a level, see its certificate, download, open the PDF link logged out in SkillPassport, pull it with a five-minute SkillPassport service token, then confirm an issued learner_name UPDATE is rejected. Check both on-time and late completion, missing name→Settings→issued, revocation, and an already-completed learner. Avoid test completion/revocation mutations in production.
