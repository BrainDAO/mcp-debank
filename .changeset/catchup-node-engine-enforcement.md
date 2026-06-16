---
"@iqai/mcp-debank": patch
---

Enforce the Node engine version at process startup (#13). MCP hosts (Claude Desktop, etc.) often spawn `node` from a non-interactive shell that picks whichever Node sits first on PATH — frequently an old nvm default. On Node < 20, `undici` v7 crashes during module evaluation with an opaque `ReferenceError: File is not defined`, leaving operators to debug a cryptic stack trace.

The bin entry is now a thin shim (`src/index.ts`) that checks `process.versions.node` against the required major **before** any static import of `fastmcp`/`undici` runs. On older Node, it emits a clear `[debank-mcp] Node v… is too old — set the "command" field to an absolute path to a Node 22+ binary` diagnostic and exits with code 1. Bootstrap is dynamic-imported only after the version gate passes.
