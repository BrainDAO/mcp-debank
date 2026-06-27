# Deterministic token balance across chains

Driven by IQAIcom/aiden#105 (DeBank multichain token disambiguation). This is
the `@iqai/mcp-debank` side of the fix; a small aiden wiring change + version
bump follows.

## Problem

In aiden, a query like "balance of \<token\> in wallet 0x…" routes to the DeBank
agent (code mode), which writes guest JS for the `execute` tool. Live runs on
`gpt-4.1-mini` showed the guest code intermittently mishandles the per-chain
balance — it re-divides the already-decimal-adjusted `amount` by `10**decimals`
(→ ~`3e-14` values) or reads a null/empty field (→ "balance not available").
Roughly 1-in-3 to 1-in-5 runs glitch. The DeBank API returns correct data every
time (the successful runs prove it); the error is purely in LLM-authored
arithmetic. Instruction wording (tried in aiden) does not reliably fix a
probabilistic code-gen error.

## Goal

Move the balance computation off the LLM and into deterministic package code,
**without adding a new MCP tool** — the code-mode surface stays `execute` +
`search_docs`. Follow the package's existing host-side-aggregate pattern
(`getUserTokensAcrossChains`): a deterministic method exposed to guest code via
a `TOOL_METADATA` entry and documented through `search_docs`. The guest's job
shrinks to a single call with no arithmetic.

## Design

### New host-side aggregate: `UserService.getTokenBalanceAcrossChainsRaw`

Signature: `{ id: string; token: string; chain?: string; min_usd_value?: number; is_all?: boolean } -> TokenBalanceAcrossChains`

Algorithm:
1. `holdings = this.getUserTokensAcrossChainsRaw({ id, min_usd_value, is_all })`
   — the existing all-chain aggregator (fan-out, dust filter, abort-aware,
   per-chain `.catch`). Reused as-is.
2. If `chain` is provided, resolve it (`resolveChain`) and keep only holdings on
   that chain.
3. Match: keep holdings whose normalized `name` **or** `symbol` equals the
   normalized `token` (see matcher below).
4. For each match, read the **human `amount`** field directly (already
   decimal-adjusted) and `usd = amount * price`. No `10**decimals` math.
5. Return structured data:
   ```ts
   {
     wallet: string;
     token: string;                 // the user's reference, echoed
     matches: Array<{ chain: string; name: string; symbol: string; amount: number | null; price: number; usd: number }>;
     total: number;                 // Σ amount over matches with a finite amount (nulls excluded)
     total_usd: number;             // Σ usd over the same
     mixed_representations: boolean; // distinct match names > 1
     chains: string[];              // chains a match was found on
   }
   ```
   Empty match set → `matches: []`, `total: 0`, `chains: []` (caller renders
   "wallet holds no \<token\>").

### Pure matcher (own module, unit-tested)

`matchesTokenReference(reference: string, holding: { name: string; symbol: string }): boolean`
Normalization (applied to the reference and to each of name/symbol):
- trim, lower-case,
- drop a **trailing** generic descriptor word (`token`/`coin`) **unless it is
  the only word** (so a token literally named "Coin" is preserved),
then **exact** equality (never substring). A reference matches a holding if the
normalized reference equals the holding's normalized name OR normalized symbol.

### TOOL_METADATA entry (exposes to guest + search_docs)

Add to `src/mcp/legacy/tool-metadata.ts`, mirroring the `getUserTokensAcrossChains`
entry:
- `qualified: "debank.user.getTokenBalanceAcrossChains"`
- `sandboxImpl: lazyMethod("userService", "getTokenBalanceAcrossChainsRaw")`
- `parameters`: zod for `{ id, token, chain?, min_usd_value?, is_all? }`
- `responseSchema`: the structured shape above
- `description` + `exampleCall`: teach the agent to use this for "balance of a
  named token at a wallet" (so discovery, not aiden instruction text, does the
  teaching — consistent with the lean-on-discovery convention)
- `timeoutMs: 30_000` (same as the aggregate it builds on)

This makes `debank.user.getTokenBalanceAcrossChains({ id, token })` callable from
guest code through the existing `execute` tool. **No new MCP tool.**

### aiden wiring (separate, smaller change)

- The guest's `run(debank)` for a named-token balance becomes
  `return await debank.user.getTokenBalanceAcrossChains({ id, token });` — zero
  arithmetic. `search_docs` surfaces the method, so this is discovery-driven.
- Revert the #105-branch instruction bullets (all-chain enumeration, mandatory
  total, decimals nudge, balance-field nudge) — the method now owns all of it.
- Bump `@iqai/mcp-debank` `2.0.2 → <new>` after publish. Dev-link the local
  build to verify before publishing.

## Error handling / edge cases

- **No matches:** `matches: []` (not an error). Caller renders "no \<token\>".
- **Chain restriction miss:** `resolveChain` fails → return an explicit error
  field; do not silently fall back to all chains.
- **Partial chain failure:** inherited from `getUserTokensAcrossChainsRaw` — a
  single chain's transient failure is skipped (already logged there); the result
  covers the chains that succeeded.
- **`amount` missing/non-finite for a matched holding:** that match is reported
  with `amount: 0` is WRONG — instead mark it (e.g. `amount: null`) and exclude
  it from `total`, so a data gap is visible rather than silently zeroed.
- **`price` missing:** `usd: 0` with the token amount still reported.

## Testing

Package (the real test surface):
- Unit-test `matchesTokenReference` (multi-word, descriptor-strip, sole-word
  "Coin"/"Token", case-insensitive, name-vs-symbol, substring rejection).
- Unit-test `getTokenBalanceAcrossChainsRaw` with `getUserTokensAcrossChainsRaw`
  mocked: multi-chain same-name, multi-chain differing-names (mixed=true),
  single chain, chain restriction, empty matches, missing `amount`, missing
  `price`. Follow the existing `*.test.ts` (`node:test`) patterns.
- A `tool-metadata` test entry assertion (the new entry is well-formed, like the
  existing metadata tests).

aiden (end-to-end, via the dev-linked build):
- The `/api/query` loop on `gpt-4.1-mini`: the multichain query returns a
  consistent per-chain list + total across ~5 runs with no `e-14`/null glitches;
  a chain-named query restricts to that chain.

## Dev-link → release

1. In the worktree: `pnpm build`.
2. In aiden's #105 branch: set `"@iqai/mcp-debank": "link:../debank-mcp-feat-token-balance"`
   (or `file:`), `pnpm install`; aiden resolves the bin via
   `require.resolve("@iqai/mcp-debank/package.json") -> dist/index.js`, so the
   local `dist` must be built.
3. Verify end-to-end via `/api/query`.
4. Add a changeset, version bump, `changeset publish`.
5. aiden bumps the pin to the published version and drops the link.

## Cross-repo sequencing

- PR 1 (`debank-mcp`): method + matcher + TOOL_METADATA entry + tests +
  changeset.
- PR 2 (`aiden`): guest wiring to the new method + dependency bump + revert the
  superseded #105 instruction bullets. (The existing aiden #105 branch becomes
  this PR.)

## Out of scope

- A new first-class MCP tool (explicitly rejected — preserves the 2-tool code
  surface).
- Per-chain USD pricing beyond `amount * price` already on each holding.
- Any change to the `execute` sandbox or the dynamic-mode tools.

## Open implementation details (confirm during planning)

- How `search_docs` documents a method (does it derive from `TOOL_METADATA`, or
  from the cookbook/instructions?) — ensure the new method is discoverable.
- Exact `responseSchema` zod placement/import alongside the existing schemas.
