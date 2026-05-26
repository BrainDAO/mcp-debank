---
"@iqai/mcp-debank": major
---

**Breaking change:** The 30 legacy `debank_*` tools (formerly behind `--legacy-tools`) are removed. Use `list_endpoints` + `get_endpoint_schema` + `invoke_endpoint` for per-endpoint access (host-side jq filtering supported), or `execute` for multi-step workflows.

New tools: `execute` (sandboxed JavaScript against a DeBank client), `search_docs` (local MiniSearch index over methods + cookbook), `debank_resolve`, `list_endpoints`, `get_endpoint_schema`, and `invoke_endpoint`.

Internals: each service exposes only `*Raw()` JSON-returning methods. `invoke_endpoint` dispatches by qualified name via the `sandboxImpl` field on each tool metadata entry. The markdown wrapper layer (`toMarkdown`) is fully removed.

**Breaking changes:**
- The 30 `debank_*` tools (chain, protocol, token, user, transaction) are no longer available. Use `invoke_endpoint` with the qualified name from `list_endpoints`.
- The `--legacy-tools` flag and `DEBANK_MCP_LEGACY` env var are removed and no longer recognized.
- `debank_get_supported_chain_list` now returns JSON, not markdown.
- The `OPENROUTER_API_KEY`, `LLM_MODEL`, and `GOOGLE_GENERATIVE_AI_API_KEY` environment variables are no longer recognized.
