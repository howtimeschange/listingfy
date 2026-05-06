# PostgreSQL Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:verification-before-completion before reporting migration status.

**Goal:** Move Listingify runtime and operational scripts from SQLite to PostgreSQL.

**Architecture:** PostgreSQL is the only supported runtime database for the Web API and operational scripts. Existing synchronous DB call sites are routed through a PostgreSQL compatibility facade first, then can be migrated gradually into asynchronous repositories without blocking this cutover.

**Tech Stack:** PostgreSQL 16, Docker Compose, Node.js, Hono, React/Vite, `pg`, `deasync`, SQL migrations.

---

## Why PostgreSQL

- Existing migrations and business queries already rely on SQL features that map well to PostgreSQL: `on conflict`, partial unique indexes, transactions, JSON extraction, and views.
- MySQL would require broader rewrites around partial indexes, conflict handling, JSON functions, and date defaults.
- PostgreSQL gives a safer path for multi-user Web API usage, concurrent imports, publish task retry workflows, and future background workers.

## Migration Steps

1. Provision PostgreSQL:

   ```bash
   docker compose -f docker-compose.postgres.yml up -d
   ```

2. Configure the runtime:

   ```bash
   export DATABASE_PROVIDER=postgres
   export DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify
   ```

3. Apply schema migrations:

   ```bash
   npm run db:migrate
   ```

4. Import current metadata/content snapshots as needed:

   ```bash
   npm run db:migrate:sqlite-data -- --sqlite data/app.sqlite
   npm run shein:metadata:import
   npm run deepdraw:import
   ```

5. Create or reset the first admin:

   ```bash
   npm run admin:create -- --username admin --display-name 系统管理员 --password '<强密码>'
   ```

6. Start the API and Web app:

   ```bash
   npm run web:server
   npm run web:dev
   ```

## Code Changes

- Runtime database config defaults to PostgreSQL and fails fast without `DATABASE_URL`.
- `npm run db:migrate` is PostgreSQL-only.
- `npm run db:migrate:sqlite-data` performs the one-time legacy SQLite data copy into PostgreSQL and verifies table row counts.
- Web API startup applies migrations through PostgreSQL and exposes `dbProvider` for health visibility.
- Admin creation, SHEIN metadata import/query, and DeepDraw import now use PostgreSQL.
- `scripts/lib/postgres_db.mjs` converts the current SQLite-flavored SQL surface into PostgreSQL-compatible SQL and preserves the existing `prepare().get/all/run` API.
- `scripts/lib/sqlite_db.mjs` remains only as a legacy test/offline helper, not as an operational database path.

## Follow-Up Hardening

- Replace the synchronous compatibility facade with async repository functions by bounded domain areas: auth, metadata, listing drafts, publish tasks, and imports.
- Add a real PostgreSQL integration test job once CI or local development has Docker available.
- Add migration rollback/runbook notes for production backup and restore.
- Review high-volume import transactions and convert long imports to explicit async transaction scopes.
