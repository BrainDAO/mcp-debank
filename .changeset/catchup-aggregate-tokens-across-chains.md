---
"@iqai/mcp-debank": major
---

Add `debank.user.getUserTokensAcrossChains` aggregate and remove the broken `getUserAllTokenList` (#16).

`/user/all_token_list` was structurally unservable for any active wallet — DeBank's upstream cannot return within the 5 s per-call wrapper timeout, and soft instructions could not stop the agent from inventing a "3-call limit per invocation" rule and degrading queries to 14-minute round trips.

The new `getUserTokensAcrossChainsRaw` does the fan-out inside the service layer:

1. `getUserTotalBalanceRaw` → discover active chains.
2. Filter to chains with `usd_value >= min_usd_value` (default 1).
3. `Promise.all(getUserTokenListRaw per filtered chain)` with per-chain `.catch` so a single chain's failure degrades the aggregate to best-effort instead of failing entirely.

Wall-time on a whale wallet (~30 active chains): **~6 s** (down from 2-14 minutes). The aggregate gets a per-method `timeoutMs: 30_000` override (new `ToolMetadata.timeoutMs` field) so the wrapper doesn't cancel it at 5 s.

**Breaking change**: `debank.user.getUserAllTokenList` is no longer registered. Anyone calling it gets `Invalid arguments` from Zod or an undefined property error — the recommended replacement is `getUserTokensAcrossChains`, which is faster for every wallet size.
