import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function exists(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

export async function readText(file: string): Promise<string> {
  return readFile(file, "utf8");
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const text = await readFile(file, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function writeTextAtomic(file: string, content: string): Promise<void> {
  await ensureDir(path.dirname(file));
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp, content, "utf8");
  await rename(temp, file);
}

export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await writeTextAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}
