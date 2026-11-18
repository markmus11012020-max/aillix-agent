import { loadConfig } from "../src/config.js";
import { LocalBoard } from "../src/board/local.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const board = new LocalBoard(config.stateDir, config.boardFile);

  console.log("board:", await board.health());
  const columns = await board.getColumns();
  const cards = await board.listCards();
  console.log("columns:", columns.length);
  console.log("cards:", cards.length);
  console.log("kanban:", config.boardFile);
  console.log("canvas:", config.canvasFile);
  if (cards.length > 0) {
    for (const card of cards) {
      console.log(`  ${card.id}  ${card.column}  ${card.title}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
