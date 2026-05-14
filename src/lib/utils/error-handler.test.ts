// src/lib/utils/error-handler.test.ts

import axios from "axios";
import { describe, expect, it } from "vitest";
import { extractErrorMessage } from "./error-handler.js";

describe("extractErrorMessage", () => {
	it("preserves code and cause for AxiosError", () => {
		const axiosErr = new axios.AxiosError(
			"timeout of 6000ms exceeded",
			"ECONNABORTED",
		);
		const wrapped = extractErrorMessage(axiosErr) as Error & { code?: string };
		expect(wrapped).toBeInstanceOf(Error);
		expect(wrapped.code).toBe("ECONNABORTED");
		expect(wrapped.cause).toBe(axiosErr);
		expect(wrapped.message).toBe("timeout of 6000ms exceeded");
	});

	it("passes Error instances through unchanged", () => {
		const e = new Error("boom");
		expect(extractErrorMessage(e)).toBe(e);
	});

	it("wraps non-Error values with String()", () => {
		const wrapped = extractErrorMessage("string error");
		expect(wrapped).toBeInstanceOf(Error);
		expect(wrapped.message).toBe("string error");
	});
});
