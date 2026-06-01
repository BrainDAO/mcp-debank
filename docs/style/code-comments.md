# Code comments

Three locations, three rules. Apply consistently.

## Locations

| Location | Style | Example |
|---|---|---|
| File header (very top, before imports) | `//` line comments | see below |
| Single-line comment anywhere | `//` | `// Skip the gateway path when token cache is warm.` |
| Multi-line narrative anywhere else | `/** ... */` | function/type docstring, inline explanatory block, comment above a const |

**Single-line `//` comments are always fine** — even inside a function body, even right before a multi-line `/** */` block. The rule above is about *multi-line* blocks (two or more consecutive comment lines).

## File header

Use line comments. Format: path + blank line + prose.

```ts
// src/mcp/execute/sandbox.ts
//
// Owns isolated-vm lifecycle, lazy load (cached), and the three-layer timeout
// policy (script timeout + outer Promise.race + per-call host timeout).
//
// MUST NOT be imported statically from anywhere reachable from server
// startup. Loaded dynamically by execute/tool.ts on first execute call.

import dedent from "dedent";
// ...
```

## Multi-line narrative (function docstring, inline explanation, type doc)

Use `/** */`. No JSDoc tags — we don't have a TypeDoc consumer, just write prose.

```ts
/**
 * Lazily resolves an instance method on one of the five service singletons
 * and returns it bound to that singleton. The generic constraints make
 * typos in either argument a compile error.
 */
function lazyMethod<K extends ServiceKey, M extends keyof Services[K]>(
	serviceKey: K,
	methodKey: M,
) {
	// ...
}
```

```ts
async function main() {
	// ... preamble ...

	/**
	 * JSON.stringify produces double-quoted keys and no trailing commas;
	 * Biome's `format --write` post-pass (below) unquotes identifier keys
	 * (`quoteProperties: "asNeeded"` default) and adds trailing commas
	 * (`trailingCommas: "all"` default), producing idiomatic TypeScript.
	 */
	const out = `// AUTO-GENERATED ...`;
}
```

## What to write

- **Write WHY, not WHAT.** Identifiers describe what the code does. Comments explain why a non-obvious choice was made — a hidden constraint, a subtle invariant, a workaround for a specific bug, behavior that would surprise a reader.
- **Don't reference the current task/PR/commit.** Those rot. The PR description and `git log` are where that information belongs.
- **Don't write headers for the sake of headers.** A 4-line file that's obvious from its name doesn't need a header.

## What NOT to do

- **No JSDoc tags** (`@param`, `@returns`, `@throws`). They imply tooling extraction we don't do. Prose is clearer.
- **No `@deprecated` placeholders or `// removed in vN` comments.** If something is unused, delete it. Git history is the record.
- **No "TODO" or "FIXME" comments without a tracked issue.** They're load-bearing only when something will actually pick them up.
- **No `// eslint-disable` / `// biome-ignore` without a one-line reason.** If a lint suppression is unavoidable, the line above explains *why*.

## Why this convention

`/** */` is the canonical JSDoc/TSDoc form — TypeScript tooling, IDE hovers, and most TS code in the wild expect it for tooling-extractable docs. We keep `//` for **narrative** content (file headers, single-line explanations) so it's visually distinct from `/** */` **structural** content (function/type docs, multi-line inline rationale).

A file ends up looking like:

```ts
// src/foo/bar.ts                                  ← file header (//)
//
// One-paragraph summary of what this module owns.

import { ... } from "...";

const CONSTANT = 42;  // single-line note (//)

/**                                                ← multi-line narrative (/** */)
 * Reason this function exists. The non-obvious
 * thing about its behavior.
 */
export function foo(x: number): number {
	// Single-line note inside the body is fine.
	if (x < 0) {
		/**
		 * Multi-line note inside a function body uses
		 * /** */ — same as docstrings.
		 */
		return -x * CONSTANT;
	}
	return x * CONSTANT;
}
```

## Enforcement

There is no linter rule for this — it's a discipline. Biome enforces *formatting* of whichever style is present but doesn't choose between `//` and `/** */`. PR review and grep-friendly conventions are the gate.

To audit the current state at any time:

```sh
# Find multi-line // blocks outside file headers (manual review needed)
for f in $(git ls-files '*.ts' '*.tsx' | grep -v generated); do
  awk -v file="$f" '
    BEGIN { in_header = 1; block_start = 0; block_lines = 0 }
    /^[[:space:]]*\/\// {
      if (in_header) next
      if (block_lines == 0) block_start = NR
      block_lines++
      next
    }
    {
      if (in_header && !/^[[:space:]]*\/\// && !/^[[:space:]]*$/) in_header = 0
      if (block_lines >= 2) print file ":" block_start "-" (NR-1) " (" block_lines " lines)"
      block_lines = 0
    }
  ' "$f"
done
```

Should produce zero output. If it doesn't, the listed blocks are either legitimate file headers (false positive — refine the awk if you care) or multi-line `//` blocks that should be converted to `/** */`.
