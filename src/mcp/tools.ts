import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KaitenBoard } from "../board/kaiten.js";
import type { KaitenClient } from "../kaiten/client.js";

function text(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorText(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : String(error),
      },
    ],
  };
}

export function registerKaitenTools(server: McpServer, client: KaitenClient): void {
  const board = new KaitenBoard(client);

  server.registerTool(
    "kaiten_health",
    {
      description: "Проверить токен, доску и доступ к Kaiten.",
    },
    async () => {
      try {
        return text(await client.health());
      } catch (error) {
        return errorText(error);
      }
    },
  );

  server.registerTool(
    "kaiten_get_board",
    {
      description: "Получить доску, колонки и дорожки Kaiten.",
    },
    async () => {
      try {
        const info = await client.getBoard();
        return text({
          id: info.id,
          title: info.title,
          columns: info.columns.map((column) => ({ id: column.id, title: column.title })),
          lanes: info.lanes.map((lane) => ({ id: lane.id, title: lane.title })),
        });
      } catch (error) {
        return errorText(error);
      }
    },
  );

  server.registerTool(
    "kaiten_list_cards",
    {
      description: "Список карточек доски.",
      inputSchema: {
        column: z.string().optional().describe("Название колонки, например 03 Options"),
      },
    },
    async ({ column }) => {
      try {
        const cards = await board.listCards();
        const filtered = column ? cards.filter((card) => card.column === column) : cards;
        return text(filtered);
      } catch (error) {
        return errorText(error);
      }
    },
  );

  server.registerTool(
    "kaiten_get_card",
    {
      description: "Получить карточку по ID.",
      inputSchema: {
        cardId: z.number().int().positive(),
      },
    },
    async ({ cardId }) => {
      try {
        return text(await client.getCard(cardId));
      } catch (error) {
        return errorText(error);
      }
    },
  );

  server.registerTool(
    "kaiten_create_card",
    {
      description: "Создать карточку в Kaiten.",
      inputSchema: {
        title: z.string().min(1),
        description: z.string().optional(),
        column: z.string().min(1).describe("Название колонки, например 03 Options"),
        lane: z.string().optional().describe("Название дорожки, например Captain"),
        externalId: z.string().optional(),
        ownerId: z.number().int().positive().optional(),
        responsibleId: z.number().int().positive().optional(),
        dueDate: z.string().optional(),
      },
    },
    async (input) => {
      try {
        return text(await board.createCard(input));
      } catch (error) {
        return errorText(error);
      }
    },
  );

  server.registerTool(
    "kaiten_update_card",
    {
      description: "Обновить карточку Kaiten.",
      inputSchema: {
        cardId: z.number().int().positive(),
        title: z.string().optional(),
        description: z.string().optional(),
        column: z.string().optional(),
        lane: z.string().optional(),
        externalId: z.string().optional(),
      },
    },
    async ({ cardId, ...input }) => {
      try {
        return text(await board.updateCard(String(cardId), input));
      } catch (error) {
        return errorText(error);
      }
    },
  );

  server.registerTool(
    "kaiten_move_card",
    {
      description: "Переместить карточку в колонку и дорожку.",
      inputSchema: {
        cardId: z.number().int().positive(),
        column: z.string().min(1),
        lane: z.string().optional(),
      },
    },
    async ({ cardId, column, lane }) => {
      try {
        return text(await board.moveCard(String(cardId), column, lane));
      } catch (error) {
        return errorText(error);
      }
    },
  );

  server.registerTool(
    "kaiten_add_comment",
    {
      description: "Добавить комментарий к карточке.",
      inputSchema: {
        cardId: z.number().int().positive(),
        text: z.string().min(1),
      },
    },
    async ({ cardId, text: comment }) => {
      try {
        await board.addComment(String(cardId), comment);
        return text(`Комментарий добавлен в карточку ${cardId}.`);
      } catch (error) {
        return errorText(error);
      }
    },
  );
}
