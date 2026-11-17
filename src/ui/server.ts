import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { AppConfig } from "../config.js";
import type { Board } from "../types.js";
import type { StateStore } from "../state/store.js";
import { lintCard } from "../card/lint.js";

export interface UiServerOptions {
  store: StateStore;
  board: Board;
  config: AppConfig;
  onPrompt?: (text: string) => Promise<string>;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function json(res: http.ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function authorized(req: http.IncomingMessage, token: string): boolean {
  if (!token) return true;
  const header = req.headers.authorization ?? "";
  if (header === `Bearer ${token}`) return true;
  return req.headers["x-ui-token"] === token;
}

export function startUiServer(options: UiServerOptions): { close: () => Promise<void>; url: string } {
  const { store, board, config } = options;
  const uiRoot = path.resolve(config.projectRoot, "ui");

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const pathname = url.pathname;

      if (!authorized(req, config.uiToken) && pathname.startsWith("/api/")) {
        json(res, 401, { error: "Unauthorized" });
        return;
      }

      if (req.method === "GET" && !pathname.startsWith("/api/")) {
        const file = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
        const safe = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
        const content = await readFile(path.join(uiRoot, safe), "utf8");
        const type = safe.endsWith(".js")
          ? "text/javascript; charset=utf-8"
          : safe.endsWith(".css")
            ? "text/css; charset=utf-8"
            : "text/html; charset=utf-8";
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
        res.end(content);
        return;
      }

      if (req.method === "GET" && pathname === "/api/state") {
        const health = await board.health().catch((error) => ({ ok: false, message: (error as Error).message }));
        try {
          const state = await store.get();
          const dashboard = await store.dashboard();
          json(res, 200, {
            initialized: true,
            state,
            dashboard,
            board: { kind: board.kind, health },
            card: await store.readCard(),
          });
        } catch {
          json(res, 200, {
            initialized: false,
            board: { kind: board.kind, health },
          });
        }
        return;
      }

      if (req.method === "POST" && pathname === "/api/init") {
        const body = JSON.parse(await readBody(req)) as { task: string };
        if (!body.task?.trim()) {
          json(res, 400, { error: "Нужен текст задания." });
          return;
        }
        const state = await store.init(body.task.trim());
        json(res, 200, { ok: true, state });
        return;
      }

      if (req.method === "POST" && pathname === "/api/answer") {
        const body = JSON.parse(await readBody(req)) as { id: string; answer: string };
        const state = await store.answer(body.id, body.answer);
        json(res, 200, { ok: true, state });
        return;
      }

      if (req.method === "POST" && pathname === "/api/recommendation") {
        const body = JSON.parse(await readBody(req)) as {
          id: string;
          action: "accepted" | "rejected" | "deferred";
          decision: string;
        };
        const state = await store.decideRecommendation(body.id, body.action, body.decision);
        json(res, 200, { ok: true, state });
        return;
      }

      if (req.method === "POST" && pathname === "/api/decision") {
        const body = JSON.parse(await readBody(req)) as { text: string; reason: string };
        const state = await store.get();
        const next = await store.decide({ step: state.step, text: body.text, reason: body.reason });
        json(res, 200, { ok: true, state: next });
        return;
      }

      if (req.method === "POST" && pathname === "/api/next") {
        if (!options.onPrompt) {
          json(res, 200, { ok: false, message: "Используйте /hackathon next в OpenCode." });
          return;
        }
        const message = await options.onPrompt(
          "Выполни следующий шаг Aillix Agent: вызови hackathon_next, действуй по директиве, запиши артефакт через hackathon_record.",
        );
        json(res, 200, { ok: true, message });
        return;
      }

      if (req.method === "POST" && pathname === "/api/card/assemble") {
        if (!options.onPrompt) {
          json(res, 200, { ok: false, message: "Используйте /hackathon card в OpenCode." });
          return;
        }
        const message = await options.onPrompt(
          "Собери карточку Aillix: вызови hackathon_card, запиши текст в card/CARD.md и вызови hackathon_check.",
        );
        json(res, 200, { ok: true, message });
        return;
      }

      if (req.method === "GET" && pathname === "/api/card") {
        json(res, 200, { text: await store.readCard() });
        return;
      }

      if (req.method === "POST" && pathname === "/api/check") {
        const card = await store.readCard();
        json(res, 200, lintCard(card, { limit: config.cardLimit }));
        return;
      }

      if (req.method === "POST" && pathname === "/api/sync") {
        json(res, 200, await store.syncBoard());
        return;
      }

      json(res, 404, { error: "Not found" });
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  server.listen(config.uiPort, "127.0.0.1", () => {
    console.error(`Aillix Console: http://127.0.0.1:${config.uiPort}`);
  });

  server.on("error", (error) => {
    console.error(`Aillix Console error: ${(error as Error).message}`);
  });

  return {
    url: `http://127.0.0.1:${config.uiPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
