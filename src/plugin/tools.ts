import { Plugin } from "@opencode/plugin";
import { lintCard } from "../card/lint.js";
import type { AppConfig } from "../config.js";
import { gateReport } from "../state/machine.js";
import { STEPS, stepById, type State } from "../state/schema.js";
import type { StateStore } from "../state/store.js";

type Ctx = Plugin.Context;

function obj(properties: Record<string, unknown>, required: string[] = []) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function text(value: unknown) {
  return { content: typeof value === "string" ? value : JSON.stringify(value, null, 2) };
}

function ownerAgent(owner: string): string {
  if (owner === "captain") return "hackathon-captain";
  if (owner === "developer") return "hackathon-developer";
  if (owner === "reviewer") return "hackathon-reviewer";
  return "hackathon";
}

function formatStatus(
  dashboard: Awaited<ReturnType<StateStore["dashboard"]>>,
  state: State,
  config: AppConfig,
): string {
  const lines = [
    `Aillix Agent`,
    `Шаг ${dashboard.stepNumber}: ${dashboard.stepTitle}`,
    `Владелец: ${dashboard.owner}`,
    `Статус: ${dashboard.status}`,
    `Прогресс: ${dashboard.progress}%`,
    `Прошло: ${dashboard.elapsedMin} мин`,
    `До дедлайна: ${dashboard.remainingMin} мин`,
    `Следующий стоп: ${dashboard.nextStopLabel}`,
    `Вопросы: ${dashboard.openQuestions} (блокирующих ${dashboard.blockingQuestions})`,
    `Рекомендации ждут решения: ${dashboard.proposedRecommendations}`,
    `Доска: ${config.boardFile}`,
    `Canvas: ${config.canvasFile}`,
    "",
    dashboard.blockers.length ? `Блокеры:\n- ${dashboard.blockers.join("\n- ")}` : "Блокеров нет.",
    "",
    `Дальше: ${dashboard.nextAction}`,
  ];
  if (dashboard.warning) lines.push("", `Внимание: ${dashboard.warning}`);
  return lines.join("\n");
}

export async function registerHackathonTools(ctx: Ctx, store: StateStore, config: AppConfig): Promise<void> {
  await ctx.tool.transform((editor) => {
    editor.namespace({
      name: "hackathon",
      description: "Aillix Agent: состояние, шаги, вопросы, рекомендации, карточка и доска.",
    });

    editor.add({
      name: "init",
      description: "Инициализировать Aillix Agent: создать state и первую карточку шага.",
      input: obj({ task: { type: "string", description: "Текст задания организаторов." } }, ["task"]),
      options: { namespace: "hackathon", codemode: true },
      execute: async (input, context) => {
        await ctx.permission.assert({
          sessionID: context.sessionID,
          agent: context.agent,
          action: "hackathon_init",
          resources: ["state"],
          save: [],
        });
        const state = await store.init((input as { task: string }).task);
        return text(
          `Aillix Agent инициализирован. Текущий шаг: ${stepById(state.step).title}.\n` +
            `Доска: ${config.boardFile}\nCanvas: ${config.canvasFile}`,
        );
      },
    });

    editor.add({
      name: "status",
      description: "Показать пульт: шаг, время, вопросы, рекомендации, блокеры.",
      input: obj({}),
      options: { namespace: "hackathon", codemode: true },
      execute: async () => {
        const state = await store.get();
        const dashboard = await store.dashboard();
        return text(formatStatus(dashboard, state, config));
      },
    });

    editor.add({
      name: "next",
      description: "Получить директиву следующего шага или причину блокировки.",
      input: obj({}),
      options: { namespace: "hackathon", codemode: true },
      execute: async () => {
        let state = await store.get();
        const current = stepById(state.step);

        if (state.status === "done") {
          return text("Все шаги завершены. Карточка отправлена. Сделайте бэкап и дебриф.");
        }

        const artifact = state.artifacts[state.step] ?? "";
        const report = gateReport(state);

        if (artifact.trim().length > 0 && report.passed) {
          state = await store.advance();
          if (state.status === "done") {
            return text("Все шаги завершены. Переходите к отправке карточки и бэкапу.");
          }
          const next = stepById(state.step);
          return text({
            step: next.id,
            number: next.number,
            title: next.title,
            owner: next.owner,
            agent: ownerAgent(next.owner),
            promptFile: `../Aillix/${promptFileFor(next.number)}`,
            timeLimitMin: next.timeLimitMin,
            gate: next.gate,
            action: `Запусти шаг ${next.number}: ${next.title}.`,
          });
        }

        if (artifact.trim().length > 0 && !report.passed) {
          return text({
            blocked: true,
            step: current.id,
            number: current.number,
            title: current.title,
            blockers: report.blockers,
            checks: report.checks,
            action: "Закрой блокеры и повтори hackathon_next.",
          });
        }

        return text({
          step: current.id,
          number: current.number,
          title: current.title,
          owner: current.owner,
          agent: ownerAgent(current.owner),
          promptFile: `../Aillix/${promptFileFor(current.number)}`,
          timeLimitMin: current.timeLimitMin,
          gate: current.gate,
          action: `Запусти шаг ${current.number}: ${current.title}.`,
        });
      },
    });

    editor.add({
      name: "record",
      description: "Записать артефакт шага.",
      input: obj(
        {
          step: { type: "string", description: "ID шага, например intake или options." },
          content: { type: "string", description: "Текст артефакта." },
        },
        ["step", "content"],
      ),
      options: { namespace: "hackathon", codemode: true },
      execute: async (input) => {
        const { step, content } = input as { step: State["step"]; content: string };
        const state = await store.recordArtifact(step, content);
        return text(`Артефакт шага ${step} записан. Длина: ${content.length} символов.`);
      },
    });

    editor.add({
      name: "question",
      description: "Задать вопрос капитану и создать карточку вопроса.",
      input: obj(
        {
          text: { type: "string" },
          why: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          recommended: { type: "string" },
          blocking: { type: "boolean" },
        },
        ["text", "why"],
      ),
      options: { namespace: "hackathon", codemode: true },
      execute: async (input, context) => {
        await ctx.permission.assert({
          sessionID: context.sessionID,
          agent: context.agent,
          action: "hackathon_question",
          resources: ["question"],
          save: [],
        });
        const state = await store.get();
        const data = input as {
          text: string;
          why: string;
          options?: string[];
          recommended?: string;
          blocking?: boolean;
        };
        const result = await store.ask({ ...data, step: state.step });
        return text(
          `Вопрос ${result.question.id} создан. Блокирует: ${result.question.blocking ? "да" : "нет"}.`,
        );
      },
    });

    editor.add({
      name: "recommend",
      description: "Записать рекомендацию агента. Не является решением.",
      input: obj(
        {
          text: { type: "string" },
          rationale: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          changeCondition: { type: "string" },
        },
        ["text", "rationale"],
      ),
      options: { namespace: "hackathon", codemode: true },
      execute: async (input) => {
        const state = await store.get();
        const data = input as {
          text: string;
          rationale: string;
          confidence?: "low" | "medium" | "high";
          changeCondition?: string;
        };
        const result = await store.recommend({ ...data, step: state.step });
        return text(`[РЕКОМЕНДАЦИЯ ${result.recommendation.id}] ${result.recommendation.text}`);
      },
    });

    editor.add({
      name: "decide",
      description: "Зафиксировать решение капитана или принять/отклонить рекомендацию.",
      input: obj(
        {
          text: { type: "string" },
          reason: { type: "string" },
          recommendationId: { type: "string" },
          action: { type: "string", enum: ["accepted", "rejected", "deferred"] },
        },
        ["text", "reason"],
      ),
      options: { namespace: "hackathon", codemode: true },
      execute: async (input, context) => {
        await ctx.permission.assert({
          sessionID: context.sessionID,
          agent: context.agent,
          action: "hackathon_decide",
          resources: ["decision"],
          save: [],
        });
        const state = await store.get();
        const data = input as {
          text: string;
          reason: string;
          recommendationId?: string;
          action?: "accepted" | "rejected" | "deferred";
        };
        if (data.recommendationId && data.action) {
          await store.decideRecommendation(data.recommendationId, data.action, data.text);
        } else {
          await store.decide({ step: state.step, text: data.text, reason: data.reason });
        }
        return text("Решение записано.");
      },
    });

    editor.add({
      name: "card",
      description: "Получить шаблон, артефакты и промпт для сборки карточки.",
      input: obj({}),
      options: { namespace: "hackathon", codemode: true },
      execute: async () => {
        const context = await store.cardContext();
        return text(context.prompt);
      },
    });

    editor.add({
      name: "check",
      description: "Проверить карточку по линту.",
      input: obj({}),
      options: { namespace: "hackathon", codemode: true },
      execute: async () => {
        const card = await store.readCard();
        if (!card.trim()) return text("Карточка не найдена. Сначала соберите card/CARD.md.");
        return text(lintCard(card, { limit: config.cardLimit }));
      },
    });

    editor.add({
      name: "sync",
      description: "Синхронизировать состояние с Obsidian Kanban и Canvas.",
      input: obj({}),
      options: { namespace: "hackathon", codemode: true },
      execute: async (_input, context) => {
        await ctx.permission.assert({
          sessionID: context.sessionID,
          agent: context.agent,
          action: "hackathon_sync",
          resources: ["board"],
          save: [],
        });
        const result = await store.syncBoard();
        return text(result);
      },
    });

    editor.add({
      name: "submit",
      description: "Финальное подтверждение капитана: перевести карточку в Done.",
      input: obj({}),
      options: { namespace: "hackathon", codemode: true },
      execute: async (_input, context) => {
        await ctx.permission.assert({
          sessionID: context.sessionID,
          agent: context.agent,
          action: "hackathon_submit",
          resources: ["card"],
          save: [],
        });
        const state = await store.submit();
        return text(`Карточка переведена в Done. Статус: ${state.status}.`);
      },
    });
  });
}

function promptFileFor(number: number): string {
  const map: Record<number, string> = {
    1: "10_ПРОМПТ_01_ЗАДАЧА.md",
    2: "11_ПРОМПТ_02_ПОЛЬЗОВАТЕЛЬ.md",
    3: "12_ПРОМПТ_03_ТРИ_ВАРИАНТА.md",
    4: "13_ПРОМПТ_04_СРАВНЕНИЕ.md",
    5: "14_ПРОМПТ_05_ЦЕННОСТЬ.md",
    6: "15_ПРОМПТ_06_AI_MCP.md",
    7: "16_ПРОМПТ_07_MVP.md",
    8: "17_ПРОМПТ_08_АРХИТЕКТУРА_РИСКИ.md",
    9: "18_ПРОМПТ_09_ПЛАН.md",
    10: "19_ПРОМПТ_10_КАРТОЧКА.md",
    11: "20_ПРОМПТ_11_ФИНАЛ.md",
  };
  return map[number] ?? "00_README.md";
}
