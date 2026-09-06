# Deployment

## Norwegian Geo (external product)

Norwegian Geo is no longer deployed from this repository. The consumer site and project package live in [`aprestmo/norwegian-geo`](https://github.com/aprestmo/norwegian-geo) and consume Aurii through versioned packages and HTTP contracts. See [`EXTERNAL_CONSUMERS.md`](EXTERNAL_CONSUMERS.md).

---

## Studio + Core (not yet hosted)

Studio and the Core API need a persistent backend (PostgreSQL + HTTP server). Free options for a future demo:

| Platform | Static product sites | Studio + Core |
|----------|----------------------|-----------------|
| GitHub Pages | Yes (static) | No |
| Cloudflare Pages | Yes (static) | No |
| Render | Static or Docker | Free web + Postgres (cold start) |
| Fly.io | — | Docker Compose, limited free tier |
| Railway | — | Docker, limited credits |

Recommended path when you want the dashboard live:

1. Deploy Core + Postgres on **Render** or **Fly.io** (Dockerfiles in repo root)
2. Point Studio `PUBLIC_AURII_API_URL` at the Core URL
3. Register a project package and import its data on first boot

Local full stack:

```bash
docker compose up
# Core: http://localhost:3000
# Studio: http://localhost:4321
```

Operational contracts (startup order, migrations, backup/restore, health checks, limitations):

- [`OPERATIONS.md`](OPERATIONS.md)
- Persistence proof: `bun run ops:persistence-proof`

Do not promise HA, SLA, or zero-downtime deploys from this documentation.
