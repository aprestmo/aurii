# ADR-0010 — Authoring and CMS capabilities are optional clients of Aurii Core

Status: Accepted  
Date: 2026-07-30  
Decision Makers: Aurii Project  
Supersedes: None  
Related: [ADR-0001 — Platform Vision](./ADR-0001%20—%20Platform%20Vision.md), [ADR-0001 Adopt a Runtime-First Architecture](./ADR-0001%20Adopt%20a%20Runtime-First%20Architecture.md), [ADR-0005 — API-First Architecture](./ADR-0005%20—%20API-First%20Architecture.md), [docs/PRODUCT_MODEL.md](../docs/PRODUCT_MODEL.md)

⸻

## Context

Aurii’s founding principle is that Core is a declarative runtime for structured knowledge—not a traditional CMS. That principle remains correct for the Runtime.

At the same time, the platform is intended to power products that look like CMSes: blogs, documentation sites, magazines, newsrooms, and live coverage tools. Contributors can misread “Aurii is not a CMS” as “Aurii must not power CMS products,” or conversely assume that a CMS layer is required between Core and every frontend.

The repository already has:

- an import-first Core with schemas, entities, datasets, query, and HTTP API;
- Studio as a generic data-administration client (data workspace);
- Norwegian Geo as a data product that needs no authoring UI;
- Phase 3 relational references that enable hybrid compositions later.

What is missing is an explicit decision that separates **Core**, the **data workspace**, and an **optional authoring workspace**, and that states how frontends consume data.

⸻

## Decision

1. **Core remains the system of record.** All durable structured data—imported or authored—is stored, validated, related, queried, and delivered by Core.

2. **Studio and future authoring interfaces are clients.** They use public APIs and the SDK only. They never bypass Core, talk to storage directly, or own business logic that belongs in schemas, capabilities, pipelines, or Core services.

3. **A CMS or authoring interface is optional.** A frontend, app, export adapter, or AI client can consume Core without any CMS client being deployed. Norwegian Geo is the proving case for this mode.

4. **Frontends consume Core directly.** Delivery goes through public APIs, the SDK, and events—not through a CMS UI or Studio. An authoring workspace may write entities; it is not a read proxy for consumers.

5. **Editorial state is expressed generically.** Draft, published, revision, workflow, and preview—when introduced—must be expressed through schemas, capabilities, APIs, and services. Core must not become a hardcoded news CMS.

6. **One Studio shell may host multiple workspaces.** A future shell may include a data workspace and an authoring workspace. Those workspaces remain clients of Core; they are not layers between Core and consumers.

7. **Newsroom and LiveCenter are compositions on the Runtime.** They are products built from schemas, modules, capabilities, pipelines, and clients—not special cases embedded in Core.

### Intended clarification

> Aurii Core is not a CMS. Aurii can power CMS products through an optional authoring layer.

⸻

## Clarification (2026-08-15)

Studio may host **domain-specific editors** (match desk, map collection view, dense company table) as extensions on public APIs ([ADR-0020](./ADR-0020%20—%20Extensible%20Studio.md)). That does **not** make Studio the publication CMS, and it does **not** weaken points 3–5 above.

Provenance and editorial overrides are Core metadata concerns ([ADR-0019](./ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)), not CMS features.

Architecture fitness tests: [`docs/ARCHITECTURE_FITNESS.md`](../docs/ARCHITECTURE_FITNESS.md).

⸻

## Compatibility with “Aurii is not a CMS”

| Statement | Meaning |
|-----------|---------|
| Aurii is not a CMS | Core is a domain-agnostic runtime and content/data lake, not an editor-first publishing application |
| Aurii can power a CMS | Products may add an authoring client that uses Core like any other client |
| A CMS is not required | Data products and many APIs need only imports, schemas, and delivery |

This ADR does not weaken Runtime-first or API-first architecture; it applies them to authoring.

⸻

## Alternatives considered

### A. Require a CMS layer for all products

Reject. Forces Norwegian Geo and similar data products through an unnecessary editorial UI. Couples delivery to Studio. Contradicts API-first consumption.

### B. Embed newsroom/CMS semantics in Core

Reject. Hardcodes domain workflow into the Runtime. Violates “keep Runtime small,” “capabilities before features,” and Norwegian Geo’s proof that Core must stay domain-agnostic.

### C. Treat Studio as the only human interface forever

Reject as a long-term model. Studio should remain the generic admin client; specialized authoring UX may exist as additional clients or workspaces. Forcing all editing through today’s data browser would either under-serve editors or pollute Core with UI assumptions.

### D. Optional authoring clients on public APIs (chosen)

Accept. Preserves Core purity, supports data-only and authored modes, and allows hybrid products via schema-declared references.

⸻

## Consequences

### Positive

- Clear product modes: data-only, authored, hybrid (see `docs/PRODUCT_MODEL.md`).
- Phase 4 can complete import → Core → SDK → frontend without waiting for CMS work.
- Future Editorial vertical can validate authoring without rewriting Core as a CMS.
- “Aurii is not a CMS” remains true for Core while marketing and roadmap can describe CMS-capable products honestly.

### Negative / costs

- Contributors must learn the Core / Studio / authoring / consumer distinction.
- Editorial features arrive later; documenting them as optional can create expectation gaps if status language is sloppy.
- Two reference verticals (Norwegian Geo + future Editorial) increase long-term validation cost—accepted as necessary honesty.

### Neutral

- Studio may grow a second workspace without changing Core’s role.
- Product manifests and modules remain product packaging, not authoring infrastructure.

⸻

## Tradeoffs

| Choice | Benefit | Cost |
|--------|---------|------|
| Authoring outside Core | Core stays generic | Editorial UX must be built as a client |
| Delivery only via API/SDK | Frontend independence | Offline snapshot modes must be explicit, not the only story |
| Generic capabilities for draft/publish | Reuse across products | Harder than hardcoding a news CMS; deferred until after Phase 4 |
| Dual reference verticals | Honest validation | Editorial vertical not available yet |

⸻

## Examples

- **Norwegian Geo:** imports + Core + Studio data workspace + consumer site. No CMS.
- **Tax list portal:** same data-only pattern at larger scale.
- **Classic blog:** optional authoring workspace writes articles; public site reads via SDK.
- **News CMS:** authoring workspace + imported reference data (municipalities, companies) as hybrid.
- **LiveCenter:** later-phase hybrid product; realtime and collaboration are client/capability concerns, not Core newsroom builtins.

⸻

## Implementation notes (non-binding for this ADR)

- Do not implement schema-generated forms, drafts, revisions, preview, workflow, media, or LiveCenter as part of accepting this ADR.
- Phase 4 (`Phase4.md`) completes the data-product delivery path first.
- A future Editorial reference vertical validates authoring; it must not dump editorial concepts into Core merely because Norwegian Geo cannot exercise them.

⸻

## Status of related features

| Concern | Status at ADR acceptance |
|---------|--------------------------|
| Core as system of record | Implemented |
| Studio data workspace | Implemented (admin client) |
| Public API + SDK delivery | Implemented; production frontend path strengthened in Phase 4 |
| Authoring workspace | Planned (post–Phase 4) |
| Newsroom / LiveCenter products | Planned (later phases) |
| Draft / publish / revision / workflow | Planned as generic capabilities (not yet implemented) |
