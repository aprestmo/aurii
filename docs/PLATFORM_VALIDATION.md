# Platform validation through real products

> How Aurii earns the right to become a long-lived platform: by proving a shared Core makes several substantially different products meaningfully easier to build, operate, and evolve.
>
> This document records **validation intent, discovery process, maturity rules, and decision criteria**. It does not invent commercial products, freeze a portfolio roster, or claim that Aurii is already validated.
>
> Canonical vocabulary: [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md).  
> Product direction: [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).  
> Design stress tests: [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md).  
> Runnable proof today: Norwegian Geo — [`NORWEGIAN_GEO.md`](NORWEGIAN_GEO.md), [`REFERENCE_DEMO.md`](REFERENCE_DEMO.md).

---

## Why this document exists

Aurii should not exist simply because we can build our own CMS, admin interface, or data platform.

Existing products already solve large parts of those problems well.

The hypothesis behind Aurii is different:

> A small, reusable Content & Data Core can reduce the amount of infrastructure, platform code, and glue code we rebuild across otherwise very different products, while still allowing each product to own its domain model, workflows, user experience, and delivery mechanisms.

Aurii should earn the right to become a long-lived platform by proving this hypothesis through **real projects**.

We have an unusual opportunity to spend approximately **6–12 months** exploring this properly, with enough freedom to move back and forth between Core development and actual products.

We should use that freedom deliberately.

**The goal is not to stabilize Aurii as early as possible.**

**The goal is to discover what Aurii actually needs to be.**

This complements:

| Document | Role |
|----------|------|
| [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md) | How products and Core should relate once we build |
| [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md) | Design tests that Core must not special-case |
| This document | Whether the platform hypothesis is true enough to keep building Aurii — and how to discover that |

Constitutional anchors: Article 21 (specifications are not proof), Article 22 (vertical before horizontal), Article 24 (products discover, Core generalizes) — [`Constitution.md`](Constitution.md).

---

## Primary objective

Use a portfolio of real projects over the next 6–12 months to:

1. discover the **smallest useful** Aurii Core,
2. validate which abstractions are genuinely reusable,
3. identify what should remain product-specific,
4. measure whether Aurii creates meaningful development and operational leverage,
5. discover product opportunities that become viable because Aurii exists.

The goal of the validation period is **convergence**, not early stability.

Core APIs, abstractions, and boundaries are expected to change during this period.

- Breaking changes are acceptable.
- Removing abstractions is desirable when they prove unnecessary.
- Moving functionality back out of Core is considered **learning**, not failure.

---

## Core hypothesis

Aurii is valuable if a shared Core makes several substantially different products meaningfully easier to build, operate, and evolve than implementing each product independently.

The goal is therefore **not** to build Aurii first and find use cases afterwards.

Instead, Aurii and the validation projects should evolve together.

### Intended development loop

```text
Product A
   ↓
reveals requirements
   ↓
Aurii Core evolves
   ↓
Product B
   ↓
tests whether the abstraction is actually reusable
   ↓
Core is changed, simplified, or partially reverted
   ↓
Product C
   ↓
...
```

Over time, this loop should require fewer fundamental changes to Core.

That **convergence** is one of the strongest signals that the architecture is becoming real rather than theoretical.

---

## Validation portfolio

We currently have approximately 5–10 potential projects of different sizes and domains that can act as validation projects.

The portfolio should deliberately contain **different types of systems** rather than several variants of the same application.

Potential categories:

- structured reference datasets
- editorial content
- reviews and ratings
- live or frequently updated data
- public data APIs
- documentation
- internal tools
- larger editorial applications
- import-heavy data systems
- applications with highly specialized workflows
- applications requiring custom user interfaces
- products delivering the same data through multiple formats
- API-only systems with no traditional CMS interface
- research/knowledge-work products combining structured + unstructured evidence

Not every project needs to validate every part of Aurii.

Each project should put pressure on a **different** part of the architecture.

Fitness cases already named for design pressure (Kampbart, playgrounds, Gaselle, Geo) live in [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md). They are architecture tests and possible products — not a closed catalog.

Do **not** invent demo backends for fitness cases unless that is the assigned task. Prefer real projects that pull capabilities into Aurii.

---

## Validation sequence

Projects should preferably be selected so that they progressively challenge the assumptions made by previous projects.

### Early projects

Focus on basic Core primitives:

- schemas
- entities
- relations
- CRUD
- validation
- authorization
- API
- SDK
- basic client integration
- deployment

**Question:** Is Aurii pleasant and useful at all?

Norwegian Geo is the implemented early / data-product proof for import, schema, query, delivery, and SDK — not the whole portfolio.

### Cross-domain projects

Introduce substantially different domains and workflows.

Test whether abstractions introduced by earlier projects survive contact with different requirements.

**Question:** Are we finding reusable platform concepts or merely generalizing the first application?

### Non-CMS projects

Include projects where the primary interaction may be:

- imports
- APIs
- scripts
- automated clients
- pipelines
- grids
- dataset management

**Question:** Is Aurii genuinely a Content & Data Platform, or is it gradually becoming a CMS?

### Editorial / workflow-heavy projects

Challenge the other end of the spectrum with:

- drafts
- previews
- rich text
- publishing
- revisions
- workflows
- editorial permissions

**Question:** Which editorial capabilities belong in Core, plugins, or the product itself?

Editorial + Context ([`Phase5.md`](../Phase5.md)) is a planned portfolio entry — do not implement unless assigned.
Research/knowledge-work ([`RESEARCH.md`](RESEARCH.md)) is another planned portfolio entry and should remain a separate sibling-product hypothesis.

### Production-oriented projects

Later projects should increasingly test:

- deployment
- migrations
- observability
- backups
- performance
- operational complexity
- upgrades
- multiple deployed Aurii applications

**Question:** Is Aurii only pleasant to develop, or does it also make systems easier to own?

---

## Core maturity model

Capabilities do not need to become stable platform commitments as soon as they appear.

During the validation period, Core functionality can move through three maturity levels.

| Level | Meaning |
|-------|---------|
| **Experimental** | A real project needs the capability. We implement it in Core to test the abstraction. Its API can change freely. It may later disappear entirely. |
| **Candidate** | The capability has survived multiple substantially different use cases. Responsibility and boundaries are becoming clearer. Likely to remain, but still open to substantial change. |
| **Core** | The abstraction has demonstrated genuine reuse. We understand why it belongs in the platform rather than an individual product. We are willing to maintain its contract over time. |

The objective during the validation period is **not** to move as many features as possible into Core.

It is to confidently determine **which** features deserve to be there.

When proposing or reviewing a Core change, state the intended maturity level. Do not treat Experimental APIs as commitments.

---

## Platform boundary test

For every significant capability, ask:

> Is this a platform concern, a reusable extension, or a product concern?

A capability can initially live in Core even if we are uncertain.

However, future projects must be allowed to challenge that decision.

Examples (hypotheses, **not** commitments):

| Capability | Working hypothesis |
|------------|-------------------|
| schema | likely Core |
| entities | likely Core |
| relations | likely Core |
| permissions | candidate |
| events | candidate |
| history | candidate |
| editorial draft workflow | possibly plugin / product |
| publishing workflow | possibly plugin / product |
| search | unresolved |
| revisions | unresolved |

Prefer keeping functionality in the product, client, or plugin until multiple projects demonstrate that the abstraction belongs in Core.

| Evidence | Action |
|----------|--------|
| Repeated implementation across projects | Candidate for reusable capability, then possibly Core |
| One project needs it | Keep it in that product / plugin / client — or Experimental in Core with explicit intent to challenge later |
| Theoretical future need | Do not add it to Core |

This is the operational form of:

> **Products discover requirements. Core absorbs durable generalizations.**

See [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md) and Constitution Article 24.

---

## What each validation project should record

Every project should have a short **validation report**. At minimum:

### What did this project test?

Which parts of Aurii were exercised?

### What was reused?

Which Core capabilities worked without significant modification?

### What changed?

What Core functionality had to be added, changed, or removed?

### What did not belong in Core?

Which initially generic-looking concerns turned out to be product-specific?

### What would we have done without Aurii?

For example:

- Payload
- Directus
- Sanity
- Strapi
- PostgreSQL + custom application
- Git / static files
- custom API
- spreadsheet + scripts
- another specialized product

### Did Aurii help?

Record both positive and negative effects. Examples:

- development time saved
- infrastructure avoided
- code reused
- complexity introduced
- Core changes required
- operational improvements
- operational overhead

The goal is not perfect measurement.

The goal is to build enough evidence to avoid judging Aurii purely on intuition.

Use the register template at the end of this document.

---

## Important rule: do not optimize for stability too early

During the discovery phase, the following are **not** failure signals:

- substantial Core refactoring
- breaking API changes
- deleting Core functionality
- temporary duplication between projects
- replacing a Studio implementation
- discovering that a generic abstraction was wrong
- moving functionality from Core back into a product
- a validation project that does not fit the current architecture

These are expected outcomes of the validation process.

Premature compatibility guarantees would make experimentation unnecessarily expensive.

Studio must remain a **client** of Aurii rather than becoming Aurii itself — [`Studio.md`](Studio.md).

---

## What convergence should look like

As the validation portfolio grows, we should gradually observe:

- fewer fundamental changes required for each new project
- repeated use of the same small set of Core primitives
- product-specific logic naturally staying outside Core
- new applications starting with substantially more infrastructure already solved
- fewer one-off implementations of auth, validation, APIs, events, and storage concerns
- Core becoming easier to explain rather than more complicated
- Studio remaining one client among several
- projects becoming less coupled to Aurii internals
- a clear distinction emerging between platform and product concerns

A healthy trajectory might look like:

```text
Early
Project A → large Core changes
Project B → large Core changes
Project C → moderate Core changes
Later
Project D → some Core changes
Project E → mostly reusable Core
Project F → almost entirely domain + product UI
```

This is more meaningful than completing a predetermined feature checklist.

---

## Time boundary

Aurii has a generous validation window, but it must not become an indefinite platform experiment.

Calendar months below are planning guidance for humans running the validation period. Agents should judge progress by **evidence and convergence**, not by inventing day-count estimates for implementation work.

### 0–3 months: Discovery

Primary goal:

- build real systems
- challenge architecture aggressively
- identify fundamental primitives
- accept significant rewrites

Expect instability. No major platform conclusion is required yet.

### Around 6 months: Evidence gate

By this point there must be **credible evidence of value**.

We do not need a finished platform.

We should, however, be able to demonstrate several of the following:

- multiple substantially different applications use Aurii
- meaningful infrastructure is reused between them
- later projects are becoming easier to start
- clear Core primitives are emerging
- some initially proposed abstractions have been removed or moved out of Core
- Core works independently of Studio
- at least one project benefits from a domain-specific client
- Aurii is solving more than CRUD and database access
- there is an increasingly clear reason to choose Aurii for another project

If little or no convergence is visible after approximately six months, seriously consider:

- reducing the scope of Aurii,
- turning useful parts into standalone libraries,
- adopting an existing platform,
- or ending the platform effort.

Continuing beyond this point should require **positive evidence**, not merely remaining possibilities.

### 6–9 months: Consolidation

If the six-month evidence gate is passed:

- test emerging abstractions against additional projects
- reduce accidental complexity
- improve operations
- identify likely long-term Core contracts
- begin distinguishing experimental APIs from stable candidates

The emphasis should gradually shift from discovery toward repeatability.

### 9–12 months: Decision phase

By this stage, the question is no longer:

> Could Aurii eventually become useful?

It is:

> Has Aurii demonstrated enough value to justify becoming infrastructure we intentionally maintain?

At or before 12 months, make an **explicit decision**.

| Outcome | Meaning |
|---------|---------|
| **Continue toward Aurii v1** | The platform hypothesis is validated strongly enough to justify stabilizing Core contracts. |
| **Narrow Aurii** | Some parts are valuable, but a smaller platform or set of libraries is the correct outcome. |
| **Adopt an existing platform** | Remaining differentiation does not justify owning the full stack. |
| **Stop** | The projects were useful experiments, but Aurii itself did not create sufficient leverage. |

All four are valid outcomes.

---

## Hard stop principle

Twelve months should be treated as an **upper bound for proving the platform hypothesis**, not a deadline for finishing every Aurii feature.

Aurii does not need to be complete after twelve months.

But its value proposition must no longer be speculative.

By then we must be able to point to concrete systems and say:

> These products are meaningfully easier to build or operate because Aurii exists.

If we cannot do that after this amount of real-world experimentation, continuing to invest in the platform should require an exceptionally strong reason.

Stopping or narrowing Aurii in that situation is a **successful outcome of the validation process**, not a project failure.

---

## MVP should emerge from validation

Avoid defining Aurii MVP primarily as a feature checklist such as:

```text
REST · GraphQL · Studio · plugins · auth · history · workflows · …
```

Instead, the validation period should tell us what the MVP actually is.

> **Aurii MVP** = the smallest Core that has demonstrated meaningful reuse across several real and substantially different products.

This means the MVP definition may become **smaller** during development.

That should be considered a success.

---

## Comparison against existing solutions

For appropriate projects, continuously ask:

> Would this application be easier or better with an existing platform?

Possible alternatives:

- Sanity
- Payload
- Directus
- Strapi
- PostgreSQL plus application code
- static files / Git
- domain-specific products

Aurii does not need to outperform each competitor feature-for-feature.

The relevant comparison is the **portfolio as a whole**.

Aurii needs to beat the accumulated cost and complexity of something like:

```text
Project A → CMS
Project B → custom PostgreSQL app
Project C → scripts + JSON
Project D → spreadsheet
Project E → separate API
Project F → another CMS
+ authentication
+ deployment
+ validation
+ data modelling
+ integrations
+ maintenance
+ glue code
```

If Aurii turns a significant portion of that repeated work into shared infrastructure, the platform has value.

---

## Secondary objective: discover products

The validation portfolio has a second purpose.

While validating Aurii, actively observe whether any of the applications represent problems that exist outside our own environment.

The question is not initially:

> Can we sell Aurii?

A potentially more interesting question is:

> What products become unusually cheap or practical to build because Aurii exists underneath them?

### Productization model

```text
                       Aurii Core
                           │
          ┌────────────────┼────────────────┐
          │                │                │
      Product A        Product B        Product C
          │                │                │
   specialized UI    specialized UI    specialized UI
   domain logic      domain logic      domain logic
```

Aurii itself may remain infrastructure.

The market-facing products can be much narrower and more opinionated.

This aligns with [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md): commercial value may live in opinionated products, advanced capabilities, integrations, hosted services, and operations — without freezing the open/commercial boundary here.

### Product opportunity signals

During validation, record cases where:

- the same workflow appears across several organizations
- users currently rely on spreadsheets
- users maintain bespoke internal applications
- existing products are significantly too generic
- existing products are disproportionately expensive
- domain-specific UX creates clear value
- the same structured data needs several distribution formats
- self-hosting or data ownership is genuinely important
- the Aurii foundation makes a specialized solution unusually cheap to build
- several organizations could use substantially the same product

Do **not** add Core features purely for hypothetical future commercial products.

Products should pull capabilities from Aurii through real requirements.

---

## Success criteria

By the end of the validation period, we should ideally be able to demonstrate:

1. Several substantially different real projects use the same Core.
2. Core can operate independently of Studio.
3. At least one application uses a highly domain-specific client.
4. At least one application is meaningfully non-CMS-like.
5. Meaningful platform functionality is reused across projects.
6. Later projects require less infrastructure work than earlier projects.
7. We can identify concrete code and services we no longer rebuild per product.
8. Core abstractions have become fewer and clearer over time.
9. Some initially proposed Core functionality has deliberately been removed or moved elsewhere.
10. Aurii does not force unrelated products into the same UX or application model.
11. Operating several Aurii applications is manageable.
12. We can articulate when **not** to use Aurii.
13. At least some validation projects would clearly be more expensive or complex without the shared platform.

Commercial validation is separate, but ideally we have also identified one or more credible market-facing product hypotheses.

### Current honest status

| Criterion | Status (as of Phase 4 complete) |
|-----------|----------------------------------|
| Several substantially different real projects on one Core | **Not met** — Norwegian Geo is the primary implemented vertical |
| Core independent of Studio | **Met** — Core serves without Studio; geo consumer never imports Studio |
| Domain-specific client | **Partial** — `apps/geo` is a domain consumer; Studio remains generic ops UI |
| Meaningfully non-CMS-like application | **Partial** — Norwegian Geo is import/delivery-led |
| Meaningful platform reuse | **Partial** — schemas, import, query, published routes, SDK, project packages |
| Later projects easier to start | **Unproven** — second real product not yet in portfolio |
| Concrete code we no longer rebuild | **Emerging** |
| Abstractions fewer and clearer over time | **Too early** — discovery still ahead |
| Deliberate removals / move-outs from Core | **Policy in place**; needs portfolio evidence |
| No forced shared UX | **Policy met** so far |
| Multi-app operations manageable | **Unproven** |
| Clear “when not to use Aurii” | **Emerging** — conventional CMS-only needs are a candidate |
| Clearer cost without Aurii | **Unproven** across a portfolio |

Phase 4 proved a **data-product delivery slice**. It did **not** complete platform validation. Phase 5 (Editorial & Context) is one planned portfolio entry for authoring — [`Phase5.md`](../Phase5.md) — and must not be treated as the only remaining proof. Planned Research ([`RESEARCH.md`](RESEARCH.md)) is a second distinct pressure profile for validating provenance-heavy, sensitive, mixed-structure knowledge work.

---

## Failure signals

We should be willing to conclude that the platform hypothesis is wrong.

Warning signs include:

- new applications continue requiring major bespoke Core changes late in the validation period
- reusable functionality remains superficial
- most projects primarily need an ordinary CMS
- Aurii mainly becomes a wrapper around PostgreSQL
- Studio gradually becomes inseparable from Core
- product-specific requirements continually leak into Core
- the number of Core concepts keeps increasing without convergence
- developers need to understand large parts of Aurii internals to build ordinary applications
- existing platforms consistently solve the same use cases more simply
- Aurii increases rather than decreases time to create new products
- maintaining the platform costs more than the duplication it removes

These signals matter increasingly as we approach the six- and twelve-month gates.

---

## Final questions

At the end of this validation period, we should be able to answer three questions.

### 1. Platform

> If Aurii did not exist today, would the evidence from these projects convince us to build it?

### 2. Leverage

> What can we now build significantly faster, better, or cheaper because Aurii exists?

### 3. Products

> Has Aurii enabled any product opportunities that would otherwise have been impractical or uneconomical to pursue?

If the answer to the first two questions is clearly yes, Aurii has earned the right to move from an experimental platform toward v1.

If the answer is no after a maximum of roughly twelve months of real-world validation, we should stop, narrow, or replace the platform rather than extend the experiment indefinitely.

---

## How agents and contributors should use this

1. Prefer real validation products over synthetic demos when proving architecture.
2. Expect and allow Core change during discovery; do not treat Experimental APIs as frozen.
3. When proposing a Core feature, apply the **platform boundary test**, state maturity level (**Experimental** / **Candidate** / **Core**), and cite which projects already need it.
4. Prefer removing or relocating abstractions that fail reuse over expanding Core “just in case.”
5. When starting or adopting a validation project, add or update a register / report entry below.
6. Do not treat Norwegian Geo alone as full platform validation.
7. Do not implement fitness-test products (Kampbart, Gaselle, playground Map) or Phase 5 Editorial unless assigned.
8. Keep Studio a Core client; keep domain UX in products or extensions.
9. Do not build Core features solely for anticipated commercial products.
10. Judge progress by **convergence and evidence**, not by feature-checklist completion or early API stability.

---

## Validation project register

Record one entry per real project. Design-only fitness cases may be listed as **design** until they become real projects.

### Report template

```markdown
### <Project name>

| Field | Value |
|-------|-------|
| Status | candidate \| active \| paused \| concluded |
| Domain shape | e.g. reference dataset, editorial, live data, internal tool, API-only |
| Sequence role | early \| cross-domain \| non-CMS \| editorial \| production |
| What this project tested | short |
| Core exercised | modelling, validation, relations, mutations, auth, history, events, APIs, SDKs, … |
| Clients | Studio, custom UI, CLI, import, automation, … |
| Distribution | REST, SDK, website, feeds, exports, … |
| Maturity pressure | which Experimental / Candidate capabilities were challenged |
| What was reused unchanged | … |
| What Core changed | added / changed / removed |
| What did not belong in Core | … |
| Alternatives considered | Sanity, Payload, Postgres app, … |
| Did Aurii help? | positives and negatives |
| Product opportunity signal | none \| weak \| strong — and why |
| Convergence note | larger / similar / smaller Core change than previous project |
```

### Norwegian Geo

| Field | Value |
|-------|-------|
| Status | **active** (canonical implemented vertical) |
| Domain shape | Structured reference datasets; public data API; website delivery; import-heavy |
| Sequence role | early + non-CMS + distribution |
| What this project tested | Schema, import/sync, relations, query, published routes, SDK, project packages, Core without Studio dependency |
| Core exercised | Modelling, validation, relations, import/sync, query, published routes, SDK, project packages, sources/schedules |
| Clients | Studio (ops), CLI/import pipeline, `apps/geo` consumer (no Studio dependency) |
| Distribution | Published REST routes, SDK, public website, snapshot offline mode |
| Maturity pressure | Project packages, published routes, DataSources — treat contracts as Candidate until more products reuse them |
| What was reused unchanged | (baseline — first real vertical) |
| What Core changed | Substantial Phase 2–4 work; expected for an early project |
| What did not belong in Core | Norwegian geography, Kartverket/Bring/SSB specifics |
| Alternatives considered | Static JSON/Git; bespoke Postgres API; headless CMS (poor fit for reference geo) |
| Did Aurii help? | Strong fit for schema + import + multi-consumer delivery; does **not** alone validate authoring, custom domain editors, or multi-product ops |
| Product opportunity signal | Possible reusable Norwegian reference-data product; not yet market-validated |
| Convergence note | First vertical — large Core change expected |
| Docs | [`NORWEGIAN_GEO.md`](NORWEGIAN_GEO.md), [`REFERENCE_DEMO.md`](REFERENCE_DEMO.md), [`DELIVERY.md`](DELIVERY.md) |

### Editorial + Context (planned)

| Field | Value |
|-------|-------|
| Status | **candidate** (planned — [`Phase5.md`](../Phase5.md); do not implement unless assigned) |
| Domain shape | Larger editorial application; custom workflows; hybrid structured + rich content |
| Sequence role | editorial / workflow-heavy |
| What this project should test | Whether authored/hybrid products stay on generic Core; which draft/revision/publish concerns are Core vs product |
| Clients (intended) | Separate Editorial product (not Studio); Context as research/writing aid |
| Alternatives considered | Sanity, Payload, in-house CMS |
| Did Aurii help? | TBD when built |
| Product opportunity signal | Primary Phase 5 commercial hypothesis if Context proves valuable |

### Research (planned)

| Field | Value |
|-------|-------|
| Status | **candidate** (planned hypothesis — [`RESEARCH.md`](RESEARCH.md); do not implement unless assigned) |
| Domain shape | Research / knowledge-work with mixed structured data, notes/documents, evidence graphs, and sensitive/private inputs |
| Sequence role | cross-domain + non-CMS + editorial-adjacent + production-oriented data custody |
| What this project should test | Heterogeneous sources, provenance from claim to source, files/media references, permissions/privacy pressure, customer-controlled data custody, optional interoperability with Editorial |
| Clients (intended) | Separate Research product; optional downstream Editorial references; AI assistant as ordinary Core client |
| Alternatives considered | Internal tools, spreadsheets + scripts, generic CMS + plugins, bespoke graph/doc systems |
| Did Aurii help? | TBD when built |
| Product opportunity signal | Tests a non-journalism-specific knowledge-work product hypothesis while pressure-testing deployability and custody boundaries |

### Architecture fitness cases (design)

Kampbart, playground directory, DN Gaselle, and Geo-as-design-case: see [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md). Promote to register entries above when they become real projects. Prefer them as cross-domain / specialized-UI pressure when adopted.

---

## Related documents

- [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) — open Core, product boundaries, Studio audience, customer-led evolution
- [RESEARCH.md](./RESEARCH.md) — planned Research vertical and custody/provenance pressure profile
- [ARCHITECTURE_FITNESS.md](./ARCHITECTURE_FITNESS.md) — Kampbart, playgrounds, Gaselle, Geo as design tests
- [PRODUCT_MODEL.md](./PRODUCT_MODEL.md) — canonical vocabulary
- [Constitution.md](./Constitution.md) — Articles 21, 22, 24
- [Studio.md](./Studio.md) — Studio as Core client
- [NORWEGIAN_GEO.md](./NORWEGIAN_GEO.md) — implemented validation vertical
- [Phase5.md](../Phase5.md) — planned Editorial & Context portfolio entry
- [ADR-0010 — Optional Authoring Layer](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)
- [ADR-0020 — Extensible Studio](../adr/ADR-0020%20—%20Extensible%20Studio.md)
- [BREAKING_CHANGES.md](./BREAKING_CHANGES.md) — change discipline (validation period still prefers discovery over premature stability)
