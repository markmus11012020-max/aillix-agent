import { Plugin } from "@opencode/plugin";
import { createBoardWithFallback } from "../board/factory.js";
import { loadConfig } from "../config.js";
import { StateStore } from "../state/store.js";
import { startUiServer } from "../ui/server.js";
import { registerHackathonTools } from "./tools.js";

export default Plugin.define({
  id: "aillix-hackathon",
  async setup(ctx) {
    console.error("Aillix plugin: setup start");
    const config = loadConfig({ projectRoot: ctx.location.directory });
    const board = await createBoardWithFallback(config);
    console.error(`Aillix plugin: board ${board.kind}`);
    const store = new StateStore(config, board);

    await registerHackathonTools(ctx, store, config);
    console.error("Aillix plugin: tools registered");

    let ui: { close: () => Promise<void>; url: string } | undefined;
    try {
      ui = startUiServer({
        store,
        board,
        config,
        onPrompt: async (text) => {
          const page = await ctx.session.list({
            directory: ctx.location.directory,
            limit: 1,
            order: "desc",
          });
          const session = page.data?.[0];
          if (!session) return "Нет активной сессии OpenCode. Откройте сессию и повторите.";
          await ctx.session.prompt({ sessionID: session.id, text });
          return "Команда отправлена в OpenCode.";
        },
      });
      console.error(`Aillix plugin: UI ${ui.url}`);
    } catch (error) {
      console.error(`Aillix Console не запущен: ${(error as Error).message}`);
    }

    const hook = await ctx.session.hook("context", async (event) => {
      try {
        const state = await store.get();
        const dashboard = await store.dashboard();
        event.system.push({
          type: "text",
          text: [
            "<aillix-state>",
            `Шаг: ${dashboard.stepNumber}. ${dashboard.stepTitle}`,
            `Владелец: ${dashboard.owner}`,
            `Статус: ${dashboard.status}`,
            `Прошло: ${dashboard.elapsedMin} мин; до дедлайна: ${dashboard.remainingMin} мин`,
            `Вопросы: ${dashboard.openQuestions}; блокирующих: ${dashboard.blockingQuestions}`,
            `Рекомендации ждут решения: ${dashboard.proposedRecommendations}`,
            dashboard.blockers.length ? `Блокеры: ${dashboard.blockers.join("; ")}` : "Блокеров нет.",
            "Правило: агент рекомендует, капитан решает. Код не писать. Прямых рекомендаций не давать.",
            "</aillix-state>",
          ].join("\n"),
        });
      } catch {
        // state may not be initialized yet
      }
    });

    return async () => {
      await hook.dispose();
      if (ui) await ui.close();
    };
  },
});
