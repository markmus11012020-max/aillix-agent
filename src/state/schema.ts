import { z } from "zod";
import type { AgentRole, StepDefinition, StepId } from "../types.js";

export const STEP_IDS = [
  "intake",
  "user",
  "options",
  "compare",
  "value",
  "ai_mcp",
  "mvp",
  "architecture",
  "plan",
  "card",
  "red_team",
] as const;

export const StepIdSchema = z.enum(STEP_IDS);

export const STEPS: StepDefinition[] = [
  {
    id: "intake",
    number: 1,
    title: "Задача и рамки",
    owner: "captain",
    artifact: "01_intake.md",
    boardColumn: "01 Intake",
    timeLimitMin: 30,
    gate: [
      "задание записано дословно",
      "факты отделены от предположений",
      "критерии оценки выписаны",
      "ограничения выписаны",
      "неизвестные перечислены",
      "3–5 вопросов менторам",
    ],
  },
  {
    id: "user",
    number: 2,
    title: "Пользователь и проблема",
    owner: "captain",
    artifact: "02_user.md",
    boardColumn: "02 User",
    timeLimitMin: 30,
    gate: [
      "три сегмента описаны",
      "выбран один основной пользователь",
      "боль в деньгах, времени или риске",
      "текущие решения и их ограничения",
      "связь с бизнесом Т-Инвестиций",
      "блок 1 карточки собран",
    ],
  },
  {
    id: "options",
    number: 3,
    title: "Три варианта",
    owner: "captain",
    artifact: "03_options.md",
    boardColumn: "03 Options",
    timeLimitMin: 45,
    gate: [
      "три варианта из разных классов",
      "у каждого есть пользователь, боль и ценность",
      "у каждого есть роль AI и роль кода",
      "у каждого есть T-Invest MCP",
      "у каждого есть реализуемость 1–5",
      "победитель ещё не выбран",
    ],
  },
  {
    id: "compare",
    number: 4,
    title: "Сравнение и выбор",
    owner: "captain",
    artifact: "04_compare.md",
    boardColumn: "04 Compare",
    timeLimitMin: 45,
    gate: [
      "матрица заполнена",
      "у каждой оценки есть объяснение",
      "чувствительность проверена",
      "выбран один вариант",
      "причины выбора и отклонения записаны",
      "решение капитана зафиксировано",
    ],
  },
  {
    id: "value",
    number: 5,
    title: "Ценность и сценарий",
    owner: "captain",
    artifact: "05_value.md",
    boardColumn: "05 Value",
    timeLimitMin: 40,
    gate: [
      "ценностное предложение в одном предложении",
      "сценарий из 5 шагов",
      "HITL описан",
      "поведение без данных описано",
      "демо на 3 минуты",
      "блок 2 карточки собран",
    ],
  },
  {
    id: "ai_mcp",
    number: 6,
    title: "AI, T-Invest MCP, HITL",
    owner: "developer",
    artifact: "06_ai_mcp.md",
    boardColumn: "06 AI/MCP",
    timeLimitMin: 50,
    gate: [
      "AI и код разделены",
      "AI не считает числа",
      "карта T-Invest MCP заполнена",
      "инструменты подтверждены или «ПРОВЕРИТЬ»",
      "HITL описан",
      "отказы описаны",
      "блок 3 карточки собран",
    ],
  },
  {
    id: "mvp",
    number: 7,
    title: "MVP и ценность",
    owner: "developer",
    artifact: "07_mvp.md",
    boardColumn: "07 MVP",
    timeLimitMin: 30,
    gate: [
      "must-have не больше 5",
      "out-of-scope минимум 3",
      "один сквозной сценарий",
      "ценность наблюдаема",
      "критерии приёмки",
      "блок 4 карточки собран",
    ],
  },
  {
    id: "architecture",
    number: 8,
    title: "Архитектура и риски",
    owner: "developer",
    artifact: "08_architecture.md",
    boardColumn: "08 Arch/Risks",
    timeLimitMin: 40,
    gate: [
      "компонентов не больше 7",
      "потоки данных описаны",
      "внешние источники описаны",
      "хранилище описано",
      "безопасность описана",
      "пять рисков с мерами и владельцами",
      "блок 5 карточки собран",
    ],
  },
  {
    id: "plan",
    number: 9,
    title: "План MVP",
    owner: "developer",
    artifact: "09_plan.md",
    boardColumn: "09 Plan",
    timeLimitMin: 30,
    gate: [
      "даты 23.11–03.12",
      "владельцы и результаты",
      "предпроверка 03.12",
      "демо 05.12",
      "что не успеем",
      "буфер не меньше 20%",
      "блок 6 карточки собран",
    ],
  },
  {
    id: "card",
    number: 10,
    title: "Сборка карточки",
    owner: "orchestrator",
    artifact: "10_card.md",
    boardColumn: "10 Card",
    timeLimitMin: 40,
    gate: [
      "6 блоков",
      "направление «AI-агент»",
      "каждое число с источником или «цель»",
      "нет прямых рекомендаций",
      "нет старых проектов и доменов",
      "лимит не превышен",
      "реестры заполнены",
    ],
  },
  {
    id: "red_team",
    number: 11,
    title: "Красная команда и финал",
    owner: "reviewer",
    artifact: "11_red_team.md",
    boardColumn: "11 HITL",
    timeLimitMin: 40,
    gate: [
      "нет blocker",
      "противоречия исправлены",
      "финальная карточка",
      "питч на 3 минуты",
      "15 вопросов жюри",
      "чек-лист отправки",
    ],
  },
];

export function stepById(id: StepId): StepDefinition {
  const step = STEPS.find((item) => item.id === id);
  if (!step) throw new Error(`Unknown step: ${id}`);
  return step;
}

export function stepByNumber(number: number): StepDefinition {
  const step = STEPS.find((item) => item.number === number);
  if (!step) throw new Error(`Unknown step number: ${number}`);
  return step;
}

export function nextStep(id: StepId): StepDefinition | undefined {
  const index = STEPS.findIndex((item) => item.id === id);
  return STEPS[index + 1];
}

export function ownerLabel(owner: AgentRole): string {
  return {
    orchestrator: "Оркестратор",
    captain: "Капитан",
    developer: "Инженер",
    reviewer: "Ревьюер",
  }[owner];
}

export const QuestionSchema = z.object({
  id: z.string(),
  step: StepIdSchema,
  text: z.string(),
  why: z.string(),
  options: z.array(z.string()).optional(),
  recommended: z.string().optional(),
  blocking: z.boolean(),
  status: z.enum(["open", "answered", "closed"]),
  answer: z.string().optional(),
  createdAt: z.string(),
  answeredAt: z.string().optional(),
});

export const RecommendationSchema = z.object({
  id: z.string(),
  step: StepIdSchema,
  text: z.string(),
  rationale: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  changeCondition: z.string(),
  status: z.enum(["proposed", "accepted", "rejected", "deferred"]),
  decision: z.string().optional(),
  createdAt: z.string(),
  decidedAt: z.string().optional(),
});

export const DecisionSchema = z.object({
  id: z.string(),
  step: StepIdSchema,
  text: z.string(),
  reason: z.string(),
  who: z.string(),
  createdAt: z.string(),
});

export const StateSchema = z.object({
  version: z.literal(1),
  project: z.string(),
  startedAt: z.string(),
  step: StepIdSchema,
  status: z.enum(["active", "done"]),
  task: z.string(),
  artifacts: z.record(z.string()),
  questions: z.array(QuestionSchema),
  recommendations: z.array(RecommendationSchema),
  decisions: z.array(DecisionSchema),
  board: z.object({
    backend: z.preprocess((value) => (value === "kaiten" ? "local" : value), z.literal("local")),
    cards: z.record(z.string()),
    finalCardId: z.string().optional(),
  }),
  updatedAt: z.string(),
});

export type State = z.infer<typeof StateSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type Decision = z.infer<typeof DecisionSchema>;

export function createInitialState(task: string, project = "Aillix"): State {
  const now = new Date().toISOString();
  return {
    version: 1,
    project,
    startedAt: now,
    step: "intake",
    status: "active",
    task,
    artifacts: {},
    questions: [],
    recommendations: [],
    decisions: [],
    board: {
      backend: "local",
      cards: {},
    },
    updatedAt: now,
  };
}
