# Aurii Product Strategy

> Direction for how Aurii should evolve as a platform: open Core, separate products, and a developer/operator Studio.
>
> This document records **intended direction and design criteria**. It does not freeze a license model, a commercial feature matrix, a plugin API, or a product packaging scheme.
>
> Canonical vocabulary remains [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md). This file does not redefine Core, Studio, Project, Project package, Product, Plugin, capability, or Editorial.
>
> Nothing here claims that planned or visionary capabilities are already implemented.

---

## Why this document exists

Aurii is deliberately broader than a CMS. Current examples — Norwegian Geo, Gaselle, Kampbart, a future Editorial/Context product, magazines, newsrooms, reports, and other structured-data products — are **architecture tests and possible products**. They are not a fixed list of what Aurii is allowed to become.

How Aurii **earns** the right to be a platform — hypothesis, portfolio, success/failure criteria, and the v1 decision — is recorded in [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md). This file assumes that process; it does not replace it.

The risk this document protects against is accidental narrowing:

- turning **Studio** into the CMS / product layer
- making **Core** media-specific or newsroom-shaped
- assuming one universal modular CMS UI can serve every product
- freezing an open-vs-commercial boundary before real products and customers have validated it
- putting hypothetical abstractions into Core before a concrete product has proven the need

---

## One-sentence direction

Aurii Core is a general-purpose, developer-friendly information platform and system of record. Opinionated products are built on Core. Studio is how competent operators work with Aurii — not how journalists, editors, or other domain users do their jobs.

---

## Canonical principle

> **Products discover requirements. Core absorbs durable generalizations.**

This is the primary design criterion when reviewing architecture changes.

Aurii should not attempt to predict every abstraction required by hypothetical future customers. New requirements should generally enter through a concrete product or customer use case first. If the same need proves generic across products, it can later become a reusable capability. Only when it is truly fundamental should it move into Core.

A requirement should not move into Core simply because it could theoretically be useful elsewhere.

This protects Core from both premature abstraction and product-specific or domain-specific logic.

---

## Layering

Prefer this stack:

```text
Product UX
    ↓
shared capabilities / integrations
    ↓
public Aurii APIs / SDK
    ↓
Aurii Core
```

Do **not** prefer a single giant application where every possible feature exists and is merely hidden or enabled.

| Layer | Role | Must remain |
|-------|------|-------------|
| **Aurii Core** | Domain-agnostic system of record | Usable independently of Studio and of any commercial product |
| **Public APIs / SDK** | The contract products and other clients consume | Documented; the same surface Studio uses |
| **Shared capabilities / integrations** | Reusable behaviour that may live in Core, plugins, or licensed packages | Not prematurely classified as open or commercial |
| **Product UX** | Opinionated application for a job | Separate products may differ completely |

Do not decide in this document which capabilities belong in Core versus commercial packages. Only the layering principle is recorded.

Examples of capabilities that **may** later be reused across products include revisions, media, search, workflow primitives, preview/publishing, collaboration, Context, publication targets, and integrations. Several of these are **planned or visionary** ([`Phase5.md`](../Phase5.md), [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)). Listing them here does not implement them and does not assign them to Core.

---

## Core

Aurii Core remains a **general-purpose information platform**.

- Core is the system of record ([`PRODUCT_MODEL.md`](PRODUCT_MODEL.md)).
- Core must remain usable without Studio and without any commercial product.
- Core does not assume records are articles, pages, or media documents.
- Core does not encode newsroom, magazine, report, or other product-domain workflow.
- Developers should be able to evaluate, self-host, understand, and build a genuinely useful product on Core.

Publishing, news, and magazine are important early validation domains because of existing experience. They must not define the limits of Core.

New customer categories outside publishing must remain possible without redesigning Core.

See [`Core.md`](Core.md), [ADR-0002](../adr/ADR-0002%20—%20Core%20as%20the%20Content%20Lake.md), and [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

---

## Products

A **Product** is a coherent solution composed from datasets, schemas, imports, capabilities, modules, and consumers. It is not another name for a dataset, Core Project, project package, or Studio.

Products built on Core may be **separate, opinionated applications** — for example publishing, magazine, newsroom, reports, or future products that have not been identified yet.

Different products may share underlying packages and capabilities while having completely different:

- navigation
- workflows
- mental models
- defaults
- terminology
- dashboards
- interaction patterns
- operational assumptions

Modularity is useful **inside meaningful product boundaries**. Aurii should not assume that one CMS UI can scale cleanly from a tiny blog to a large newsroom by toggling modules.

A small blog or publisher, a magazine workflow, and a large newsroom may share capabilities while having fundamentally different product experiences. They do not need to share one universal UI.

```text
Studio is a tool for working with Aurii.
Products are tools for doing a job.
```

Those products may use exactly the same Core entities and APIs without exposing Studio’s operational model.

We do not know what future customers will need. Customer needs are explicitly allowed to evolve the platform beyond the currently imagined products.

---

## Studio audience

Studio is an **operator/developer workspace** for working with Aurii data and platform operations.

It is **not** the end-user CMS for a journalist, editor, author, or other domain user.

The primary user is a competent developer, data operator, integrator, or technical project administrator — someone who can understand and operate concepts such as:

- projects and datasets
- schemas and entities
- relations
- DataSources
- imports, sync, and schedules
- queries
- published routes
- platform / runtime state

A journalist should normally work in a journalism / newsroom product. A magazine editor should normally work in a magazine product. A report author should normally work in a reporting product.

Studio may still host **domain-specific extensions** when an operator- or developer-facing tool is appropriate — for example a map, coverage view, or specialized operational editor ([ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md)). That must not cause Studio to evolve into a universal CMS or product shell.

Studio is **not** the future Editorial product ([`Phase5.md`](../Phase5.md)).

Full Studio contract: [`Studio.md`](Studio.md).

---

## Customer-led evolution

Prefer this flow:

```text
real customer / product requirement
          ↓
product implementation
          ↓
repeated pattern across products
          ↓
reusable capability
          ↓
fundamental / general enough?
          ↓
        Core
```

| Temptation | Response |
|------------|----------|
| “This could theoretically be useful elsewhere, so put it in Core now.” | Keep it in the product until the pattern repeats. |
| “Studio should grow this domain UI so we do not need another app.” | Build a product for that job. Studio stays an Aurii workspace. |
| “Publishing needs X, therefore Core is a media backend.” | Express X in the publishing product first. Promote only what proves generic. |
| “One modular CMS can cover blog, magazine, and newsroom.” | Share capabilities. Do not assume one UI. |
| “Leave a Core primitive incomplete so a commercial package can finish it.” | Do not hobble fundamentals to force an upgrade. |

Real customer needs should continue to define Aurii over time. The platform should not be limited to the products we can name today.

---

## Publishing as an early deep vertical

Publishing, news, and magazine remain a highly relevant early product domain because of existing experience and domain knowledge.

Use that domain to discover real requirements and stress-test the architecture.

Preserve the distinction:

| Statement | Meaning |
|-----------|---------|
| Core is not a media backend | No newsroom, magazine, report, or article builtins in Core |
| A future Publishing / Editorial / Newsroom / Magazine product is a client | It consumes public APIs / SDK like any other product |
| Different publishing cases may justify separate products | Not one universal CMS |
| Shared capabilities are welcome | Revisions, preview, workflow primitives, and similar may be reused when they exist |
| New customer categories must remain possible | Publishing must not redesign Core around itself |

**Editorial + Context** ([`Phase5.md`](../Phase5.md)) is the planned authoring reference vertical. It is a product hypothesis on Core, not a rename of Studio, and not a boundary on what Core can support. It is **not implemented**.

Norwegian Geo remains the implemented canonical vertical for import, schema, query, storage, SDK, and delivery. Fitness tests (Kampbart, playgrounds, Gaselle, Geo) remain design tests, not a closed product catalog — [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md).

---

## Open Core and commercial products

Intended commercial direction, **without locking the final license model**:

1. **Core should be open and developer-friendly enough** to evaluate, self-host, understand, and build a genuinely useful product on top of it.
2. **Commercial value may live** in opinionated products, advanced capabilities, integrations, hosted services, support, SLA / operations, and similar.
3. **Do not make fundamental primitives artificially incomplete** purely to force a commercial upgrade.
4. **Commercial products should, where practical, consume the same documented public Core APIs / SDK** available to other clients.
5. **The exact boundary** between open and licensed capabilities remains a future product and business decision.

The docs must not promise that all future Core-adjacent capabilities will be open source.

Equally, they must not imply that an open Core is only a crippled demo for commercial products.

This document does **not** assign specific capabilities to an open or commercial column. Doing so now would freeze a boundary that has not been validated by real products and customers.

---

## What this document does not decide

Do not read this file as locking:

- a plugin API
- a product packaging model
- a commercial feature matrix
- a licensing boundary
- which of revisions, media, search, workflow, preview, collaboration, Context, or integrations belong in Core
- a single publishing/CMS application that every editorial use case must join

The intended outcome is clearer boundaries that preserve future optionality — not more architecture than Aurii currently needs.

---

## Related documents

- [PRODUCT_MODEL.md](PRODUCT_MODEL.md) — canonical terms, modes, and boundaries
- [PLATFORM_VALIDATION.md](PLATFORM_VALIDATION.md) — real-project portfolio, reuse test, MVP success/failure criteria
- [Studio.md](Studio.md) — Studio contract and audience
- [Constitution.md](Constitution.md) — durable principles, including customer-led evolution
- [ARCHITECTURE_FITNESS.md](ARCHITECTURE_FITNESS.md) — representative product tests
- [Phase5.md](../Phase5.md) — planned Editorial & Context (not implemented)
- [ADR-0010 — Optional Authoring Layer](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)
- [ADR-0020 — Extensible Studio](../adr/ADR-0020%20—%20Extensible%20Studio.md)
- [AGENTS.md](../AGENTS.md) — how agents should apply these boundaries
