import { createRequire } from "node:module";
import { FastMCP } from "fastmcp";
import { createChildLogger } from "./lib/utils/logger.js";
import { endpointTools } from "./mcp/endpoints/tools.js";
import { executeTool } from "./mcp/execute/tool.js";
import { INSTRUCTIONS } from "./mcp/instructions/instructions.generated.js";
import { searchDocsTool } from "./mcp/search-docs/tool.js";
import { dynamicConvenienceTools } from "./mcp/tools.js";

const logger = createChildLogger("DeBank MCP");

const require = createRequire(import.meta.url);

const { version } = require("../package.json") as { version: string };

function dynamicToolsEnabled(): boolean {
	if (process.env.DEBANK_MCP_TOOLS === "dynamic") return true;
	if (process.argv.includes("--tools=dynamic")) return true;
	return false;
}

async function main() {
	const server = new FastMCP({
		name: "DeBank MCP Server",
		// FastMCP's type is `${number}.${number}.${number}`, but at runtime it
		// just stringifies the field for the MCP serverInfo response — so
		// prerelease versions (e.g. `1.0.0-beta.0` from `changeset pre enter`)
		// pass through fine. Cast instead of re-asserting at boot.
		version: version as `${number}.${number}.${number}`,
		instructions: INSTRUCTIONS,
	});

	type RegisteredTool = Parameters<typeof server.addTool>[0];
	const tools: RegisteredTool[] = [
		executeTool as unknown as RegisteredTool,
		searchDocsTool as unknown as RegisteredTool,
	];
	if (dynamicToolsEnabled()) {
		tools.push(
			...(dynamicConvenienceTools as unknown as RegisteredTool[]),
			...(endpointTools as unknown as RegisteredTool[]),
		);
		logger.info(
			"Dynamic tools enabled (--tools=dynamic or DEBANK_MCP_TOOLS=dynamic)",
		);
	}
	for (const tool of tools) server.addTool(tool);

	try {
		await server.start({ transportType: "stdio" });
	} catch (error) {
		logger.error("Failed to start server", error as Error);
		// Defer the forced exit by one tick so winston's async transport can
		// flush to the MCP host's stderr pipe. Mirrors the pattern in index.ts.
		process.exitCode = 1;
		setImmediate(() => process.exit(1));
	}
}

main().catch((error) => {
	logger.error("Unexpected error occurred", error);
	process.exitCode = 1;
	setImmediate(() => process.exit(1));
});
