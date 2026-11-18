import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLimits } from "../src/state/limits.js";

describe("readLimits", () => {
  it("reads card and step limits", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aillix-limits-"));
    fs.writeFileSync(
      path.join(dir, "limits.json"),
      JSON.stringify({ cardLimit: 5000, stepLimit: 1200 }),
      "utf8",
    );
    try {
      expect(readLimits(dir)).toEqual({ cardLimit: 5000, stepLimit: 1200 });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty limits when file is missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aillix-limits-"));
    try {
      expect(readLimits(dir)).toEqual({});
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
