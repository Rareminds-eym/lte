# Deployment Guide

This guide covers various deployment options for the LMS application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Database](#local-database)
- [Cloudflare Pages (Primary)](#cloudflare-pages-primary--lte)
- [CI/CD](#cicd)

## Prerequisites

- Node.js >= 22.0.0
- npm >= 10.0.0
- Wrangler >= 4.x (`npm i -g wrangler` or `npx wrangler`)
- Supabase CLI (for `db:reset:dev`)

## Environment Variables

Create a `.env.production` file with your production environment variables:

```bash
VITE_API_URL=https://api.yourdomain.com
VITE_ENABLE_ANALYTICS=true
VITE_GOOGLE_ANALYTICS_ID=UA-XXXXXXXXX-X
```

See `.env.example` for all available variables.

## Docker Deployment

### Build and Run with Docker

```bash
# Build the Docker image
npm run docker:build

# Run the container
npm run docker:run
```

Or use Docker Compose:

```bash
# Production
npm run docker:prod

# Development
npm run docker:dev
```

### Manual Docker Commands

```bash
# Build
docker build -t lms:latest .

# Run
docker run -d -p 3000:80 --name lms-app lms:latest

# Stop
docker stop lms-app

# Remove
docker rm lms-app
```

## Local Database

Reset dev seed data before building (Supabase):

```bash
npm run db:reset:dev
```

## Cloudflare Pages (Primary — LTE)

LTE deploys on Cloudflare Pages with Functions (`functions/`). Build output is `dist/` (Vite `outDir: "dist"`), not `build/`.

```bash
# 1. Reset dev data (local Supabase)
npm run db:reset:dev

# 2. Build
npm run build

# 3. Deploy to Cloudflare Pages
npx wrangler pages deploy dist --branch=main
# preview
npx wrangler pages deploy dist --branch=preview
```

Local Pages dev:

```bash
npm run pages:dev  # wrangler pages dev dist --compatibility-date=2026-09-01
```

## CI/CD

### GitHub Actions

The project includes a CI/CD pipeline in `.github/workflows/ci.yml` that:

- Runs on push to main/develop branches
- Runs on pull requests
- Executes type checking, linting, testing, and building
- Uploads test coverage

### Automated Deployment

Add deployment step to `.github/workflows/ci.yml`:

```yaml
- name: Deploy to Production
  if: github.ref == 'refs/heads/main'
  run: |
    npm run build && npx wrangler pages deploy dist --branch=main
- name: Deploy Preview
  if: github.ref != 'refs/heads/main'
  run: |
    npm run build && npx wrangler pages deploy dist --branch=preview
```

## Performance Optimization

### Build Optimization

The production build is automatically optimized with:

- Minification
- Tree shaking
- Code splitting
- Asset optimization

### Caching Strategy

Configure caching headers in your hosting platform:

```
# Static assets (1 year)
/static/*
  Cache-Control: public, max-age=31536000, immutable

# HTML (no cache)
/*.html
  Cache-Control: no-cache, no-store, must-revalidate

# Service worker
/service-worker.js
  Cache-Control: no-cache
```

## Monitoring

### Error Tracking

Consider integrating error tracking services:

- Sentry
- Rollbar
- Bugsnag

### Analytics

Configure analytics in your environment variables:

- Google Analytics
- Mixpanel
- Amplitude

## Health Checks

LTE exposes a versioned health endpoint:

```bash
curl -s https://<pages-domain>/api/v1/health | jq
# expected: { "status": "ok" }
```

- HTTP 200 from `/api/v1/health` indicates the Pages Functions are reachable.
- Application loads without errors.

## Rollback Strategy

### Docker

```bash
# Tag previous version
docker tag lms:latest lms:previous

# Rollback
docker run -d -p 3000:80 lms:previous
```

### Git-based Deployments

```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

## Security Checklist

- [ ] Environment variables are properly set
- [ ] API keys are not exposed in client code
- [ ] HTTPS is enabled
- [ ] Security headers are configured
- [ ] Dependencies are up to date
- [ ] CORS is properly configured
- [ ] Rate limiting is in place (if applicable)

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
npm run clean
npm install
npm run build
```

### Docker Issues

```bash
# Remove all containers and images
docker-compose down
docker system prune -a

# Rebuild
npm run docker:build
```

### Environment Variables Not Working

Ensure variables are prefixed with `VITE_` and rebuild the application. Access them in code using `import.meta.env.VITE_*`.

## Support

For deployment issues, please:

1. Check the logs
2. Review the documentation
3. Open an issue on GitHub
