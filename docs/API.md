# API

> The API is the public surface of Aurii.
>
> It is not an integration layer.
> It is the platform.

---

# Purpose

Everything Core can do should be accessible through APIs.

Applications should never require privileged internal access.

Studio is built using the same APIs available to every developer.

The API is not an afterthought.

The API is one of the primary products of Aurii.

---

# Philosophy

Applications should consume capabilities.

Not databases.

Not tables.

Not storage.

Everything passes through Core.

```
Application

↓

API

↓

Core Runtime

↓

Storage
```

Applications never communicate directly with PostgreSQL.

---

# API First

Aurii is API First.

Every feature added to Core should first answer:

How is this exposed through the API?

If there is no answer,

the feature is incomplete.

---

# One API Surface

Aurii should expose one conceptual API.

Different protocols may exist:

- REST
- Realtime
- Webhooks
- Streaming
- SDKs

But they should all expose the same platform capabilities.

There should never be competing APIs.

---

# Resources

The API exposes resources.

Primary resources include:

- Entities
- Schemas
- Projects
- Organizations
- Imports
- Pipelines
- Connectors
- Assets
- Users
- Roles
- Events

Everything else derives from these.

---

# Projects API (implemented)

Projects are the administrative top-level boundary. Full contract: [`PROJECTS.md`](PROJECTS.md).

Base path: `/api/projects` (served by `@aurii/api`).

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/projects` | Create (`201`) |
| GET | `/api/projects` | List; optional `?status=`; default returns all statuses |
| GET | `/api/projects/:id` | By UUID |
| GET | `/api/projects/by-slug/:slug` | By slug (separate from UUID lookup) |
| PATCH | `/api/projects/:id` | Update name, slug, description |
| PATCH | `/api/projects/:id/status` | Body `{ "status": "inactive" }` |
| POST | `/api/projects/:id/archive` | Explicit archive |

Success: `{ "data": { …project } }`.  
Error: `{ "error": { "code": "PROJECT_…", "message": "…" } }`.

No permanent delete endpoint.

---

# REST

REST is the primary transport.

Examples:

```
GET

POST

PATCH

DELETE
```

REST should remain predictable.

Resources should behave consistently.

---

# Entity API

Every Entity should expose standard operations.

```
Create

Read

Update

Delete

Query

Publish

Archive

Restore
```

Capabilities depend on the Schema.

Not on hardcoded endpoints.

---

# Schema API

Schemas are resources.

Schemas can be:

- created
- versioned
- validated
- documented
- published

Schema evolution should happen through APIs.

---

# Import API

Imports should expose:

- create

- execute

- preview

- validate

- schedule

- history

Imports become programmable.

---

# Query API

The Query Language is exposed through APIs.

Applications submit queries.

Core returns Entities.

Storage remains invisible.

## Endpoints (Phase 3)

```
GET /query?q=<query>&dataset=<id>
GET /query?q=<query>&dataset=<id>&explain=true
GET /query/explain?q=<query>
```

Response includes `entities`, `count`, and optionally `aggregate`, `plan`, and `explain` (steps + estimated schemas).

See `docs/Query-Language-v1.md` for syntax.

Public, unauthenticated frontend delivery uses **published routes**, not `/query`. See [`DELIVERY.md`](DELIVERY.md).

---

# Search API

Search is separate.

Examples:

```
Search

Autocomplete

Suggestions

Facets
```

Search answers relevance.

Query answers structure.

---

# Asset API

Assets expose:

- upload
- metadata
- variants
- transformations
- downloads

Storage providers remain abstracted.

---

# Event API

Events should be observable.

Applications may subscribe.

Examples:

```
EntityCreated

EntityUpdated

ImportCompleted

PipelineFinished
```

Events should be immutable.

---

# Realtime

Aurii should support realtime subscriptions.

Examples:

```
Document Updated

Import Finished

Asset Processed
```

Applications should react immediately.

---

# Webhooks

Projects may register webhooks.

Examples:

```
Entity Published

Import Completed

Pipeline Failed
```

Webhooks integrate Aurii with external systems.

---

# Authentication

Authentication is separate from business logic.

Supported providers may include:

- Entra ID
- OAuth
- OpenID Connect
- Local Accounts

Core consumes identities.

Applications never manage authentication themselves.

---

# Authorization

Authorization belongs inside Core.

Permissions are evaluated before data leaves the platform.

Applications receive only authorized information.

---

# Versioning

APIs evolve.

Breaking changes should be versioned.

Applications should migrate intentionally.

Backward compatibility should be preferred.

---

# SDKs

SDKs are generated.

Developers should not handwrite repetitive client code.

Examples:

TypeScript

Go

Python

Rust

C#

Future SDKs should all derive from the same API specification.

---

# OpenAPI

REST APIs should generate OpenAPI automatically.

OpenAPI becomes the contract.

Documentation derives from the contract.

SDKs derive from the contract.

Testing derives from the contract.

---

# Documentation

Every endpoint should document:

- purpose
- permissions
- examples
- schemas
- responses
- errors

Documentation should be generated whenever possible.

---

# Errors

Errors should be predictable.

Examples:

Validation Error

Permission Denied

Conflict

Not Found

Rate Limited

Internal Error

Errors are part of the API.

They deserve as much consistency as successful responses.

---

# Pagination

Collections should support:

- cursor pagination
- offset pagination
- keyset pagination

Large datasets should never require loading everything.

**Current beta (honest):** `GET /entities` and Query Language use offset/`limit`. Published routes use a single declarative `limit` on the route definition — no cursor or page query parameters. See [`DELIVERY.md`](DELIVERY.md).

---

# Performance

APIs should encourage efficient requests.

Examples:

- projections

- filtering

- batching

- streaming

- compression

Performance belongs inside Core.

Applications should remain simple.

---

# Security

Every request should be authenticated unless explicitly public.

Every resource should perform authorization.

Audit logging should be automatic.

Sensitive data should never leak.

---

# API Generation

The API should emerge from:

Schema Language

+

Core Runtime

+

Query Language

Developers describe the domain.

Aurii builds the API.

---

# Guiding Principle

Applications should think:

"I want this information."

Never:

"I wonder how this database works."

The API exists to remove implementation knowledge from applications.