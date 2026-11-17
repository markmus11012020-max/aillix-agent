import { config as loadEnv } from "dotenv";
import path from "node:path";
import process from "node:process";

loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true });

export type BoardBackend = "kaiten" | "local";

export interface AppConfig {
  projectRoot: string;
  stateDir: string;
  cardDir: string;
  uiPort: number;
  uiToken: string;
  boardBackend: BoardBackend;
  kaiten: {
    baseUrl: string;
    token: string;
    boardId: number;
    readOnly: boolean;
  };
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

function asBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const projectRoot = overrides.projectRoot ?? process.cwd();
  const kaitenBaseUrl = overrides.kaiten?.baseUrl ?? process.env.KAITEN_API_URL ?? "";
  const kaitenToken = overrides.kaiten?.token ?? process.env.KAITEN_API_TOKEN ?? "";
  const kaitenBoardId = overrides.kaiten?.boardId ?? asInt(process.env.KAITEN_BOARD_ID, 0);
  const explicitBackend = overrides.boardBackend ?? (process.env.BOARD_BACKEND as BoardBackend | undefined);
  const boardBackend: BoardBackend = explicitBackend ?? (kaitenBaseUrl && kaitenToken && kaitenBoardId ? "kaiten" : "local");

  return {
    projectRoot,
    stateDir: overrides.stateDir ?? path.resolve(projectRoot, process.env.STATE_DIR ?? "state"),
    cardDir: overrides.cardDir ?? path.resolve(projectRoot, process.env.CARD_DIR ?? "card"),
    uiPort: overrides.uiPort ?? asInt(process.env.UI_PORT, 8787),
    uiToken: overrides.uiToken ?? process.env.UI_TOKEN ?? "",
    boardBackend,
    kaiten: {
      baseUrl: kaitenBaseUrl,
      token: kaitenToken,
      boardId: kaitenBoardId,
      readOnly: overrides.kaiten?.readOnly ?? asBool(process.env.KAITEN_READ_ONLY, false),
    },
    hackathon: {
      start: overrides.hackathon?.start ?? process.env.HACKATHON_START ?? "2026-11-21T10:00:00+03:00",
      deadline: overrides.hackathon?.deadline ?? process.env.HACKATHON_DEADLINE ?? "2026-11-21T22:00:00+03:00",
      target: overrides.hackathon?.target ?? process.env.HACKATHON_TARGET ?? "2026-11-21T20:00:00+03:00",
    },
    cardLimit: overrides.cardLimit ?? asInt(process.env.CARD_LIMIT, 6000),
  };
}
