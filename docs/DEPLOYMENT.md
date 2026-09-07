# Deployment

> How to run Aurii as a persistent runtime outside a developer machine.
>
> Related: [`OPERATIONS.md`](OPERATIONS.md), [`EXTERNAL_CONSUMERS.md`](EXTERNAL_CONSUMERS.md), [`DELIVERY.md`](DELIVERY.md), [`validation/PHASE_4_6_EXTERNAL_RUNTIME.md`](validation/PHASE_4_6_EXTERNAL_RUNTIME.md).
>
> This is a **production-shaped reference deployment**, not Aurii Cloud. It does not promise HA, multi-region, or zero-downtime deploys.
>
> Norwegian Geo is Aurii’s first **external** downstream product ([`aprestmo/norwegian-geo`](https://github.com/aprestmo/norwegian-geo)). It is not deployed from this repository.

---

## Target shape

```text
Internet
   │
   ├── https://api.example
   │        │
   │        ▼
   │   Aurii API / Runtime
   │        │
   │        ▼
   │    PostgreSQL  (private network only)
   │
   └── https://studio.example   (optional, operator-only)
            │
            ▼
        Aurii Studio
```

Hostnames such as `api.aurii.dev` / `studio.aurii.dev` are **examples**. Do not hardcode them into Core. Put TLS on a reverse proxy in front of the containers.

A downstream product (Norwegian Geo or any later product) talks only to the public HTTPS API:

```text
Product frontend
        │
        ▼
@aurii/sdk / delivery HTTP
        │
        ▼
https://api.example
```

The product must not depend on a shared Docker network, a sibling Aurii checkout, the database, Studio, or Core internal modules.

---

## What to run

| Service | Required? | Role |
|---------|-----------|------|
| PostgreSQL 16 | Yes | System of record |
| Aurii Runtime (`Dockerfile.core`) | Yes | HTTP API + Core |
| Reverse proxy + TLS | Yes on the internet | HTTPS, HTTP→HTTPS |
| Studio (`Dockerfile.studio`) | No | Operator workspace |
| Backup job | Yes on a durable instance | `pg_dump` to off-machine storage |

Local development:

```bash
docker compose up              # postgres + migrate + core
docker compose --profile studio up
```

Reference (internet-shaped) compose: [`deploy/compose.reference.yml`](../deploy/compose.reference.yml). Postgres is not published to the host.

---

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `AURII_STORAGE` | Production: `postgres` | Storage adapter |
| `DATABASE_URL` | Yes when using Postgres | Connection string |
| `AURII_API_TOKEN` | Production: yes | Bearer for management / mutation |
| `AURII_CORS_ORIGINS` | Production: yes | Comma-separated browser origins. No `*` |
| `AURII_ENV` | Production: `production` | Fail-closed config + sanitized 500s |
| `PORT` | No (default 3000) | Listen port |
| `AURII_UPLOAD_DIR` | No | Writable upload dir (default `/tmp/aurii-uploads` in the image) |
| `AURII_ENABLE_SCHEDULER` | No | `1` starts the in-process import scheduler |
| `AURII_VERSION` | No | Release label (image build-arg) |
| `AURII_GIT_SHA` | No | Commit identity |
| `AURII_BUILD_TIME` | No | Build timestamp |
| `AURII_PLATFORM_STORE` | No | Inferred from `DATABASE_URL` |
| `AURII_DB_PATH` | SQLite only | Dev file path |
| `PUBLIC_AURII_CORE_URL` | Studio build | Public API URL baked into Studio |

Production start **exits** if Postgres URL, API token, or CORS allow-list is missing.

Template: [`deploy/env.reference.example`](../deploy/env.reference.example). Copy to `deploy/.env` (gitignored). Never commit secrets. Never put tokens in Studio or product frontend bundles.

---

## Deploy procedure

```text
build image
    ↓
run migrations   (bun run packages/db/scripts/migrate.ts)
    ↓
start new runtime
    ↓
GET /health
```

```bash
docker build -f Dockerfile.core \
  --build-arg AURII_VERSION=0.1.0 \
  --build-arg AURII_GIT_SHA="$(git rev-parse HEAD)" \
  --build-arg AURII_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t aurii-core:local .

# migrations — explicit, not hidden inside process startup
docker run --rm --network <internal> \
  -e DATABASE_URL="$DATABASE_URL" \
  aurii-core:local \
  bun run packages/db/scripts/migrate.ts

docker compose -f deploy/compose.reference.yml --env-file deploy/.env up -d postgres migrate core
curl -fsS https://api.example/health
```

The runtime image **does not** apply Drizzle migrations on `CMD`. Entity/schema DDL is still ensured by the Postgres adapter `init()` (idempotent `CREATE TABLE IF NOT EXISTS`). Project tables use the explicit migrate command.

### Rollback

1. Keep the previous image tag.
2. If the new migration has not been applied, start the previous image.
3. If the new migration **has** been applied and is incompatible, restore the last known-good dump ([`OPERATIONS.md`](OPERATIONS.md)) and start the previous image.
4. Do not “repair” the database by hand as a substitute for restore.

There is no in-repo blue/green or migrate-down control plane.

---

## HTTPS and DNS

Terminate TLS at the proxy. Example: [`deploy/Caddyfile.example`](../deploy/Caddyfile.example).

Requirements for an internet instance:

- stable hostname
- HTTPS
- HTTP → HTTPS redirect
- documented API base URL for consumers (`AURII_CORE_URL=https://api.example`)
- no localhost URLs in downstream production config
- `AURII_CORS_ORIGINS` lists the real product and Studio origins

---

## Authentication and CORS

```text
Principal → authorization → eligible data → query / delivery
```

Never load unauthorized rows and filter them afterwards.

| Surface | Auth |
|---------|------|
| `GET /health` | Public |
| `GET /public/:projectSlug/v1/...` | Public or project token per route `access` |
| `/schemas`, `/entities`, `/query`, `/import`, `/api/projects/...` | `AURII_API_TOKEN` or a project-scoped token |

Give a product only the credential it needs (project token with delivery/read scopes). Do not embed a global administrator token in a public frontend.

CORS:

- Development default: `Access-Control-Allow-Origin: *`
- Production: explicit `AURII_CORS_ORIGINS`. Wildcard is rejected at startup.
- An unapproved browser origin does not receive an allow-origin header on protected APIs.
- Non-browser clients (SSR, CI, `curl`) do not use CORS.

---

## Studio

Studio is optional. Stop it; published routes and the SDK keep working.

```bash
docker compose --profile studio up      # local
docker compose -f deploy/compose.reference.yml --profile studio up -d
```

Bake `PUBLIC_AURII_CORE_URL` at **image build**. Do not ship tokens in the static bundle.

If Core auth is too thin for a public `studio.example` hostname, restrict Studio at the proxy (basic auth, IP allow-list, VPN). That is an infrastructure limitation, not a reason to invent enterprise RBAC in Core.

---

## Downstream product

```bash
AURII_DELIVERY_MODE=live
AURII_CORE_URL=https://api.example
AURII_PROJECT_SLUG=<project-slug>
```

Live mode must not silently fall back to snapshot files. See [`DELIVERY.md`](DELIVERY.md).

Norwegian Geo is the first intended external product ([`EXTERNAL_CONSUMERS.md`](EXTERNAL_CONSUMERS.md)). In-repo proof uses the generic City/Region fixture so a second product can use the same boundaries.

---

## Health and identity

`GET /health` (unauthenticated):

```json
{
  "status": "ok",
  "phase": "4.6",
  "version": "0.1.0",
  "storage": "postgres",
  "database": { "connected": true },
  "release": {
    "version": "0.1.0",
    "gitSha": "…",
    "buildTime": "…"
  }
}
```

`status: "unavailable"` and HTTP **503** when the database probe fails. Logs go to stdout/stderr.

---

## Backup and restore

See [`OPERATIONS.md`](OPERATIONS.md). Scripts: [`deploy/backup-postgres.sh`](../deploy/backup-postgres.sh), [`deploy/restore-postgres.sh`](../deploy/restore-postgres.sh).

A backup that has never been restored does not count. After restore, restart Core and check `/health` plus a known entity — not only `pg_restore`’s exit code.

---

## CI

| Workflow | What it does |
|----------|----------------|
| `.github/workflows/ci.yml` `runtime-container` | Build image, migrate empty Postgres, start, `/health`, 401 on `/schemas`, refuse invalid production config |
| `.github/workflows/deploy-reference.yml` | Build the image on `main` / dispatch. **Does not deploy a host.** |

Norwegian Geo has its own lifecycle. Aurii deploy automation must not check out that product.

---

## Security baseline (reference instance)

- No default production credentials (example file is placeholders only)
- Postgres not published on a public interface
- Secrets in env / host secret store, not images or git
- Management endpoints authenticated in production
- Studio protected at Core token and/or the proxy
- HTTPS at the edge
- CORS allow-list in production
- 500 responses do not include stack traces in production
- Backup files are not web-accessible
- `.env` and `*.dump` are gitignored

---

## Current limitations

- Single region, single Postgres
- No automated failover or PITR configuration in-repo
- No zero-downtime schema deploy
- Studio has no enterprise SSO/RBAC
- Host deploy (DNS, TLS certs, off-machine backup copy) is an operator step
- Norwegian Geo lives in [`aprestmo/norwegian-geo`](https://github.com/aprestmo/norwegian-geo) and is not built or deployed from this repository

---

## Historical: static Geo Pages

The previous in-repo GitHub Pages static Geo site is **not** the Phase 4.6 runtime proof. Live delivery is Core published routes over HTTPS. Snapshot mode remains an explicit offline fallback (`AURII_DELIVERY_MODE=snapshot`). The Geo site now deploys from [`aprestmo/norwegian-geo`](https://github.com/aprestmo/norwegian-geo).
