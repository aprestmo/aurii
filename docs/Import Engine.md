# Import Engine

> Information already exists.
>
> The purpose of the Import Engine is not merely to import data.
> Its purpose is to understand information and transform it into first-class Entities within Aurii.

---

# Purpose

Organizations already possess enormous amounts of valuable information.

CSV files.

Excel spreadsheets.

Databases.

Public APIs.

Legacy systems.

Documents.

PDFs.

GIS data.

ERP systems.

CRM systems.

The challenge is rarely creating data.

The challenge is making existing data usable.

The Import Engine exists to solve that problem.

---

# Philosophy

Import is not a file upload.

Import is a conversation between an external source and Aurii.

The goal is to answer three questions:

1. What information exists?
2. What does it mean?
3. How should it become part of the platform?

Import should therefore be intelligent.

---

# Project write policy

Imports belong to a dataset. Project is derived as `Import → Dataset → Project`.

* **active** — import definitions may run; entity writes allowed
* **inactive / archived** — import history and results remain readable; new runs are rejected (`PROJECT_NOT_WRITABLE`)

Core re-checks project status at import start and again immediately before persisting entities. See [ADR-0013](../adr/ADR-0013%20—%20Project%20Write%20Policy%20for%20Dataset-Bound%20Resources.md).

---

# Import Is A Resource

An Import is an Entity.

It is not a temporary process.

Every Import has:

- identity
- configuration
- mappings
- transformations
- history
- execution logs
- permissions
- schedules

Imports should be reusable.

**Sources** are the architectural companion: a DataSource registry already exists ([ADR-0015](../adr/ADR-0015%20—%20DataSource%20Model.md)). Ingestion should be thinkable as:

```
fetch → transform → identity matching → normalize → upsert/sync
```

Intended (not implemented) placement: reusable adapters in `packages/sources`, optional long-running work in `apps/worker`. Adapter APIs are not locked. Resulting values should carry provenance; source values and editorial overrides stay distinct ([ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)).

Do not build a second import engine. Extend this one.

---

# Import Lifecycle

Every Import follows the same lifecycle.

```
Source

↓

Discovery

↓

Analysis

↓

Schema Matching

↓

Mapping

↓

Validation

↓

Transformation

↓

Preview

↓

Execution

↓

Verification

↓

Reporting

↓

Scheduling
```

Every step should be inspectable.

---

# Supported Sources

Aurii should support multiple source types.

## Files

- CSV
- TSV
- XLSX
- JSON
- NDJSON
- XML
- YAML
- GeoJSON
- Parquet
- ZIP archives

---

## Databases

- PostgreSQL

- MySQL

- MariaDB

- SQL Server

- Oracle

- MongoDB

---

## APIs

- REST

- GraphQL

- RSS

- Atom

- OData

- SOAP (optional)

---

## Cloud Storage

- S3

- Cloudflare R2

- Azure Blob Storage

- Google Cloud Storage

- MinIO

---

## Productivity

- Google Sheets

- Excel Online

- Airtable

---

## Repositories

- Git

- GitHub

- Gitea

- GitLab

---

## Documents

- PDF

- Word

- Markdown

- HTML

- Plain text

---

# AI Assisted Imports

AI should assist throughout the import process.

Examples:

- detect tables

- identify entities

- recognize addresses

- classify fields

- infer relationships

- generate schemas

- suggest mappings

- detect duplicates

- summarize data quality

AI assists.

Users approve.

---

# Discovery

Discovery is the first stage.

Aurii should inspect incoming information before asking the user anything.

Discovery identifies:

- format

- encoding

- delimiters

- headers

- field types

- record count

- nested structures

- duplicate keys

- missing values

Users should begin with knowledge instead of configuration.

---

# Schema Matching

Aurii should compare incoming data with existing Schemas.

Possible outcomes:

✓ Existing Schema

✓ Similar Schema

✓ Suggested Schema

✓ Create New Schema

The system should minimize duplicate models.

---

# Mapping

Mapping connects source fields to Schema fields.

Example:

```
CSV

Company Name

↓

Company.name

----------------

Postal Code

↓

Address.postalCode

----------------

Phone

↓

Company.phone
```

Mappings should be saved.

Mappings become reusable assets.

---

# Validation

Validation happens before storage.

Examples:

- required fields

- invalid dates

- malformed emails

- duplicate identifiers

- invalid references

- unsupported values

Errors should be visible.

Nothing should fail silently.

---

# Transformation

Transformation prepares data.

Examples:

```
Trim whitespace

↓

Normalize casing

↓

Split full name

↓

Convert currency

↓

Convert dates

↓

Lookup municipality

↓

Generate slug

↓

Normalize phone numbers

↓

Create relationships
```

Transformations should be composable.

---

# Enrichment

Imports should optionally enrich information.

Examples:

Postal Code

↓

Municipality

↓

County

↓

Coordinates

Or

Organization Number

↓

Company Registry

↓

Industry

↓

Status

↓

Address

Aurii should make enrichment reusable.

---

# Pipelines

Imports execute Pipelines.

Pipelines are reusable workflows.

```
Import

↓

Validate

↓

Normalize

↓

Enrich

↓

Store

↓

Publish Event
```

One Pipeline should support many Imports.

---

# Preview

Nothing large should import blindly.

Users should always preview:

- entities

- relationships

- warnings

- duplicates

- transformations

Confidence should precede execution.

---

# Execution

Execution should support:

- streaming

- chunking

- batching

- retries

- resumability

- parallelism

Large imports should never require loading everything into memory.

---

# Scheduling

Imports should become automations.

Examples:

Every hour

Every day

Every Monday

After webhook

After file upload

Imports become integrations.

---

# Incremental Imports

Aurii should avoid importing everything repeatedly.

Strategies include:

- timestamps

- checksums

- version numbers

- cursor-based synchronization

- change feeds

Incremental synchronization should be preferred.

---

# Import History

Every execution should be stored.

History includes:

- duration

- imported entities

- updated entities

- skipped entities

- warnings

- errors

- execution logs

Imports should always be auditable.

---

# Error Handling

Errors should be classified.

Examples:

Validation Error

Transformation Error

Connection Error

Authentication Error

Permission Error

Storage Error

Unknown Error

Users should understand failures.

---

# Performance

Large datasets require different strategies.

Aurii should support:

- millions of rows

- streaming

- background workers

- checkpoints

- resumable execution

- progress reporting

Scalability should be built into the design.

---

# Security

Imports may contain sensitive information.

Aurii should support:

- encrypted credentials

- secrets management

- audit logs

- permission checks

- GDPR-aware imports

Security begins before storage.

---

# Import Registry

Projects should maintain an Import Registry.

The registry contains:

- reusable imports

- schedules

- mappings

- pipelines

- execution history

- documentation

Imports become long-lived platform resources.

---

# The Long-Term Vision

Eventually, importing information into Aurii should feel less like uploading a file and more like teaching the platform about a new domain.

Every successful import expands the platform's understanding of the world.

That understanding can then be reused by APIs, AI, search, applications and future imports.

Import is not the beginning of a workflow.

Import is the beginning of knowledge.

---

# Guiding Principle

An import should never merely move data.

It should increase the platform's understanding of that data.

If an import only copies information,

we have built a loader.

If an import creates reusable knowledge,

we have built a platform.