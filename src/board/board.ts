import type { Board, BoardCard, BoardCardInput } from "../types.js";

export const BOARD_COLUMNS = [
  "00 Inbox",
  "01 Intake",
  "02 User",
  "03 Options",
  "04 Compare",
  "05 Value",
  "06 AI/MCP",
  "07 MVP",
  "08 Arch/Risks",
  "09 Plan",
  "10 Card",
  "11 HITL",
  "12 Done",
  "Questions",
] as const;

export type BoardColumn = (typeof BOARD_COLUMNS)[number];

export type { Board, BoardCard, BoardCardInput };
