# Constitution

> The Constitution defines the fundamental principles that govern Aurii.
>
> These principles are intended to remain stable over the lifetime of the project.
> Technologies may change.
> Implementations may change.
> The Constitution should not.

---

# Article 1 — Purpose

Aurii exists to provide a general-purpose platform for structured content and data.

Aurii is not designed around websites.

Aurii is designed around information.

The platform should enable organizations to model, manage, enrich and distribute information independently of how that information is ultimately consumed.

Every architectural decision should reinforce this purpose.

---

# Article 2 — Core Before Clients

Core is the product.

Every other application—including Studio—is a client of Core.

Core must never depend on Studio.

Studio may depend on Core.

This dependency direction must never be reversed.

---

# Article 3 — Information Before Presentation

Presentation is temporary.

Information is permanent.

Aurii shall never model data around a specific frontend.

Instead, frontends shall adapt to the data model.

The same information should be reusable across:

- websites
- mobile applications
- APIs
- AI systems
- print
- internal tools
- future consumers

without duplication.

---

# Article 4 — Schema First

Every dataset shall be described by a schema.

Schemas define:

- structure
- validation
- relationships
- metadata
- permissions
- editing behaviour
- API contracts
- indexing
- search
- AI context

Schemas are first-class resources.

No production data should exist without an associated schema.

---

# Article 5 — API First

Everything Core can do shall be available through public APIs.

The Studio must consume those same APIs.

Private APIs should only exist where required for infrastructure or security.

If functionality cannot be exposed through an API, it should be reconsidered.

---

# Article 6 — AI First

Artificial Intelligence is a native capability.

AI should assist users in:

- modelling
- importing
- validating
- searching
- transforming
- documenting
- querying
- automation

AI must remain explainable.

Users should always understand why suggestions were made.

Important decisions must remain reviewable.

---

# Article 7 — Import Is A Product

Import is not a utility.

Import is one of the platform's primary capabilities.

Aurii shall support structured and unstructured sources including, but not limited to:

- files
- databases
- APIs
- cloud storage
- spreadsheets
- Git repositories
- AI extracted documents

Every import should support:

- analysis
- preview
- validation
- mapping
- transformation
- repeatability
- auditing
- scheduling
- monitoring

Imports shall be reusable resources.

---

# Article 8 — Data Ownership

Users own their information.

Aurii should never intentionally create vendor lock-in.

Data should always remain exportable.

Schemas should remain portable.

APIs should remain documented.

Migration away from Aurii should always be possible.

Trust is earned through openness.

---

# Article 9 — Open Standards

Whenever practical, Aurii should prefer open standards.

Examples include:

- HTTP
- JSON
- OpenAPI
- OAuth
- OpenID Connect
- PostgreSQL
- S3
- Markdown
- RSS
- XML

Closed or proprietary formats should only be adopted when they clearly provide significant value.

---

# Article 10 — Composability

Aurii shall be composed of independent engines.

Each engine should have one primary responsibility.

Examples include:

- Schema Engine
- Dataset Engine
- Import Engine
- Connector Engine
- Pipeline Engine
- Query Engine
- Asset Engine
- Event Engine
- API Engine

No engine should become responsible for unrelated concerns.

---

# Article 11 — Reusability

Generic solutions shall always be preferred over application-specific solutions.

When implementing a feature, developers should ask:

"Can this solve a broader class of problems?"

If yes, prefer the generalized design.

---

# Article 12 — Configuration Over Code

Whenever practical, behaviour should be expressed through:

- schemas
- metadata
- configuration
- plugins

rather than hardcoded logic.

This allows systems to evolve without requiring code changes.

---

# Article 13 — Extensibility

Aurii should assume it will be extended.

Every major subsystem should expose extension points.

Customization should happen through well-defined interfaces.

Forking should rarely be necessary.

---

# Article 14 — Event Driven

Important changes should produce events.

Examples include:

- document created
- document updated
- asset uploaded
- import completed
- pipeline finished
- schema changed

Events allow automation, integrations and observability.

---

# Article 15 — Security By Default

Security is not optional.

Every feature should be designed with:

- authentication
- authorization
- least privilege
- encryption
- audit logging
- secure defaults

Permissions should be explicit.

Implicit permissions should be avoided.

---

# Article 16 — GDPR By Design

Aurii shall prioritize compliance with European privacy legislation.

Developers should consider:

- personal data
- retention
- deletion
- consent
- auditing
- data minimization

from the beginning of every feature.

---

# Article 17 — Performance Matters

Aurii should scale from small personal projects to enterprise deployments.

Large datasets should be handled through:

- streaming
- batching
- pagination
- background jobs
- asynchronous processing

Architectural shortcuts that prevent future scalability should be avoided.

---

# Article 18 — Technology Is Replaceable

The current implementation uses technologies such as:

- Bun
- Elysia
- PostgreSQL
- Astro

These are implementation choices.

They are not constitutional principles.

Technology may evolve.

The principles shall remain.

---

# Article 19 — Documentation Is Architecture

Documentation is not an afterthought.

The specification defines the intended architecture.

Implementation should follow the specification.

Significant architectural changes should first update the specification.

Code should not become the primary source of truth.

---

# Article 20 — Long-Term Thinking

Every architectural decision should consider the long-term evolution of the platform.

Developers should optimize for:

- maintainability
- simplicity
- extensibility
- consistency

rather than short-term convenience.

---

# Article 21 — Specifications Are Not Proof

A specification is a hypothesis.

It defines intent.

It does not prove that the design works.

Only runnable code executed against real data constitutes validation.

Aurii shall not treat a well-written specification as evidence of a working system.

The measure of progress is not the quality of documentation.

The measure of progress is what the system can do.

---

# Article 22 — Vertical Before Horizontal

Aurii shall not attempt to become complete before it has proven that one narrow vertical works end to end.

The first vertical is import.

Aurii must be able to:

- accept a real external dataset
- map it declaratively to an Entity model
- validate it against a Schema
- store it
- expose it through a Query

Until this works in production, no new horizontal capabilities shall take priority.

This is not a limitation.

This is the foundation.

---

# Final Principle

Whenever uncertainty exists, ask one question:

> Does this decision make Aurii a better platform for structured information?

If the answer is yes,

continue.

If the answer is no,

reconsider the design.

This principle supersedes individual implementation preferences.