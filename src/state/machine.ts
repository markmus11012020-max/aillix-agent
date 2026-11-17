import type { AppConfig } from "../config.js";
import type { StepId } from "../types.js";
import { STEPS, nextStep, stepById, type State } from "./schema.js";
import { openBlockingQuestions } from "./protocol.js";
import { getTimeStatus, timeWarning } from "./time.js";

export interface GateCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface GateReport {
  step: StepId;
  passed: boolean;
  checks: GateCheck[];
  blockers: string[];
}

function artifactText(state: State, step: StepId): string {
  return state.artifacts[step] ?? "";
}

function hasAll(text: string, patterns: RegExp[]): boolean {
  return patterns.every((pattern) => pattern.test(text));
}

function stepSpecificChecks(state: State, step: StepId): GateCheck[] {
  const text = artifactText(state, step);
  const checks: GateCheck[] = [];

  if (step === "options") {
    checks.push({
      label: "три варианта A/B/C",
      passed: hasAll(text, [/вариант\s*a/i, /вариант\s*b/i, /вариант\s*c/i]),
    });
  }
  if (step === "compare") {
    checks.push({
      label: "матрица и решение",
      passed: /матриц/i.test(text) && /решени/i.test(text),
    });
  }
  if (step === "value") {
    checks.push({
      label: "HITL и сценарий",
      passed: /hitl|человек/i.test(text) && /шаг/i.test(text),
    });
  }
  if (step === "ai_mcp") {
    checks.push({
      label: "AI, MCP, HITL",
      passed: /ai/i.test(text) && /mcp/i.test(text) && /hitl|человек/i.test(text),
    });
  }
  if (step === "mvp") {
    checks.push({
      label: "must-have и out-of-scope",
      passed: /must[- ]?have/i.test(text) && /out[- ]?of[- ]?scope|вне скоупа/i.test(text),
    });
  }
  if (step === "architecture") {
    const riskCount = (text.match(/риск/gi) ?? []).length;
    checks.push({
      label: "не меньше 3 упоминаний рисков",
      passed: riskCount >= 3,
      detail: `найдено: ${riskCount}`,
    });
  }
  if (step === "plan") {
    checks.push({
      label: "даты 23.11–03.12",
      passed: /23[.\-–]?11|23 ноября/i.test(text) && /03[.\-–]?12|3 декабря/i.test(text),
    });
  }
  if (step === "card") {
    checks.push({
      label: "6 блоков",
      passed:
        /пользовател/i.test(text) &&
        /решени/i.test(text) &&
        /роль ai|ai-агент/i.test(text) &&
        /mvp/i.test(text) &&
        /техническ|архитектур/i.test(text) &&
        /план/i.test(text),
    });
  }
  if (step === "red_team") {
    checks.push({
      label: "blocker и чек-лист",
      passed: /blocker|блокер/i.test(text) && /чек[- ]?лист/i.test(text),
    });
  }

  return checks;
}

export function gateReport(state: State): GateReport {
  const step = stepById(state.step);
  const text = artifactText(state, state.step);
  const blocking = openBlockingQuestions(state.questions);

  const checks: GateCheck[] = [
    {
      label: "артефакт шага создан",
      passed: text.trim().length >= 200,
      detail: text.trim().length >= 200 ? "ok" : "нужно не меньше 200 символов",
    },
    {
      label: "нет открытых блокирующих вопросов",
      passed: blocking.length === 0,
      detail: blocking.length === 0 ? "ok" : `открыто: ${blocking.length}`,
    },
    {
      label: "в артефакте нет TODO",
      passed: !/todo|заполнить позже/i.test(text),
    },
    ...stepSpecificChecks(state, state.step),
  ];

  const blockers = checks.filter((check) => !check.passed).map((check) => check.label);
  return { step: state.step, passed: blockers.length === 0, checks, blockers };
}

export function canAdvance(state: State): boolean {
  return state.status === "active" && gateReport(state).passed;
}

export function advance(state: State): State {
  const report = gateReport(state);
  if (!report.passed) {
    throw new Error(`Gate not passed: ${report.blockers.join(", ")}`);
  }
  const next = nextStep(state.step);
  const now = new Date().toISOString();
  if (!next) {
    return { ...state, status: "done", updatedAt: now };
  }
  return { ...state, step: next.id, updatedAt: now };
}

export function dashboard(state: State, config: AppConfig) {
  const step = stepById(state.step);
  const report = gateReport(state);
  const time = getTimeStatus(config.hackathon.start, config.hackathon.deadline, config.hackathon.target);
  const blocking = openBlockingQuestions(state.questions);
  const proposed = state.recommendations.filter((item) => item.status === "proposed");

  const blockers = [...report.blockers];
  if (blocking.length > 0) blockers.push(`вопросов без ответа: ${blocking.length}`);
  if (state.status === "done") blockers.length = 0;

  const progress = state.status === "done" ? 100 : Math.round(((step.number - 1) / STEPS.length) * 100);
  const warning = timeWarning(time);

  return {
    step: state.step,
    stepNumber: step.number,
    stepTitle: step.title,
    owner: step.owner,
    status: state.status === "done" ? ("done" as const) : blockers.length > 0 ? ("blocked" as const) : ("ready" as const),
    progress,
    startedAt: state.startedAt,
    elapsedMin: time.elapsedMin,
    remainingMin: time.remainingMin,
    nextStop: time.nextStop?.toISOString() ?? "",
    nextStopLabel: time.nextStopLabel,
    openQuestions: state.questions.filter((item) => item.status === "open").length,
    blockingQuestions: blocking.length,
    proposedRecommendations: proposed.length,
    blockers,
    nextAction:
      state.status === "done"
        ? "Карточка отправлена. Бэкап и дебриф."
        : blockers.length > 0
          ? "Закрыть блокеры и ответить на вопросы."
          : `Запустить шаг ${step.number}: ${step.title}.`,
    warning,
  };
}
