# ADR-005: Zod for Request Body Validation

**Status**: Accepted
**Date**: 2026-08-04
**Area**: API input validation (Pages Functions)

## Context

Settings endpoints (`account.ts`, `password.ts`, `profile.ts`) accept JSON request bodies
that must be validated server-side (OWASP input validation: validate type, length, format).
Validation failures must produce a stable error shape (`VALIDATION_ERROR` + issue details)
for the frontend without leaking internals.

`zod@4.4.3` is already a dependency of this project (used by `settings/schemas.ts`).

## Decision

- All request body validation in `functions/api/v1/` uses **Zod schemas** with `.safeParse()`.
- Schemas live in per-route `schemas.ts` modules, exported for reuse and unit-testing.
- On failure, respond `400` with `code: "VALIDATION_ERROR"`, the first issue message
  (`parsed.error.issues[0]?.message ?? "Invalid input"` — no `!` assertions), and the full
  `issues` array in `details` for client-side display.
- Unknown-body protection: schemas are strict about the fields they accept where
  applicable (no silent pass-through of junk payloads).

## Consequences

- Server-side validation only; frontend validation is convenience, never trust.
- Stable, documented error contract between API and frontend.
- Schema files are thin and covered by tests at 100% lines (settings module).

## Alternatives Considered

- Hand-rolled checks: rejected — no stable error shape, no type inference.
- JSON Schema + ajv: rejected — more boilerplate, no TypeScript-first inference.
- No validation at source boundary: rejected — violates OWASP input validation standard.
