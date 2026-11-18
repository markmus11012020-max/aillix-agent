import { loadConfig } from "../src/config.js";
import { LocalBoard } from "../src/board/local.js";
import { StateStore } from "../src/state/store.js";
import type { State } from "../src/state/schema.js";
import { writeCanvas } from "../src/board/canvas.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const board = new LocalBoard(config.stateDir, config.boardFile);
  const store = new StateStore(config, board);
  let state: State;
  try {
    state = await store.get();
  } catch {
    console.log("State не инициализирован. Сначала /hackathon start.");
    return;
  }
  await writeCanvas(state, config);
  console.log(`Canvas: ${config.canvasFile}`);
  console.log(`Шаг: ${state.step}; вопросов: ${state.questions.length}; рекомендаций: ${state.recommendations.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
