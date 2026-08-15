# ADR-0020 — Extensible Studio (generated default, replaceable UI)

Status: Accepted  
Date: 2026-08-15  
Decision Makers: Aurii Project  
Extends: [ADR-0017 — Studio Extension Model](./ADR-0017%20—%20Studio%20Extension%20Model.md)  
Related: [ADR-0010](./ADR-0010%20—%20Optional%20Authoring%20Layer.md), [`docs/Studio.md`](../docs/Studio.md), [`docs/ARCHITECTURE_FITNESS.md`](../docs/ARCHITECTURE_FITNESS.md)

⸻

## Context

[ADR-0017](./ADR-0017%20—%20Studio%20Extension%20Model.md) established three Studio layers for the project-oriented beta: generic runtime, `defineStudio()` config, and a **simple view registry**. That is enough for Norwegian Geo navigation and a coverage page. It is not enough for products that need a real working surface.

Kampbart needs a match editor (score, lineup, timeline, events, report). A playground directory needs List | Table | Map on the same collection. Gaselle needs dense tables and relation context. None of those should fork `apps/studio` or teach Core about football, maps, or rankings.

Separately, schema-generated forms were deferred as a “CMS feature” ([`Phase4.md`](../Phase4.md) non-goals). Generated forms are the **default data-workspace editor**, not a publication CMS. They belong in Studio’s trajectory without turning Studio into the future Editorial product ([ADR-0010](./ADR-0010%20—%20Optional%20Authoring%20Layer.md)).

⸻

## Decision

1. **Generated UI is the default, not the ceiling.**

   ```text
   Schema
     ↓
   Default generated UI
     ↓
   Customizable / replaceable UI
   ```

   Without extensions, Studio must still work: collections, generated (or generic) record forms, sources, imports, query, routes.

2. **The architecture is replaceable UI.** Projects must eventually be able to register:

   | Extension | Purpose | Example |
   |-----------|---------|---------|
   | Custom field inputs | Replace one field control | Geo coordinate picker |
   | Custom record editors | Replace the whole entity form | Kampbart match desk |
   | Custom collection views | Alternate ways to see the same schema | List, Table, Cards, Map, Custom |
   | Custom tools / pages | Project tools that are not a single record | Coverage, sync health |
   | Custom navigation | Grouping and labels | `defineStudio` (already beta) |
   | Domain-specific workflows | Multi-step UI on generic Core operations | Match event entry; override review |

3. **Collection views are Studio extensions, not Core concepts.** Map, Kanban, or Timeline must not become Runtime types. Core stores entities; Studio (or a reusable view module) renders them.

4. **Domain-specific Studio experiences do not require the Editorial product.** A match desk or map browser is a Studio extension on public APIs. Draft/preview/collaboration/Context remain the future Editorial client ([`Phase5.md`](../Phase5.md)). One Studio shell may host both data operations and custom editors ([ADR-0010](./ADR-0010%20—%20Optional%20Authoring%20Layer.md) point 6).

5. **Keep a stable extension contract as a planned API.** Beta keeps the simple view registry. Do not lock plugin signatures in this ADR. Do document the **intent** so Core/Studio changes do not paint the platform into generated-CRUD-only.

6. **Core stays unaware of domain UX.** If Kampbart needs a timeline, that is a Studio (or plugin) module calling entity/query APIs. If Core would need a `MatchEngine`, the design has failed.

7. **Generated forms may ship before rich text, publishing, or a CMS.** They are schema-driven default editing for any entity—Company, Municipality, Match, Article—not article authoring.

⸻

## Content / Data / Sources as product lenses

Studio may **think** in three lenses without splitting Core:

| Lens | Meaning | Today’s Studio surface (approx.) |
|------|---------|----------------------------------|
| **Sources** | External systems and sync | Sources, Imports, Schedules, History |
| **Data** | Records and datasets | Entities / collections, Query |
| **Content** | Editorial production on the same entities | Not a separate store; schemas with rich fields, custom editors, future Editorial client |

These are **mental models and optional `defineStudio` grouping**, not three storage engines and not a mandated top-level IA for every project. Norwegian Geo should not be forced into a “Content” nav item. Kampbart’s Match is both structured data and editorial report.

Do not freeze Content | Data | Sources as the only Studio information architecture.

⸻

## Compatibility

- ADR-0017 remains in force for the beta three-layer split and package split (`@aurii/studio` vs `@aurii/studio-app`).
- ADR-0010 remains in force: Studio is not a CMS synonym; a future CMS/Editorial product is a separate client; frontends never read through Studio.
- This ADR **widens** what Studio is allowed to become (extensible workspace), not what Core is allowed to become.

⸻

## Non-goals (this ADR)

- Implementing the full extension API, map view, or Kampbart editor
- A plugin marketplace or sandboxed Plugin Runtime
- Replacing ADR-0017’s simple registry in the current beta
- Locking React/Astro component contracts

⸻

## Consequences

### Positive

- Kampbart, playgrounds, and Gaselle can be designed against a real Studio trajectory.
- Generated forms stop being confused with “building a CMS.”
- Map/timeline stay out of Core.

### Costs

- Extension API design must stay ahead of one-off pages in `apps/studio`.
- Contributors must not implement domain editors by forking Studio or adding Core special cases.

⸻

## Decision summary

Studio’s default experience is schema-generated (or generic) UI. The architecture is a replaceable, project-extensible workspace on the same Core model. Domain-specific tools are extensions. They are not Core features and not a reason to delay thinking about extensibility until a late “nice to have” phase.
