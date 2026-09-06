# Temporal References

> **Status: architectural contract (Pre–Phase 5).** Live vs pinned references and temporal metadata homes.
>
> ADR: [ADR-0023 — Live vs Pinned References](../adr/ADR-0023%20—%20Live%20vs%20Pinned%20References.md).
>
> Related: [HISTORY_MODEL.md](HISTORY_MODEL.md), [SCHEMA_EVOLUTION.md](SCHEMA_EVOLUTION.md), [NORWEGIAN_GEO.md](NORWEGIAN_GEO.md), [Phase5.md](../Phase5.md).

---

## Purpose

Once imported facts can change over time, a reference such as:

```text
Article → Municipality: Trondheim
```

is ambiguous. It may mean:

1. give me the **current** Trondheim entity; or
2. give me the **version used when the article was published**.

Both are valid. Aurii must not accidentally choose one semantic for every product.

---

## Reference modes

### Live reference

Resolve the **current** entity state.

Conceptual shape:

```yaml
entityRef:
  schema: municipality
  id: "5001"
```

Useful for:

- current company profile
- current municipality page
- live dashboard
- dynamic fact box

### Pinned reference

Resolve the state that the consumer **intentionally** referenced.

Conceptual shape:

```yaml
entityRef:
  schema: municipality
  id: "5001"
  entityRevision: 42
```

Useful for:

- publication history
- research evidence
- compliance
- reproducibility

The exact public syntax is not locked to YAML. Products and schemas may express the same contract through fields, JSON, or SDK helpers.

**Rule:** Updating the live entity must not mutate a pinned reference result.

---

## Runtime support

| Mode | Resolution |
|------|------------|
| Live | `getEntity(id)` / query current row |
| Pinned | `getEntityRevision(id, entityRevision)` → immutable snapshot |

Pre–Phase 5 provides:

- `entityRevision` on live entities (also the optimistic concurrency token — [ADR-0022](../adr/ADR-0022%20—%20Entity%20Revision%20and%20Optimistic%20Concurrency.md))
- durable revision snapshots written on create/update so pinned addressing is real, not fake

Full editorial publication history (which publication pointed at which revision) remains Phase 5 product work.

---

## Temporal metadata

Distinguish:

| Field | Meaning |
|-------|---------|
| `recordedAt` | When Aurii learned/stored the fact |
| `effectiveAt` | When the fact applies in the real world, if known |

Example:

```yaml
population: 218460
effectiveAt: 2027-01-01
recordedAt: 2027-02-20T10:14:00Z
```

Homes today:

- **`recordedAt`** — system metadata on durable writes (entity `createdAt` / `updatedAt`, revision snapshot `recordedAt`). Not a substitute for domain effective time.
- **`effectiveAt`** — domain field (or pair `validFrom` / `validTo`) declared on schemas when the product needs real-world validity. Norwegian Geo historical modules already use validity windows in product data.

This is **not** a full bitemporal database. The requirement is to avoid architecture that makes recorded vs effective distinction impossible later.

Do not invent Core builtins named `EffectiveAt` for every entity. Prefer schema-declared temporal fields when a product needs them.

---

## Non-goals

- Full bitemporal query engine
- Automatic pinning of every reference
- Forcing all products to use pinned references
- Replacing Norwegian Geo `validFrom` / `validTo` with a Core-only temporal model
