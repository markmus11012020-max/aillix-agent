import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isPathInside, validateWorkdir } from "../src/git/repo.js";

describe("git workdir guard", () => {
  it("accepts the work root and its children", () => {
    expect(isPathInside("/work/hackathon", "/work/hackathon")).toBe(true);
    expect(isPathInside("/work/hackathon/2026-11-21", "/work/hackathon")).toBe(true);
  });

  it("rejects parent and sibling paths", () => {
    expect(isPathInside("/work", "/work/hackathon")).toBe(false);
    expect(isPathInside("/work/other", "/work/hackathon")).toBe(false);
    expect(isPathInside("/work/hackathon-evil", "/work/hackathon")).toBe(false);
  });

  it("validates a real directory inside a real root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aillix-work-"));
    const day = path.join(root, "2026-11-21");
    fs.mkdirSync(day);

    try {
      expect(validateWorkdir(day, root)).toBe(fs.realpathSync(day));
      expect(() => validateWorkdir(os.tmpdir(), root)).toThrow(/внутри/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
