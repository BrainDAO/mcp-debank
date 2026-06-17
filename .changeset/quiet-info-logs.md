---
"@iqai/mcp-debank": patch
---

Quiet five info-level log statements that fired once per upstream call / cache hit / entity resolution. Default production logs are now scoped to actual signal (startup, warnings, errors); per-call diagnostic instrumentation moves to `debug`.

Demoted to `debug`:

- `[DeBank API] op=... ms=... ok=true` (every successful upstream call)
- `[DeBank API] op=... ms=... ok=false err=...` (every failed call — already covered by service-level `logger.error`)
- `[DeBank API] op=GET ... cache=hit` (every cache hit)
- `Resolved chains "X" -> "Y"` (every successful `resolveChains`)
- `Resolved wrapped token "X" -> "Y"` (every successful `resolveWrappedToken`)

`error`, `warn`, and one-shot startup `info` statements are unchanged — they remain visible by default. Set `LOG_LEVEL=debug` to restore the previous verbosity when diagnosing endpoint performance. The README's env-vars table now documents the `LOG_LEVEL` knob.
