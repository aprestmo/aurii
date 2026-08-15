# Query Language

> Every platform has a way to ask questions.
>
> SQL asks databases.
>
> GraphQL asks APIs.
>
> GROQ asks documents.
>
> Aurii Query asks knowledge.

---

# Purpose

The purpose of the Query Language is simple:

Allow applications, users and AI to retrieve exactly the information they need without understanding how that information is stored.

Queries should describe intent.

Core determines execution.

---

# Philosophy

Users should think in Entities.

Not tables.

Not joins.

Not indexes.

Not SQL.

Not storage.

Instead they should ask questions like:

> Give me every published article written by journalists working in Oslo during the last 30 days.

or

> Find municipalities with more than 100 000 inhabitants.

or

> Return every image used by this article.

The language should describe knowledge.

Not implementation.

---

# One Language

The same query language should be used by:

- REST
- Studio
- SDKs
- CLI
- AI
- Imports
- Pipelines

There should not be five different query systems.

One language.

Everywhere.

---

# Declarative

Queries describe *what* is wanted.

Core decides *how* to retrieve it.

Applications should never think about:

- indexes
- joins
- execution plans
- caches

These belong inside Core.

---

# Core Concepts

Every query is built from a few primitives.

```
Entity

Field

Relationship

Filter

Projection

Ordering

Aggregation

Traversal
```

Nothing else should be required.

---

# Reading Entities

The most basic query returns Entities.

```
Article
```

returns every Article.

```
Municipality
```

returns every Municipality.

Everything begins with an Entity type.

---

# Filtering

Filters narrow the result.

Examples:

```
status = "published"

population > 100000

country = "NO"

createdAt > yesterday
```

Filters should compose naturally.

---

# Relationships

Relationships should be traversable. Query-through-relation is part of the **foundation**, not a CMS extra.

The language should eventually support:

- filter/sort on referenced fields
- reverse references (e.g. articles that reference this company)
- one-to-many and many-to-many as schema cardinality allows

Implemented today: Query Language v1 joins (see [`Query-Language-v1.md`](Query-Language-v1.md)). Dot-notation traversal remains visionary (ADR-0004). Reverse references are planned, not a new query engine.

Example:

```
Article

↓

Author

↓

Organization
```

Queries should navigate naturally.

```
article.author.organization.name
```

without developers writing joins.

---

# Projection

Applications rarely need complete Entities.

Projection selects fields.

Example:

```
title

slug

publishedAt
```

Only requested information should be returned.

---

# Ordering

Results should be sortable.

Examples:

```
publishedAt desc

population asc

title asc
```

Ordering belongs in the query.

---

# Pagination

Large result sets should always support pagination.

Core should support multiple strategies:

- offset

- cursor

- keyset

Applications choose.

Core executes.

---

# Aggregation

Queries should summarize knowledge.

Examples:

```
Count

Average

Sum

Minimum

Maximum
```

Aggregation should compose with filtering.

---

# Search

Search and Query are different.

Search answers:

> What is relevant?

Query answers:

> What matches?

Both are important.

Neither replaces the other.

---

# Computed Fields

Schemas may define computed values.

Queries should retrieve them exactly like ordinary fields.

Applications should not need to know the difference.

---

# AI

AI should generate queries.

Users should ask:

> Show me municipalities in Northern Norway with declining population.

AI translates intent into Query Language.

Core executes.

Applications receive structured results.

---

# Stability

Queries should survive storage changes.

Changing database technology should not require rewriting applications.

Applications depend on the language.

Core depends on storage.

---

# APIs

REST should expose the Query Language.

SDKs should expose the Query Language.

Studio should use the Query Language.

AI should generate the Query Language.

Everything converges on one abstraction.

---

# Security

Permission checks happen inside Core.

Queries never bypass authorization.

Unauthorized information should never appear in results.

Security is part of execution.

Not application code.

---

# Optimization

Developers write readable queries.

Core optimizes execution.

Examples include:

- indexes
- caching
- batching
- prefetching
- execution planning

Optimization should remain invisible.

---

# Future

The Query Language should evolve without breaking applications.

New capabilities should extend the language rather than replacing it.

Backward compatibility should be a priority.

---

# Guiding Principle

Applications should ask questions about knowledge.

Core should answer them.

Everything else is implementation.