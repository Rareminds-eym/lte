# LTE - Quick Start Guide

A modern Learning Transform Engine built with React 19, TypeScript, Vite, and Cloudflare Workers.

## Prerequisites

- Node.js >= 22.0.0
- npm >= 10.0.0

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env.local

# 3. Start development
npm start
```

The app runs on `http://localhost:3000`

---

## Available Commands

### Development
- `npm start` - Full dev mode (workers + pages on ports 3000/8788)
- `npm run dev` - Vite dev server on port 3000
- `npm run dev:local` - Vite dev server on port 8788
- `npm run dev:prod` - Production-like dev on port 8788
- `npm run preview` - Preview production build

### Build
- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run pages:build` - Pages-specific build

### Workers & Pages
- `npm run workers:dev` - All workers (email, payments, SSO, realtime)
- `npm run pages:dev` - Pages dev with service bindings

### Testing
- `npm test` - Run tests (Vitest)
- `npm run test:property` - Run property tests

### Quality & Linting
- `npm run lint` - ESLint + CSS lint
- `npm run lint:css` - Stylelint (Tailwind validation)
- `npm run lint:files` - Validate .ts/.tsx only in src/ and functions/
- `npm run lint:console` - Detect console statements
- `npm run lint:biome` - Biome linter & formatter
- `npm run format:biome` - Auto-format with Biome
- `npm run typecheck` - TypeScript type checking
- `npm run setup:husky` - Setup pre-commit git hooks

---

## Project Structure

```
src/
├── app/           - App init, routing, styles, providers
├── pages/         - Route-level pages
├── widgets/       - Large UI blocks
├── features/      - User-facing features
├── entities/      - Business entities
└── shared/        - Reusable utilities, API, types

functions/
├── auth/          - Auth handlers
├── users/         - User handlers
├── courses/       - Course handlers
├── enrollments/   - Enrollment workflows
├── uploads/       - File upload workflows
├── notifications/ - Notifications
├── middleware/    - Shared middleware
└── schemas/       - Validation schemas
```

---

## Tech Stack

- **React 19** with TypeScript
- **Vite** - Build tool & dev server
- **React Router 7** - Client routing
- **Tailwind CSS v4** - Styling
- **Zustand** - State management
- **TanStack Query** - Data fetching
- **Vitest** - Testing
- **Cloudflare Workers** - Backend services
- **Supabase** - Database & auth

---

## Key Features

✅ React 19 + TypeScript  
✅ Feature-Sliced Design architecture  
✅ Cloudflare Workers integration  
✅ Comprehensive testing setup  
✅ Tailwind CSS v4  
✅ ESLint + Prettier + Biome  
✅ Git hooks with Husky  
✅ GitHub Actions CI/CD  

---

## Environment Variables

Create `.env.local` with:

```
VITE_API_URL=          # API server URL
VITE_API_TIMEOUT=      # Request timeout (ms)
VITE_ENABLE_ANALYTICS= # Feature flag
VITE_ENABLE_DEBUG=     # Debug mode
VITE_GOOGLE_ANALYTICS_ID= # Google Analytics
VITE_SENTRY_DSN=       # Sentry error tracking
```

Only `VITE_*` variables are exposed to frontend.

---

## Styling with Tailwind CSS v4

Use Tailwind utilities directly in JSX:

```tsx
<div className="bg-blue-500 text-white px-4 py-2 rounded">
  Content
</div>
```

Custom colors in `tailwind.config.ts`:
- `primary` (#3b82f6)
- `secondary` (#8b5cf6)
- `danger` (#ef4444)
- `success` (#10b981)
- `warning` (#f59e0b)
- `info` (#0ea5e9)

Validate CSS:
```bash
npm run lint:css
```

---

## TypeScript Only

Project enforces `.ts` / `.tsx` files only in `src/` and `functions/`.

Setup pre-commit hooks:
```bash
npm run setup:husky
```

Manual validation:
```bash
npm run lint:files
```

---

## Contributing

1. Create feature branch: `git checkout -b feat/your-feature`
2. Make changes and test: `npm test && npm run lint`
3. Commit with conventional format: `feat: description`
4. Push and create PR

Git hooks validate:
- File types (TypeScript only)
- Console usage
- Code formatting
- TypeScript types
- Commit message format

---

## Resources

- [React Docs](https://react.dev/)
- [TypeScript Docs](https://www.typescriptlang.org/)
- [Vite Docs](https://vitejs.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)

---

## More Documentation

- **Architecture** - See `../architecture/ARCHITECTURE.md`
- **Authentication** - See `../authentication/` (OAuth2, RPC methods)
- **Deployment** - See `../deployment/DEPLOYMENT.md`
- **Testing** - See `../testing/CODECOV_SETUP.md`

---

**Last Updated:** 2026-07-17
