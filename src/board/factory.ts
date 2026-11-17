import type { AppConfig } from "../config.js";
import { KaitenClient } from "../kaiten/client.js";
import type { Board } from "../types.js";
import { createKaitenBoard } from "./kaiten.js";
import { LocalBoard } from "./local.js";

export function createBoard(config: AppConfig): Board {
  if (config.boardBackend === "kaiten" && config.kaiten.baseUrl && config.kaiten.token && config.kaiten.boardId) {
    return createKaitenBoard(
      new KaitenClient({
        baseUrl: config.kaiten.baseUrl,
        token: config.kaiten.token,
        boardId: config.kaiten.boardId,
        readOnly: config.kaiten.readOnly,
      }),
    );
  }
  return new LocalBoard(config.stateDir, config.projectRoot);
}

export async function createBoardWithFallback(config: AppConfig): Promise<Board> {
  const board = createBoard(config);
  if (board.kind === "local") return board;
  const health = await board.health();
  if (health.ok) return board;
  return new LocalBoard(config.stateDir, config.projectRoot);
}
