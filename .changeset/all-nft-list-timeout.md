---
"@iqai/mcp-debank": patch
---

Raise the per-call timeout for `getUserAllNftList` to 20 s and fix a latent bug where the `timeoutMs` override didn't actually widen the underlying axios timeout.

DeBank's `/user/all_nft_list` aggregates NFTs across every chain server-side and routinely takes 10-20 s for active wallets (vs. ~1.5 s for the per-chain `/user/nft_list`). Under the previous 5 s wrapper + 6 s axios timeout, the call always rejected with `"DeBank call timed out after 5s"` for any wallet with a few hundred NFTs — gateway probes against Vitalik confirmed the upstream needs significantly more headroom.

Two coordinated changes:

- **`tool-metadata.ts`**: `debank.user.getUserAllNftList` now declares `timeoutMs: 20_000`. 20 s gives the upstream room to land while still leaving the agent ~10 s of the execute script's 30 s budget to project and return the data. For ultra-high-activity wallets where even 20 s is insufficient (e.g. Vitalik's ~12k NFTs take 65 s upstream), the method description points at the per-chain fallback (`getUserUsedChainList` + per-chain `getUserNftList`).
- **`client.ts`**: the axios `timeout` option now scales with `spec.timeoutMs` (always `abortMs + 1000` for the 1 s buffer that lets the wrapper fire first). Previously the axios timeout was a hardcoded 6 s constant, so `timeoutMs` overrides on _direct_ methods (non-aggregates) were silently no-ops — axios rejected at 6 s before the wrapper budget ever kicked in. The aggregate use case (`getUserTokensAcrossChains`) wasn't affected because each of its internal axios calls is fast; this fix makes the override actually work for direct methods like the one above.

Other `all_*` methods (`all_complex_protocol_list`, `all_simple_protocol_list`, `all_history_list`) were probed against Vitalik and consistently completed in 1-2 s — no override needed.
