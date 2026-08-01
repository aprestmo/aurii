ADR-0017 — Studio Extension Model

Status: Accepted
Date: 2026-08-01
Decision Makers: Aurii Project
Related: ADR-0010, ADR-0014

⸻

Context

Studio must work for any project without product-specific forks, while allowing projects to customize navigation and add views (maps, coverage, sync status). A full plugin marketplace is out of scope for beta.

⸻

Decision

1. **Three layers:**
   1. Generic Studio runtime (`apps/studio`)
   2. Declarative `defineStudio()` config (`@aurii/studio`)
   3. Optional custom views registered by module path

2. **Default experience without config:** project overview, dataset switcher, schemas, entities, imports, import history, sources, query playground, API routes, system status.

3. **Config API** configures navigation groups, collections (columns/filters/sort), hidden/featured schemas, import/route groups, dashboards, and custom views.

4. **Custom views** use SDK/public APIs only — no direct database access, no Core domain logic.

5. **Simple view registry** for beta — not a full Plugin Runtime. Document the extension point; expand later if needed.

6. **Package split:** `@aurii/studio` is the config/helpers library; the Astro app is `@aurii/studio-app` so projects can depend on config without pulling the UI.

⸻

Consequences

Positive

* One Studio binary + project config
* Norwegian Geo can ship domain navigation without forking Studio

Tradeoffs

* Custom views are client modules with a thin contract — limited isolation vs a full plugin sandbox
* Hosted static builds must not embed secrets

Non-goals

* CMS / authoring workspace
* Realtime collaboration
* Complete plugin marketplace
