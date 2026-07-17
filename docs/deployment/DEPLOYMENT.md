# Deployment Guide

This guide covers various deployment options for the LMS application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [Cloud Platforms](#cloud-platforms)
- [Static Hosting](#static-hosting)
- [CI/CD](#cicd)

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker (for containerized deployment)

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

## Cloud Platforms

### Vercel

1. Install Vercel CLI:

```bash
npm install -g vercel
```

2. Deploy:

```bash
vercel
```

3. For production:

```bash
vercel --prod
```

### Netlify

1. Install Netlify CLI:

```bash
npm install -g netlify-cli
```

2. Build the app:

```bash
npm run build
```

3. Deploy:

```bash
netlify deploy --prod --dir=build
```

### AWS (S3 + CloudFront)

1. Build the app:

```bash
npm run build
```

2. Install AWS CLI and configure credentials

3. Sync to S3:

```bash
aws s3 sync build/ s3://your-bucket-name --delete
```

4. Invalidate CloudFront cache:

```bash
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Heroku

1. Create a `static.json` file:

```json
{
  "root": "build/",
  "routes": {
    "/**": "index.html"
  }
}
```

2. Add Node.js buildpack:

```bash
heroku buildpacks:set heroku/nodejs
```

3. Deploy:

```bash
git push heroku main
```

### Google Cloud Platform (Firebase)

1. Install Firebase CLI:

```bash
npm install -g firebase-tools
```

2. Login and initialize:

```bash
firebase login
firebase init
```

3. Build and deploy:

```bash
npm run build
firebase deploy
```

## Static Hosting

### GitHub Pages

1. Install gh-pages:

```bash
npm install --save-dev gh-pages
```

2. Add to package.json:

```json
{
  "homepage": "https://yourusername.github.io/lms",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  }
}
```

3. Deploy:

```bash
npm run deploy
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
    # Add your deployment commands here
    npm run deploy
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

The Docker deployment includes a health check endpoint at `/health`.

For other deployments, ensure your hosting platform can check:

- HTTP 200 response from root path
- Application loads without errors

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
