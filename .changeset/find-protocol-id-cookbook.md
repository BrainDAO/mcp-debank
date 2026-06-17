---
"@iqai/mcp-debank": patch
---

Add a cookbook recipe for finding the right `protocol_id` before calling `getUserProtocol`. DeBank's protocol IDs don't follow a single convention — some are bare (`uniswap`), some are versioned (`aave3`, `aave4`), and per-chain deployments use a chain prefix (`arb_aave3`, `base_aave3`). Real session telemetry showed agents wasting ~7-12 upstream calls per query guessing IDs like `aave_v3`, `aave3`, `arb_aave3` until one matched.

The new `11-find-protocol-id.md` teaches the discovery procedure (filter `getProtocolList` or `getAllProtocolsOfSupportedChains` by name), surfaces via `search_docs` when an agent searches "protocol id" / "aave id" / "find protocol", and links from the existing `07-protocol-positions.md` recipe. Discovery primitive only — no fixed lookup table in the always-loaded instructions (which would push back toward the cheat-sheet anti-pattern we moved away from in earlier work).
