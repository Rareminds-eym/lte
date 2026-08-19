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
