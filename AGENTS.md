# AGENTS.md

> This document defines how AI agents should reason about, design and implement Aurii.
>
> It is not merely a coding guide.
>
> It is the architectural philosophy of the project.

---

# Mission

Your mission is not to write code.

Your mission is to build Aurii.

Every decision should move the platform closer to becoming the best runtime for structured knowledge.

Never optimize for short-term implementation if it compromises long-term architecture.

---

# Understand Aurii

Aurii is **not** a CMS.

Aurii is **not** a database.

Aurii is **not** an API framework.

Aurii is a **Declarative Runtime for Structured Knowledge** — a schema-driven platform for modeling, ingesting, editing, enriching, relating, and publishing structured data and editorial content.

**Product clarification:**

- **Aurii Core** is the system of record. It is not a CMS. It does not assume records are articles. The same entity/schema model represents structured records, editorial documents, and hybrids. Core must remain usable independently of Studio and of commercial products.
- **Studio** is an **extensible developer/operator project workspace** (generated UI by default; custom editors/views via extensions). Studio is **not** a publication CMS, **not** the Editorial product, and **not** the default tool for journalists, editors, or other domain users.
- Data enters Core from **many sources** (file, HTTP, database, manual, automation, AI, future product clients)—not only from an authoring UI.
- Developers describe installable projects with a **project package** (`aurii.config.ts` / `defineProject`), complementary to product composition (`product.yaml`).
- **Products** may be separate, opinionated clients over Core. They do not need to share one universal UI. A publication CMS is a future separate product that may consume Core. It is never required between Core and a frontend, and it is not Studio renamed. Domain-specific Studio tools (match desk, map) are operator-facing extensions, not that CMS.
- Separate products may optionally integrate through Core data/references/public APIs, but they should remain independently usable. Do not introduce Core coupling solely to connect two products.
- **Products discover requirements. Core absorbs durable generalizations.** Do not move a need into Core merely because it could theoretically be useful elsewhere. Do not make Core media-specific because publishing is an early vertical.
- **Aurii must not become “a better headless CMS.”** Conventional CMS capabilities are enabling infrastructure, not the reason Aurii exists. Canonical rules: [`docs/COMPETITIVE_GUARDRAILS.md`](docs/COMPETITIVE_GUARDRAILS.md).
- Relations, sources, provenance/overrides, and Studio extensibility are **foundations**. Do not treat them as late optional integrations. Do not implement them as large features unless that is the assigned task.
- Products with sensitive-data requirements may need customer-controlled/self-hosted Core. Product delivery and data-custody boundaries do not have to be the same.

See `docs/PRODUCT_MODEL.md`, `docs/PRODUCT_STRATEGY.md`, `docs/PLATFORM_VALIDATION.md`, `docs/COMPETITIVE_GUARDRAILS.md`, `docs/Studio.md`, `docs/PROJECT_PACKAGES.md`, `docs/ARCHITECTURE_FITNESS.md`, [ADR-0010](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md), [ADR-0019](adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md), [ADR-0020](adr/ADR-0020%20—%20Extensible%20Studio.md), and ADRs 0014–0018.

Everything you build should reinforce that vision.

---

# Before Writing Code

Before implementing anything, ask yourself:

1. Does this belong in the Runtime?
2. Does this belong in Schema Language?
3. Does this belong in Query Language?
4. Does this belong in Pipeline Language?
5. Does this belong in the Capability Model?
6. Can this be implemented as a Plugin?
7. Does this make Aurii more generic?
8. Has a real product proven this need, or is it hypothetical?
9. Would this turn Studio into a domain CMS, or Core into a media backend?
10. Does the reuse / platform boundary test in `docs/PLATFORM_VALIDATION.md` say this belongs in Core yet?
11. If it enters Core now, is it Experimental, Candidate, or Core — and which projects will challenge it?
12. Does the **Kyro test** in `docs/COMPETITIVE_GUARDRAILS.md` say a conventional headless CMS already solves this adequately — and if so, why must it be Core?

If you cannot answer these questions, stop and think before writing code.

A need that is real for one product should usually stay in that product until it proves durable across products.

---

# Runtime First

The Runtime is the heart of Aurii.

Applications exist because the Runtime exists.

Never allow application-specific requirements to shape the Runtime unnecessarily.

Applications adapt to Runtime.

Never the opposite.

---

# Everything Is An Entity

Never introduce special object types unless absolutely necessary.

Whenever you encounter something new, ask:

> Can this simply be another Entity with another Schema?

Prefer one generic abstraction over many specialized ones.

---

# Schema Is The Source Of Truth

Schemas define:

- structure
- validation
- relationships
- capabilities
- API behavior
- search behavior
- AI context

Never duplicate information already present in a Schema.

Whenever behavior can be expressed declaratively, prefer the Schema.

---

# Think Declaratively

Avoid imperative designs.

Instead of asking:

> "How should this feature work?"

Ask:

> "How can this behavior be declared?"

Declarative systems are easier to evolve.

---

# Capabilities Before Features

Never introduce hardcoded functionality.

Instead ask:

> Is this a Capability?

Example:

Wrong:

```
Article supports publishing.
```

Correct:

```
Schema declares Publish capability.
```

Capabilities scale.

Special cases do not.

---

# Pipelines Before Scripts

Never solve recurring transformations using custom scripts.

Instead ask:

Can this become a Pipeline?

Reusable Pipelines improve the entire platform.

---

# Queries Before SQL

Applications should never think about storage.

Whenever data retrieval is needed, ask:

Can this be expressed using Query Language?

Storage is an implementation detail.

---

# Plugins Before Core

Whenever implementing functionality, ask:

Can this live outside Core?

If yes,

prefer a Plugin.

Core should become smaller over time.

---

# AI Is A User

Treat AI as another client of the Runtime.

AI never bypasses:

- permissions
- validation
- schemas
- queries

AI consumes the same platform as humans.

---

# Keep Runtime Small

The Runtime should know as little as possible.

Whenever logic becomes domain-specific,

move it:

- to Schemas
- to Plugins
- to Capabilities
- to Pipelines

Generic Runtime.

Specific Plugins.

**Products discover requirements. Core absorbs durable generalizations.** Do not promote a product need into Core until it has proven durable and general.

---

# Competitive guardrails before changing Core

Aurii must not optimize for becoming another headless CMS. Schema-driven CRUD, generated admin, drafts, media, preview, and standard publishing APIs are already well-served by systems such as Kyro, Payload, Sanity, Directus, and Strapi. Detailed rules: [`docs/COMPETITIVE_GUARDRAILS.md`](docs/COMPETITIVE_GUARDRAILS.md).

Before adding a substantial capability to Core, apply:

1. **Product-local test** — can this live in Editorial, Research, Studio, or another product first?
2. **Kyro test** — could a conventional modern headless CMS such as Kyro, Payload, or Sanity solve this adequately? If yes, why must it exist in Core?
3. **Multi-product reuse test** — has the need appeared in at least two materially different products? Two screens inside one product do not count.
4. **Core-fundamentality test** — does this interact fundamentally with ingest, provenance, datasets, relations, query, or cross-product information?

If the capability is conventional CMS functionality and has not demonstrated cross-product platform value, **keep it outside Core by default**.

Also:

- Do **not** infer that roadmap concepts are implemented. Phase 5, Context, Editorial, and Research are planned unless the assigned task says otherwise.
- Do **not** move product schemas (`Article`, `Story`, `Desk`, `Newsroom`, `ResearchNote`, …) into Core.
- Do **not** expand Studio into a universal CMS. Studio is the developer/operator workspace. Domain users belong in products.
- Do **not** add competitor-parity features (GraphQL, extra database adapters, protocol checklists, framework-native runtimes) without a concrete Aurii use case.
- Prefer an **ADR** before altering Core boundaries.
- Prefer existing packages and standard protocols for commodity needs (rich text, CRDT collaboration, auth, media upload) rather than inventing Aurii-specific equivalents in Core.

Promotion path: product-local → experimental shared capability → candidate reusable capability → proven across multiple products → Core only if fundamental.

---

# APIs Are Products

Never expose databases.

Expose concepts.

Applications should consume Runtime concepts.

Not implementation details.

---

# Events Connect The Platform

Whenever two systems need to communicate,

consider Events first.

Prefer loose coupling.

Avoid direct dependencies.

---

# Explain Your Reasoning

When proposing architectural changes:

Explain:

- why
- tradeoffs
- consequences
- future implications

Never optimize blindly.

Architecture matters.

---

# Respect Existing Decisions

Before introducing a new abstraction, ask:

Does something already solve this?

Avoid duplication.

One concept.

One responsibility.

---

# Documentation Comes First

If architecture changes,

update documentation first.

Then update code.

The specification is the source of truth.

Code implements the specification.

---

# Think In Decades

Do not optimize for today's requirements.

Design for:

- future datasets
- future AI
- future applications
- future protocols
- future storage engines

Aurii should evolve without rewriting its foundations.

---

# Simplicity Is Power

Prefer:

One concept

over

Three similar concepts.

Prefer:

One language

over

Five APIs.

Prefer:

One abstraction

over

Many implementations.

Complexity compounds.

Simplicity scales.

---

# Naming Matters

Names define architecture.

Prefer names that describe concepts.

Avoid names tied to current implementation.

Good examples:

- Runtime
- Entity
- Schema
- Capability
- Pipeline

Avoid names tied to frameworks or technologies.

---

# Think Like A Platform Engineer

You are not building pages.

You are not building forms.

You are not building CRUD.

You are building infrastructure that allows others to build those things.

Always think one level lower.

---

# Long-Term Compatibility

Breaking changes should be rare.

When changing concepts:

- preserve compatibility
- provide migrations
- document rationale

Architecture should evolve carefully.

---

# Challenge Assumptions

Never assume previous decisions are correct.

Respect them.

Question them.

Improve them when necessary.

The goal is not consistency with history.

The goal is a better platform.

---

# When Unsure

If two solutions appear valid:

Choose the one that:

- removes concepts
- removes duplication
- increases reuse
- improves declarative behavior
- reduces coupling
- improves future extensibility
- keeps product-specific logic out of Core
- does not turn Studio into a domain CMS

Prefer implementing a need in a product first. Promote it to a reusable capability or Core only after the pattern proves durable.

If the need is conventional CMS functionality, apply the Kyro test and keep it outside Core by default.

Aurii should become simpler over time.

Never more complicated.

---

# Reference Verticals

Aurii uses **two** planned reference verticals, plus **architecture fitness tests** that must not require Core special cases.

| Vertical | Validates | Status |
|----------|-----------|--------|
| **Norwegian Geo** | Import, schema, query, storage, SDK, **delivery**, product modules, sources | Canonical and implemented |
| **Editorial** (future) | Authoring, revision, publishing, preview, workflow, media, Context | Planned after Phase 4 — [`Phase5.md`](Phase5.md); **do not implement unless assigned** |

**Fitness tests** (design, not in-repo demos unless assigned): Kampbart, playground directory, DN Gaselle, Geo — [`docs/ARCHITECTURE_FITNESS.md`](docs/ARCHITECTURE_FITNESS.md).

**Platform validation** (hypothesis, discovery loop, maturity model, 6–12 month gates, success/failure): [`docs/PLATFORM_VALIDATION.md`](docs/PLATFORM_VALIDATION.md). Norwegian Geo alone does not complete platform validation. Prefer convergence evidence over early API stability; removing Core abstractions that fail reuse is learning.

If a change would require Core to know football, playgrounds, Gaselle rankings, or Norwegian geography, stop. Express the domain in schemas, sources, pipelines, and Studio extensions.

Cross-cutting Runtime changes must eventually be validated against both verticals. Until Editorial exists, do **not** add editorial concepts to Core merely because Norwegian Geo cannot exercise them. Express draft/publish/revision as generic schemas and capabilities when that phase begins—not as hardcoded news CMS behavior. Structured + rich fields on the same record is already in the unified model—do not wait for Editorial to allow hybrid records in schemas.

Product model: `docs/PRODUCT_MODEL.md`. Product strategy: `docs/PRODUCT_STRATEGY.md`. Platform validation: `docs/PLATFORM_VALIDATION.md`. Competitive guardrails: `docs/COMPETITIVE_GUARDRAILS.md`. Project packages: `docs/PROJECT_PACKAGES.md`. Studio: `docs/Studio.md`. Delivery: `docs/DELIVERY.md`. Phase plan: `Phase4.md`. Editorial roadmap (planned): `Phase5.md`. ADRs: `0010`, `0014`–`0020`.

---

## Norwegian Geo (canonical data / delivery testbed)

When adding features, fixing bugs, or validating architecture changes for **import, schema, query, storage, SDK, or delivery**, use **Norwegian Geo**. It is Aurii's primary reference implementation and a reusable Norwegian reference data product. Do not invent new synthetic datasets when this one already exercises the platform.

Norwegian Geo is **not** sufficient to validate authoring-specific functionality (drafts, publishing UI, preview, editorial workflow, media libraries). Those wait for the Editorial vertical.

### What it is

A three-layer product built on Aurii:

```
Aurii Core → Norwegian Geo Core → Dataset Modules
```

| Layer | Location | Purpose |
|-------|----------|---------|
| **Aurii Core** | `packages/core/` | Generic runtime (no Norwegian logic) |
| **Norwegian Geo Core** | `demo/norwegian-geo/core/` | Counties, municipalities, postal codes, history |
| **Dataset modules** | `demo/norwegian-geo/modules/` | Schools, kindergartens, hospitals, holidays (+ future domains) |
| **Import** | `bun run import:norwegian-geo` | One-command import into Core (dataset: `norwegian-geo`) |
| **Tests** | `vertical-slice.test.ts`, `geo-website-routes.test.ts`, `public-reference-datasets.test.ts`, `apps/geo/src/__tests__/live-geo-delivery.integration.test.ts` | Integration coverage |
| **Consumer site** | `apps/geo` | Public website |
| **Studio** | `apps/studio` (`@aurii/studio-app`) | Project workspace (dataset: `norwegian-geo`; config via `aurii.config.ts`) |
| **Project package** | `demo/norwegian-geo/aurii.config.ts` | Schemas, sources, imports, sync, routes, Studio config |

Full documentation: `docs/NORWEGIAN_GEO.md`, `docs/REFERENCE_DEMO.md`, and `Phase2.2.md`.

### When to use it

**Always extend Norwegian Geo when:**

- Adding import, query, schema, API, or **delivery** capabilities
- Changing SDK or storage behaviour
- Validating that a data-product feature works end-to-end

**Workflow for agents:**

1. Read `docs/NORWEGIAN_GEO.md` to understand layer boundaries
2. Import the dataset: `bun run import:norwegian-geo`
3. Run relevant tests: `bun test` (especially `vertical-slice`, `geo-website-routes`, `public-reference-datasets`, `live-geo-delivery`)
4. If the feature affects public consumers, update `apps/geo` or add a test there
5. New domain data → add a module under `demo/norwegian-geo/modules/`, not Core hacks

**Do not:**

- Create parallel demo datasets for the same purpose
- Hardcode Norwegian geo logic in Core (keep it in schemas, imports, and the Norwegian Geo product)
- Skip integration tests and rely only on unit tests
- Pretend Norwegian Geo validates CMS/authoring flows
- Implement the Editorial vertical “while you’re here” unless that is the assigned task
- Implement Kampbart, playground Map, or Gaselle as Core features or new demo backends unless that is the assigned task

### Example queries (copy-paste)

```
from county order by name asc
from municipality where countyId == "03"
from postal-code where municipalityId == "0301" limit 10
```

---

## Editorial (future authoring vertical)

Use a future **Editorial** reference product when changing authoring, revision, publishing, preview, workflow, or media behaviour.

Planning only (not implemented): [`Phase5.md`](Phase5.md) — Editorial & Context.

Until that vertical exists:

- Do not create a fake newsroom dataset to justify Core special cases
- Do not require Norwegian Geo to grow editorial fields for platform features it does not need
- Phase 4 is **complete** ([`Phase4.md`](Phase4.md)). Do not reopen data-product delivery as if it were unfinished
- Do not implement Phase 5 capabilities (editor, Context, CRDT, workflow engines) unless that is the assigned task
- Domain-specific Studio extensions are planned ([ADR-0020](adr/ADR-0020%20—%20Extensible%20Studio.md)); do not build match desks or map views unless assigned
- Do not turn Studio into the Editorial product or assume every publishing use case belongs in one universal CMS
- Publishing/news/magazine is an important validation domain, not a boundary on what Core can support
- Editorial concepts (`Article`, `Story`, `Headline`, `Byline`, `Desk`, `Publication`, `PrintReady`, `Breaking`, `Embargo`) begin **product-local**. They must not become Core concepts merely because Editorial needs them
- Phase 5 must prove a sophisticated authored-content product can be built on Aurii **without making Core a CMS backend**. Judge early Editorial work on Context differentiation, not CMS feature completeness
- Context may start inside Editorial while experimentally validating it, but its data/query model must not assume Editorial is its permanent host. Context must remain architecturally consumable by Research, an external CMS, custom applications, and AI clients
- Apply the Kyro test and promotion ladder in [`docs/COMPETITIVE_GUARDRAILS.md`](docs/COMPETITIVE_GUARDRAILS.md) before promoting any Editorial need into Core

---

# The Final Question

Before every pull request, every design decision and every implementation, ask one question:

> Does this make Aurii a better Declarative Runtime for Structured Knowledge?

If the answer is yes,

continue.

If the answer is no,

rethink the design.

Everything else is secondary.