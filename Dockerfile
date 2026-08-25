# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files + committed registry config (reads ${NPM_TOKEN} from env)
COPY package*.json .npmrc ./

# Install dependencies.
#   docker build --secret id=npm_token,env=NPM_TOKEN .
# The token lives only in this stage's env for the duration of npm ci;
# it is never written to disk or carried into the final image.
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN="$(cat /run/secrets/npm_token)" npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage (token stays behind in the build stage)
# Vite emits to dist/ (vite.config.ts outDir), not build/.
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
