import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { LocalBoard } from "../src/board/local.js";
import { StateStore } from "../src/state/store.js";
import { gateReport } from "../src/state/machine.js";

const tempDirs: string[] = [];

async function setup() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aillix-state-"));
  tempDirs.push(dir);
  const config = loadConfig({
    projectRoot: dir,
    stateDir: path.join(dir, "state"),
    cardDir: path.join(dir, "card"),
    boardBackend: "local",
  });
  const board = new LocalBoard(config.stateDir, dir);
  const store = new StateStore(config, board);
  return { dir, config, board, store };
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("StateStore", () => {
  it("initializes state and writes STATE.md", async () => {
    const { dir, store } = await setup();
    const state = await store.init("Тестовое задание");
    expect(state.step).toBe("intake");
    expect(state.task).toBe("Тестовое задание");
    const md = await readFile(path.join(dir, "state", "STATE.md"), "utf8");
    expect(md).toContain("Текущий шаг");
  });

  it("records an artifact and passes the intake gate", async () => {
    const { store } = await setup();
    await store.init("Задание");
    const artifact = "Задание записано дословно. Ограничения: время, данные, инструменты. Критерии: ценность, AI, MCP, реализуемость. Неизвестные: точный старт. Вопросы менторам: 1, 2, 3. ".repeat(3);
    const state = await store.recordArtifact("intake", artifact);
    expect(state.artifacts.intake).toBeTruthy();
    const report = gateReport(state);
    expect(report.passed).toBe(true);
  });

  it("blocks advance on an open blocking question", async () => {
    const { store } = await setup();
    await store.init("Задание");
    const artifact = "Задание записано дословно. Ограничения и критерии. Вопросы менторам. ".repeat(5);
    await store.recordArtifact("intake", artifact);
    await store.ask({
      step: "intake",
      text: "Какой пользователь основной?",
      why: "От этого зависит карточка.",
      blocking: true,
    });
    const state = await store.get();
    const report = gateReport(state);
    expect(report.passed).toBe(false);
    await expect(store.advance()).rejects.toThrow("Gate not passed");
  });

  it("advances after the gate and creates the next step card", async () => {
    const { store } = await setup();
    await store.init("Задание");
    const artifact = "Задание записано дословно. Ограничения и критерии. Вопросы менторам. ".repeat(5);
    await store.recordArtifact("intake", artifact);
    const state = await store.advance();
    expect(state.step).toBe("user");
  });
});
