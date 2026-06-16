---
"@iqai/mcp-debank": minor
---

Add request coalescing, an in-process GET cache, and per-call latency instrumentation to `BaseService` (#15). Three coordinated changes:

- **Coalescing**: concurrent callers for the same URL now share one underlying promise instead of firing duplicate axios requests. Critical when a guest `Promise.all`s identical lookups.
- **TTL cache**: identical lookups within `cacheDuration` skip the gateway hop entirely; emits `cache=hit` in the log. Layered on top of IQ Gateway's own cache. POSTs are never cached. Failed promises and expired entries are evicted with proper timer cleanup.
- **Instrumentation**: every upstream GET/POST emits one stderr line `[DeBank API] info: op=… route=… path=… ms=… ok=…` — enables identifying slow endpoints from real session traces.

The cache layer uses an internal `AbortController` per shared fetch (decoupled from any caller's signal) so one caller's abort cannot cascade to coalesced peers. Each caller gets a per-caller race wrapper for their own signal, preserving the standard `AbortError` contract (including `signal.reason` propagation). Logger also gates ANSI colorization on `process.stderr?.isTTY` so MCP host log files stay clean.
