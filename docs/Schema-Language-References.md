# Schema Language — Reference Fields (Phase 3)

> Phase 3 implementation status. See `docs/Schema Language.md` for the full vision.

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

## Norwegian geo migration

`countyId` and `municipalityId` are now `type: reference` in `demo/norwegian-geo/core/schemas/`.

Stored values are unchanged (still string IDs like `"03"` and `"0301"`).

## SDK alignment

SDK `FieldDefinition` accepts `to` (preferred) or `reference` / `schema` (deprecated aliases).
