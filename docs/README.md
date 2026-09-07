# Aurii Documentation

This directory contains the architecture specification and design documents for the Aurii Runtime.

The specification is the **source of truth**. Code implements the specification.

---

## Contents

### Product model

- [PRODUCT_MODEL.md](./PRODUCT_MODEL.md) — **Canonical product model** (Core, datasets, products, modules, Studio, authoring, consumers)
- [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) — Open Core, product boundaries, Studio audience, customer-led evolution
- [PLATFORM_VALIDATION.md](./PLATFORM_VALIDATION.md) — Prove Aurii through a diverse real-product portfolio (discovery loop, maturity model, 6–12 month gates)
- [COMPETITIVE_GUARDRAILS.md](./COMPETITIVE_GUARDRAILS.md) — Aurii must not become a better headless CMS (Kyro test, commodity vs strategic, promotion ladder)
- [ARCHITECTURE_FITNESS.md](./ARCHITECTURE_FITNESS.md) — Kampbart, playgrounds, Gaselle, Geo as architecture tests
- [PROJECTS.md](./PROJECTS.md) — Project as top-level Core boundary (API, migration, seed)
- [Phase4.md](../Phase4.md) — Phase 4 report: Data Products and Delivery (**complete**)
- [Phase5.md](../Phase5.md) — Phase 5 plan: Editorial & Context (**planned / post–Phase 4**)
- [DELIVERY.md](./DELIVERY.md) — Live frontend delivery contract
- [PACKAGES.md](./PACKAGES.md) — Experimental 0.x public package distribution
- [EXTERNAL_CONSUMERS.md](./EXTERNAL_CONSUMERS.md) — Products outside the Aurii monorepo
- [SCALE.md](./SCALE.md) — Query scale measurements and named bottlenecks
- [ADR-0010 — Optional Authoring Layer](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md) — CMS/authoring as optional Core clients
- [ADR-0011 — Project as Top-Level Boundary](../adr/ADR-0011%20—%20Project%20as%20Top-Level%20Boundary.md) — Project tenancy model
- [ADR-0019 — Provenance and Editorial Overrides](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)
- [ADR-0020 — Extensible Studio](../adr/ADR-0020%20—%20Extensible%20Studio.md)
- [ADR-0021 — Schema Evolution](../adr/ADR-0021%20—%20Schema%20Evolution%20and%20Historical%20Interpretation.md)
- [ADR-0022 — Entity Revision and Optimistic Concurrency](../adr/ADR-0022%20—%20Entity%20Revision%20and%20Optimistic%20Concurrency.md)
- [ADR-0023 — Live vs Pinned References](../adr/ADR-0023%20—%20Live%20vs%20Pinned%20References.md)

### Architecture

- [Architecture.md](./Architecture.md) — Overall system architecture and engine design
- [ARCHITECTURE_FITNESS.md](./ARCHITECTURE_FITNESS.md) — Representative product tests of the architecture
- [COMPETITIVE_GUARDRAILS.md](./COMPETITIVE_GUARDRAILS.md) — Core-boundary tests against conventional CMS architecture
- [SCHEMA_EVOLUTION.md](./SCHEMA_EVOLUTION.md) — Schema identity, versioning, change classification
- [HISTORY_MODEL.md](./HISTORY_MODEL.md) — Provenance vs audit vs revision vs publication
- [TEMPORAL_REFERENCES.md](./TEMPORAL_REFERENCES.md) — Live vs pinned references; recordedAt / effectiveAt
- [OPERATIONS.md](./OPERATIONS.md) — Persistent Postgres startup, backup, restore
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Production-shaped runtime (containers, CORS, HTTPS, migrate)
- [validation/PHASE_4_6_EXTERNAL_RUNTIME.md](./validation/PHASE_4_6_EXTERNAL_RUNTIME.md) — External runtime validation report
- [Runtime.md](./Runtime.md) — Runtime design and execution model
- [Core.md](./Core.md) — Core package internals
- [Domain Model.md](./Domain%20Model.md) — Entity, Dataset, Schema, Pipeline domain model
- [Capabilities.md](./Capabilities.md) — Capability model and plugin surface (**vision**; see status banner)

### Languages

- [Schema Language.md](./Schema%20Language.md) — Declarative schema definition format
- [Query Language.md](./Query%20Language.md) — Query Language syntax and semantics
- [Pipeline Language.md](./Pipeline%20Language.md) — Pipeline and transform definitions

### Components

- [Studio.md](./Studio.md) — Studio developer/operator workspace (beta)
- [Import Engine.md](./Import%20Engine.md) — Import pipeline architecture
- [Plugin Runtime.md](./Plugin%20Runtime.md) — Plugin system specification

### Integration

- [API.md](./API.md) — HTTP API reference
- [DELIVERY.md](./DELIVERY.md) — Published routes vs authenticated Query/SDK; live vs snapshot
- [SCALE.md](./SCALE.md) — Measured query limits and named bottlenecks
- [PROJECTS.md](./PROJECTS.md) — Projects API and data model
- [AI.md](./AI.md) — AI integration and agent interface

### Vision & Philosophy

- [Vision.md](./Vision.md) — Product vision
- [Constitution.md](./Constitution.md) — Architectural principles (including customer-led evolution)
- [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) — Open Core, product boundaries, Studio audience
- [PLATFORM_VALIDATION.md](./PLATFORM_VALIDATION.md) — Real-project validation portfolio and v1 decision criteria
- [COMPETITIVE_GUARDRAILS.md](./COMPETITIVE_GUARDRAILS.md) — Do not optimize Aurii into another headless CMS
- [Toc.md](./Toc.md) — Table of contents for the full specification

### Development

- [REFERENCE_DEMO.md](./REFERENCE_DEMO.md) — **Canonical data/delivery demo** for agents and contributors (Norwegian Geo; pending external repo)
- [NORWEGIAN_GEO.md](./NORWEGIAN_GEO.md) — Norwegian Geo product layer boundaries
- [EXTERNAL_CONSUMERS.md](./EXTERNAL_CONSUMERS.md) — First external product extraction / generic fixture
- [../AGENTS.md](../AGENTS.md) — Agent rules, including Norwegian Geo vs future Editorial vertical

### Phase reports (historical + plan)

| Document | Status |
|----------|--------|
| [Phase1.md](../Phase1.md) | Historical — complete |
| [Phase2.md](../Phase2.md) | Historical — complete |
| [Phase2.2.md](../Phase2.2.md) | Historical — complete |
| [Phase3.md](../Phase3.md) | Historical — complete |
| [Phase4.md](../Phase4.md) | Historical — complete (data products + delivery) |
| [PHASE_4_6_EXTERNAL_RUNTIME.md](./validation/PHASE_4_6_EXTERNAL_RUNTIME.md) | External runtime — in-repo / CI proof |
| [Phase5.md](../Phase5.md) | Plan — Editorial & Context (post–Phase 4; not implemented) |

Historical phase reports are records of what was true when written. Prefer status notes over rewriting them.

---

## Architecture Decision Records

See [`../adr/`](../adr/) for all recorded architectural decisions. Latest: [ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md), [ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md). Project-boundary decision: [ADR-0011](../adr/ADR-0011%20—%20Project%20as%20Top-Level%20Boundary.md).
