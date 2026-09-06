# Competitive and architectural guardrails

> Direction for keeping Aurii an information platform rather than another conventional headless CMS.
>
> This document is **architectural policy**. It does not implement Phase 5, Context, Editorial, Research, extra API protocols, extra storage engines, or any capability named here. Listing a capability does not mean it exists.
>
> Canonical vocabulary: [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md).  
> Product direction: [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).  
> Validation process: [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md).  
> Fitness tests: [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md).  
> Editorial roadmap (planned only): [`../Phase5.md`](../Phase5.md).

---

## Why this document exists

Aurii has reached a point where the distinction between **Core**, **Studio**, and future products such as **Editorial** and **Research** is strategically important.

A review of [Kyro CMS](https://kyro-cms.com) ([danielDozie/kyro-cms](https://github.com/danielDozie/kyro-cms)) reinforces this. Kyro is a strong implementation of the conventional modern developer-first headless CMS model. Payload, Sanity, Directus, Strapi, and similar systems occupy the same category.

Aurii should **not** attempt to beat those systems by rebuilding the same feature set inside Core or Studio.

Aurii’s hypothesis is broader:

> Aurii Core is a system of record for structured data, authored information, and hybrids, where information can be ingested, synchronized, related, enriched, queried, traced to sources, and consumed by multiple independent products.

This document makes that distinction an explicit architectural guardrail **before** Phase 5 implementation starts.

---

## Core principle

> **Aurii must not become “a better headless CMS”.**

Conventional CMS capabilities are **enabling infrastructure**, not the primary reason Aurii exists.

When an established CMS can solve a requirement without compromising Aurii’s platform model, that is evidence that the capability should remain **product-local**, **integration-based**, or **replaceable** rather than becoming a defining Core abstraction.

This complements the existing principle:

> **Products discover requirements. Core absorbs durable generalizations.**

A need that is real for one product should usually stay in that product until it proves durable across products. Competitor feature lists are not a substitute for that evidence.

---

## How to use this document

This file is the **canonical detailed rule set**. Other documents should **link here** and summarize only the guardrail that is relevant in that context. Do not copy these lists into every strategy file.

When proposing a substantial Core, Studio, or platform change:

1. Apply the tests in [Before changing Core](#before-changing-core).
2. Check [Commodity vs strategic capabilities](#commodity-vs-strategic-capabilities).
3. Apply the [Kyro test](#the-kyro-test).
4. Prefer an [ADR](../adr/) before altering Core boundaries.

---

## Competitor reference

This is **not** a feature-comparison matrix. Feature lists go stale. The useful fact is the **category**.

| Reference | What it represents |
|-----------|--------------------|
| **Kyro** | A mature conventional schema-first, developer-first headless CMS: TypeScript configuration, generated admin, CRUD, rich text, media, drafts/history, auth/RBAC, preview, plugins/hooks, multiple API transports, typed clients, multiple database adapters, and framework integrations such as Astro. Use Kyro as the named reference for this category. |
| **Payload** | Schema-first / code-configured headless CMS with generated admin and a strong developer workflow. |
| **Sanity** | Content-lake / studio-centric headless CMS with real-time editing and a strong authored-content model. |
| **Directus** | Database-wrapping headless CMS / data studio over existing or generated schemas. |
| **Strapi** | Conventional open-source headless CMS with generated admin, REST/GraphQL, and plugin marketplace. |

Specific feature inventories will change. The **category shape** will not: schema-driven CRUD, generated admin interfaces, drafts, media, preview, auth, and standard publishing APIs are already well-served.

**Conclusion**

These systems demonstrate that schema-driven CRUD, generated admin interfaces, and conventional CMS functionality are already well-served categories.

Aurii may consume, reproduce, or integrate such capabilities where a real product requires them. Its platform thesis must be validated on **information capabilities beyond conventional CMS architecture**.

Do **not** claim that these competitors cannot handle structured data. Many of them can. The distinction is **architectural emphasis** and Aurii’s hypothesis — not an assertion that other products are incapable.

Do **not** claim that Aurii is already differentiated in the market. Differentiation is a hypothesis to be proven through real products ([`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md)).

---

## Commodity vs strategic capabilities

### Commodity capabilities

These may be necessary in Aurii **products**, but their existence alone does **not** differentiate Aurii:

- generated forms
- schema-derived CRUD
- rich-text editing
- media library
- image/file upload
- drafts
- revision history
- preview
- authentication
- RBAC
- standard publishing states
- REST endpoints
- GraphQL endpoints
- generic realtime presence
- generic WebSocket subscriptions
- standard admin tables
- field component libraries
- dashboard widgets
- generic plugin hooks

**Rules**

1. Do not move these into Core solely because Editorial needs them.
2. Prefer product-local implementation first.
3. Prefer existing libraries and protocols rather than inventing Aurii-specific equivalents.
4. Promote a primitive toward a shared capability or Core only after **at least two materially different products** demonstrate the same requirement.
5. UI implementation must never be the reason a domain concept enters Core.

### Strategic Aurii surface

Aurii should prioritize capabilities that reinforce its information-platform hypothesis. Differentiation is expected in these areas — as **direction**, not as a claim that the full surface is already implemented.

#### Ingest

Aurii should understand information arriving from:

- CSV
- JSON
- external APIs
- scheduled synchronization
- external databases
- manual operations
- automation
- AI processes
- future product clients

Ingest is not merely “create CMS records”.

#### Sources and provenance

Aurii should be able to answer:

- Where did this information come from?
- Which source supplied it?
- When was it imported?
- Has it been overridden?
- What process changed it?
- Which information is source-derived vs authored?

Provenance remains a first-class platform concern ([ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)).

#### Datasets

Datasets are not simply CMS collections.

Aurii should preserve concepts required for:

- separate data products
- versions / snapshots
- imports
- synchronization
- operational ownership
- querying across structured information

#### Relations

Relationships between entities and datasets remain more important than parent/child CMS page structures.

The same entity may participate in several independent products.

#### Query

Aurii Query should continue evolving as a platform capability rather than exposing SQL or database implementation details to products.

Products should depend primarily on Core contracts, not storage layout.

#### Hybrid information

Aurii should support entities that combine:

- structured fields
- imported facts
- authored content
- relations
- provenance
- references to other datasets

without treating either “article” or “CMS document” as the universal root model.

#### Multiple independent products

Core must support:

- Studio
- Editorial
- Research
- data products
- domain applications
- future unknown products

without requiring them to share a common UI or workflow.

Shared Core does **not** imply shared UX.

---

## The Kyro test

Apply this review question before introducing a **substantial new Core capability**.

> Could this requirement be solved adequately by a conventional modern headless CMS such as Kyro, Payload, or Sanity?

If yes, then ask:

1. Why must this capability exist in Aurii Core?
2. Is the requirement actually product-specific?
3. Can it live in Editorial, Research, Studio, or another product?
4. Could Aurii integrate an external component or library instead?
5. Does this capability interact fundamentally with ingest, provenance, datasets, relations, query, or cross-product information?
6. Has the need appeared in more than one materially different Aurii product?

**Default decision when the answers are weak: do not add it to Core.**

The Kyro test is **not** a ban on implementing CMS functionality.

It is a test of **where the functionality belongs**.

Editorial may need drafts, media, preview, and a rich-text editor. That does not make those things defining Core abstractions.

---

## Core / Studio / Product boundary

### Core

Core may know about generic concepts such as:

- schemas
- entities
- relations
- datasets
- sources
- imports
- provenance
- queries
- generic revisions **if proven reusable**
- generic capabilities that multiple products require

Core must **not** know about built-in domain types such as:

- `Article`
- `Story`
- `Page`
- `Journalist`
- `Newsroom`
- `Desk`
- `PrintEdition`
- `BlogPost`
- `TravelPlan`
- `ResearchNote`

Those belong to schemas and products.

### Studio

Studio remains **the developer/operator workspace for Aurii itself**.

It may expose:

- schemas
- datasets
- imports
- sources
- schedules
- routes
- queries
- entities
- provenance
- diagnostics
- developer/operator extensions

Studio must **not** become the generic end-user application.

Do not add functionality to Studio simply to avoid creating a separate product.

- A journalist should not normally work in Studio.
- A researcher should not normally work in Studio.
- A travel user should not normally work in Studio.

Operator-facing domain extensions (for example a match desk or map) remain valid under [ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md). They must not cause Studio to become the product those operators’ end users would use.

### Products

Products may have completely independent:

- navigation
- workflows
- terminology
- interaction models
- editors
- dashboards
- permissions
- presentation

A publication CMS, if built, is a **separate product** — not Studio renamed, and not a required layer between Core and a frontend ([ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)).

---

## Prefer integration over reinvention

When Aurii needs commodity functionality, evaluate in this order:

1. Use an existing package.
2. Use a standard protocol.
3. Implement it inside the consuming product.
4. Create a replaceable shared capability.
5. Only then consider Core.

### Realtime collaboration

Prefer:

```text
editor
  ↕
Yjs / CRDT
  ↕
collaboration service
  ↓
durable revision
  ↓
Aurii Core
```

Do **not** turn Core into a CRDT engine.

### Rich text

Use an established editor model such as ProseMirror / Tiptap or another suitable system.

Do **not** invent an Aurii editor document model unless a genuine platform requirement appears.

### Media

Do **not** make Core a full DAM merely because Editorial needs uploads.

Define generic references and metadata boundaries first.

### Authentication

Use standard identity and auth mechanisms.

Do **not** make identity implementation part of Aurii’s differentiating domain model.

---

## Avoid protocol checklist development

Kyro exposes REST, GraphQL, tRPC, and WebSockets.

Aurii must **not** interpret that as a checklist.

> **More protocols do not automatically make Aurii a better platform.**

A new API protocol should be added only when a real product or customer use case requires it.

Aurii should optimize for:

- stable contracts
- useful query semantics
- SDK ergonomics
- delivery
- interoperability

rather than the number of transports exposed.

REST + SDK may remain sufficient until evidence proves otherwise.

Do not add GraphQL, tRPC, or WebSocket support for competitor parity.

---

## Storage abstraction must be justified by product value

Kyro supports SQLite, Postgres, and MongoDB.

Do **not** copy this as a goal.

Aurii currently benefits from Postgres because its model relies heavily on:

- structured records
- relations
- querying
- provenance
- operational state

> **Database portability is not itself a product objective.**

Introduce a second primary storage engine only if a real deployment or customer need justifies the abstraction cost.

Do not weaken Aurii’s data model merely to support interchangeable databases.

---

## Do not optimize around a frontend framework

Kyro explicitly positions itself as Astro-native.

Aurii may provide excellent Astro integrations, but Core must remain **framework-independent**.

```text
Aurii Core
   ↓
HTTP / SDK / published APIs
   ↓
Astro
SvelteKit
native apps
backend services
external systems
future clients
```

Astro is an important consumer, not the Aurii runtime boundary.

---

## Architectural promotion ladder

New capabilities should normally follow this maturity path:

```text
Product-local
     ↓
Experimental shared capability
     ↓
Candidate reusable capability
     ↓
Proven across multiple products
     ↓
Core, only if fundamental
```

Requirements must **not** skip directly from:

```text
Editorial needs X  →  Core implements X
```

A capability should normally demonstrate reuse in **at least two materially different product contexts** before promotion into Core is considered.

Examples of materially different contexts:

- Editorial + Research
- Editorial + Kampbart
- Geo + Gaselle
- Research + a structured data product

Two slightly different screens inside Editorial do **not** count.

This ladder is the operational form of Constitution Article 24 and the Experimental → Candidate → Core model in [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md).

Prefer an ADR before moving a capability across a Core boundary.

---

## Rejection examples

Decisions that should **normally be rejected**:

| Reject | Reason |
|--------|--------|
| Add `Article` to Core because Editorial needs articles. | Product schema. |
| Add `NewsroomWorkflow` to Core. | Domain-specific product concept. |
| Turn Studio into the Editorial CMS because Studio already edits entities. | Destroys Studio / product separation. |
| Add GraphQL because competing CMSes expose GraphQL. | Competitor parity is not evidence of need. |
| Add MongoDB support because Kyro supports MongoDB. | Portability alone is not an Aurii objective. |
| Build a custom rich-text framework in Core. | Commodity capability with established external solutions. |
| Store realtime cursor / presence state as normal Core entities. | Ephemeral collaboration state is not durable information-domain state. |

---

## Positive examples

Decisions that are a **strong Aurii fit**:

| Accept | Why |
|--------|-----|
| Imported company data and manually authored company annotations coexist on a shared entity model with provenance. | Hybrid information + provenance. |
| Editorial content references a municipality entity owned by an independently managed geographic dataset. | Cross-product relations without owning foreign data. |
| Context traverses relations and available datasets to surface relevant information to Editorial and Research. | Cross-product information capability. |
| Multiple products consume the same company entity without copying it into product-specific databases. | Shared system of record. |
| A scheduled source refresh updates imported fields while preserving explicitly authored overrides and provenance. | Sources + overrides. |
| An external CMS calls Aurii Context / Core APIs without using Aurii Editorial. | Context is not editor-owned. |

These examples are **architectural fits**, not a claim that Context, Editorial, or Research are implemented.

---

## Before changing Core

Before adding a substantial capability to Core, apply all four tests:

### 1. Product-local test

Can this live in Editorial, Research, Studio, or another product first?

If yes, keep it there.

### 2. Kyro test

Could a conventional modern headless CMS solve this adequately?

If yes, the default is **outside Core** unless the later tests are strong.

### 3. Multi-product reuse test

Has the need appeared in at least two **materially different** Aurii product contexts?

If no, do not promote it to Core.

### 4. Core-fundamentality test

Does this interact fundamentally with ingest, provenance, datasets, relations, query, or cross-product information — and is it general rather than a domain type?

If no, it is not a defining Core abstraction.

If the capability is conventional CMS functionality and has not demonstrated cross-product platform value, **keep it outside Core by default**.

Also:

- Do not infer that roadmap concepts are implemented.
- Do not move product schemas into Core.
- Do not expand Studio into a universal CMS.
- Do not add competitor-parity features without a concrete Aurii use case.
- Prefer an ADR before altering Core boundaries.

---

## What this document does not do

This document must not be read as:

- implementing Phase 5, Context, or Editorial
- removing existing functionality
- adding GraphQL, tRPC, or WebSocket support
- adding database adapters
- redesigning Core APIs
- deciding licensing
- claiming Aurii is already differentiated in the market
- claiming planned capabilities already exist

It records **where work should and should not go** when implementation starts.

---

## Related documents

- [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) — open Core, product boundaries, Studio audience
- [PLATFORM_VALIDATION.md](PLATFORM_VALIDATION.md) — discovery loop, maturity model, portfolio evidence
- [ARCHITECTURE_FITNESS.md](ARCHITECTURE_FITNESS.md) — design tests, including conventional-CMS and Context-portability tests
- [PRODUCT_MODEL.md](PRODUCT_MODEL.md) — canonical vocabulary
- [RESEARCH.md](RESEARCH.md) — planned Research sibling-product hypothesis
- [Studio.md](Studio.md) — Studio contract
- [Constitution.md](Constitution.md) — Articles 21, 22, 24
- [../Phase5.md](../Phase5.md) — planned Editorial & Context (not implemented)
- [ADR-0010 — Optional Authoring Layer](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)
- [ADR-0019 — Provenance and Editorial Overrides](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)
- [ADR-0020 — Extensible Studio](../adr/ADR-0020%20—%20Extensible%20Studio.md)
- [../AGENTS.md](../AGENTS.md) — implementation-agent instructions
