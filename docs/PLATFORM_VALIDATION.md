# Platform validation through real projects

> How Aurii earns the right to be a platform: by proving a shared Core makes several different products meaningfully easier to build, operate, and evolve.
>
> This document records **validation intent and decision criteria**. It does not invent commercial products, freeze a portfolio roster, or claim that Aurii is already validated.
>
> Canonical vocabulary: [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md).  
> Product direction: [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).  
> Design stress tests: [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md).  
> Runnable proof today: Norwegian Geo — [`NORWEGIAN_GEO.md`](NORWEGIAN_GEO.md), [`REFERENCE_DEMO.md`](REFERENCE_DEMO.md).

---

## Why this document exists

Aurii should not exist simply because we can build our own CMS, admin interface, or data platform.

Existing products such as Sanity, Payload, Directus, and Strapi already solve large parts of those problems well.

The hypothesis behind Aurii is different:

> A small, reusable Content & Data Core can reduce the amount of infrastructure and glue code we rebuild across otherwise very different products, while still allowing each product to have its own domain model, workflows, user experience, and delivery mechanisms.

Aurii should earn the right to become a platform by proving this hypothesis through **real projects**.

This complements:

| Document | Role |
|----------|------|
| [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md) | How products and Core should relate once we build |
| [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md) | Design tests that Core must not special-case |
| This document | Whether the platform hypothesis is true enough to keep building Aurii |

Constitutional anchors: Article 21 (specifications are not proof), Article 22 (vertical before horizontal), Article 24 (products discover, Core generalizes) — [`Constitution.md`](Constitution.md).

---

## Core hypothesis

Aurii is valuable if a shared Core makes several different products meaningfully easier to build, operate, and evolve than implementing each product independently.

The goal is therefore **not** to build Aurii first and find use cases afterwards.

The goal is to evolve Aurii alongside a portfolio of real projects that continuously test whether the common abstractions are actually useful.

---

## Validation portfolio

We currently have approximately 5–10 potential projects of different sizes and domains that can act as validation projects.

They should deliberately be **diverse**. Examples of shapes that should appear in the portfolio:

- structured reference datasets
- editorial content
- reviews or ratings
- live or frequently updated data
- documentation
- public data APIs
- small internal tools
- larger editorial applications
- products requiring custom workflows
- products requiring multiple output formats

A successful Aurii architecture should support several of these **without** forcing them into the same application model or user interface.

Fitness cases already named for design pressure (Kampbart, playgrounds, Gaselle, Geo) live in [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md). They are architecture tests and possible products — not a closed catalog. The validation portfolio may include those cases and others that are not listed there.

Do **not** invent demo backends for fitness cases unless that is the assigned task. Prefer real projects that pull capabilities into Aurii.

---

## What each project should validate

For every project built on Aurii, explicitly record what parts of the platform it exercises. Use the register template at the end of this document.

### Core

Does the project benefit from a shared implementation of:

- data modelling
- validation
- relations
- mutations
- authorization
- history / audit
- events
- APIs
- SDKs

### Clients

Can the project use the same Core while having an interface appropriate for its own domain?

Examples:

- editorial Studio / authoring product
- dataset management UI
- table / grid interface
- specialized review application
- CLI
- import pipeline
- automated client

**Studio must remain a client of Aurii rather than becoming Aurii itself.** See [`Studio.md`](Studio.md) and [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).

### Distribution

Can the same underlying data be consumed in multiple useful ways?

Examples:

- REST
- GraphQL
- SDK
- static JSON
- websites
- internal services
- feeds
- exports
- generated packages

Norwegian Geo already exercises live published routes, SDK, and a public website consumer — [`DELIVERY.md`](DELIVERY.md).

### Operations

Does Aurii actually simplify:

- deployment
- authentication
- observability
- upgrades
- backups
- local development
- infrastructure management

Or are we merely moving complexity into a new platform?

Honest ops and scale limits: [`DEPLOYMENT.md`](DEPLOYMENT.md), [`SCALE.md`](SCALE.md).

---

## The reuse test

A capability should not automatically become part of Aurii Core just because one project needs it.

For each proposed Core feature, ask:

> Is this a platform concern or a product concern?

Prefer keeping functionality in the product, client, or plugin until **multiple projects** demonstrate that the abstraction belongs in Core.

| Evidence | Action |
|----------|--------|
| Repeated implementation across projects | Candidate for reusable capability, then possibly Core |
| One project needs it | Keep it in that product / plugin / client |
| Theoretical future need | Do not add it to Core |

This is the operational form of:

> **Products discover requirements. Core absorbs durable generalizations.**

See [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md) and Constitution Article 24.

---

## Comparison against existing solutions

For relevant validation projects, also ask:

> Would this project have been easier to build with an existing product?

Candidates may include:

- Sanity
- Payload
- Directus
- Strapi
- a plain application with PostgreSQL
- static files / Git
- other domain-specific tools

Aurii does not need to beat every existing system individually.

It needs to demonstrate that a **common Aurii foundation** produces enough value across the portfolio to justify owning and maintaining the platform.

Record the comparison briefly in each project's validation register entry when the project is real enough to judge.

---

## Success criteria for MVP

Aurii should not be considered validated because the Core API works.

An MVP should demonstrate that:

1. Multiple substantially different real projects run on the same Core architecture.
2. At least one project has a highly domain-specific client rather than a generic CMS interface.
3. Core can operate independently of Studio.
4. Projects reuse meaningful platform functionality instead of merely sharing a database library.
5. At least one dataset / content model is consumed by more than one type of client or output.
6. Adding a new project is noticeably faster because Aurii exists.
7. Aurii does not require every project to adopt unnecessary platform abstractions.
8. We can identify concrete infrastructure or application code that no longer needs to be rebuilt per project.
9. Operating several Aurii projects is demonstrably simpler than operating equivalent independent stacks.
10. We have identified features that initially looked generic but correctly remained outside Core.

### Current honest status

| Criterion | Status (as of Phase 4 complete) |
|-----------|----------------------------------|
| Multiple substantially different real projects on one Core | **Not met** — Norwegian Geo is the primary implemented vertical |
| Domain-specific client (not generic CMS UI) | **Partial** — `apps/geo` is a domain consumer; Studio remains generic ops UI; Kampbart-class editors are design-only |
| Core independent of Studio | **Met** — Core serves without Studio; geo consumer never imports Studio |
| Meaningful platform reuse (not only a DB library) | **Partial** — schemas, import, query, published routes, SDK, project packages are real |
| One model, multiple clients / outputs | **Partial** — Norwegian Geo: Studio + `apps/geo` + published routes / SDK |
| Faster second project | **Unproven** — second real product not yet in portfolio |
| Avoid forced abstractions | **Partial** — reuse test is policy; needs more projects to stress |
| Concrete code we no longer rebuild | **Emerging** — import/query/delivery/project package path |
| Simpler multi-project operations | **Unproven** |
| Correctly kept features out of Core | **Policy in place**; needs portfolio evidence |

Phase 4 proved a **data-product delivery slice**. It did **not** complete platform validation. Phase 5 (Editorial & Context) is one planned portfolio entry for authoring — [`Phase5.md`](../Phase5.md) — and must not be treated as the only remaining proof.

---

## Failure criteria

We should be willing to conclude that the hypothesis is wrong.

Aurii should be reconsidered if:

- most projects mainly need a conventional CMS
- projects require extensive workarounds to fit the Core model
- most reusable functionality is already provided better by an existing platform
- Studio gradually becomes inseparable from Core
- every project requires significant Core customization
- reuse between projects remains superficial
- platform maintenance costs exceed the savings from reuse
- new projects are slower to build because they first require changes to Aurii

Stopping or narrowing Aurii in that situation should be considered a **successful outcome of the validation process**, not a project failure.

---

## Phase 2: Product opportunities

If the platform hypothesis is validated, a second question becomes interesting:

> What products become economically or technically feasible because Aurii exists?

Once the marginal cost of creating a new structured-data product becomes low enough, Aurii can potentially become a foundation for products beyond the original internal use cases.

Validation projects therefore serve two purposes:

1. Validate Aurii itself.
2. Discover repeatable products that could have a market outside the original environment.

Potential opportunities should emerge from **actual projects**, not be invented in isolation.

Signals worth looking for:

- the same workflow appears across several organizations
- users currently solve the problem with spreadsheets or custom internal systems
- existing products are too generic or too expensive
- organizations need control over their own data / infrastructure
- a specialized client provides significantly better UX than generic CMS interfaces
- structured data needs to be distributed through several channels
- multiple customers could use the same Aurii-powered product with different schemas or configuration

### Productization model

A useful mental model may eventually become:

```text
                    Aurii Core
                        │
          ┌─────────────┼─────────────┐
          │             │             │
      Product A     Product B     Product C
          │             │             │
      own Studio     own UI        own UI
      own domain     own domain     own domain
```

Aurii itself does not necessarily need to be the product customers buy.

Aurii may instead be the platform that makes several focused products cheap enough to build and maintain.

This aligns with [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md): commercial value may live in opinionated products, advanced capabilities, integrations, hosted services, and operations — without freezing the open/commercial boundary here.

### Important constraint

Do **not** build platform functionality solely because it might enable a future commercial product.

Real validation projects should pull capabilities into Aurii.

Aurii should grow from **demonstrated reuse**, not anticipated reuse.

---

## Decision we want to reach

By the time we approach Aurii v1, we should be able to answer:

> If Aurii did not exist, would we choose to build it again based on what we learned from these projects?

And ideally:

> What became possible to build because Aurii existed?

If we cannot answer the first question convincingly, Aurii should probably remain a small internal library/platform or be discontinued.

If we can answer both, we may have found something substantially more interesting than another CMS.

---

## How agents and contributors should use this

1. Prefer real validation projects over synthetic demos when proving architecture.
2. When proposing a Core feature, apply the **reuse test** and cite which projects already need it.
3. When starting or adopting a validation project, add or update a register entry below.
4. Do not treat Norwegian Geo alone as full platform validation.
5. Do not implement fitness-test products (Kampbart, Gaselle, playground Map) or Phase 5 Editorial unless assigned.
6. Keep Studio a Core client; keep domain UX in products or extensions.

---

## Validation project register

Record one entry per real project. Design-only fitness cases may be listed as **design** until they become real projects.

### Template

```markdown
### <Project name>

| Field | Value |
|-------|-------|
| Status | candidate \| active \| paused \| concluded |
| Domain shape | e.g. reference dataset, editorial, live data, internal tool |
| Core exercised | modelling, validation, relations, mutations, auth, history, events, APIs, SDKs |
| Clients | Studio, custom UI, CLI, import, automation, … |
| Distribution | REST, SDK, website, feeds, exports, … |
| Operations notes | deploy, auth, local, upgrades, … |
| Alternatives considered | Sanity, Payload, Postgres app, … |
| Why Aurii (or not) | short judgement |
| Reuse evidence | what this project duplicated vs shared |
| Product opportunity signal | none \| weak \| strong — and why |
```

### Norwegian Geo

| Field | Value |
|-------|-------|
| Status | **active** (canonical implemented vertical) |
| Domain shape | Structured reference datasets; public data API; website delivery |
| Core exercised | Modelling, validation, relations, import/sync, query, published routes, SDK, project packages, sources/schedules |
| Clients | Studio (ops), CLI/import pipeline, `apps/geo` consumer (no Studio dependency) |
| Distribution | Published REST routes, SDK, public website, snapshot offline mode |
| Operations notes | Local Bun + Docker Postgres path documented; multi-project ops still thin |
| Alternatives considered | Static JSON/Git; bespoke Postgres API; headless CMS (poor fit for reference geo) |
| Why Aurii (or not) | Strong fit for schema + import + multi-consumer delivery; does **not** alone validate authoring or custom domain editors |
| Reuse evidence | Project package, import engine, query, delivery used as platform path |
| Product opportunity signal | Possible reusable Norwegian reference-data product; not yet market-validated |
| Docs | [`NORWEGIAN_GEO.md`](NORWEGIAN_GEO.md), [`REFERENCE_DEMO.md`](REFERENCE_DEMO.md), [`DELIVERY.md`](DELIVERY.md) |

### Editorial + Context (planned)

| Field | Value |
|-------|-------|
| Status | **candidate** (planned — [`Phase5.md`](../Phase5.md); do not implement unless assigned) |
| Domain shape | Larger editorial application; custom workflows; hybrid structured + rich content |
| Core exercised (intended) | Authored entities, generic revisions/lifecycle, relations to structured data, delivery of unpublished content |
| Clients (intended) | Separate Editorial product (not Studio); Context as research/writing aid |
| Distribution (intended) | Web and other consumers via Core/delivery APIs |
| Alternatives considered | Sanity, Payload, in-house CMS |
| Why Aurii (or not) | TBD when built — must prove Core stays non-media and Studio stays non-CMS |
| Product opportunity signal | Primary Phase 5 commercial hypothesis if Context proves valuable |

### Architecture fitness cases (design)

Kampbart, playground directory, DN Gaselle, and Geo-as-design-case: see [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md). Promote to register entries above when they become real projects.

---

## Related documents

- [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) — open Core, product boundaries, Studio audience, customer-led evolution
- [ARCHITECTURE_FITNESS.md](./ARCHITECTURE_FITNESS.md) — Kampbart, playgrounds, Gaselle, Geo as design tests
- [PRODUCT_MODEL.md](./PRODUCT_MODEL.md) — canonical vocabulary
- [Constitution.md](./Constitution.md) — Articles 21, 22, 24
- [Studio.md](./Studio.md) — Studio as Core client
- [NORWEGIAN_GEO.md](./NORWEGIAN_GEO.md) — implemented validation vertical
- [Phase5.md](../Phase5.md) — planned Editorial & Context portfolio entry
- [ADR-0010 — Optional Authoring Layer](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)
- [ADR-0020 — Extensible Studio](../adr/ADR-0020%20—%20Extensible%20Studio.md)
