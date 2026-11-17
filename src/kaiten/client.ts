import { KaitenError } from "./errors.js";
import { RateLimiter } from "./rate-limit.js";

export interface KaitenColumn {
  id: number;
  title: string;
  type?: number;
}

export interface KaitenLane {
  id: number;
  title: string;
}

export interface KaitenBoard {
  id: number;
  title: string;
  columns: KaitenColumn[];
  lanes: KaitenLane[];
}

export interface KaitenCard {
  id: number;
  title: string;
  description?: string | null;
  board_id?: number;
  column_id?: number;
  lane_id?: number;
  external_id?: string | null;
  owner_id?: number;
  responsible_id?: number;
}

export interface CreateCardInput {
  boardId?: number;
  title: string;
  description?: string;
  columnId?: number;
  laneId?: number;
  ownerId?: number;
  responsibleId?: number;
  dueDate?: string;
  externalId?: string;
  position?: 1 | 2;
}

export interface UpdateCardInput {
  title?: string;
  description?: string | null;
  columnId?: number;
  laneId?: number;
  ownerId?: number;
  responsibleId?: number;
  dueDate?: string;
  externalId?: string;
  condition?: number;
}

export interface KaitenClientOptions {
  baseUrl: string;
  token: string;
  boardId: number;
  readOnly?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class KaitenClient {
  private readonly baseUrl: string;
  private readonly token: string;
  readonly boardId: number;
  readonly readOnly: boolean;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly limiter = new RateLimiter(50);

  constructor(options: KaitenClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
    this.boardId = options.boardId;
    this.readOnly = options.readOnly ?? false;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private assertWrite(): void {
    if (this.readOnly) {
      throw new KaitenError("Kaiten is in read-only mode", 0);
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.limiter.wait();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });

        const text = await response.text();
        if (response.ok) {
          return (text ? JSON.parse(text) : undefined) as T;
        }

        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "");
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * (attempt + 1));
          continue;
        }

        throw new KaitenError(
          `Kaiten API ${response.status}: ${text.slice(0, 500)}`,
          response.status,
          text,
        );
      } catch (error) {
        if (error instanceof KaitenError) throw error;
        if (attempt < 2) {
          await sleep(300 * (attempt + 1));
          continue;
        }
        throw new KaitenError(`Kaiten request failed: ${(error as Error).message}`, 0);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new KaitenError("Kaiten request failed after retries", 0);
  }

  async health(): Promise<{ ok: boolean; message: string }> {
    try {
      const board = await this.getBoard();
      return { ok: true, message: `Kaiten board: ${board.title}` };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }

  async getBoard(): Promise<KaitenBoard> {
    const board = await this.request<KaitenBoard>("GET", `/boards/${this.boardId}`);
    return {
      ...board,
      columns: board.columns ?? [],
      lanes: board.lanes ?? [],
    };
  }

  async listCards(columnId?: number): Promise<KaitenCard[]> {
    const cards: KaitenCard[] = [];
    for (let offset = 0; offset < 1000; offset += 100) {
      const query = new URLSearchParams({
        board_id: String(this.boardId),
        limit: "100",
        offset: String(offset),
      });
      if (columnId !== undefined) query.set("column_id", String(columnId));
      const page = await this.request<KaitenCard[]>("GET", `/cards?${query.toString()}`);
      cards.push(...page);
      if (page.length < 100) break;
    }
    return cards;
  }

  async getCard(cardId: number): Promise<KaitenCard> {
    return this.request<KaitenCard>("GET", `/cards/${cardId}`);
  }

  async createCard(input: CreateCardInput): Promise<KaitenCard> {
    this.assertWrite();
    return this.request<KaitenCard>("POST", "/cards", {
      board_id: input.boardId ?? this.boardId,
      title: input.title,
      description: input.description,
      column_id: input.columnId,
      lane_id: input.laneId,
      owner_id: input.ownerId,
      responsible_id: input.responsibleId,
      due_date: input.dueDate,
      external_id: input.externalId,
      position: input.position,
    });
  }

  async updateCard(cardId: number, input: UpdateCardInput): Promise<KaitenCard> {
    this.assertWrite();
    return this.request<KaitenCard>("PATCH", `/cards/${cardId}`, {
      title: input.title,
      description: input.description,
      column_id: input.columnId,
      lane_id: input.laneId,
      owner_id: input.ownerId,
      responsible_id: input.responsibleId,
      due_date: input.dueDate,
      external_id: input.externalId,
      condition: input.condition,
    });
  }

  async moveCard(cardId: number, columnId: number, laneId?: number): Promise<KaitenCard> {
    return this.updateCard(cardId, { columnId, laneId });
  }

  async addComment(cardId: number, text: string): Promise<void> {
    this.assertWrite();
    await this.request("POST", `/cards/${cardId}/comments`, { text });
  }
}
