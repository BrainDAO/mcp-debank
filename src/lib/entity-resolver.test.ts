import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveWrappedToken } from "./entity-resolver.js";

vi.mock("../services/index.js", () => ({
	chainService: {
		getSupportedChainListRaw: vi.fn(async () => [
			{ id: "eth", name: "Ethereum" },
			{ id: "bsc", name: "BNB Chain" },
			{ id: "matic", name: "Polygon" },
			{ id: "xdai", name: "Gnosis Chain" },
			{ id: "okt", name: "OKC" },
			{ id: "heco", name: "HECO" },
			{ id: "arb", name: "Arbitrum" },
		]),
	},
}));

describe("resolveChain (DeBank-backed, deterministic match)", () => {
	beforeEach(() => {
		vi.resetModules();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("exact ID (case-insensitive) wins first", async () => {
		const { resolveChain } = await import("./entity-resolver.js");
		expect(await resolveChain("eth")).toBe("eth");
		expect(await resolveChain("ETH")).toBe("eth");
	});

	it("exact name (case-insensitive) when ID misses", async () => {
		const { resolveChain } = await import("./entity-resolver.js");
		expect(await resolveChain("Ethereum")).toBe("eth");
		expect(await resolveChain("polygon")).toBe("matic");
	});

	it("alias table maps ambiguous user inputs", async () => {
		const { resolveChain } = await import("./entity-resolver.js");
		expect(await resolveChain("BSC")).toBe("bsc");
		expect(await resolveChain("Binance Smart Chain")).toBe("bsc");
		expect(await resolveChain("OKExChain")).toBe("okt");
		expect(await resolveChain("Gnosis")).toBe("xdai");
		expect(await resolveChain("Huobi")).toBe("heco");
	});

	it("partial name match as last resort", async () => {
		const { resolveChain } = await import("./entity-resolver.js");
		expect(await resolveChain("Gnosis Chain")).toBe("xdai");
	});

	it("returns null for unknown input", async () => {
		const { resolveChain } = await import("./entity-resolver.js");
		expect(await resolveChain("DefinitelyMadeUpChain")).toBeNull();
	});

	it("returns null for empty/non-string input", async () => {
		const { resolveChain } = await import("./entity-resolver.js");
		expect(await resolveChain("")).toBeNull();
		expect(await resolveChain("   ")).toBeNull();
	});

	it("resolveChains: comma-separated, mixed ID + name + alias", async () => {
		const { resolveChains } = await import("./entity-resolver.js");
		expect(await resolveChains("eth, BSC, Polygon")).toBe("eth,bsc,matic");
	});

	it("resolveChains: returns null if any item fails", async () => {
		const { resolveChains } = await import("./entity-resolver.js");
		expect(await resolveChains("eth, NopeChain")).toBeNull();
	});
});

describe("resolveWrappedToken", () => {
	it("returns the wrapped-native address for the keyword 'WETH' on eth", () => {
		const r = resolveWrappedToken("WETH", "eth");
		expect(typeof r).toBe("string");
		expect(r).toMatch(/^0x[a-f0-9]{40}$/i);
	});

	it("is case-insensitive: 'weth' / 'WETH' / ' Weth ' all match", () => {
		const a = resolveWrappedToken("weth", "eth");
		const b = resolveWrappedToken("WETH", "eth");
		const c = resolveWrappedToken(" Weth ", "eth");
		expect(a).toBe(b);
		expect(b).toBe(c);
	});

	it("recognises 'wrapped native' and 'native token' aliases", () => {
		const a = resolveWrappedToken("wrapped native", "eth");
		const b = resolveWrappedToken("native token", "eth");
		expect(typeof a).toBe("string");
		expect(typeof b).toBe("string");
	});

	it("returns null for unrelated tokens (e.g., 'USDT')", () => {
		// Prior bug: function ignored the keyword and returned WETH for any input.
		expect(resolveWrappedToken("USDT", "eth")).toBeNull();
		expect(resolveWrappedToken("DAI", "eth")).toBeNull();
		expect(resolveWrappedToken("", "eth")).toBeNull();
	});

	it("returns null for pair/LP symbols that merely contain a keyword", () => {
		// Exact-match (not substring): a symbol like WETH-USDT must NOT be
		// misresolved to the chain's wrapped-native address.
		expect(resolveWrappedToken("WETH-USDT", "eth")).toBeNull();
		expect(resolveWrappedToken("native-usdt-pool", "eth")).toBeNull();
		expect(resolveWrappedToken("wethereum", "eth")).toBeNull();
	});

	it("returns null for unknown chains regardless of keyword", () => {
		expect(resolveWrappedToken("WETH", "definitely_not_a_chain")).toBeNull();
	});

	it("accepts chain-specific wrapped-native symbols like WBNB / WMATIC / WAVAX (parity with v0.1 isWrappedTokenKeyword)", async () => {
		/**
		 * These wrap-symbols were handled by v0.1 legacy auto-resolution via
		 * isWrappedTokenKeyword() returning true. The Code Mode public
		 * helper must accept them too.
		 */
		const wbnb = resolveWrappedToken("WBNB", "bsc");
		const wmatic = resolveWrappedToken("WMATIC", "matic");
		const wavax = resolveWrappedToken("WAVAX", "avax");
		expect(wbnb).toMatch(/^0x[a-f0-9]{40}$/i);
		expect(wmatic).toMatch(/^0x[a-f0-9]{40}$/i);
		expect(wavax).toMatch(/^0x[a-f0-9]{40}$/i);
	});

	it("returns null for 0x addresses (no resolution needed)", async () => {
		/**
		 * isWrappedTokenKeyword short-circuits on 0x...40-char inputs, so resolveWrappedToken
		 * returns null and callers know to use the address as-is.
		 */
		expect(resolveWrappedToken(`0x${"a".repeat(40)}`, "eth")).toBeNull();
	});
});
