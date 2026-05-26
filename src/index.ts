#!/usr/bin/env -S node --no-node-snapshot
import { createRequire } from "node:module";
import { FastMCP } from "fastmcp";
import { createChildLogger } from "./lib/utils/logger.js";
import { endpointTools } from "./mcp/endpoints/tools.js";
import { executeTool } from "./mcp/execute/tool.js";
import { INSTRUCTIONS } from "./mcp/instructions/instructions.generated.js";
import { searchDocsTool } from "./mcp/search-docs/tool.js";
import { defaultConvenienceTools } from "./mcp/tools.js";

const logger = createChildLogger("DeBank MCP");

const require = createRequire(import.meta.url);

type SemverString = `${number}.${number}.${number}`;
function assertSemver(v: string): asserts v is SemverString {
	if (!/^\d+\.\d+\.\d+$/.test(v)) {
		throw new Error(
			`package.json version "${v}" is not a major.minor.patch semver string`,
		);
	}
}
const { version: rawVersion } = require("../package.json") as {
	version: string;
};
assertSemver(rawVersion);
const version: SemverString = rawVersion;

async function main() {
	const server = new FastMCP({
		name: "DeBank MCP Server",
		version,
		instructions: INSTRUCTIONS,
	});

	type RegisteredTool = Parameters<typeof server.addTool>[0];
	const defaults: ReadonlyArray<RegisteredTool> = [
		executeTool,
		searchDocsTool,
		...defaultConvenienceTools,
		...endpointTools,
	] as unknown as ReadonlyArray<RegisteredTool>;
	for (const tool of defaults) server.addTool(tool);

	try {
		await server.start({ transportType: "stdio" });
	} catch (error) {
		logger.error("Failed to start server", error as Error);
		process.exit(1);
	}
}

main().catch((error) => {
	logger.error("Unexpected error occurred", error);
	process.exit(1);
});
