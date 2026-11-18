import fs from "node:fs";
import path from "node:path";

export interface Limits {
  cardLimit?: number;
  stepLimit?: number | null;
}

export function readLimits(stateDir: string): Limits {
  try {
    const raw = fs.readFileSync(path.join(stateDir, "limits.json"), "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const cardLimit =
      typeof data.cardLimit === "number" && data.cardLimit > 0 ? data.cardLimit : undefined;
    const stepLimit =
      typeof data.stepLimit === "number" && data.stepLimit > 0 ? data.stepLimit : null;
    return { cardLimit, stepLimit };
  } catch {
    return {};
  }
}

export async function writeLimits(stateDir: string, input: Limits): Promise<Limits> {
  const cardLimit =
    typeof input.cardLimit === "number" && input.cardLimit > 0 ? input.cardLimit : undefined;
  const stepLimit =
    typeof input.stepLimit === "number" && input.stepLimit > 0 ? input.stepLimit : null;
  const payload = {
    cardLimit: cardLimit ?? null,
    stepLimit,
    source: "team",
    confirmedAt: new Date().toISOString(),
  };
  await fs.promises.mkdir(stateDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(stateDir, "limits.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  return { cardLimit, stepLimit };
}

