import path from "node:path";
import type { Board, BoardCard, BoardCardInput } from "../types.js";
import { BOARD_COLUMNS } from "./board.js";
import { readJson, writeJsonAtomic, writeTextAtomic } from "../utils/fs.js";

interface LocalCard extends BoardCard {
  comments: string[];
}

interface LocalBoardFile {
  nextId: number;
  cards: LocalCard[];
}

export class LocalBoard implements Board {
  readonly kind = "local" as const;
  private readonly dataFile: string;
  private readonly markdownFile: string;

  constructor(
    stateDir: string,
    boardFile: string,
  ) {
    this.dataFile = path.join(stateDir, "local-board.json");
    this.markdownFile = boardFile;
  }

  private async load(): Promise<LocalBoardFile> {
    return readJson<LocalBoardFile>(this.dataFile, { nextId: 1, cards: [] });
  }

  private async save(data: LocalBoardFile): Promise<void> {
    await writeJsonAtomic(this.dataFile, data);
    await writeTextAtomic(this.markdownFile, this.render(data));
  }

  private render(data: LocalBoardFile): string {
    const lines: string[] = [
      "---",
      "kanban-plugin: board",
      "---",
      "",
      "# Aillix Agent Board",
      "",
      "<!-- Aillix: файл создаётся агентом. Ручные правки будут перезаписаны. -->",
      "",
    ];
    for (const column of BOARD_COLUMNS) {
      lines.push(`## ${column}`, "");
      const cards = data.cards.filter((card) => card.column === column);
      if (cards.length === 0) {
        lines.push("");
        continue;
      }
      for (const card of cards) {
        const checked = column === "12 Done" ? "x" : " ";
        lines.push(`- [${checked}] ${card.id} | ${card.title}`);
        if (card.externalId) lines.push(`  - external_id: ${card.externalId}`);
        if (card.lane) lines.push(`  - lane: ${card.lane}`);
        if (card.description) {
          const description = card.description.replace(/\n/g, "\n    ");
          lines.push(`  - description: ${description}`);
        }
        if (card.comments.length > 0) {
          for (const comment of card.comments) {
            lines.push(`  - comment: ${comment.replace(/\n/g, "\n    ")}`);
          }
        }
      }
      lines.push("");
    }
    return `${lines.join("\n")}\n`;
  }

  async health(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: `Obsidian board: ${this.markdownFile}` };
  }

  async getColumns(): Promise<Array<{ id: string; title: string }>> {
    return BOARD_COLUMNS.map((title) => ({ id: title, title }));
  }

  async listCards(): Promise<BoardCard[]> {
    const data = await this.load();
    return data.cards.map(({ comments: _comments, ...card }) => card);
  }

  async createCard(input: BoardCardInput): Promise<BoardCard> {
    const data = await this.load();
    const id = `CARD-${String(data.nextId).padStart(3, "0")}`;
    const card: LocalCard = {
      id,
      title: input.title,
      description: input.description,
      column: input.column,
      lane: input.lane,
      externalId: input.externalId,
      comments: [],
    };
    data.cards.push(card);
    data.nextId += 1;
    await this.save(data);
    const { comments: _comments, ...result } = card;
    return result;
  }

  async updateCard(id: string, input: Partial<BoardCardInput>): Promise<BoardCard> {
    const data = await this.load();
    const card = data.cards.find((item) => item.id === id);
    if (!card) throw new Error(`Local card not found: ${id}`);
    if (input.title !== undefined) card.title = input.title;
    if (input.description !== undefined) card.description = input.description;
    if (input.column !== undefined) card.column = input.column;
    if (input.lane !== undefined) card.lane = input.lane;
    if (input.externalId !== undefined) card.externalId = input.externalId;
    await this.save(data);
    const { comments: _comments, ...result } = card;
    return result;
  }

  async moveCard(id: string, column: string, lane?: string): Promise<BoardCard> {
    return this.updateCard(id, { column, lane });
  }

  async addComment(id: string, text: string): Promise<void> {
    const data = await this.load();
    const card = data.cards.find((item) => item.id === id);
    if (!card) throw new Error(`Local card not found: ${id}`);
    card.comments.push(text);
    await this.save(data);
  }

  async sync(): Promise<{ ok: boolean; message: string }> {
    const data = await this.load();
    await this.save(data);
    return { ok: true, message: `Obsidian board synced: ${data.cards.length} cards` };
  }
}
