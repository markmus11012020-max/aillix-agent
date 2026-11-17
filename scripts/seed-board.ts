import { loadConfig } from "../src/config.js";
import { KaitenClient } from "../src/kaiten/client.js";
import { BOARD_COLUMNS } from "../src/board/board.js";

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.boardBackend === "local") {
    console.log("BOARD_BACKEND=local. Локальная доска активна.");
    return;
  }

  const client = new KaitenClient({
    baseUrl: config.kaiten.baseUrl,
    token: config.kaiten.token,
    boardId: config.kaiten.boardId,
    readOnly: true,
  });

  const board = await client.getBoard();
  console.log(`Доска: ${board.title} (${board.id})`);
  console.log("Колонки:");
  for (const column of board.columns) console.log(`  ${column.id}  ${column.title}`);
  console.log("Дорожки:");
  for (const lane of board.lanes) console.log(`  ${lane.id}  ${lane.title}`);

  const existing = new Set(board.columns.map((column) => column.title));
  const missing = BOARD_COLUMNS.filter((column) => !existing.has(column));
  if (missing.length > 0) {
    console.log("");
    console.log("Не хватает колонок:");
    for (const column of missing) console.log(`  - ${column}`);
    console.log("Создайте их в Kaiten или измените маппинг в src/state/schema.ts.");
  } else {
    console.log("");
    console.log("Все колонки Aillix на месте.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
