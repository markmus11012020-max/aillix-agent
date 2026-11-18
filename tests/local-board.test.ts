import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalBoard } from "../src/board/local.js";

const dirs: string[] = [];

async function setup() {
  const project = await mkdtemp(path.join(os.tmpdir(), "aillix-local-"));
  dirs.push(project);
  const board = new LocalBoard(path.join(project, "state"), path.join(project, "KANBAN.md"));
  return { project, board };
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe("LocalBoard", () => {
  it("creates, moves and comments a card", async () => {
    const { project, board } = await setup();
    const card = await board.createCard({
      title: "STEP 01: Intake",
      description: "Артефакт",
      column: "01 Intake",
      lane: "Captain",
      externalId: "aillix:step:01",
    });
    expect(card.id).toBe("CARD-001");

    await board.moveCard(card.id, "03 Options");
    await board.addComment(card.id, "Проверено");

    const cards = await board.listCards();
    expect(cards[0].column).toBe("03 Options");
    const md = await readFile(path.join(project, "KANBAN.md"), "utf8");
    expect(md).toContain("kanban-plugin: board");
    expect(md).toContain("STEP 01: Intake");
    expect(md).toContain("Проверено");
  });

  it("returns all board columns", async () => {
    const { board } = await setup();
    const columns = await board.getColumns();
    expect(columns).toHaveLength(14);
    expect(columns[0].title).toBe("00 Inbox");
    expect(columns[columns.length - 1].title).toBe("Questions");
  });
});
