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
