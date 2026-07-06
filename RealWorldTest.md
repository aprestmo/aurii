# Real-World Dataset Test — Findings

> Tested against: `packages/core/examples/data/job-postings.csv`
> Dataset: 15 Norwegian job postings with realistic messy data
> Test file: `packages/core/src/__tests__/real-world-dataset.test.ts`
> Result: **60 tests, 0 failures** — all findings are CI-verified

---

## Dataset

A 15-row CSV of Norwegian job postings designed to trigger real-world data quality issues:

- Mixed date formats (ISO 8601, `DD.MM.YYYY`, `"March 15, 2024"`)
- Boolean-like columns with values: `Yes`, `No`, `Hybrid`, `Full Remote`, `1`
- Empty salary fields for some rows (Hydro, Whereby)
- Empty company name (anonymous blockchain role)
- Empty application deadline (several rows)
- Norwegian text with `æ`, `ø`, `å` in company names and descriptions
- Numbers stored as plain strings (`"950000"`)
- String that looks like a number with CSV quotes around it (`"2"` in Openings column)

---

## What Works — Confirmed

| Behaviour | Result |
|-----------|--------|
| All 15 rows survive CSV parsing | ✓ No rows dropped |
| Required-field validation passes when only `title` is required | ✓ 0 failures |
| `toBoolean("Yes")`, `toBoolean("No")`, `toBoolean("1")` | ✓ Correct |
| `toDate("2024-03-01")` — ISO passthrough | ✓ |
| `toDate("15.03.2024")` — European DD.MM.YYYY | ✓ Normalized to ISO |
| `toDate("March 15, 2024")` — natural language via Date.parse | ✓ Works in Bun runtime |
| `toDate("")` — empty string | ✓ Returns null, field dropped |
| `toNumber("950000")` — plain integer string | ✓ |
| `toNumber("")` — empty → null, not zero | ✓ |
| Norwegian `æøå` preserved in string fields (description, company) | ✓ |
| Entities with absent optional fields have no null keys | ✓ Null is dropped at engine level |
| `from job-posting` returns all 15 | ✓ |
| `where category == "Engineering"` filters correctly | ✓ |
| `where salaryMin > 900000` — numeric comparison | ✓ |
| `order by salaryMax desc` — numeric order | ✓ |
| `contains` operator with Norwegian substring (`"søker"`) | ✓ |
| Pagination with `limit` / `offset` | ✓ Pages are non-overlapping |
| `select title, company, salaryMin` — projection | ✓ No extra keys |
| Hyphenated schema ID `job-posting` in queries | ✓ Parses correctly |
| Long descriptions (Schibsted: LLM/vector DB job) stored and retrieved intact | ✓ |
| `analyzeContent` detects 14 columns and generates suggested mapping | ✓ |
| `detectFormat("job-postings.csv", content)` → `"csv"` | ✓ |
| Suggested mapping: `title → "Title"`, `company → "Company"` | ✓ |

---

## What Breaks — Verified Bugs and Gaps

### 1. `toBoolean` erases semantic values for multi-state fields

**Affected rows:** Finn.no (Hybrid), Equinor (Hybrid), Vipps (Hybrid), Schibsted (Hybrid), NAV (Hybrid), Kolonial.no (Hybrid), Sopra Steria (Full Remote), Norsk Hydro (1 → OK)

```
"Hybrid"      → null  → field dropped from entity
"Full Remote" → null  → field dropped from entity
```

A `remote` field typed as `boolean` cannot express three real states: remote, hybrid, on-site. When a job has `Remote: Hybrid`, the entity has **no `remote` field at all**. This is not an error — it's silent data loss.

**Consequence:** `where remote == true` returns only fully-remote jobs. Hybrid jobs are invisible. A consumer cannot discover hybrid jobs by any query.

**Fix required:** Either change `remote` to a `string` field, or add an enum field type to the schema language. The pipeline has no mechanism to convert "Hybrid" → a safe string constant.

---

### 2. `toSlug` strips Norwegian letters instead of transliterating

```
applyTransform("Aker BP søker ingeniør", "toSlug")
→ "aker-bp-sker-ingenir"   ← ø stripped entirely

applyTransform("Lærling", "toSlug")
→ "lrling"   ← æ stripped, leaving a broken slug
```

The transform uses `/[^\w\s-]/g` where `\w = [a-zA-Z0-9_]` — Norwegian letters are non-word characters and are silently removed. The correct behaviour would be transliteration: `æ→ae`, `ø→o`, `å→a` (or URL encoding).

**Consequence:** Any Norwegian content that goes through a `toSlug` transform produces broken, unrecognisable slugs. This is a correctness bug, not a missing feature.

---

### 3. `toNumber` silently corrupts thousands-separator format

```
applyTransform("1,500", "toNumber")
→ 1   ← parseFloat stops at the comma
```

`parseFloat("1,500") = 1`. A salary exported as `"1,500,000"` from Excel becomes `1`. There is no error, no warning — just silent corruption.

The same applies to currency-prefixed strings:
```
applyTransform("$49.99", "toNumber")
→ null   ← parseFloat("$49.99") = NaN
```

**Consequence:** Any salary or price data from US-locale Excel exports (`1,500,000`) becomes wrong. The pipeline needs a `stripThousandsSeparator` or `parseCurrencyNumber` transform, or `toNumber` needs to handle locale-aware formats.

---

### 4. `toDate` passes ISO 8601 timestamps as-is (field stores datetime in date field)

```
applyTransform("2024-03-15T14:30:00Z", "toDate")
→ "2024-03-15T14:30:00Z"   ← not truncated to date
```

The ISO 8601 check matches the prefix `/^\d{4}-\d{2}-\d{2}/` and returns the **full input string**. A `date`-typed field ends up storing a datetime string. The schema type says `date` but the value is a full ISO timestamp.

**Consequence:** Date comparisons (`where postedDate > "2024-03-01"`) may behave incorrectly when some values are `"2024-03-15"` and others are `"2024-03-15T14:30:00Z"` — string comparison will still work lexically, but it is semantically inconsistent.

---

### 5. `where field == null` silently returns 0 results

The query parses successfully:
```
from job-posting where deadline == null
→ ParsedQuery { where: [{ field: "deadline", op: "==", value: null }] }
```

But the SQLite executor generates:
```sql
json_extract(data, '$.deadline') = ?   -- bound value: null
```

In SQL, `NULL = NULL` is `UNKNOWN` (never `TRUE`). Entities whose `deadline` was empty string → `toDate("") = null` → field dropped → `json_extract` returns `NULL` — but `NULL = NULL` still doesn't match.

**Result:** 0 entities returned instead of the ~5 entities with no deadline.

**Consequence:** Cannot find entities where an optional field is absent. The executor needs to generate `IS NULL` for null-valued conditions, not `= ?`.

---

### 6. OR conditions not supported in Query Language

```
from job-posting where category == "Engineering" or category == "Data"
→ throws parse error
```

The query language only supports `and`. Cannot express disjunction. Any multi-category filter requires fetching all and filtering in application code.

---

### 7. No aggregate queries

```
from job-posting select count(*) where category == "Engineering"
→ throws parse error
```

No `COUNT`, `SUM`, `AVG`, `GROUP BY`. Cannot answer "what is the average salary for Engineering jobs?" or "how many openings per category?" without fetching all data and aggregating in the application layer.

---

### 8. No multi-field ORDER BY

```
from job-posting order by salaryMax desc, postedDate asc
→ throws parse error
```

Only one sort key is supported.

---

### 9. No join / relation queries

```
from job-posting join company on company == company.name
→ throws parse error
```

All data must be denormalized into a single entity. This is a known Phase 3 gap, not a bug.

---

### 10. `analyzeContent` type inference downgrades sparse numeric columns to string

When a column like `Salary Min` has numeric values in most rows but empty strings in a few (Hydro, Whereby), `inferType` requires **all** non-empty values to be numeric. One ambiguous value causes the entire column to be typed as `string`.

**Consequence:** The auto-generated schema for a real salary dataset will suggest `string` instead of `number`, meaning the import wizard will not automatically add a `toNumber` transform. The user has to correct this manually.

---

## Summary Table

| Issue | Category | Severity | Silent? | Status |
|-------|----------|----------|---------|--------|
| `toBoolean` drops "Hybrid"/"Full Remote" | Data model gap | High | Yes | Open |
| `toSlug` strips Norwegian letters | Correctness bug | High | Yes | **Fixed** |
| `toNumber` corrupts `"1,500"` → `1` | Correctness bug | High | Yes | Open |
| `toDate` passes full timestamps through | Correctness bug | Medium | Yes | **Fixed** |
| `where field == null` returns 0 results | Executor bug | Medium | Yes | **Fixed** |
| No OR conditions | Query language gap | Medium | No — throws | Open |
| No aggregate queries | Query language gap | Medium | No — throws | Open |
| No multi-field ORDER BY | Query language gap | Low | No — throws | Open |
| No join/relation queries | Known Phase 3 gap | Low | No — throws | Open |
| Type inferrer downgrades sparse numeric columns | Analysis heuristic | Low | Yes | Open |

---

## Fixes Applied in This PR

Three silent correctness bugs were fixed immediately (each 1-5 lines):

### Fixed: `toSlug` Norwegian transliteration (`transforms.ts`)
```ts
.replace(/[æÆ]/g, "ae")
.replace(/[øØ]/g, "o")
.replace(/[åÅ]/g, "a")
```
`"Lærling"` → `"laerling"`, `"ingeniør"` → `"ingenior"`.

### Fixed: `toDate` clips full timestamps (`transforms.ts`)
```ts
if (ISO_DATE_PATTERNS[0]!.test(v)) return v.slice(0, 10);
```
`"2024-03-15T14:30:00Z"` → `"2024-03-15"`.

### Fixed: `where field == null` generates IS NULL (`sqlite.ts`)
```ts
if (condition.value === null) {
  return condition.op === "==" ? `${path} IS NULL` : `${path} IS NOT NULL`;
}
```
`from job-posting where deadline == null` now returns the 5 entities with no deadline.
(PostgreSQL adapter already had this logic; SQLite now matches it.)

---

## Remaining Open Issues

| Issue | Recommended Next Step |
|-------|----------------------|
| `toBoolean` drops "Hybrid"/"Full Remote" | Add `enum` field type, or change `remote` to `string` |
| `toNumber` corrupts `"1,500"` → `1` | Add `stripThousandsSeparator` transform or locale-aware parsing |
| No OR conditions in query language | Extend parser: `where A or B` |
| No aggregate queries | Phase 3: `count`, `sum`, `avg`, `group by` |
| No multi-field ORDER BY | Extend parser and executor |
| No join/relation queries | Phase 3 |
| Type inferrer downgrades sparse numeric columns | Lower threshold or use majority-wins logic |

---

## Files Added

| File | Purpose |
|------|---------|
| `packages/core/examples/data/job-postings.csv` | 15-row real-world test dataset |
| `packages/core/examples/schemas/job-posting.yaml` | Schema definition |
| `packages/core/examples/imports/job-postings.yaml` | Import definition |
| `packages/core/src/__tests__/real-world-dataset.test.ts` | 60 CI-verified tests documenting all findings |
| `RealWorldTest.md` | This document |
