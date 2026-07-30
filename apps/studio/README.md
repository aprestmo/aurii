# @aurii/studio

> Aurii Studio is a **client** of the Aurii Runtime. It consumes the public HTTP API (via `@aurii/sdk`) and nothing else.
>
> Today Studio is a generic **data workspace** (imports, schemas, entities, queries). An optional **authoring workspace** for CMS-style editing is a later-phase client—not required for data products. See [`docs/PRODUCT_MODEL.md`](../../docs/PRODUCT_MODEL.md) and [ADR-0010](../../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

An Astro application providing:

- **Dashboard** — entity counts, field coverage per schema, import history
- **Import Wizard** — upload → analyze → schema → mapping → dry run → import
- **Entity Browser** — browse, filter, and query entities (including relation links)
- **Query playground** — run and explain Query Language against the active dataset
- **Schemas** — inspect registered schemas
- **Login** — API URL + token when the API requires authentication

**Status:** usable after Phase 2–3. Phase 4 deepens import operations and delivery; it does not turn Studio into a news CMS.

## Quick start

```bash
# Start the Core API first (from packages/core)
bun run cli serve

# Then start Studio
bun install
bun run dev        # http://localhost:4321
```

Production build:

```bash
bun run build      # static output in dist/
bun run preview
```

## Configuration

Studio stores its connection settings in the browser (localStorage):

| Key             | Meaning                                    |
|-----------------|--------------------------------------------|
| `aurii.apiUrl`  | Core API base URL (default localhost:3000) |
| `aurii.token`   | Bearer token if the API requires auth      |
| `aurii.dataset` | Active dataset (switcher in the sidebar)   |

Visit `/login` to change the connection.

## Import Wizard

The wizard walks through six steps:

1. **Upload** — drag-and-drop CSV or JSON
2. **Preview** — detected format, delimiter, columns, inferred types
3. **Schema** — accept the generated schema or use an existing one
4. **Mapping** — map source columns to schema fields, choose transforms
5. **Dry run** — full validation, nothing written, per-row errors shown
6. **Import** — the real run, with result summary

Nothing is written to storage before step 6.
