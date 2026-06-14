// src/services/user.service.test.ts
//
// Focused unit tests for the host-side aggregate method
// getUserTokensAcrossChainsRaw. Mocks the two underlying *Raw calls so
// we test the orchestration (chain filter + Promise.all + flatten) without
// crossing the network.

import { afterEach, describe, expect, it, vi } from "vitest";
import { userService } from "./index.js";

const WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

function token(symbol: string, chain: string, amount: number, price: number) {
	// Pad to UserTokenBalance shape; only the fields the aggregate touches matter.
	return {
		id: `${chain}_${symbol}`,
		chain,
		name: symbol,
		symbol,
		display_symbol: null,
		optimized_symbol: symbol,
		decimals: 18,
		logo_url: "",
		protocol_id: "",
		price,
		is_verified: true,
		is_core: true,
		is_wallet: true,
		time_at: 0,
		amount,
		raw_amount: amount,
		raw_amount_hex_str: "0x0",
	};
}

describe("userService.getUserTokensAcrossChainsRaw", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("filters chains below min_usd_value and fans out per-chain calls in parallel", async () => {
		const totalBalanceSpy = vi
			.spyOn(userService, "getUserTotalBalanceRaw")
			.mockResolvedValue({
				total_usd_value: 100,
				chain_list: [
					{
						id: "eth",
						community_id: 1,
						name: "Ethereum",
						logo_url: "",
						native_token_id: "eth",
						wrapped_token_id: "",
						usd_value: 80,
					},
					{
						id: "bsc",
						community_id: 56,
						name: "BNB",
						logo_url: "",
						native_token_id: "bnb",
						wrapped_token_id: "",
						usd_value: 19,
					},
					{
						id: "dust-chain",
						community_id: 999,
						name: "Dust",
						logo_url: "",
						native_token_id: "x",
						wrapped_token_id: "",
						usd_value: 0.5, // below default min_usd_value=1, must be skipped
					},
				],
			});
		const tokenListSpy = vi
			.spyOn(userService, "getUserTokenListRaw")
			.mockImplementation(async (args) => {
				if (args.chain_id === "eth") return [token("USDC", "eth", 50, 1)];
				if (args.chain_id === "bsc") return [token("BNB", "bsc", 0.5, 38)];
				throw new Error(`unexpected chain ${args.chain_id}`);
			});

		const result = await userService.getUserTokensAcrossChainsRaw({
			id: WALLET,
		});

		expect(totalBalanceSpy).toHaveBeenCalledTimes(1);
		expect(tokenListSpy).toHaveBeenCalledTimes(2);
		// Order doesn't matter; assert both chains were queried, dust-chain wasn't.
		const calledChains = tokenListSpy.mock.calls
			.map((c) => (c[0] as { chain_id: string }).chain_id)
			.sort();
		expect(calledChains).toEqual(["bsc", "eth"]);
		// Flattened result includes tokens from both queried chains.
		expect(result.map((t) => t.symbol).sort()).toEqual(["BNB", "USDC"]);
	});

	it("honors custom min_usd_value (0 includes dust chains)", async () => {
		vi.spyOn(userService, "getUserTotalBalanceRaw").mockResolvedValue({
			total_usd_value: 0.5,
			chain_list: [
				{
					id: "dust",
					community_id: 1,
					name: "Dust",
					logo_url: "",
					native_token_id: "x",
					wrapped_token_id: "",
					usd_value: 0.5,
				},
			],
		});
		const tokenListSpy = vi
			.spyOn(userService, "getUserTokenListRaw")
			.mockResolvedValue([token("DUST", "dust", 1, 0.5)]);

		const result = await userService.getUserTokensAcrossChainsRaw({
			id: WALLET,
			min_usd_value: 0,
		});

		expect(tokenListSpy).toHaveBeenCalledTimes(1);
		expect(result).toHaveLength(1);
	});

	it("returns [] without firing per-chain calls when no chain meets the threshold", async () => {
		vi.spyOn(userService, "getUserTotalBalanceRaw").mockResolvedValue({
			total_usd_value: 0,
			chain_list: [],
		});
		const tokenListSpy = vi
			.spyOn(userService, "getUserTokenListRaw")
			.mockResolvedValue([]);

		const result = await userService.getUserTokensAcrossChainsRaw({
			id: WALLET,
		});

		expect(result).toEqual([]);
		expect(tokenListSpy).not.toHaveBeenCalled();
	});

	it("survives a missing chain_list (treats as empty wallet)", async () => {
		vi.spyOn(userService, "getUserTotalBalanceRaw").mockResolvedValue({
			total_usd_value: 0,
		} as never);
		const tokenListSpy = vi.spyOn(userService, "getUserTokenListRaw");

		const result = await userService.getUserTokensAcrossChainsRaw({
			id: WALLET,
		});

		expect(result).toEqual([]);
		expect(tokenListSpy).not.toHaveBeenCalled();
	});
});
