# Operations

> **Status: Phase 4.6 operational contract.** Persistent Core + Postgres startup, explicit migrations, health, backup, and restore.
>
> Related: [DEPLOYMENT.md](DEPLOYMENT.md), [SCALE.md](SCALE.md), [docker-compose.yml](../docker-compose.yml), [deploy/compose.reference.yml](../deploy/compose.reference.yml).
>
> This document does **not** promise HA, SLA, zero-downtime deploys, or multi-region failover.

---

## Persistent data requirements

| Store | Contents | Required for restore? |
|-------|----------|------------------------|
| PostgreSQL (`aurii` database) | Datasets, schemas, entities, entity revision snapshots, import runs, platform tables (sources, routes, tokens, audit), projects | **Yes** |
| Object/file uploads (if configured) | Temporary import uploads under `AURII_UPLOAD_DIR` | Usually no for delivery; yes if products rely on retained uploads |
| Application secrets / env | `DATABASE_URL`, `AURII_API_TOKEN`, `AURII_CORS_ORIGINS`, `AURII_STORAGE=postgres` | Required to start; not inside the DB dump |

**Postgres is the system of record.** Back up the database. Dumping only application containers does not preserve Aurii state.

---

## Startup ordering

```text
1. PostgreSQL healthy (pg_isready)
2. Run project DB migrations (`bun run db:migrate` / image command below)
3. Start Core / API (`AURII_STORAGE=postgres`) — no hidden migrate in process startup
4. Health check: GET /health → 200 and database.connected=true
5. Optional: Studio against PUBLIC_AURII_CORE_URL
```

```bash
bun run packages/db/scripts/migrate.ts
# image: bun run packages/db/scripts/migrate.ts
```

`DATABASE_URL` is **required** for migrations. There is no default `aurii:aurii@localhost` in the migrate entrypoint.

Local Compose and the reference Compose both run a one-shot `migrate` service, then `core`.

Entity/schema DDL is also ensured by the Postgres storage adapter `init()` (idempotent `CREATE TABLE IF NOT EXISTS` + column safety nets). That is not a substitute for `packages/db` migrations.

### Invalid configuration

The process **exits** before listen when:

- `AURII_STORAGE=postgres` and `DATABASE_URL` is missing
- `AURII_ENV=production` (or `NODE_ENV=production`) without Postgres, token, or explicit CORS origins
- Migrations cannot apply (migrate command non-zero — do not start the new runtime)

---

## Environment / secrets

See the table in [`DEPLOYMENT.md`](DEPLOYMENT.md). Production additionally requires `AURII_ENV=production`, `AURII_API_TOKEN`, and `AURII_CORS_ORIGINS`.

---

## Health and version identity

- Postgres: `pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
- Core: `GET /health`

Healthy body includes `storage`, `database.connected`, and `release` (`version`, `gitSha`, `buildTime`) so operators can answer: *which Aurii build is the product talking to?*

Unavailable database → HTTP 503, `status: "unavailable"`. Application logs stay on stdout/stderr. Import/scheduler failures continue to use existing run records and process logs.

---

## Migrations during deploy

```text
build image → run migrations → start new runtime → health
```

Do not start a new image against an unmigrated or half-migrated database.

**Rollback:** previous image if the migration was not applied; otherwise restore the last dump, then start the previous image. There is no migrate-down runner.

---

## Backup

Logical dump of the Aurii database:

```bash
./deploy/backup-postgres.sh
# or
pg_dump --format=custom --file="aurii-$(date -u +%Y%m%dT%H%M%SZ).dump" \
  "$DATABASE_URL"
```

Docker Compose (local):

```bash
docker compose exec -T postgres \
  pg_dump -U aurii -d aurii -Fc > aurii-backup.dump
```

Reference compose optional sidecar: `--profile backup` runs [`deploy/backup-postgres.sh`](../deploy/backup-postgres.sh) on `BACKUP_INTERVAL_SECONDS` (default 24h), keeps `BACKUP_KEEP` files, and can run `BACKUP_UPLOAD_COMMAND` for off-machine copy (S3-compatible or otherwise). Encrypted transport is the upload channel’s responsibility (HTTPS/S3 TLS). Do not serve the backup volume on a public URL.

---

## Restore

```bash
# Stop Core first. Destructive into the target database.
./deploy/restore-postgres.sh aurii-backup.dump
# or
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" aurii-backup.dump
```

Restart Core (or recreate the container from the **same** image). Verify `/health`, a known entity GET, and a representative published route — not only that `pg_restore` exited zero.

---

## Restart and recreate

| Event | Expected |
|-------|----------|
| Process / container restart | State in Postgres survives |
| Recreate container from the same image | State survives (volume is Postgres, not the app container) |
| New image | Run migrations, then start; products do not need rebuild for an Aurii restart |
| Studio stopped | Public delivery continues |

---

## Failure behavior

| Failure | Observed contract |
|---------|-------------------|
| Runtime down | Consumers using live delivery fail (`LiveDeliveryError` / HTTP error). No silent snapshot fallback unless `AURII_DELIVERY_MODE=snapshot` |
| Database down | `/health` → 503; process may also fail storage operations |
| Invalid / missing bearer | HTTP 401 |
| Stale `expectedRevision` | HTTP 409 `concurrency_conflict` |
| Invalid migration | Migrate command exits non-zero; do not start the new runtime |
| Invalid production config | Process exits before listen |

---

## Automated proofs

```bash
bun run scripts/ops-persistence-proof.ts   # restart + backup/restore against Postgres
bash scripts/ci-runtime-container.sh       # image build + migrate + health + auth
```

Persistence proof scenario:

1. start / use Postgres
2. migrate
3. register a small dataset and mutate an entity
4. close/reopen storage (process restart)
5. re-run migrations
6. backup
7. destructive change
8. restore
9. verify original revision

---

## Operational limitations (honest)

- Single-region, single Postgres instance
- No automated failover
- No point-in-time recovery configuration in-repo
- No claim of zero-downtime schema deploys
- Upload directories outside Postgres are not covered by `pg_dump` unless separately backed up
- Scale limits remain as documented in [SCALE.md](SCALE.md)
- Host DNS/TLS/off-machine backup copy is operator-owned
