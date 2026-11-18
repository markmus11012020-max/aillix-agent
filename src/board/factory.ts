import type { AppConfig } from "../config.js";
import type { Board } from "../types.js";
import { LocalBoard } from "./local.js";

export function createBoard(config: AppConfig): Board {
  return new LocalBoard(config.stateDir, config.boardFile);
}
