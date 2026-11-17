import { loadConfig } from "../src/config.js";

const config = loadConfig();
const url = process.env.T_INVEST_MCP_URL || "https://sandbox-invest-public-api.tbank.ru/mcp";
const token = process.env.T_INVEST_TOKEN || "";

if (!token) {
  console.error("T_INVEST_TOKEN не задан. Заполните agent/.env.");
  process.exit(1);
}

const body = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "aillix-smoke", version: "1.0.0" },
  },
};

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });

  console.log("URL:", url);
  console.log("STATUS:", response.status);
  console.log("CONTENT-TYPE:", response.headers.get("content-type"));
  const text = await response.text();
  console.log("BODY:", text.slice(0, 800));

  if (response.status === 401 || response.status === 403) {
    console.error("Токен не принят. Проверьте T_INVEST_TOKEN и права токена.");
    process.exit(1);
  }
  if (response.status >= 500) {
    console.error("Сервер вернул 5xx. Повторите позже.");
    process.exit(1);
  }
  console.log("TLS и сеть в порядке. Если статус 400/405 — проверьте протокол MCP.");
} catch (error) {
  console.error("Ошибка TLS/сети:", (error as Error).message);
  console.error("Проверьте сертификаты Минцифры и NODE_EXTRA_CA_CERTS.");
  process.exit(1);
}
