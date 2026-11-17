import { describe, expect, it } from "vitest";
import { KaitenClient } from "../src/kaiten/client.js";
import { KaitenBoard } from "../src/board/kaiten.js";
import { KaitenError } from "../src/kaiten/errors.js";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("KaitenClient", () => {
  it("maps columns and lanes when creating a card", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body as string | undefined });
      if (url.includes("/boards/1")) {
        return jsonResponse({
          id: 1,
          title: "Aillix",
          columns: [
            { id: 10, title: "03 Options" },
            { id: 11, title: "04 Compare" },
          ],
          lanes: [
            { id: 1, title: "Captain" },
            { id: 2, title: "Developer" },
          ],
        });
      }
      if (url.includes("/cards") && method === "POST") {
        return jsonResponse({
          id: 5,
          title: "STEP 03: Три варианта",
          column_id: 10,
          lane_id: 1,
          external_id: "aillix:step:03",
        });
      }
      return jsonResponse({}, 404);
    };

    const client = new KaitenClient({
      baseUrl: "https://example.kaiten.ru/api/latest",
      token: "secret-token",
      boardId: 1,
      fetchImpl: fakeFetch,
    });
    const board = new KaitenBoard(client);
    const card = await board.createCard({
      title: "STEP 03: Три варианта",
      column: "03 Options",
      lane: "Captain",
      externalId: "aillix:step:03",
    });

    expect(card.id).toBe("5");
    expect(card.column).toBe("03 Options");
    expect(card.lane).toBe("Captain");
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toContain('"column_id":10');
    expect(post?.body).toContain('"lane_id":1');
    expect(post?.body).toContain('"external_id":"aillix:step:03"');
  });

  it("throws a KaitenError on 401 without leaking the token", async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse({ message: "Invalid token" }, 401);
    const client = new KaitenClient({
      baseUrl: "https://example.kaiten.ru/api/latest",
      token: "super-secret-token",
      boardId: 1,
      fetchImpl: fakeFetch,
    });

    await expect(client.getBoard()).rejects.toMatchObject({ status: 401 });
    try {
      await client.getBoard();
    } catch (error) {
      expect(error).toBeInstanceOf(KaitenError);
      expect((error as Error).message).not.toContain("super-secret-token");
    }
  });

  it("blocks writes in read-only mode", async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse({});
    const client = new KaitenClient({
      baseUrl: "https://example.kaiten.ru/api/latest",
      token: "token",
      boardId: 1,
      readOnly: true,
      fetchImpl: fakeFetch,
    });

    await expect(
      client.createCard({ title: "x", columnId: 1 }),
    ).rejects.toThrow("read-only");
  });
});
