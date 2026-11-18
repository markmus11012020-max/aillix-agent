import { config as loadEnv } from "dotenv";
import path from "node:path";
import process from "node:process";

loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true });

export interface AppConfig {
  projectRoot: string;
  stateDir: string;
  cardDir: string;
  boardFile: string;
  canvasFile: string;
  uiPort: number;
  uiToken: string;
  hackathon: {
    start: string;
    deadline: string;
    target: string;
  };
  cardLimit: number;
}

function asInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const projectRoot = overrides.projectRoot ?? process.cwd();

  return {
    projectRoot,
    stateDir: overrides.stateDir ?? path.resolve(projectRoot, process.env.STATE_DIR ?? "state"),
    cardDir: overrides.cardDir ?? path.resolve(projectRoot, process.env.CARD_DIR ?? "card"),
    boardFile:
      overrides.boardFile ??
      path.resolve(projectRoot, process.env.BOARD_FILE ?? "KANBAN.md"),
    canvasFile:
      overrides.canvasFile ??
      path.resolve(projectRoot, process.env.CANVAS_FILE ?? "AILLIX_CANVAS.canvas"),
    uiPort: overrides.uiPort ?? asInt(process.env.UI_PORT, 8787),
    uiToken: overrides.uiToken ?? process.env.UI_TOKEN ?? "",
    hackathon: {
      start: overrides.hackathon?.start ?? process.env.HACKATHON_START ?? "2026-11-21T10:00:00+03:00",
      deadline: overrides.hackathon?.deadline ?? process.env.HACKATHON_DEADLINE ?? "2026-11-21T22:00:00+03:00",
      target: overrides.hackathon?.target ?? process.env.HACKATHON_TARGET ?? "2026-11-21T20:00:00+03:00",
    },
    cardLimit: overrides.cardLimit ?? asInt(process.env.CARD_LIMIT, 6000),
  };
}
