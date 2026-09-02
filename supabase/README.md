# LTE Supabase Configuration

This directory contains the Supabase database configuration for the LTE (Learner Transformer Engine) project.

## Directory Structure

- **config.toml** — Supabase configuration with custom port settings
- **migrations/** — Database schema migrations
- **seed/** — Seed scripts for populating initial data

## Port Configuration

The following ports are configured for local development (from `config.toml:11`):

| Service | Port | Purpose |
|---------|------|---------|
| API | 54341 | REST API endpoint |
| Database | 54347 | PostgreSQL connection |
| Studio | 54343 | Supabase Studio UI |
| Inbucket (SMTP) | 54344 | Email testing |

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
Open http://127.0.0.1:54343 in your browser

## Database Schema

The schema includes 30 tables (migrations `20260716092555` … `20260812093636`):

- **capabilities, levels, level_scale, skills, level_skills** — Learning catalog core
- **roles, role_capability_sequence** — Role shadow + capability ordering
- **modules, modules_content, e_content** — 6E module stages + content items
- **module_artifacts, artifact_questions, artifact_templates** — Artifact definitions
- **users, user_profiles, subscription_cache** — Identity + profile
- **learning_tracks, learning_paths, learning_track_evidence** — Learner path assignment
- **user_capabilities, user_capability_level_progress, user_module_progress, user_stage_progress** — Progress tracking
- **artifact_submissions, artifact_submission_answers, artifact_submission_files, artifact_evaluation_flows** — Submissions + evaluation
- **skill_gap, profile_snapshot** — Gap analysis + snapshots
- **xp_events** — Evidence / engagement XP ledger

RLS intentionally off — via service_role + gateway (verifications/2026-08-10 H2, plan 2026-09-01).
