# Phase 4.6 — External Runtime Validation

> Prove that Aurii can live as an independently deployed platform, consumed over a real network/package boundary.
>
> **Status:** in-repo / CI operational proof **passed** (container build → migrate → health → 401 → fail-closed start; Postgres backup/restore). A public `*.aurii.dev` host is an operator step (DNS + secrets), not something this repository can complete from CI alone.

Related: [`DEPLOYMENT.md`](../DEPLOYMENT.md), [`OPERATIONS.md`](../OPERATIONS.md), [`EXTERNAL_CONSUMERS.md`](../EXTERNAL_CONSUMERS.md), [`DELIVERY.md`](../DELIVERY.md).

---

## Why this phase exists

Phase 4 proved a data product **inside** the monorepo. Package extraction work (#65) proved a generic consumer can use supported contracts without building Geo in Aurii CI.

Until Aurii also runs as a small real service, filesystem, localhost, CORS, auth, migrate, restart, and secret-handling bugs stay hidden.

This phase is **not** Aurii Cloud.

---

## Environment (this validation)

| Item | Value |
|------|--------|
| Hosting shape | Production-shaped Docker: Postgres 16 (private) + Aurii Runtime image + optional Studio. TLS at a reverse proxy. |
| Aurii version | `0.1.0` + `AURII_GIT_SHA` / `AURII_BUILD_TIME` on `/health` |
| PostgreSQL | 16 (CI service / Compose `postgres:16-alpine`) |
| Downstream consumer | Generic City/Region fixture (`tests/fixtures/external-product`). Norwegian Geo is the first external product at [`aprestmo/norwegian-geo`](https://github.com/aprestmo/norwegian-geo). |
| Example URLs | `https://api.example`, `https://studio.example` (not hardcoded in Core) |

Prerequisites from the phase brief:

| Prerequisite | State |
|--------------|--------|
| Geo extracted to `aprestmo/norwegian-geo` | **Incomplete** — extraction inventory in [`EXTERNAL_CONSUMERS.md`](../EXTERNAL_CONSUMERS.md). This PR does not create that repository. |
| Geo without `workspace:*` into Aurii | Blocked on extraction + first package publish |
| Geo builds independently | Blocked on extraction |
| Aurii CI no longer builds Geo | **Done** (#65) |
| Generic downstream-consumer contract tests | **Done** (#65 + this phase CORS/health/container) |
| Public packages consumable externally | **Done** (pack tests, [`PACKAGES.md`](../PACKAGES.md)) |
| Phase 4 green | **Assumed / CI** |

---

## Tests performed

| Test | How | Result |
|------|-----|--------|
| Clean production image build | `scripts/ci-runtime-container.sh` | **Pass** (`aurii-core:ci`) |
| Migrations on empty Postgres | Same script | **Pass** (`0000_projects.sql`, `0001_datasets_project_id.sql`) |
| Runtime start + `/health` | Same script | **Pass** — `status=ok`, `storage=postgres`, `database.connected=true`, `release.gitSha` set, `platformStore.mode=postgres` |
| Invalid production config refuses to listen | Same script + `runtime-config.test.ts` | **Pass** — `Aurii refused to start: Production requires AURII_API_TOKEN…` |
| Management unauthenticated → 401 | CI script + `api-server.test.ts` | **Pass** |
| Optimistic concurrency → 409 | `api-server.test.ts` | **Pass** |
| CORS allow-list + preflight; unapproved origin not reflected | `api-server.test.ts` | **Pass** |
| Generic external consumer (schema → import → public route → SDK) | fixture tests | **Pass** |
| Product-boundary architecture | `tests/architecture` | **Pass** |
| Persistence restart + backup/restore | `scripts/ops-persistence-proof.ts` against Postgres 16 | **Pass** — revision 2 survived restart; dump/restore recovered pre-damage state |
| Container recreate / new image | Documented procedure; image rebuilt each CI run | Procedure defined; state lives in Postgres volume |
| Live HTTPS `api.aurii.dev` + deployed Geo | Requires operator DNS/secrets | **Not run in this environment** |
| Studio stopped while consumer works | Public routes do not start Studio | **Pass** (architecture + fixture HTTP) |

---

## Final questions

1. **Can Aurii run persistently without a developer machine?** Yes, as a container + Postgres. The image has no repo-local demo paths.
2. **Can an independently deployed product consume it solely through supported network/package boundaries?** Yes for the generic fixture (SDK + `/public/...`). Geo HTTPS to a named public host is waiting on extraction + operator DNS.
3. **Can Aurii be restarted without downstream impact?** Yes — state is Postgres. Consumers keep the same base URL.
4. **Can Aurii be upgraded without rebuilding the product?** Yes, as long as public HTTP/SDK contracts hold. Product rebuild is not part of the migrate→start path.
5. **Can the database be migrated safely?** Yes: explicit migrate command, fail the deploy if it exits non-zero. No hidden migrate on `CMD`.
6. **Can an actual backup be restored?** Yes via `pg_dump`/`pg_restore` and `ops-persistence-proof`. Off-machine copy is operator `BACKUP_UPLOAD_COMMAND`.
7. **Can Studio be unavailable while the product continues?** Yes. Studio is an optional Compose profile. Delivery is Core published routes.
8. **Are authentication and CORS enough for this reference?** For a single-operator instance: production requires a token and an origin allow-list; public routes stay on their existing access model. Not enterprise RBAC.
9. **Did deployment reveal hidden monorepo/local-development assumptions?** Yes — see friction. None required Geo-specific Core code.
10. **Did any operational issue require changing Core?** Yes, but only generic runtime concerns (CORS policy, health/DB probe, fail-closed production config, release identity, sanitized 500s, migrate without default credentials).
11. **If Core changed, was the change generic?** Yes. No Hetzner/Coolify/Cloudflare/Geo types in Core.
12. **Is the platform operationally credible enough to begin Phase 5?** **Conditionally yes** for architecture: the deploy path is real and tested in CI. **Not yet** for a named public reference URL until an operator attaches DNS/TLS and Geo is extracted. Do not treat missing `api.aurii.dev` as a Core defect.
13. **What should remain deferred?** Aurii Cloud, HA Postgres, Kubernetes, enterprise SSO/RBAC, Geo repository extraction/publish, automatic host deploy, Editorial/Context.

---

## Friction discovered

| Issue | Class | Disposition |
|-------|--------|-------------|
| CORS was `*` on all surfaces, including management | Core concern | `AURII_CORS_ORIGINS`; production rejects wildcard |
| `/health` had no DB probe or build identity | Core concern | `ping()` + `release` + 503 |
| Production could start with no token (open admin API) | Core concern | Fail-closed when `AURII_ENV=production` |
| Compose ran migrate inside the serve command (easy to treat as “startup magic”) | Deployment concern | One-shot `migrate` service; image `CMD` is serve-only |
| `db:migrate` defaulted to `aurii:aurii@localhost` | Deployment concern | `DATABASE_URL` required |
| Studio URL defaults to `http://localhost:3000` if unset | Studio concern | Bake `PUBLIC_AURII_CORE_URL` at image build; document |
| Geo still in the monorepo with `workspace:*` | Product / documentation concern | Do not fake extraction; keep generic fixture as the CI consumer |
| No credentials for a public `*.aurii.dev` in this environment | Deployment concern | Document operator attach; do not invent Core hosting APIs |
| 500 responses stringified errors | Core concern | Sanitized message in production |

---

## Architecture fitness

- Core remains deployment-independent (no provider types).
- Products remain independent (Aurii CI/deploy does not build Geo).
- Consumers use SDK/public routes.
- Studio is optional.
- Postgres is behind Core.

---

## Success criteria (honest)

The **in-repo definition of done** for this PR:

```text
build image → migrate → start → health → auth/CORS
     +
generic consumer contract
     +
persistence/backup proof script
     +
documented host attach
```

The **phase brief** also asks for a persistent instance on real infrastructure and an independently deployed Norwegian Geo. That last mile is operator + extraction work. It must not be papered over by putting Geo files into the Runtime image.
