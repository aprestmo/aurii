# Deployment

## Geo demo (free — GitHub Pages)

The Norwegian geo website (`apps/geo`) is a **fully static** Astro site. It reads bundled JSON from `demo/norwegian-geo/core/data/` and `demo/norwegian-geo/modules/*/data/` at build time and needs no running API.

### Live URL

**https://aprestmo.github.io/aurii/**

Deployed automatically when `main` changes (workflow: `.github/workflows/deploy-geo.yml`).

### How it works

- Workflow: `.github/workflows/deploy-geo.yml`
- Triggers on push to `main` when `apps/geo/` or demo data changes
- Builds with `ASTRO_BASE=/aurii/` for GitHub project pages
- Deploys `apps/geo/dist` via GitHub Pages

### One-time setup (repo admin)

1. Open **Settings → Pages** on GitHub
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Merge a change to `main` (or run **Actions → Deploy Geo Demo → Run workflow**)

Alternatively via CLI:

```bash
gh api repos/aprestmo/aurii/pages -X POST -f build_type=workflow
```

### Local preview (production paths)

```bash
cd apps/geo
ASTRO_SITE=https://aprestmo.github.io ASTRO_BASE=/aurii/ bun run build
bun run preview
```

---

## Studio + Core (not yet hosted)

Studio and the Core API need a persistent backend (PostgreSQL + HTTP server). Free options for a future demo:

| Platform | Geo site | Studio + Core |
|----------|----------|-----------------|
| GitHub Pages | Yes (static) | No |
| Cloudflare Pages | Yes (static) | No |
| Render | Static or Docker | Free web + Postgres (cold start) |
| Fly.io | — | Docker Compose, limited free tier |
| Railway | — | Docker, limited credits |

Recommended path when you want the dashboard live:

1. Deploy Core + Postgres on **Render** or **Fly.io** (Dockerfiles in repo root)
2. Point Studio `PUBLIC_AURII_API_URL` at the Core URL
3. Run `bun run import:norwegian-geo` on first boot

Local full stack:

```bash
docker compose up
# Core: http://localhost:3000
# Studio: http://localhost:4321
```

---

## Cloudflare Pages (alternative for geo)

Connect the GitHub repo in Cloudflare Pages:

- **Build command:** `cd apps/geo && bun install && ASTRO_SITE=https://<your-subdomain>.pages.dev ASTRO_BASE=/ bun run build`
- **Build output:** `apps/geo/dist`
- **Root directory:** `/` (monorepo — set build command as above)

No base path prefix needed if using a custom `*.pages.dev` subdomain at root.
