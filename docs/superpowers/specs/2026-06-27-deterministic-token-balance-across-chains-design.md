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

## Decisions (from spec review)

1. **Complete sweep, no dust filter.** This method calls the aggregate with
   `min_usd_value: 0` and does not expose `min_usd_value`/`is_all` as knobs — a
   balance query must not under-report (the aggregate's default of 1 skips
   chains whose total USD < $1, hiding small holdings).
2. **Bridged-suffix variants are out of scope (v1).** The matcher does normalized
   exact match on `name`/`symbol`/`display_symbol`/`optimized_symbol`; it does
   NOT strip `.e`/`(PoS)`/etc. (too false-positive-prone). Documented in the tool
   description so the agent discloses it.
3. **Chain-restricted queries use a single-chain fetch** (`getUserTokenListRaw`),
   not aggregate-then-filter.

## Design

### New host-side aggregate: `UserService.getTokenBalanceAcrossChainsRaw`

Signature: `{ id: string; token: string; chain?: string } -> TokenBalanceAcrossChains`

The method always does a COMPLETE sweep — it does not expose `min_usd_value` or
`is_all`.

Algorithm:
1. **Fetch (two paths):**
   - `chain` provided → `resolveChain(chain)`, then a single-chain
     `this.getUserTokenListRaw({ id, chain_id, is_all: true })`. Don't fan out to
     N chains to drop N-1; the single-chain endpoint exists for this. If
     `resolveChain` misses, return `{ error: "...", matches: [] }` — never
     silently fall back to all chains.
   - `chain` absent → `this.getUserTokensAcrossChainsRaw({ id, min_usd_value: 0,
     is_all: true })`. `min_usd_value: 0` queries EVERY chain the wallet has
     touched (the default of 1 would drop a chain whose total USD < $1 and the
     token sitting there would vanish).
2. **Match:** keep holdings the matcher accepts for `token` (see matcher below).
3. **Per match:** read the human `amount` field directly (already
   decimal-adjusted); `usd = amount * price`. No `10**decimals` math. If `amount`
   is missing/non-finite → `amount: null` (excluded from totals).
4. **Aggregate + observability:** `total`/`total_usd` over finite amounts;
   `mixed_representations` = distinct match `name`s > 1; `chains` = DEDUPED set of
   chains with a match; `partial`/`chains_skipped` from the fetch (see Error
   handling).
5. Return:
   ```ts
   {
     wallet: string;
     token: string;                  // the user's reference, echoed
     matches: Array<{ chain: string; name: string; symbol: string; amount: number | null; price: number; usd: number }>;
     total: number;                  // Σ amount over finite-amount matches
     total_usd: number;              // Σ usd over the same
     mixed_representations: boolean;  // distinct match names > 1
     chains: string[];               // DEDUPED chains with a match
     partial: boolean;               // a targeted chain was skipped (transient error)
     chains_skipped: string[];       // skipped chain ids (empty when partial=false)
   }
   ```
   Empty match set → `matches: []`, `total: 0`, `chains: []`, with `partial`
   reflecting the sweep (caller renders "wallet holds no \<token\>").

### Pure matcher — `src/lib/token-matcher.ts` (sibling of `entity-resolver.ts`, unit-tested)

`matchesTokenReference(reference, holding)` where `holding` is
`Pick<UserTokenBalance, "id" | "name" | "symbol" | "display_symbol" | "optimized_symbol">`.

- **Address inputs:** if the trimmed reference is a `0x…` hex address, match
  case-insensitively against `holding.id` (the token address) and skip the
  name/symbol path. (Verbose prompts sometimes pass a contract address.)
- **Name/symbol path:** normalize the reference and EACH of the holding's `name`,
  `symbol`, `display_symbol`, `optimized_symbol`:
  - trim, lower-case,
  - drop a **trailing** generic descriptor word (`token`/`coin`) **unless it is
    the only word**,
  then **exact** equality (never substring). Match if the normalized reference
  equals ANY of the four normalized fields.

Concrete normalization cases (must be in the unit tests):
`"IQ token"`→`"iq"`, `"USD Coin"`→`"usd"`, `"The Token"`→`"the"`,
`"Big Dog Coin"`→`"big dog"`; sole-word `"Coin"`→`"coin"`, `"Token"`→`"token"`
(preserved). Substring rejection: `"IQ"` must NOT match `"hiIQ"`; `"USDC"` must
NOT match via substring.

**Bridged/suffix variants are NOT matched in v1** (decision 2): `USDC` won't
match `USDC.e`/`USDC (PoS)`. The tool description states this.

### TOOL_METADATA entry (exposes to guest + search_docs)

Add to `src/mcp/legacy/tool-metadata.ts`, mirroring the `getUserTokensAcrossChains`
entry:
- `qualified: "debank.user.getTokenBalanceAcrossChains"`
- `sandboxImpl: lazyMethod("userService", "getTokenBalanceAcrossChainsRaw")`
- `parameters`: zod for `{ id, token, chain? }`
- `responseSchema`: the structured shape above — `matches[].amount` is
  `z.number().nullable()` (the existing `UserTokenBalanceSchema.amount` is plain
  `z.number()`, so nullable must be explicit here or the null case is untestable)
- `description` + `exampleCall`: teach the agent to use this for "balance of a
  named token at a wallet", and state the bridged-variant limitation (so
  discovery, not aiden instruction text, does the teaching)
- `timeoutMs: 30_000` (same as the aggregate it builds on)

Makes `debank.user.getTokenBalanceAcrossChains({ id, token })` callable from guest
code via the existing `execute` tool. **No new MCP tool.**

### aiden wiring (separate, smaller change)

- The guest's `run(debank)` for a named-token balance becomes
  `return await debank.user.getTokenBalanceAcrossChains({ id, token });` — zero
  arithmetic. `search_docs` surfaces the method, so this is discovery-driven.
- Revert the #105-branch instruction bullets (all-chain enumeration, mandatory
  total, decimals nudge, balance-field nudge) — the method now owns all of it.
- Bump `@iqai/mcp-debank` `2.0.2 → <new>` after publish. Dev-link the local build
  to verify first.

## Error handling / edge cases

- **No matches:** `matches: []` (not an error). Caller renders "no \<token\>".
- **Chain restriction miss:** `resolveChain` fails → `{ error, matches: [] }`;
  never silently fall back to all chains.
- **Partial chain failure (observability):** `getUserTokensAcrossChainsRaw` skips
  a chain on transient error (logged, per `user.service.ts`). It does not report
  WHICH chains it skipped, so a 5/7-chain answer looks identical to a complete
  one — a silent under-count that defeats the "deterministic total" goal.
  **Extend the aggregate** to surface skipped chain ids (record the chain id in
  its per-chain `.catch`), and plumb them into `partial`
  (= `chains_skipped.length > 0`) and `chains_skipped`. The single-chain path
  throws on failure, so `partial` is always `false` there.
- **`amount` missing/non-finite for a matched holding:** reporting `amount: 0`
  would be wrong — it hides a data gap. Set `amount: null` and exclude it from
  `total`/`total_usd` so the gap is visible. (Schema: `z.number().nullable()`.)
- **`price` missing:** `usd: 0`, token `amount` still reported.
- **`total` precision:** sums JS numbers; for whale-scale, high-decimal holdings
  the sum can exceed 2^53 and lose precision. Acceptable for this display/LLM use
  case; not corrected.

## Testing

Tests use **vitest** (every `*.test.ts` imports from `"vitest"`; no `node:test`
anywhere in this repo).

Package (the real test surface):
- `src/lib/token-matcher.test.ts` — the normalization cases above (sole-word
  "Coin"/"Token", 2-word descriptor tails, substring rejection,
  name/symbol/display_symbol/optimized_symbol, `0x…` → `id`).
- `getTokenBalanceAcrossChainsRaw` with `getUserTokensAcrossChainsRaw` /
  `getUserTokenListRaw` mocked: multi-chain same-name, multi-chain
  differing-names (`mixed_representations=true`), chain-restricted (single fetch,
  no fan-out), `resolveChain` miss, empty matches, missing `amount` (→ `null`,
  excluded from `total`), missing `price`, and a skipped-chain case asserting
  `partial=true` + `chains_skipped`.
- `src/mcp/legacy/tool-metadata.test.ts`: the hardcoded
  `expect(TOOL_METADATA).toHaveLength(35)` becomes `36`; add a well-formedness
  assertion for the new entry.

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

- PR 1 (`debank-mcp`): method + matcher + TOOL_METADATA entry + aggregate
  skipped-chains extension + tests + changeset → publish a new version.
- PR 2 (`aiden`): guest wiring to the new method + dependency bump to the
  published version + revert the superseded #105 instruction bullets. (The
  existing aiden #105 branch becomes this PR.)

**Gating (must not regress):** PR 2's instruction reverts MUST NOT merge before
`@iqai/mcp-debank` is published AND aiden's pin is bumped to it. If the reverts
ship while aiden still resolves 2.0.2, the method won't exist and the agent falls
back to LLM arithmetic — the exact glitch this removes. Bump + revert land in the
same aiden PR, after PR 1 is published.

## Out of scope

- A new first-class MCP tool (rejected — preserves the 2-tool code surface).
- **Bridged/wrapped symbol variants** — `USDC` won't aggregate `USDC.e`,
  `USDC (PoS)`, `USDbC`. Normalized exact match on
  name/symbol/display_symbol/optimized_symbol only; no suffix stripping (too
  false-positive-prone for v1). The tool description states this. Revisit as a
  follow-up if the USDC-across-chains case proves important.
- Per-chain USD pricing beyond `amount * price` already on each holding.
- Any change to the `execute` sandbox or the dynamic-mode tools.

## Open implementation details (confirm during planning)

- How `search_docs` documents a method (derive from `TOOL_METADATA`, or the
  cookbook/instructions?) — ensure the new method is discoverable.
- The skipped-chains extension to `getUserTokensAcrossChainsRaw`: prefer a
  non-breaking shape (it's used elsewhere) — return tokens as today and attach
  skipped chains via a separate field/overload, or have the new method re-derive
  targeted chains from `getUserTotalBalance` and diff against observed chains.
