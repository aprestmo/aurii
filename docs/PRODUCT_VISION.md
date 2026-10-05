# Aurii Product Vision

> Canonical **product direction** for Aurii as a developer product and general application data platform.
>
> This document captures intent and hypotheses. It does **not** prove the platform works — see Constitution Article 21 and [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md).
>
> **Vocabulary and boundaries:** [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md). **How Core and products should evolve:** [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md). **Durable principles:** [`Constitution.md`](Constitution.md). **Philosophical “why” (information-first):** [`Vision.md`](Vision.md).
>
> Status labels in this file match [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md): **Implemented**, **Beta**, **Planned**, **Experimental**, and **product hypothesis** (commercial or roadmap intent not yet decided or built).

---

## Where this document sits

```text
Constitution          ← stable principles (highest normative authority)
    ↓
Product Vision        ← this file: developer-product thesis & direction
    ↓
Product Model / Product Strategy / Platform Validation
    ↓
ADRs
    ↓
Roadmaps / phases
    ↓
Implementation
```

[`AGENTS.md`](../AGENTS.md) instructs agents how to apply these layers during architecture and implementation work.

---

## 1. Product thesis

Aurii should stand on its own as a **developer product** and **general application data platform**.

A developer should be able to use Aurii to model and build applications **without** Aurii Core containing domain-specific implementations for those applications. Domain concepts belong in **schemas, relations, capabilities, and product code** — not as built-in Core types.

**Complements (does not replace):**

> **Products discover requirements. Core absorbs durable generalizations.**

See Constitution Article 24, [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md), and [`COMPETITIVE_GUARDRAILS.md`](COMPETITIVE_GUARDRAILS.md).

### Example applications (product direction, not Core modules)

An external developer should eventually be able to build useful applications such as:

- a small CRM
- a membership registry
- a property-management application
- an asset registry
- a directory
- a case-management tool

…by describing `Customer`, `Member`, `Property`, `Case`, and similar concepts in **project schemas** and consuming generic platform primitives. Those names must **not** become Aurii Core concepts.

This is a **directional test**, not a claim that Aurii today replaces specialized SaaS or low-code platforms out of the box.

### What Aurii is not becoming

- **Not** a universal low-code application builder where every screen is generated and no product code is needed.
- **Not** “Studio as the application” — Studio is a **developer/operator workspace** ([`Studio.md`](Studio.md)), not the end-user UI for arbitrary business apps.
- **Not** a headless CMS competitor by feature matrix — apply the Kyro test before growing Core ([`COMPETITIVE_GUARDRAILS.md`](COMPETITIVE_GUARDRAILS.md)).

---

## 2. Core developer experience (conceptual journey)

The intended developer journey is conceptual. **CLI names, scaffolds, and packaging are product-direction examples unless marked implemented** in [`PROJECT_PACKAGES.md`](PROJECT_PACKAGES.md) or [`PACKAGES.md`](PACKAGES.md).

```text
install / create Aurii project
        ↓
define schemas + relations + behaviour (project package)
        ↓
run locally (Core + optional Studio)
        ↓
Aurii provides generic platform primitives
        ↓
API / SDK / Studio / events / application integration
        ↓
developer builds application using preferred frontend / framework
        ↓
optionally deploy / use Aurii Cloud (product hypothesis)
```

| Step | Typical direction examples | Status (see linked docs) |
|------|---------------------------|---------------------------|
| Project definition | `aurii.config.ts`, `defineProject()` | **Beta** — [`PROJECT_PACKAGES.md`](PROJECT_PACKAGES.md) |
| Client contract | `@aurii/sdk`, HTTP APIs | **Implemented** (evolving 0.x) — [`API.md`](API.md), [`DELIVERY.md`](DELIVERY.md) |
| Operator workspace | Studio (`@aurii/studio-app`) | **Beta** — [`Studio.md`](Studio.md) |
| One-command create | e.g. `npm create aurii` | **Product hypothesis** — not documented as stable |
| Managed hosting | Aurii Cloud | **Product hypothesis** — see §4 |

Core must remain **genuinely useful without Cloud** (self-host, local dev, own infrastructure). See [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md) (open Core, delivery vs custody).

External products already consume Core via versioned packages and HTTP — [`EXTERNAL_CONSUMERS.md`](EXTERNAL_CONSUMERS.md) (Norwegian Geo).

---

## 3. Schema → application primitives

Long-term direction: **schemas increasingly provide the declarative foundation** from which generic application infrastructure can derive — without hardcoding domain logic in Core.

```text
Schema
  ├── fields
  ├── relations
  ├── validation
  ├── permissions          (capability / model — maturity varies)
  ├── capabilities
  └── metadata
          ↓
       Aurii Core
          ↓
  ├── storage                Implemented
  ├── API                    Implemented
  ├── SDK                    Implemented (0.x)
  ├── query                  Implemented
  ├── Studio UI              Beta
  ├── events                 Candidate / partial — see PLATFORM_VALIDATION
  └── workflows / automation Planned / hypothesis — e.g. Phase 5+, pipelines
          ↓
      Application            (developer’s product / frontend)
```

**Do not read the diagram as a commitment that every box is complete.** Permissions, events, revisions, workflow, and rich authoring surfaces are **planned, candidate, or product-local** until proven across products — see maturity tables in [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md) and [`Phase5.md`](../Phase5.md) (planned, not implemented).

Aurii is a **declarative runtime for structured knowledge**, not a form generator that replaces all application logic.

---

## 4. Core vs Cloud

| | **Aurii Core** | **Aurii Cloud** |
|---|----------------|-----------------|
| **Role** | The platform / product (system of record, runtime, public APIs) | Possible **managed commercial service** around Core |
| **Distribution hypothesis** | Local development, self-hosting, packages / SDK, open developer ecosystem | Managed runtime, hosted infrastructure, operational convenience |
| **Commercial hypothesis** | Open enough to evaluate and build on (see Product Strategy) | Possible free tier; paid usage / teams / enterprise capabilities |
| **Status** | **Implemented** (platform under active validation) | **Product hypothesis** — not Aurii Cloud as shipped product |

```text
Aurii Core
├── local development
├── self-hosting
├── packages / SDK
└── open developer ecosystem

Aurii Cloud (hypothesis)
├── managed Aurii runtime
├── hosted infrastructure
├── operational convenience
├── possible free tier
└── paid usage / teams / enterprise capabilities
```

This section records **distribution and commercial hypotheses only**. It does **not** decide pricing, usage limits, licenses, package boundaries, or enterprise feature lists. Those remain future business decisions unless recorded elsewhere.

Reference deployments (e.g. production-shaped self-host) are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md) and are **not** Aurii Cloud.

**Strategic property:** Cloud should primarily **remove operational friction**, not make Core artificially unusable without it.

---

## 5. Distribution hypothesis (funnel)

Intended product funnel — **hypothesis, not a commitment**:

```text
discover Aurii
      ↓
try locally
      ↓
build something useful
      ↓
continue self-hosted
      OR
use Aurii Cloud
      ↓
paid usage / teams / larger deployments
```

Validation evidence comes from real projects ([`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md)), not from documenting the funnel.

---

## 6. Framework independence

Aurii must remain **frontend-framework independent**.

Astro, Svelte, Vue, React, mobile apps, server apps, AI clients, and future consumers should all be able to consume the **same public API / SDK and platform model**.

Current repo choices (e.g. Astro in reference products, Studio’s stack) are **implementation preferences**, not platform requirements. Products must not import `@aurii/core` or `@aurii/db` — see [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).

Constitution Article 3 (Information Before Presentation) aligns with this contract.

---

## 7. Relationship to vertical products

Existing and planned products and validation cases **stress-test** Core; they **do not define its limits**:

| Area | Role |
|------|------|
| Editorial / publication CMS | Planned reference vertical — [`Phase5.md`](../Phase5.md) |
| LiveCenter, Research | Product / hypothesis — not Core modules |
| Norwegian Geo | **Implemented** external reference product — [`NORWEGIAN_GEO.md`](NORWEGIAN_GEO.md) |
| Kampbart, Gaselle, playgrounds | Architecture fitness tests — [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md) |
| Documentation / static publishing | Valid consumer patterns |
| Structured datasets | Core strength (import, query, delivery) |

Publishing expertise is an **advantage** and useful early validation domain. Aurii must remain capable of **non-media** applications without Core redesign.

Vertical products are **clients** of Core (Constitution Article 2). They must not become Core modules or mandatory layers between Core and a frontend.

---

## 8. Non-media validation

Non-media business applications are **first-class platform validation cases**, not edge cases.

Portfolio intent already includes directories, internal tools, import-heavy systems, and specialized workflows — [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md). This vision explicitly adds **external developer-built** apps (CRM, registry, case tool, etc.) as long-term proof that Core stays domain-agnostic.

Norwegian Geo alone does not complete platform validation. Editorial alone does not prove non-media fit. A healthy portfolio spans **materially different** system types.

---

## 9. Non-media platform test

Use this test when evaluating gaps vs scope creep:

> **Can an external developer build a useful non-media business application using Aurii’s schemas, relations, APIs, and generic capabilities — without requiring domain-specific functionality to be added to Aurii Core?**

| If the answer is… | Then… |
|-------------------|--------|
| **Yes** | Prefer keeping domain logic in schemas and product code. |
| **No** | Investigate whether a **genuinely generic** platform primitive is missing — then apply reuse test, Kyro test, multi-product evidence, and promotion ladder before adding to Core. |

A “no” does **not** mean every feature requested by an application belongs in Core. Continue applying [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md) and [`COMPETITIVE_GUARDRAILS.md`](COMPETITIVE_GUARDRAILS.md).

---

## 10. Open questions / hypotheses

Intentionally unresolved (do not implement here to “complete” the doc):

- Exact **Aurii Cloud** packaging, pricing, tiers, and SLAs.
- **Open vs licensed** capability boundary beyond principles in Product Strategy.
- Stable **`npm create aurii`** (or equivalent) developer onboarding.
- Which **workflow / automation** primitives become Core vs plugin vs product-local.
- Timing and shape of a **non-media reference product** in the validation portfolio.
- How much **generated UI** from schema is enough for operators vs when a separate product UX is required.
- Whether Aurii’s developer-product thesis is **validated** — decided by portfolio evidence, not specification quality (Article 21).

When architecture or product boundaries change materially, prefer an **ADR** and update [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md) / [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md) for term changes; update this file when the **developer-product thesis or Core vs Cloud story** changes.

---

## Related documents

- [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md) — canonical terms, layers, implementation status
- [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md) — open Core, Studio audience, customer-led evolution
- [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md) — portfolio, discovery loop, maturity model
- [`COMPETITIVE_GUARDRAILS.md`](COMPETITIVE_GUARDRAILS.md) — Kyro test, promotion ladder
- [`Vision.md`](Vision.md) — information-first philosophy
- [`Constitution.md`](Constitution.md)
- [`AGENTS.md`](../AGENTS.md)
