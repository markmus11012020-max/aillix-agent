import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

export type GitAction = "status" | "init" | "commit" | "push";

export function isPathInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function validateWorkdir(
  input: string,
  workRoot = process.env.AILLIX_WORK_ROOT ?? "/work/hackathon",
): string {
  if (!input || !path.isAbsolute(input)) {
    throw new Error("Папка Работы должна быть абсолютным путём.");
  }

  const root = fs.realpathSync(workRoot);
  let real: string;
  try {
    real = fs.realpathSync(input);
  } catch {
    throw new Error(`Папка Работы не найдена: ${input}`);
  }

  if (!isPathInside(real, root)) {
    throw new Error(`Папка Работы должна быть внутри ${root}.`);
  }

  if (!fs.statSync(real).isDirectory()) {
    throw new Error("Путь Работы не является папкой.");
  }

  return real;
}

async function git(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return [stdout, stderr].filter(Boolean).join("\n").trim();
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message?: string };
    const details = (failure.stderr || failure.stdout || failure.message || "").trim();
    throw new Error(`git ${args[0]}: ${details}`);
  }
}

const FORBIDDEN = [
  /(^|\/)\.env($|\.)/i,
  /(^|\/)id_(rsa|ed25519|ecdsa|dsa)/i,
  /\.pem$/i,
  /\.key$/i,
  /(^|\/)\.ssh\//i,
];

async function ensureRepoRoot(dir: string): Promise<void> {
  const top = await git(["rev-parse", "--show-toplevel"], dir);
  if (fs.realpathSync(top) !== dir) {
    throw new Error("Папка Работы должна быть корнем git-репозитория.");
  }
}

export async function gitStatus(workdir: string): Promise<string> {
  const dir = validateWorkdir(workdir);
  await ensureRepoRoot(dir);
  return await git(["status", "--porcelain=v1", "--branch"], dir);
}

export async function gitInit(workdir: string, repoUrl?: string): Promise<string> {
  const dir = validateWorkdir(workdir);

  if (!fs.existsSync(path.join(dir, ".git"))) {
    await git(["init", "-b", "main"], dir);
  }

  if (repoUrl) {
    const remotes = await git(["remote"], dir);
    if (remotes.split(/\s+/).includes("origin")) {
      await git(["remote", "set-url", "origin", repoUrl], dir);
    } else {
      await git(["remote", "add", "origin", repoUrl], dir);
    }
  }

  await ensureRepoRoot(dir);
  return await git(["status", "--short", "--branch"], dir);
}

export async function gitCommit(workdir: string, message: string): Promise<string> {
  const dir = validateWorkdir(workdir);
  await ensureRepoRoot(dir);

  await git(["add", "-A"], dir);
  const staged = await git(["diff", "--cached", "--name-only"], dir);
  if (!staged) return "Нет изменений для коммита.";

  const forbidden = staged
    .split("\n")
    .map((file) => file.trim())
    .filter((file) => file.length > 0 && FORBIDDEN.some((pattern) => pattern.test(file)));

  if (forbidden.length > 0) {
    await git(["reset"], dir);
    throw new Error(`Запрещено коммитить секреты и ключи: ${forbidden.join(", ")}`);
  }

  await git(["commit", "-m", message], dir);
  return await git(["log", "-1", "--oneline"], dir);
}

export async function gitPush(workdir: string): Promise<string> {
  const dir = validateWorkdir(workdir);
  await ensureRepoRoot(dir);

  const remotes = await git(["remote"], dir);
  if (!remotes.split(/\s+/).includes("origin")) {
    throw new Error("Remote origin не настроен. Передайте repoUrl в hackathon_git init.");
  }

  return await git(["push", "-u", "origin", "HEAD"], dir);
}

export interface WorkdirRecord {
  path: string;
  repoUrl?: string | null;
  confirmedAt: string;
}

export async function writeWorkdir(
  stateDir: string,
  workdir: string,
  repoUrl?: string,
): Promise<WorkdirRecord> {
  const real = validateWorkdir(workdir);
  const record: WorkdirRecord = {
    path: real,
    repoUrl: repoUrl ?? null,
    confirmedAt: new Date().toISOString(),
  };
  await fs.promises.mkdir(stateDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(stateDir, "workdir.json"),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
  return record;
}

export async function readWorkdir(stateDir: string): Promise<string> {
  try {
    const raw = await fs.promises.readFile(path.join(stateDir, "workdir.json"), "utf8");
    const data = JSON.parse(raw) as { path?: unknown };
    if (typeof data.path === "string") return validateWorkdir(data.path);
  } catch {
    // fall through
  }
  throw new Error("Папка Работы не зарегистрирована. Вызови hackathon_workdir.");
}
