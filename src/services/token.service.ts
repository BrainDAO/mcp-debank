/**
 * Token Service
 * Handles all token-related operations
 */

import { createChildLogger } from "../lib/utils/index.js";
import type { TokenHistoricalPrice, TokenHolder, TokenInfo } from "../types.js";
import { BaseService, type RequestOptions } from "./base.service.js";

const logger = createChildLogger("DeBank Token Service");

const logAndWrapError = (context: string, error: unknown): Error => {
	if (error instanceof Error) {
		logger.error(context, error);
		return error;
	}

	const wrappedError = new Error(String(error));
	logger.error(context, wrappedError);
	return wrappedError;
};

export class TokenService extends BaseService {
	async getTokenInformationRaw(
		args: { id: string; chain_id: string },
		options?: RequestOptions,
	): Promise<TokenInfo> {
		try {
			return await this.fetchWithToolConfig<TokenInfo>(
				`${this.baseUrl}/token?id=${args.id}&chain_id=${args.chain_id}`,
				this.DEFAULT_CACHE_TTL_SECONDS,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch token ${args.id} on chain ${args.chain_id}`,
				error,
			);
		}
	}

	async getListTokenInformationRaw(
		args: { chain_id: string; ids: string },
		options?: RequestOptions,
	): Promise<TokenInfo[]> {
		try {
			return await this.fetchWithToolConfig<TokenInfo[]>(
				`${this.baseUrl}/token/list?chain_id=${args.chain_id}&ids=${args.ids}`,
				this.DEFAULT_CACHE_TTL_SECONDS,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch token list for chain ${args.chain_id} with ids ${args.ids}`,
				error,
			);
		}
	}

	async getTopHoldersOfTokenRaw(
		args: {
			id: string;
			chain_id: string;
			start?: number;
			limit?: number;
		},
		options?: RequestOptions,
	): Promise<TokenHolder[]> {
		try {
			const params = new URLSearchParams({
				id: args.id,
				chain_id: args.chain_id,
				...(args.start !== undefined && { start: args.start.toString() }),
				...(args.limit !== undefined && { limit: args.limit.toString() }),
			});

			return await this.fetchWithToolConfig<TokenHolder[]>(
				`${this.baseUrl}/token/top_holders?${params}`,
				this.DEFAULT_CACHE_TTL_SECONDS,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch top holders for token ${args.id} on chain ${args.chain_id}`,
				error,
			);
		}
	}

	async getTokenHistoryPriceRaw(
		args: { id: string; chain_id: string; date_at: string },
		options?: RequestOptions,
	): Promise<TokenHistoricalPrice> {
		try {
			return await this.fetchWithToolConfig<TokenHistoricalPrice>(
				`${this.baseUrl}/token/history_price?id=${args.id}&chain_id=${args.chain_id}&date_at=${args.date_at}`,
				this.DEFAULT_CACHE_TTL_SECONDS,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch historical price for token ${args.id} on ${args.chain_id} for ${args.date_at}`,
				error,
			);
		}
	}
}
