# AI

> **Status: architectural vision / not an implemented platform surface.**
>
> This document describes possible future direction. It does **not** imply that AI is available in every Studio or product surface today.
>
> AI is a **consumer of Core contracts** (ADR-0007). AI does **not** define Core architecture.
> Context must work deterministically without AI ([`Phase5.md`](../Phase5.md)).
> AI provider infrastructure should not enter Core without product evidence.
> MCP is an integration option/hypothesis, not a mandatory platform architecture.
>
> Related: [`COMPETITIVE_GUARDRAILS.md`](COMPETITIVE_GUARDRAILS.md), [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md), [ADR-0007](../adr/ADR-0007%20—%20AI-Native%20Platform.md).

> Artificial Intelligence is a first-class **consumer** of Aurii.
>
> AI is not a substitute for the Runtime.
> AI is not a required product surface.
> Optional assistance layers must help users and applications understand, create and transform structured knowledge **through the same APIs, schemas, queries, and permissions as other clients**.
>
> AI never replaces the Runtime.
>
> AI augments the Runtime — when a product chooses to enable it.

---

# Purpose

Modern software should not merely store information.

It should understand it.

Aurii may integrate AI as a client of the platform so that Entities, Schemas, Queries and Pipelines can benefit from intelligent assistance — without making AI a Core architectural dependency.

The purpose of AI is to reduce complexity for humans without sacrificing transparency or control.

---

# Philosophy

AI should never become another application that bypasses Aurii.

Instead, AI **may** assist across surfaces over time — when products enable it.

Examples of surfaces that *could* benefit (visionary; not shipped as a platform guarantee):

- while defining Schemas
- while importing data
- while writing Queries
- while building Pipelines
- while editing Entities
- while searching
- while generating documentation
- while building APIs

AI assistance is **not** a separate Aurii product boundary (Editorial / Research remain products).
Surfaces that require deterministic behaviour (for example Context MVP) must ship without depending on AI.

---

# AI Principles

Every AI capability must follow five principles.

## Assist

AI assists.

Humans decide.

---

## Explain

AI explains why it reached a conclusion.

Reasoning should be inspectable whenever practical.

---

## Review

Users can review every meaningful suggestion.

Nothing important should happen silently.

---

## Learn

AI should learn from the project's Schemas and knowledge model.

Not from hidden implementation details.

---

## Respect Permissions

AI should never gain access to information that the requesting user cannot access.

Permission checks always happen before AI receives context.

---

# AI Is A Consumer Of Runtime

AI never bypasses Core.

Instead:

```
User

↓

AI

↓

Runtime

↓

Query Language

↓

Entities

↓

Result
```

The Runtime remains authoritative.

---

# Knowledge

AI reasons about knowledge.

Knowledge consists of:

- Entities
- Schemas
- Relationships
- Metadata
- History
- Capabilities

This gives AI a structured understanding of the platform.

---

# AI Context

Context should come from the platform itself.

Examples include:

- Schema descriptions
- Field documentation
- Entity relationships
- Capability definitions
- Query history
- Project documentation

Developers should not manually recreate context that already exists in Aurii.

---

# AI Capabilities

Examples include:

## Schema Design

AI may:

- propose Schemas
- suggest field types
- detect relationships
- identify validation rules

---

## Entity Creation

AI may:

- extract structured information
- classify content
- populate metadata
- generate summaries
- suggest tags

---

## Import Assistance

AI may:

- detect formats
- infer mappings
- recognize duplicate data
- identify encoding problems
- recommend transformations

---

## Query Assistance

Users should be able to ask:

> Show every municipality with declining population since 2020.

AI converts intent into Query Language.

---

## Pipeline Assistance

AI may:

- suggest workflow steps
- optimize Pipelines
- detect unnecessary transformations
- recommend reusable components

---

## Documentation

AI should generate:

- documentation
- examples
- migration guides
- API descriptions

Documentation should remain editable by humans.

---

## Search

AI complements traditional search.

Instead of keyword matching only,

users should also search semantically.

Example:

> Find municipalities similar to Oslo in population growth.

---

# AI Providers

Aurii should never depend on a single AI vendor.

Providers should be pluggable.

Examples:

- OpenAI
- Anthropic
- Google Gemini
- Mistral
- Ollama
- Local models

The Runtime communicates through provider interfaces.

---

# Models

Different tasks require different models.

Examples:

- reasoning
- summarization
- embeddings
- translation
- OCR
- speech recognition

The Runtime chooses or allows configuration.

Applications should not depend on model names.

---

# Embeddings

Embeddings are derived data.

They are never the canonical representation.

Canonical knowledge always remains:

- Entities
- Schemas
- Relationships

Embeddings may be regenerated at any time.

---

# Retrieval

AI should retrieve context through Query Language.

Never by scanning the database directly.

Benefits include:

- permissions
- consistency
- version awareness
- structured knowledge

---

# Agents

Agents are specialized consumers of Runtime.

Examples:

- Documentation Agent
- Import Agent
- Schema Agent
- Migration Agent
- QA Agent
- Editorial Agent

Agents differ by responsibilities.

Not by architecture.

---

# MCP

Aurii should integrate naturally with the Model Context Protocol (MCP).

Aurii may expose:

- Query tools
- Entity tools
- Schema tools
- Import tools
- Pipeline tools

Aurii may also consume external MCP servers.

Examples:

- GitHub
- PostgreSQL
- Penpot
- Figma
- Slack

MCP should become the preferred integration model for AI.

---

# Memory

AI should distinguish between:

- project knowledge
- user context
- conversation history
- platform knowledge

These are different concerns.

They should not be mixed implicitly.

---

# Human Approval

Operations that modify the platform should require approval unless explicitly configured otherwise.

Examples:

- Schema changes
- Entity deletion
- Imports
- Pipeline execution
- Publishing

AI may prepare.

Humans approve.

---

# Observability

Every AI operation should record:

- provider
- model
- prompt
- retrieved context
- execution time
- cost
- output

Projects should understand how AI reaches conclusions.

---

# Security

AI inherits Runtime permissions.

AI never receives:

- hidden Entities
- private Schemas
- restricted Assets

Security always precedes intelligence.

---

# Future

> **Status: visionary.**

The long-term vision is not an AI chatbot.

The vision is a platform where AI can assist as a first-class client.

Every capability of Aurii *may eventually* be understandable, discoverable and executable through AI — as a client of Core, not as Core itself.

Eventually, developers may build applications by describing intent rather than implementation.

The Runtime remains deterministic.

AI becomes *an* interface — not the only interface, and not the architecture Context depends on.

AI must inherit authorization **before** retrieval. Never retrieve everything and filter unauthorized results afterwards.

---

# Guiding Principle

AI should increase understanding.

Never reduce transparency.

If users trust the Runtime,

they should also trust every AI capability built upon it.