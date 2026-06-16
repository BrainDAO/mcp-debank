---
"@iqai/mcp-debank": major
---

Fix three endpoint contract drift bugs in `user.service` (#21):

- **`getUserTotalNetCurve`** returns a bare `NetCurvePoint[]` — the previous typing claimed a `{ usd_value_list: NetCurvePoint[] }` wrapper that doesn't exist. The cookbook example was throwing `TypeError` at runtime.
- **`getUserTokenAuthorizedList`** now forwards the required `chain_id` query param. Previously DeBank rejected every call with `"ChainID Missing required parameter"`. Response shape corrected to match real API (token entry with nested `spenders[]`, not a flat `{spender, value, token}` triplet).
- **`getUserNftAuthorizedList`** also forwards `chain_id`. Response shape corrected from bare `NFTAuthorization[]` to the real `{ total, contracts, tokens }` wrapper with collection-level and per-token approval splits.

**Breaking change** for any direct caller of the service `*Raw` methods (not via the MCP tool layer): `getUserTokenAuthorizedListRaw` and `getUserNftAuthorizedListRaw` now require `chain_id` in args, and `getUserNftAuthorizedListRaw` returns the wrapper object instead of an array. The old call shapes were already rejected by DeBank, so anyone using them was effectively broken.

All approval-related Zod schemas now use `.passthrough()` to match the types' `[key: string]: unknown` open-shape contract — DeBank's frequent field additions won't break the agent.
