// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		setupFiles: ["./tests/integration/setup.ts"],
		include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
		testTimeout: 60_000, // generous: the lazy-isolated-vm test spawns a child process
		pool: "forks", // isolated-vm + native deps behave better with fork pool
	},
});
