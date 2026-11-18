import path from "node:path";
import type { AppConfig } from "../config.js";
import type { Board } from "../types.js";
import { LocalBoard } from "../board/local.js";
import {
  STEPS,
  StateSchema,
  createInitialState,
  stepById,
  type Decision,
  type Question,
  type Recommendation,
  type State,
} from "./schema.js";
import {
  createDecision,
  createQuestion,
  createRecommendation,
  formatQuestion,
  formatRecommendation,
  openBlockingQuestions,
  proposedRecommendations,
} from "./protocol.js";
import { advance, dashboard, gateReport } from "./machine.js";
import { writeCanvas } from "../board/canvas.js";
import { getTimeStatus, timeWarning } from "./time.js";
import { ensureDir, readJson, readText, writeJsonAtomic, writeTextAtomic } from "../utils/fs.js";

export interface QuestionInput {
  step: State["step"];
  text: string;
  why: string;
  options?: string[];
  recommended?: string;
  blocking?: boolean;
}

export interface RecommendationInput {
  step: State["step"];
  text: string;
  rationale: string;
  confidence?: "low" | "medium" | "high";
  changeCondition?: string;
}

export interface DecisionInput {
  step: State["step"];
  text: string;
  reason: string;
  who?: string;
}

export class StateStore {
  private readonly stateFile: string;
  private readonly stateMd: string;
  private readonly artifactsDir: string;
  private readonly questionsFile: string;
  private readonly recommendationsFile: string;
  private readonly decisionsFile: string;
  private readonly cardDir: string;
  private readonly cardFile: string;
  private readonly templatesDir: string;
  private board: Board;
  private readonly fallbackBoard: Board;

  constructor(
    private readonly config: AppConfig,
    board: Board,
  ) {
    this.stateFile = path.join(config.stateDir, "STATE.json");
    this.stateMd = path.join(config.stateDir, "STATE.md");
    this.artifactsDir = path.join(config.stateDir, "artifacts");
    this.questionsFile = path.join(config.stateDir, "QUESTIONS.md");
    this.recommendationsFile = path.join(config.stateDir, "RECOMMENDATIONS.md");
    this.decisionsFile = path.join(config.stateDir, "DECISIONS.md");
    this.cardDir = config.cardDir;
    this.cardFile = path.join(config.cardDir, "CARD.md");
    this.templatesDir = path.resolve(config.projectRoot, "templates");
    this.board = board;
    this.fallbackBoard = new LocalBoard(config.stateDir, config.boardFile);
  }

  async load(): Promise<State | null> {
    const raw = await readJson<unknown>(this.stateFile, null);
    if (!raw) return null;
    return StateSchema.parse(raw);
  }

  async get(): Promise<State> {
    const state = await this.load();
    if (!state) throw new Error("State not initialized. Run hackathon_init first.");
    return state;
  }

  async init(task: string): Promise<State> {
    await ensureDir(this.config.stateDir);
    await ensureDir(this.artifactsDir);
    await ensureDir(this.cardDir);
    const state = createInitialState(task);
    state.board.backend = this.board.kind;
    await this.save(state);
    await this.ensureStepCard(state, state.step);
    return this.get();
  }

  private async boardCall<T>(fn: (board: Board) => Promise<T>): Promise<T> {
    try {
      return await fn(this.board);
    } catch {
      this.board = this.fallbackBoard;
      return fn(this.board);
    }
  }

  private ensureLocalBoard(state: State): void {
    if (this.board.kind === "local" && state.board.backend !== "local") {
      state.board.cards = {};
      state.board.finalCardId = undefined;
      state.board.backend = "local";
    }
  }

  async save(state: State): Promise<void> {
    state.updatedAt = new Date().toISOString();
    StateSchema.parse(state);
    await ensureDir(this.config.stateDir);
    await writeJsonAtomic(this.stateFile, state);
    await writeTextAtomic(this.stateMd, this.renderStateMd(state));
    await writeTextAtomic(this.questionsFile, this.renderQuestionsMd(state));
    await writeTextAtomic(this.recommendationsFile, this.renderRecommendationsMd(state));
    await writeTextAtomic(this.decisionsFile, this.renderDecisionsMd(state));
    await writeCanvas(state, this.config).catch(() => {
      // Canvas — витрина, состояние важнее
    });
  }

  async recordArtifact(step: State["step"], content: string): Promise<State> {
    const state = await this.get();
    state.artifacts[step] = content.trim();
    await this.save(state);
    await this.updateStepCard(state, step);
    return state;
  }

  async getArtifact(step: State["step"]): Promise<string> {
    const state = await this.get();
    return state.artifacts[step] ?? "";
  }

  async ask(input: QuestionInput): Promise<{ state: State; question: Question }> {
    const state = await this.get();
    this.ensureLocalBoard(state);
    const question = createQuestion(state.questions, input);
    state.questions.push(question);
    await this.save(state);
    try {
      const card = await this.boardCall((board) =>
        board.createCard({
          title: `QUESTION ${question.id}: ${question.text.slice(0, 80)}`,
          description: formatQuestion(question),
          column: "Questions",
          lane: "Both",
          externalId: `aillix:question:${question.id}`,
        }),
      );
      state.board.cards[`question:${question.id}`] = card.id;
      await this.save(state);
    } catch {
      // вопрос сохраняется даже если доска недоступна
    }
    return { state, question };
  }

  async answer(id: string, answer: string): Promise<State> {
    const state = await this.get();
    this.ensureLocalBoard(state);
    const question = state.questions.find((item) => item.id === id);
    if (!question) throw new Error(`Question not found: ${id}`);
    question.status = "answered";
    question.answer = answer;
    question.answeredAt = new Date().toISOString();
    await this.save(state);
    const cardId = state.board.cards[`question:${id}`];
    if (cardId) {
      try {
        await this.boardCall((board) => board.addComment(cardId, `Ответ: ${answer}`));
        await this.boardCall((board) => board.moveCard(cardId, "12 Done"));
      } catch {
        // ответ уже сохранён в state
      }
    }
    return state;
  }

  async recommend(input: RecommendationInput): Promise<{ state: State; recommendation: Recommendation }> {
    const state = await this.get();
    const recommendation = createRecommendation(state.recommendations, input);
    state.recommendations.push(recommendation);
    await this.save(state);
    return { state, recommendation };
  }

  async decideRecommendation(
    id: string,
    action: "accepted" | "rejected" | "deferred",
    decision: string,
  ): Promise<State> {
    const state = await this.get();
    const recommendation = state.recommendations.find((item) => item.id === id);
    if (!recommendation) throw new Error(`Recommendation not found: ${id}`);
    recommendation.status = action;
    recommendation.decision = decision;
    recommendation.decidedAt = new Date().toISOString();
    if (action !== "deferred") {
      state.decisions.push(
        createDecision(state.decisions, {
          step: recommendation.step,
          text: `Рекомендация ${recommendation.id}: ${action}`,
          reason: decision,
        }),
      );
    }
    await this.save(state);
    return state;
  }

  async decide(input: DecisionInput): Promise<State> {
    const state = await this.get();
    state.decisions.push(createDecision(state.decisions, input));
    await this.save(state);
    return state;
  }

  async advance(): Promise<State> {
    const state = await this.get();
    this.ensureLocalBoard(state);
    const report = gateReport(state);
    if (!report.passed) {
      throw new Error(`Gate not passed: ${report.blockers.join(", ")}`);
    }
    const previous = state.step;
    const next = advance(state);
    await this.save(next);
    const previousCard = next.board.cards[`step:${previous}`];
    if (previousCard) {
      try {
        await this.boardCall((board) => board.moveCard(previousCard, "12 Done"));
      } catch {
        // state уже перешёл дальше
      }
    }
    if (next.status === "active") {
      await this.ensureStepCard(next, next.step);
    }
    return this.get();
  }

  async dashboard() {
    const state = await this.get();
    return dashboard(state, this.config);
  }

  async readCard(): Promise<string> {
    try {
      return await readText(this.cardFile);
    } catch {
      return "";
    }
  }

  async writeCard(text: string): Promise<void> {
    await ensureDir(this.cardDir);
    await writeTextAtomic(this.cardFile, text.trim());
    const state = await this.get();
    this.ensureLocalBoard(state);
    const card = await this.ensureFinalCard(state);
    try {
      await this.boardCall((board) => board.updateCard(card.id, { description: text.trim() }));
      await this.boardCall((board) => board.moveCard(card.id, "10 Card"));
    } catch {
      // карточка уже сохранена в файл
    }
    await this.save(state);
  }

  async submit(): Promise<State> {
    const state = await this.get();
    if (state.step !== "red_team" && state.status !== "done") {
      throw new Error("Финальная отправка доступна только после шага 11.");
    }
    state.status = "done";
    await this.save(state);
    const card = await this.ensureFinalCard(state);
    try {
      await this.boardCall((board) => board.addComment(card.id, `Отправлено капитаном: ${new Date().toISOString()}`));
      await this.boardCall((board) => board.moveCard(card.id, "12 Done"));
    } catch {
      // статус и файл карточки уже сохранены
    }
    return this.get();
  }

  async cardContext(): Promise<{ template: string; artifacts: string; prompt: string }> {
    const state = await this.get();
    const template = await readText(path.join(this.templatesDir, "card.md")).catch(() => "");
    const artifacts = STEPS.map((step) => {
      const content = state.artifacts[step.id] ?? "_нет артефакта_";
      return `## ${step.number}. ${step.title}\n\n${content}`;
    }).join("\n\n");
    const prompt = [
      "Собери карточку проекта из артефактов.",
      "Используй шаблон ниже.",
      "Выведи только текст карточки без markdown.",
      "Списки — через «•», не более 8–10 пунктов, предложения не длиннее 25 слов.",
      "Каждое число — с источником или пометкой «цель».",
      "Не добавляй факты, которых нет в артефактах.",
      "Не давай рекомендаций «покупать/продавать».",
      "",
      "ШАБЛОН:",
      template,
      "",
      "АРТЕФАКТЫ:",
      artifacts,
    ].join("\n");
    return { template, artifacts, prompt };
  }

  async syncBoard(): Promise<{ ok: boolean; message: string; cards: number }> {
    const state = await this.get();
    this.ensureLocalBoard(state);
    for (const step of STEPS) {
      if (state.artifacts[step.id] || step.id === state.step) {
        await this.ensureStepCard(state, step.id);
      }
    }
    await this.ensureFinalCard(state);
    const health = await this.boardCall((board) => board.health());
    await this.save(state);
    return { ok: health.ok, message: health.message, cards: Object.keys(state.board.cards).length };
  }

  private async ensureStepCard(state: State, stepId: State["step"]): Promise<string> {
    this.ensureLocalBoard(state);
    const key = `step:${stepId}`;
    if (state.board.cards[key]) return state.board.cards[key];
    const step = stepById(stepId);
    const card = await this.boardCall((board) =>
      board.createCard({
        title: `STEP ${String(step.number).padStart(2, "0")}: ${step.title}`,
        description: state.artifacts[stepId] ?? "Артефакт ещё не создан.",
        column: step.boardColumn,
        lane: step.owner === "captain" ? "Captain" : step.owner === "developer" ? "Developer" : "Both",
        externalId: `aillix:step:${String(step.number).padStart(2, "0")}`,
      }),
    );
    state.board.cards[key] = card.id;
    state.board.backend = this.board.kind;
    await this.save(state);
    return card.id;
  }

  private async updateStepCard(state: State, stepId: State["step"]): Promise<void> {
    try {
      const cardId = await this.ensureStepCard(state, stepId);
      const content = state.artifacts[stepId] ?? "";
      await this.boardCall((board) =>
        board.updateCard(cardId, {
          description: content.slice(0, 6000),
          column: stepById(stepId).boardColumn,
        }),
      );
      await this.boardCall((board) =>
        board.addComment(cardId, `Обновлено: ${new Date().toISOString()}`),
      );
    } catch {
      // артефакт уже сохранён в state
    }
  }

  private async ensureFinalCard(state: State): Promise<{ id: string }> {
    this.ensureLocalBoard(state);
    if (state.board.finalCardId) return { id: state.board.finalCardId };
    const card = await this.boardCall((board) =>
      board.createCard({
        title: "CARD: Aillix",
        description: "Финальная карточка проекта.",
        column: "10 Card",
        lane: "Both",
        externalId: "aillix:card:final",
      }),
    );
    state.board.finalCardId = card.id;
    await this.save(state);
    return { id: card.id };
  }

  private renderStateMd(state: State): string {
    const time = getTimeStatus(this.config.hackathon.start, this.config.hackathon.deadline, this.config.hackathon.target);
    const warning = timeWarning(time);
    const blocking = openBlockingQuestions(state.questions);
    const proposed = proposedRecommendations(state.recommendations);
    const current = stepById(state.step);
    const lines: string[] = [
      "# Aillix Agent — состояние",
      "",
      `Проект: ${state.project}`,
      `Старт: ${state.startedAt}`,
      `Текущий шаг: ${current.number}. ${current.title}`,
      `Владелец: ${current.owner}`,
      `Прошло: ${time.elapsedMin} мин`,
      `До дедлайна: ${time.remainingMin} мин`,
      `До целевой отправки: ${time.targetRemainingMin} мин`,
      `Следующий стоп: ${time.nextStopLabel}`,
      warning ? `Внимание: ${warning}` : "Внимание: нет",
      "",
      "## Шаги",
      "",
      "| # | Шаг | Владелец | Артефакт | Статус |",
      "|---|---|---|---|---|",
    ];
    for (const step of STEPS) {
      const has = Boolean(state.artifacts[step.id]);
      const isCurrent = step.id === state.step;
      lines.push(
        `| ${step.number} | ${step.title} | ${step.owner} | ${has ? "есть" : "нет"} | ${isCurrent ? "текущий" : has ? "готов" : "ожидает"} |`,
      );
    }
    lines.push("", "## Блокеры", "");
    const report = gateReport(state);
    if (report.blockers.length === 0) lines.push("_Нет._");
    else for (const blocker of report.blockers) lines.push(`- ${blocker}`);
    lines.push("", "## Вопросы", "");
    if (blocking.length === 0) lines.push("_Нет открытых блокирующих вопросов._");
    else for (const question of blocking) lines.push(`- ${question.id}: ${question.text}`);
    lines.push("", "## Рекомендации", "");
    if (proposed.length === 0) lines.push("_Нет рекомендаций, ждущих решения._");
    else for (const recommendation of proposed) lines.push(`- ${recommendation.id}: ${recommendation.text}`);
    lines.push("", "## Дальше", "");
    lines.push(report.passed ? `Запустить шаг ${current.number}.` : "Закрыть блокеры и ответить на вопросы.");
    lines.push("");
    return lines.join("\n");
  }

  private renderQuestionsMd(state: State): string {
    const lines = [
      "# Вопросы",
      "",
      "| ID | Шаг | Вопрос | Блокирует | Статус | Ответ |",
      "|---|---|---|---|---|---|",
    ];
    for (const question of state.questions) {
      lines.push(
        `| ${question.id} | ${question.step} | ${question.text.replace(/\|/g, "\\|")} | ${question.blocking ? "да" : "нет"} | ${question.status} | ${(question.answer ?? "").replace(/\|/g, "\\|")} |`,
      );
    }
    lines.push("");
    return lines.join("\n");
  }

  private renderRecommendationsMd(state: State): string {
    const lines = [
      "# Рекомендации",
      "",
      "| ID | Шаг | Рекомендация | Уверенность | Статус | Решение |",
      "|---|---|---|---|---|---|",
    ];
    for (const recommendation of state.recommendations) {
      lines.push(
        `| ${recommendation.id} | ${recommendation.step} | ${recommendation.text.replace(/\|/g, "\\|")} | ${recommendation.confidence} | ${recommendation.status} | ${(recommendation.decision ?? "").replace(/\|/g, "\\|")} |`,
      );
    }
    lines.push("");
    return lines.join("\n");
  }

  private renderDecisionsMd(state: State): string {
    const lines = [
      "# Решения",
      "",
      "| Время | Шаг | Решение | Причина | Кто |",
      "|---|---|---|---|---|",
    ];
    for (const decision of state.decisions) {
      lines.push(
        `| ${decision.createdAt} | ${decision.step} | ${decision.text.replace(/\|/g, "\\|")} | ${decision.reason.replace(/\|/g, "\\|")} | ${decision.who} |`,
      );
    }
    lines.push("");
    return lines.join("\n");
  }
}
