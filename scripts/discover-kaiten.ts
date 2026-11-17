import { loadConfig } from "../src/config.js";

loadConfig();

const baseUrl = (process.env.KAITEN_API_URL || "https://aillix.kaiten.ru/api/latest").replace(/\/+$/, "");
const token = process.env.KAITEN_API_TOKEN || "";
const spaceId = process.env.KAITEN_SPACE_ID || "942277";

if (!token) {
  console.error("KAITEN_API_TOKEN не задан.");
  console.error("Откройте Kaiten → профиль → API key → создать токен.");
  console.error("Вставьте токен в agent/.env, не в чат.");
  process.exit(1);
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { headers: headers() });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Kaiten ${response.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  return (text ? JSON.parse(text) : []) as T;
}

interface Board {
  id: number;
  title: string;
  columns?: Array<{ id: number; title: string }>;
  lanes?: Array<{ id: number; title: string }>;
}

const boards = await getJson<Board[]>(`/spaces/${spaceId}/boards`);

console.log(`Пространство ${spaceId}: досок ${boards.length}`);
for (const board of boards) {
  console.log(`\nBOARD_ID=${board.id}`);
  console.log(`TITLE=${board.title}`);
  console.log("COLUMNS:");
  for (const column of board.columns ?? []) {
    console.log(`  ${column.id}\t${column.title}`);
  }
  console.log("LANES:");
  for (const lane of board.lanes ?? []) {
    console.log(`  ${lane.id}\t${lane.title}`);
  }
}

console.log("\nСкопируйте BOARD_ID в agent/.env: KAITEN_BOARD_ID=<id>.");
