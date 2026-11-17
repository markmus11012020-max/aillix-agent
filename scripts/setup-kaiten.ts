import { loadConfig } from "../src/config.js";
import { KaitenClient } from "../src/kaiten/client.js";
import { BOARD_COLUMNS } from "../src/board/board.js";

const LANES = ["Captain", "Developer", "Both"] as const;

function columnType(title: string): 1 | 2 | 3 {
  if (title === "00 Inbox" || title === "Questions") return 1;
  if (title === "12 Done") return 3;
  return 2;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const config = loadConfig();

  if (!config.kaiten.baseUrl || !config.kaiten.token || !config.kaiten.boardId) {
    console.error("Нет Kaiten-конфигурации. Проверьте .env:");
    console.error("  KAITEN_API_URL, KAITEN_API_TOKEN, KAITEN_BOARD_ID");
    process.exit(1);
  }

  if (config.kaiten.readOnly) {
    console.warn("KAITEN_READ_ONLY=1, но setup:kaiten создаёт колонки. Флаг игнорируется для этого скрипта.");
  }

  const client = new KaitenClient({
    baseUrl: config.kaiten.baseUrl,
    token: config.kaiten.token,
    boardId: config.kaiten.boardId,
    readOnly: false,
  });

  const board = await client.getBoard();
  console.log(`Доска: ${board.title} (${board.id})`);
  if (dryRun) console.log("Режим: --dry-run, изменения не записываются.");

  const existingColumns = new Set(board.columns.map((column) => column.title));
  const missingColumns = BOARD_COLUMNS.filter((column) => !existingColumns.has(column));
  let order =
    board.columns.reduce((max, column) => Math.max(max, column.sort_order ?? 0), 0) || board.columns.length;

  if (missingColumns.length === 0) {
    console.log("Колонки: все на месте.");
  } else {
    console.log(`Колонки: не хватает ${missingColumns.length}.`);
    for (const title of missingColumns) {
      order += 10;
      const type = columnType(title);
      if (dryRun) {
        console.log(`  + ${title} (type=${type}, sort_order=${order})`);
        continue;
      }
      const column = await client.createColumn({ title, type, sortOrder: order });
      console.log(`  + ${column.title} (${column.id})`);
    }
  }

  const existingLanes = new Set(board.lanes.map((lane) => lane.title));
  const missingLanes = LANES.filter((lane) => !existingLanes.has(lane));
  let laneOrder =
    board.lanes.reduce((max, lane) => Math.max(max, lane.sort_order ?? 0), 0) || board.lanes.length;

  if (missingLanes.length === 0) {
    console.log("Дорожки: все на месте.");
  } else {
    console.log(`Дорожки: не хватает ${missingLanes.length}.`);
    for (const title of missingLanes) {
      laneOrder += 10;
      if (dryRun) {
        console.log(`  + ${title} (sort_order=${laneOrder})`);
        continue;
      }
      const lane = await client.createLane({ title, sortOrder: laneOrder });
      console.log(`  + ${lane.title} (${lane.id})`);
    }
  }

  if (dryRun) {
    console.log("");
    console.log("Проверка пропущена: запустите без --dry-run.");
    return;
  }

  const updated = await client.getBoard();
  const updatedColumns = new Set(updated.columns.map((column) => column.title));
  const updatedLanes = new Set(updated.lanes.map((lane) => lane.title));
  const stillMissingColumns = BOARD_COLUMNS.filter((column) => !updatedColumns.has(column));
  const stillMissingLanes = LANES.filter((lane) => !updatedLanes.has(lane));

  console.log("");
  console.log(`Итого: колонок ${updated.columns.length}, дорожек ${updated.lanes.length}.`);
  if (stillMissingColumns.length > 0) {
    console.error(`Не хватает колонок: ${stillMissingColumns.join(", ")}`);
    process.exit(1);
  }
  if (stillMissingLanes.length > 0) {
    console.error(`Не хватает дорожек: ${stillMissingLanes.join(", ")}`);
    process.exit(1);
  }
  console.log("Доска готова: npm run seed && npm run smoke.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
