import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";

const PORT = Number(process.env.MOCK_TINVEST_PORT ?? 8790);
const HOST = process.env.MOCK_TINVEST_HOST ?? "127.0.0.1";
const NOTE = "Mock T-Invest. Демонстрационные данные; не использовать как факт в карточке.";

function reply(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ mock: true, source: "mock-tinvest", note: NOTE, data }, null, 2),
      },
    ],
  };
}

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "mock-tinvest", version: "1.0.0" },
    { capabilities: { logging: {} } },
  );

  server.registerTool("health", { description: "Проверка mock MCP", inputSchema: {} }, async () =>
    reply({ ok: true, mode: "mock", port: PORT }),
  );

  server.registerTool(
    "get_portfolio",
    {
      description: "Портфель (mock)",
      inputSchema: { accountId: z.string().optional() },
    },
    async ({ accountId }) =>
      reply({ accountId: accountId ?? "mock-account", positions: [], totalValue: null }),
  );

  server.registerTool(
    "get_quotes",
    {
      description: "Котировки (mock)",
      inputSchema: { tickers: z.array(z.string()).optional() },
    },
    async ({ tickers }) => reply({ tickers: tickers ?? [], quotes: [] }),
  );

  server.registerTool(
    "get_orderbook",
    { description: "Стакан (mock)", inputSchema: { ticker: z.string().optional() } },
    async ({ ticker }) => reply({ ticker: ticker ?? "MOCK", bids: [], asks: [] }),
  );

  server.registerTool(
    "get_news",
    { description: "Новости (mock)", inputSchema: { ticker: z.string().optional() } },
    async ({ ticker }) => reply({ ticker: ticker ?? null, items: [] }),
  );

  server.registerTool(
    "get_instruments",
    { description: "Инструменты (mock)", inputSchema: { query: z.string().optional() } },
    async ({ query }) => reply({ query: query ?? null, instruments: [] }),
  );

  server.registerTool("get_orders", { description: "Заявки (mock)", inputSchema: {} }, async () =>
    reply({ orders: [] }),
  );

  server.registerTool(
    "get_stop_orders",
    { description: "Стоп-заявки (mock)", inputSchema: {} },
    async () => reply({ stopOrders: [] }),
  );

  server.registerTool("get_taxes", { description: "Налоги (mock)", inputSchema: {} }, async () =>
    reply({ taxes: [] }),
  );

  server.registerTool(
    "get_analytics",
    { description: "Аналитика (mock)", inputSchema: { ticker: z.string().optional() } },
    async ({ ticker }) => reply({ ticker: ticker ?? null, analytics: [] }),
  );

  return server;
}

const app = createMcpExpressApp({ host: HOST });
const sessions = new Map<string, StreamableHTTPServerTransport>();

app.get("/health", (_req, res) => {
  res.json({ ok: true, mode: "mock", port: PORT });
});

app.post("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"];
    const existing = typeof sessionId === "string" ? sessions.get(sessionId) : undefined;

    if (existing) {
      await existing.handleRequest(req, res, req.body);
      return;
    }

    if (sessionId) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Session not found" },
        id: null,
      });
      return;
    }

    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: no valid session ID" },
        id: null,
      });
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) sessions.delete(id);
    };

    const server = buildServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("mock-tinvest error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (typeof sessionId === "string") {
    const transport = sessions.get(sessionId);
    if (transport) {
      sessions.delete(sessionId);
      try {
        await transport.close();
      } catch {
        // ignore close errors
      }
      res.status(200).send("OK");
      return;
    }
  }
  res.status(404).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: "Session not found" },
    id: null,
  });
});

app.get("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST").send("Method Not Allowed");
});

const httpServer = app.listen(PORT, HOST, () => {
  console.log(`Mock T-Invest MCP: http://${HOST}:${PORT}/mcp`);
  console.log("Данные демонстрационные. В карточку не переносить.");
});

function shutdown(): void {
  console.log("Остановка mock T-Invest MCP...");
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
