# Schema Language — Reference Fields (Phase 3)

> Phase 3 implementation status. See `docs/Schema Language.md` for the full vision.
>
> Relations are a **foundation**. This page documents what is implemented; planned cardinality and reverse references must not require a second model.

## Reference type

Reference fields store **stable entity IDs**, never embedded objects.

```yaml
fields:
  - name: countyId
    type: reference
    to: county
    required: true
```

| Property | Description |
|----------|-------------|
| `type: reference` | Single reference (one-to-one or many-to-one) |
| `to` | Target schema id (canonical) |
| `schema` | Accepted alias for `to` (backward compatibility) |
| `multiple: true` | One-to-many — stores `string[]` of IDs |
| `required` | Optional or required reference |

## Validation

- **Type validation:** reference values must be strings (or string arrays when `multiple`)
- **Import validation:** optional referential integrity check during import

```yaml
# import definition
referenceValidation: strict   # default — fail row on missing target
referenceValidation: warning  # import with warning in errors
referenceValidation: skip     # remove invalid reference values and import
```

## Planned (do not treat as missing accidents)

These belong on the same reference foundation—not a new “relations engine”:

| Need | Status |
|------|--------|
| Typed references | Implemented |
| One-to-one / many-to-one | Implemented (`type: reference`) |
| One-to-many | Implemented (`multiple: true`) |
| Many-to-many | Planned (junction or multi-reference; API not locked) |
| Reverse references | Planned (query/Studio context; not a second stored graph) |
| Query/filter through relations | Partial (joins in Query Language v1; richer traversal later) |
| Referential integrity | Partial (import `strict` / `warning` / `skip`; runtime policies later) |

Studio should later use relations to show context around a record. Core remains the authority.

## Norwegian geo migration

`countyId` and `municipalityId` are now `type: reference` in `demo/norwegian-geo/core/schemas/`.

Stored values are unchanged (still string IDs like `"03"` and `"0301"`).

## SDK alignment

SDK `FieldDefinition` accepts `to` (preferred) or `reference` / `schema` (deprecated aliases).
