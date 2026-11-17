import { loadConfig } from "../src/config.js";
import { KaitenClient } from "../src/kaiten/client.js";

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.kaiten.baseUrl || !config.kaiten.token || !config.kaiten.boardId) {
    console.error("Нет Kaiten-конфигурации. Проверьте .env.");
    process.exit(1);
  }

  const client = new KaitenClient({
    baseUrl: config.kaiten.baseUrl,
    token: config.kaiten.token,
    boardId: config.kaiten.boardId,
    readOnly: true,
  });

  console.log("health:", await client.health());
  const board = await client.getBoard();
  console.log("board:", board.title, "columns:", board.columns.length, "lanes:", board.lanes.length);
  const cards = await client.listCards();
  console.log("cards:", cards.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
