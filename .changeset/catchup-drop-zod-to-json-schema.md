---
"@iqai/mcp-debank": patch
---

Drop the unused `zod-to-json-schema` devDependency (#14). The codebase migrated to Zod v4's native `z.toJSONSchema()` API; the legacy package had zero references in `src/`, `scripts/`, or `tests/`. Remains in the lockfile as a transitive of `xsschema` (pulled in by `@iqai/adk`), which is unchanged.
