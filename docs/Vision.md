# Vision

> We believe the future is built on structured information.

---

# Why Aurii Exists

Software has changed.

Content has changed.

Data has changed.

But most content management systems have not.

The majority of today's CMS platforms were designed around one assumption:

> The primary product is a website.

That assumption no longer holds true.

Organizations today publish to websites, mobile applications, digital signage, AI assistants, newsletters, APIs, print products, internal systems, social media, partner integrations and platforms that do not yet exist.

The website has become one consumer among many.

Information—not presentation—is now the primary asset.

Aurii exists because we believe software should reflect that reality.

---

# Information Is The Product

Traditional systems treat structured information as something that supports a website.

Aurii treats the information itself as the product.

Presentation becomes a separate concern.

Instead of asking:

> "How do we publish this page?"

Aurii asks:

> "How should this information be modeled?"

That single difference changes everything.

---

# A Platform, Not A CMS

Aurii should never become "just another CMS."

Instead, it should become a general platform for **modeling, ingesting, editing, enriching, relating, and publishing** structured data and editorial content.

**Aurii Core is not a CMS.** Studio is a customizable client on the same Core model. Products may still add an optional authoring workspace and deliver classic CMS experiences (blogs, docs, news) while frontends consume Core through APIs. See [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md) and [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

The same Core should support:

- publication CMS
- Kampbart-style operational tools
- playground / place directories
- company and financial datasets (Gaselle)
- Geo datasets
- LiveCenter
- documentation
- other structured-data applications

without each product requiring its own backend architecture.

A platform where organizations can model their knowledge, data and workflows without being constrained by predefined content types or publishing assumptions.

---

# One Source Of Truth

Information should exist once.

Not copied between systems.

Not synchronized between databases.

Not duplicated for every frontend.

Aurii should provide a single canonical representation of information.

Every application should consume the same data through APIs.

```
           Data

             │

        Aurii Core

      /      |      \

 Website  Mobile  Print

        AI      APIs

        Internal Apps
```

Every consumer should see the same truth.

---

# Schema Defines Reality

Schemas are more than validation.

Schemas define meaning.

They describe:

- structure
- relationships
- business rules
- permissions
- searchability
- API contracts
- editing experiences
- AI understanding

Schemas become the language of the platform.

The schema is not implementation detail.

The schema is architecture.

---

# APIs Are Products

Every dataset should automatically become an API.

Developers should never have to manually expose data unless they choose to.

APIs are not integrations.

They are products.

Well-designed APIs allow ecosystems to grow around the platform.

---

# AI Is A Native Capability

Artificial intelligence should never be bolted onto Aurii afterwards.

It should be part of the architecture from the beginning.

AI should help users:

- understand data
- model schemas
- detect relationships
- validate information
- enrich datasets
- transform imports
- discover inconsistencies
- build queries
- automate repetitive work

AI should assist.

Never replace.

The human remains responsible for decisions.

---

# Content Lake

At the heart of Aurii is the Content Lake.

Unlike traditional databases designed around individual applications, the Content Lake is designed around reusable knowledge.

Every piece of information should be available to multiple consumers.

The same dataset may power:

- websites
- print
- APIs
- analytics
- AI systems
- exports
- search
- dashboards

without duplication.

---

# Import Is A First-Class Feature

Most systems consider import a utility.

Aurii considers import a product.

Organizations already possess enormous amounts of valuable information.

The challenge is rarely creating content.

The challenge is understanding, cleaning and integrating existing data.

Aurii should excel at:

- importing
- validating
- transforming
- enriching
- versioning
- synchronizing

data from almost any source.

---

# Build Once, Use Everywhere

Every model should be reusable.

Every schema reusable.

Every API reusable.

Every connector reusable.

Every pipeline reusable.

Nothing should exist only because one application happens to need it.

Generic solutions always outlive specialized ones.

---

# Open Architecture

Aurii should embrace open standards wherever practical.

The platform should never intentionally create lock-in.

Developers should own:

- their infrastructure
- their database
- their assets
- their APIs
- their data

Migration away from Aurii should always be possible.

Trust comes from openness.

---

# Designed For Growth

Aurii should scale across dimensions.

From:

one developer

to

large engineering organizations.

From:

one dataset

to

billions of records.

From:

one website

to

hundreds of products.

Architecture should not assume today's scale.

---

# Built Around Engines

Aurii is not one application.

It is a collection of engines.

Examples include:

- Core Engine
- Schema Engine
- Dataset Engine
- Import Engine
- Connector Engine
- Pipeline Engine
- Query Engine
- API Engine
- Asset Engine
- Event Engine
- Search Engine
- AI Engine

Each engine has one responsibility.

Together they become the platform.

---

# Studio Is A Client

The editing interface is important.

But it is not the product.

Studio consumes the same APIs available to everyone else.

Generated UI is the default. Domain-specific tools (match desks, maps, dense tables) are extensions—not Core features.

Nothing inside Studio should require privileged access unavailable to external developers.

If Studio can do something, another application should be able to do it as well.

Core must work without Studio.

---

# Developer Experience Matters

Power should never require complexity.

Simple tasks should feel simple.

Advanced tasks should remain possible.

The platform should reward understanding rather than memorization.

Developers should spend their time solving business problems—not fighting the framework.

---

# Security And Ownership

Organizations should control their own information.

Aurii should prioritize:

- self-hosting
- European infrastructure
- GDPR compliance
- transparent permissions
- audit logging
- secure defaults

Data ownership should never be ambiguous.

---

# The Long-Term Vision

Aurii is not trying to replace one CMS.

Aurii is trying to redefine what content infrastructure looks like.

We envision a future where organizations no longer build separate systems for CMS, APIs, public datasets, documentation, search, AI knowledge bases and print workflows.

Instead, they build upon one shared platform.

One shared model.

One shared source of truth.

Aurii should become that platform.

---

# Our Guiding Principle

Everything we build should answer one question:

> Does this make Aurii a better platform for structured information—data and content on one Core?

If the answer is yes,

it belongs.

If the answer is no,

it probably belongs somewhere else.

Architecture fitness tests: [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md).