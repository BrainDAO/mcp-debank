# 🏦 DeBank MCP Server

[![npm version](https://img.shields.io/npm/v/@iqai/mcp-debank.svg)](https://www.npmjs.com/package/@iqai/mcp-debank)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## 📖 Overview

The DeBank MCP Server enables AI agents to interact with the [DeBank](https://debank.com) API for comprehensive blockchain and DeFi data access. This server provides tools to access chain information, protocol analytics, token data, user portfolios, NFT holdings, transaction history, gas prices, and transaction simulation capabilities.

By implementing the Model Context Protocol (MCP), this server allows Large Language Models (LLMs) to discover blockchain chains, analyze DeFi protocols, track user portfolios, and simulate transactions directly through their context window, bridging the gap between AI and decentralized finance data.

## ✨ Features

*   **Multi-Chain Support**: Access data from 100+ blockchain networks supported by DeBank with auto-resolution of chain names.
*   **Portfolio Tracking**: Monitor user positions, token balances, and protocol holdings across all chains.
*   **DeFi Analytics**: Analyze protocols, liquidity pools, and top holders with comprehensive TVL data.
*   **Transaction Tools**: Simulate transactions, check gas prices, and decode transaction data before on-chain submission.
*   **NFT Discovery**: Retrieve NFT holdings and spending permissions across multiple chains.
*   **Smart Resolution**: AI-powered entity resolution for chains, tokens, and wrapped token keywords.

## Requirements

- Node.js >= 22 (required by `isolated-vm` 6.x; older Node versions cannot run the `execute` sandbox).
- The published binary's shebang already passes `--no-node-snapshot` to node. If you invoke `node dist/index.js` directly (rare), pass `--no-node-snapshot` yourself: `node --no-node-snapshot dist/index.js`.
- On Alpine, ARM, or other platforms without a prebuilt `isolated-vm` addon: `pnpm rebuild isolated-vm` after install.

## 📦 Installation

### 🚀 Using pnpm dlx (Recommended)

To use this server without installing it globally:

```bash
pnpm dlx @iqai/mcp-debank
```

### 🔧 Build from Source

```bash
git clone https://github.com/IQAIcom/mcp-debank.git
cd mcp-debank
pnpm install
pnpm run build
```

## ⚡ Running with an MCP Client

Add the following configuration to your MCP client settings (e.g., `claude_desktop_config.json`).

### 📋 Minimal Configuration

```json
{
  "mcpServers": {
    "debank": {
      "command": "pnpm",
      "args": ["dlx", "@iqai/mcp-debank"],
      "env": {
        "DEBANK_API_KEY": "your_debank_api_key_here"
      }
    }
  }
}
```

### ⚙️ Advanced Configuration (With IQ Gateway)

```json
{
  "mcpServers": {
    "debank": {
      "command": "pnpm",
      "args": ["dlx", "@iqai/mcp-debank"],
      "env": {
        "IQ_GATEWAY_URL": "your_iq_gateway_url",
        "IQ_GATEWAY_KEY": "your_iq_gateway_key"
      }
    }
  }
}
```

## 🔐 Configuration (Environment Variables)

| Variable | Required | Description | Default |
| :--- | :--- | :--- | :--- |
| `DEBANK_API_KEY` | No | Your DeBank API key for authenticated requests | - |
| `IQ_GATEWAY_URL` | No | Custom IQ Gateway URL for enhanced resolution | - |
| `IQ_GATEWAY_KEY` | No | API key for IQ Gateway access | - |

## 💡 Usage Examples

### 🔗 Chain Data
*   "What blockchain chains does DeBank support?"
*   "Get information about the Ethereum chain."
*   "Show me details for BSC (Binance Smart Chain)."

### 📊 Protocol Analytics
*   "List all DeFi protocols on Ethereum."
*   "Get information about Uniswap protocol."
*   "Who are the top holders of Aave?"

### 💰 Token Data
*   "Get token information for WETH on Ethereum."
*   "What's the historical price of USDT on 2024-01-01?"
*   "Who are the top holders of this token?"

### 👛 Portfolio Tracking
*   "What's the total balance of wallet 0x123...?"
*   "Show me all tokens held by this address on Polygon."
*   "List all DeFi positions for this wallet."

### 🖼️ NFT Holdings
*   "What NFTs does this wallet own on Ethereum?"
*   "Show me NFT approvals for this address."

### ⛽ Transaction Tools
*   "What are the current gas prices on Ethereum?"
*   "Simulate this transaction before I submit it."
*   "Explain what this transaction does."

## Code Mode (v0.2+)

Starting in v0.2, the preferred way to query DeBank from an AI agent is the `execute` + `search_docs` pair. These two tools replace the 30 legacy endpoint-specific tools for new integrations.

### `execute` — Sandboxed JavaScript

Run arbitrary JavaScript inside a secure `isolated-vm` sandbox. The sandbox receives a fully-configured DeBank client instance as `debank`. All service namespaces (`debank.chain`, `debank.protocol`, `debank.token`, `debank.user`, `debank.transaction`) are available. Pool methods are under `debank.protocol`; NFT methods are under `debank.user`.

**Example:**

```javascript
async function run(debank) {
  return await debank.user.getUserTotalBalance({ id: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" });
}
```

**Expected response:**

```json
{
  "total_usd_value": 1234567.89,
  "chain_list": [
    { "id": "eth", "usd_value": 800000.0 },
    { "id": "arb", "usd_value": 434567.89 }
  ]
}
```

### `search_docs` — Local Documentation Search

Search the embedded MiniSearch index over all DeBank API methods and cookbook entries.

**Example query:** `user total balance`

**Trimmed results:**

```json
{
  "results": [
    {
      "kind": "method",
      "qualified": "debank.user.getUserTotalBalance",
      "name": "debank_get_user_total_balance",
      "description": "Retrieve a user's total net assets across all supported chains. Calculates and returns the total USD value of assets including both tokens and protocol positions. Provides a complete snapshot of the user's DeFi portfolio.",
      "params": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "description": "The user's wallet address." }
        },
        "required": ["id"]
      },
      "exampleCall": "await debank.user.getUserTotalBalance({id: '0x...'})"
    }
  ]
}
```

### Migrating from v0.1.x / v0.2.x

In v0.3, the 30 endpoint-specific `debank_*` tools are **removed**. Use the dynamic-tools triad instead:

- **`list_endpoints`** — discover available endpoints and their qualified names.
- **`get_endpoint_schema`** — inspect parameters and response shape for a specific endpoint.
- **`invoke_endpoint`** — call a single endpoint with optional `jq_filter` for host-side projection.

For multi-step workflows, use `execute` (sandboxed JavaScript) and `search_docs` (documentation search) as before.

## 🛠️ MCP Tools

### Dynamic endpoint tools (v0.3+)

Use `list_endpoints` to discover all 31 available endpoint names, then `get_endpoint_schema` for parameter details, and `invoke_endpoint` to call them with optional `jq_filter` projection.

## 👨‍💻 Development

### 🏗️ Build Project
```bash
pnpm run build
```

### 👁️ Development Mode (Watch)
```bash
pnpm run watch
```

### ✅ Linting & Formatting
```bash
pnpm run lint
pnpm run format
```

### 📁 Project Structure
*   `src/tools/`: Tool definitions
*   `src/services/`: API client and business logic
*   `src/lib/`: Shared utilities and entity resolution
*   `src/index.ts`: Server entry point

## 📚 Resources

*   [DeBank API Documentation](https://docs.cloud.debank.com/)
*   [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
*   [DeBank Platform](https://debank.com)

## ⚠️ Disclaimer

This project is an unofficial tool and is not directly affiliated with DeBank. It interacts with blockchain and DeFi data. Users should exercise caution and verify all data independently. DeFi interactions involve risk.

## 📄 License

[ISC](LICENSE)
