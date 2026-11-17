import { KaitenClient, type KaitenBoard as KaitenBoardInfo, type KaitenCard } from "../kaiten/client.js";
import type { Board, BoardCard, BoardCardInput } from "../types.js";
import { BOARD_COLUMNS } from "./board.js";

export class KaitenBoard implements Board {
  readonly kind = "kaiten" as const;
  private boardCache?: KaitenBoardInfo;

  constructor(private readonly client: KaitenClient) {}

  private async board(): Promise<KaitenBoardInfo> {
    if (!this.boardCache) this.boardCache = await this.client.getBoard();
    return this.boardCache;
  }

  private async columnId(title: string): Promise<number> {
    const board = await this.board();
    const column = board.columns.find((item) => item.title === title);
    if (!column) throw new Error(`Kaiten column not found: ${title}`);
    return column.id;
  }

  private async laneId(title?: string): Promise<number | undefined> {
    if (!title) return undefined;
    const board = await this.board();
    const lane = board.lanes.find((item) => item.title === title);
    return lane?.id;
  }

  private mapCard(card: KaitenCard, board: KaitenBoardInfo): BoardCard {
    const column = board.columns.find((item) => item.id === card.column_id);
    const lane = board.lanes.find((item) => item.id === card.lane_id);
    return {
      id: String(card.id),
      title: card.title,
      description: card.description ?? undefined,
      column: column?.title ?? "00 Inbox",
      lane: lane?.title,
      externalId: card.external_id ?? undefined,
    };
  }

  async health(): Promise<{ ok: boolean; message: string }> {
    return this.client.health();
  }

  async getColumns(): Promise<Array<{ id: string; title: string }>> {
    const board = await this.board();
    return board.columns.map((column) => ({ id: String(column.id), title: column.title }));
  }

  async listCards(): Promise<BoardCard[]> {
    const board = await this.board();
    const cards = await this.client.listCards();
    return cards.map((card) => this.mapCard(card, board));
  }

  async createCard(input: BoardCardInput): Promise<BoardCard> {
    const board = await this.board();
    const card = await this.client.createCard({
      title: input.title,
      description: input.description,
      columnId: await this.columnId(input.column),
      laneId: await this.laneId(input.lane),
      externalId: input.externalId,
      ownerId: input.ownerId,
      responsibleId: input.responsibleId,
      dueDate: input.dueDate,
    });
    return this.mapCard(card, board);
  }

  async updateCard(id: string, input: Partial<BoardCardInput>): Promise<BoardCard> {
    const board = await this.board();
    const card = await this.client.updateCard(Number(id), {
      title: input.title,
      description: input.description,
      columnId: input.column ? await this.columnId(input.column) : undefined,
      laneId: input.lane ? await this.laneId(input.lane) : undefined,
      externalId: input.externalId,
      ownerId: input.ownerId,
      responsibleId: input.responsibleId,
      dueDate: input.dueDate,
    });
    return this.mapCard(card, board);
  }

  async moveCard(id: string, column: string, lane?: string): Promise<BoardCard> {
    const board = await this.board();
    const card = await this.client.moveCard(Number(id), await this.columnId(column), await this.laneId(lane));
    return this.mapCard(card, board);
  }

  async addComment(id: string, text: string): Promise<void> {
    await this.client.addComment(Number(id), text);
  }

  async sync(): Promise<{ ok: boolean; message: string }> {
    return this.health();
  }
}

export function createKaitenBoard(client: KaitenClient): KaitenBoard {
  return new KaitenBoard(client);
}

export function kaitenColumnNames(): readonly string[] {
  return BOARD_COLUMNS;
}
