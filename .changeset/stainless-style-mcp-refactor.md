---
"@iqai/mcp-debank": minor
---

**Breaking change:** 30 of the 31 legacy `debank_*` tools are now hidden by default; `debank_get_supported_chain_list` remains visible as a default grounding tool. Pass `--legacy-tools` or set `DEBANK_MCP_LEGACY=1` to restore the hidden 30.

New tools: `execute` (sandboxed JavaScript against a DeBank client), `search_docs` (local MiniSearch index over methods + cookbook), and `debank_resolve`.

Internals: each service method now exposes a public `*Raw()` JSON-returning variant; the markdown method is a thin wrapper that catches formatter failures separately.
