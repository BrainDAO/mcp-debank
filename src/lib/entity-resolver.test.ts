import { describe, expect, it } from "vitest";
import { resolveWrappedToken } from "./entity-resolver.js";

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

	it("returns null for unknown chains regardless of keyword", () => {
		expect(resolveWrappedToken("WETH", "definitely_not_a_chain")).toBeNull();
	});
});
