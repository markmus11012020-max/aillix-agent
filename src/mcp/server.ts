import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config.js";
import { KaitenClient } from "../kaiten/client.js";
import { registerKaitenTools } from "./tools.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.kaiten.baseUrl || !config.kaiten.token || !config.kaiten.boardId) {
    console.error("Kaiten MCP: не заданы KAITEN_API_URL, KAITEN_API_TOKEN или KAITEN_BOARD_ID.");
  }

  const client = new KaitenClient({
    baseUrl: config.kaiten.baseUrl,
    token: config.kaiten.token,
    boardId: config.kaiten.boardId,
    readOnly: config.kaiten.readOnly,
  });

  const server = new McpServer({
    name: "aillix-kaiten",
    version: "1.0.0",
  });

  registerKaitenTools(server, client);
  await server.connect(new StdioServerTransport());
  console.error("Kaiten MCP: подключён.");
}

main().catch((error) => {
  console.error("Kaiten MCP: fatal error", error);
  process.exit(1);
});
