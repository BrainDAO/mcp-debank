// src/mcp/tools.ts
//
// Top-level chain-name resolver. Gated behind --tools=dynamic (along with
// the endpoint dispatch triad). The underlying lookup is an in-memory
// string table — kept as a top-level tool rather than reachable only via
// execute because spinning up an isolated-vm isolate just to resolve
// "BSC" → "bsc" is overhead the agent shouldn't pay.

import { z } from "zod";
import { resolveChain } from "../lib/entity-resolver.js";

const RESOLVE_PARAMS = z.object({
	name: z
		.string()
		.describe("Free-text chain name like 'BSC' or 'Binance Smart Chain'."),
	type: z
		.enum(["chain"])
		.describe("Entity type to resolve. Currently only 'chain' is supported."),
});

export const resolveTool = {
	name: "debank_resolve",
	description:
		"Resolve a human-readable chain name (e.g. 'BSC', 'Binance Smart Chain', 'Polygon') to a DeBank chain ID. Returns { resolved: '<id>' } on success or { resolved: null, error: '...' } on miss.",
	parameters: RESOLVE_PARAMS,
	annotations: { readOnlyHint: true },
	execute: async (args: z.infer<typeof RESOLVE_PARAMS>) => {
		const resolved = await resolveChain(args.name);
		if (resolved) {
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify({ resolved }) },
				],
				isError: false,
			};
		}
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify({
						resolved: null,
						error: `Could not resolve '${args.name}' as a chain. Try the exact chain ID (eth, bsc, matic, arb, …).`,
					}),
				},
			],
			isError: false,
		};
	},
};

export const dynamicConvenienceTools = [resolveTool];
