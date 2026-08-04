# LTE Supabase Configuration

This directory contains the Supabase database configuration for the LTE (Learner Transformer Engine) project.

## Directory Structure

- **config.toml** — Supabase configuration with custom port settings
- **migrations/** — Database schema migrations
- **seed/** — Seed scripts for populating initial data

## Port Configuration

The following ports are configured for local development:

| Service | Port | Purpose |
|---------|------|---------|
| API | 54321 | REST API endpoint |
| Database | 54322 | PostgreSQL connection |
| Studio | 54323 | Supabase Studio UI |
| Inbucket (SMTP) | 54324-54326 | Email testing |
| Realtime | 54327 | WebSocket connections |
| Vector | 54328 | Vector database |

## Usage

### Start Supabase locally
```bash
supabase start
```

### Run migrations
```bash
supabase db push
```

### Reset database
```bash
supabase db reset
```

This resets migrations only because automatic seed execution is disabled in `config.toml`.

### Reset database with environment seed
Use the package scripts from the `lte` folder:

```bash
npm run db:reset:dev
npm run db:reset:prod
```

Or from the repository root:

```bash
npm run db:reset:lte:dev
npm run db:reset:lte:prod
```

`db:reset:dev` runs only `supabase/seed/dev/*.sql`.
`db:reset:prod` runs only `supabase/seed/production/*.sql`.

The scripts use Supabase CLI's `--sql-paths` flag to choose the seed folder for that reset.

### Reset linked remote database with production seed
Warning: this resets the linked remote database. Use only after confirming the project ref and taking any required backup.

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db reset --linked --sql-paths "./seed/production/*.sql"
```

### View Studio
Open http://127.0.0.1:54323 in your browser

## Database Schema

The schema includes the following tables:

- **users** — User accounts (learners, instructors, admins)
- **courses** — Course content and metadata
- **lessons** — Individual lessons within courses
- **enrollments** — User course enrollments and progress
- **progress** — Detailed lesson completion tracking

All tables have Row Level Security (RLS) enabled for secure data access.
