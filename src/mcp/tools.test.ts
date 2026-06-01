import { afterEach, describe, expect, it, vi } from "vitest";
import type * as EntityResolver from "../lib/entity-resolver.js";

vi.mock("../lib/entity-resolver.js", async (importOriginal) => {
	const actual = await importOriginal<typeof EntityResolver>();
	return {
		...actual,
		resolveChain: vi.fn(async (n: string) => {
			if (n === "Binance Smart Chain") return "bsc";
			if (n === "ETH") return "eth";
			return null;
		}),
	};
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("debank_resolve", () => {
	it("Binance Smart Chain → bsc", async () => {
		const { resolveTool } = await import("./tools.js");
		const res = await resolveTool.execute({
			name: "Binance Smart Chain",
			type: "chain",
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(inner).toEqual({ resolved: "bsc" });
	});

	it("ETH → eth", async () => {
		const { resolveTool } = await import("./tools.js");
		const res = await resolveTool.execute({ name: "ETH", type: "chain" });
		const inner = JSON.parse(res.content[0]?.text);
		expect(inner).toEqual({ resolved: "eth" });
	});

	it("unknown → resolved:null with canonical error", async () => {
		const { resolveTool } = await import("./tools.js");
		const res = await resolveTool.execute({
			name: "MadeUpChain",
			type: "chain",
		});
		const inner = JSON.parse(res.content[0]?.text);
		expect(inner.resolved).toBeNull();
		expect(inner.error).toBe(
			"Could not resolve 'MadeUpChain' as a chain. Try the exact chain ID (eth, bsc, matic, arb, …).",
		);
	});
});
