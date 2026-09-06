# Operations

> **Status: operational contract (Pre–Phase 5 spike).** Persistent Core + Postgres startup, migration, backup, and restore.
>
> Related: [DEPLOYMENT.md](DEPLOYMENT.md), [SCALE.md](SCALE.md), [docker-compose.yml](../docker-compose.yml).
>
> This document does **not** promise HA, SLA, zero-downtime deploys, or multi-region failover.

---

## Persistent data requirements

| Store | Contents | Required for restore? |
|-------|----------|------------------------|
| PostgreSQL (`aurii` database) | Datasets, schemas, entities, entity revision snapshots, import runs, platform tables (sources, routes, tokens, audit), projects | **Yes** |
| Object/file uploads (if configured) | Temporary import uploads under the API upload directory | Usually no for Geo; yes if products rely on retained uploads |
| Application secrets / env | `DATABASE_URL`, optional `AURII_API_TOKEN`, `AURII_STORAGE=postgres` | Required to start; not inside the DB dump |

For the Pre–Phase 5 proof, **Postgres is the system of record**. Back up the database. Do not claim that dumping only application containers preserves Aurii state.

---

## Startup ordering

```text
1. PostgreSQL healthy (pg_isready)
2. Run project DB migrations (`bun run db:migrate`)
3. Start Core / API (`AURII_STORAGE=postgres`)
4. Health check: GET /health
5. Optional: Studio against PUBLIC_AURII_API_URL
```

Docker Compose encodes this: `postgres` → `core` (migrate then serve) → `studio`.

---

## Environment / secrets

| Variable | Purpose |
|----------|---------|
| `AURII_STORAGE=postgres` | Select Postgres adapter |
| `DATABASE_URL` | Postgres connection string |
| `PORT` | HTTP listen port (default 3000) |
| `AURII_API_TOKEN` | Optional global bearer for Core routes |
| `PUBLIC_AURII_API_URL` | Studio → Core URL |

---

## Health checks

- Postgres: `pg_isready -U aurii -d aurii`
- Core: `GET /health` → `{ status: "ok", storage: "postgres", ... }`

---

## Migrations

```bash
bun run db:migrate
# equivalent: bun run packages/db/scripts/migrate.ts
```

Entity/schema DDL is also ensured by the Postgres storage adapter `init()` (idempotent `CREATE TABLE IF NOT EXISTS` + column safety nets). Project tables use Drizzle migrations under `packages/db`.

---

## Backup

Logical dump of the Aurii database:

```bash
pg_dump --format=custom --file=aurii-backup.dump \
  "$DATABASE_URL"
```

Docker Compose example:

```bash
docker compose exec -T postgres \
  pg_dump -U aurii -d aurii -Fc > aurii-backup.dump
```

---

## Restore

```bash
# Destructive restore into an empty/target database
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" aurii-backup.dump
```

Docker Compose example:

```bash
docker compose exec -T postgres \
  pg_restore -U aurii -d aurii --clean --if-exists --no-owner < aurii-backup.dump
```

After restore, restart Core (or rely on reconnect) and verify Aurii state via `/health`, entity GET, and a representative query — not only that `pg_restore` exited zero.

---

## Automated proof

Reproducible script (local Docker):

```bash
bun run scripts/ops-persistence-proof.ts
```

Scenario:

1. start Core + Postgres (compose or existing)
2. register/import a small dataset (or Norwegian Geo subset)
3. create/mutate at least one entity
4. verify query
5. restart Core
6. verify state + `entityRevision`
7. run migrations
8. backup database
9. modify/delete test state
10. restore backup
11. verify original state

---

## Operational limitations (honest)

- Single-region, single Postgres instance
- No automated failover
- No point-in-time recovery configuration in-repo
- No claim of zero-downtime schema deploys
- Upload directories outside Postgres are not covered by `pg_dump` unless separately backed up
- Scale limits remain as documented in [SCALE.md](SCALE.md)
