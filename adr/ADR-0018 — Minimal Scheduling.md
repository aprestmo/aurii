ADR-0018 — Minimal Scheduling

Status: Accepted
Date: 2026-08-01
Decision Makers: Aurii Project
Related: ADR-0015, ADR-0014

⸻

Context

Data products need periodic sync (e.g. nightly Bring postal-code refresh). Phase 4 listed scheduled HTTP imports as stretch. For project-oriented Studio beta, a **minimal, explicit** scheduling layer is required — not a distributed job platform.

⸻

Decision

1. **Cron schedule on saved import/sync definitions:**

```ts
schedule: {
  type: "cron",
  expression: "0 4 * * *",
  timezone: "Europe/Oslo",
}
```

2. **Single-process scheduler** co-located with the API server. Evaluates due jobs on an interval; computes `nextRunAt`.

3. **Guarantees for beta:**
   * enable / disable
   * no overlapping concurrent runs for the same definition
   * failures logged on the run record + DataSource lastError
   * secrets never leave the server
   * uses existing import / pipeline engine

4. **Non-guarantees (documented limits):**
   * no multi-node leader election
   * no durable distributed queue
   * no exactly-once across process crashes (at-least-once best effort after restart)
   * webhook triggers may be stubbed as trigger mode without full HTTP ingress

⸻

Consequences

Positive

* Unblocks Studio sync UI and Norwegian Geo demo schedule (disabled by default)
* Reuses import engine and run history

Tradeoffs

* Operators needing HA schedulers must run an external cron that calls `import:run` until a later phase

Non-goals

* Kubernetes CronJob controller
* Temporal / queue backends
* Cross-region failover
