import type { Decision, Question, Recommendation } from "./schema.js";
import type { StepId } from "../types.js";

export interface QuestionInput {
  step: StepId;
  text: string;
  why: string;
  options?: string[];
  recommended?: string;
  blocking?: boolean;
}

export interface RecommendationInput {
  step: StepId;
  text: string;
  rationale: string;
  confidence?: "low" | "medium" | "high";
  changeCondition?: string;
}

export interface DecisionInput {
  step: StepId;
  text: string;
  reason: string;
  who?: string;
}

function nextId(prefix: string, existing: Array<{ id: string }>): string {
  const max = existing
    .map((item) => Number.parseInt(item.id.replace(/\D+/g, ""), 10))
    .filter((value) => Number.isFinite(value))
    .reduce((acc, value) => Math.max(acc, value), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function createQuestion(existing: Question[], input: QuestionInput): Question {
  return {
    id: nextId("Q", existing),
    step: input.step,
    text: input.text,
    why: input.why,
    options: input.options,
    recommended: input.recommended,
    blocking: input.blocking ?? false,
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

export function createRecommendation(existing: Recommendation[], input: RecommendationInput): Recommendation {
  return {
    id: nextId("R", existing),
    step: input.step,
    text: input.text,
    rationale: input.rationale,
    confidence: input.confidence ?? "medium",
    changeCondition: input.changeCondition ?? "не задано",
    status: "proposed",
    createdAt: new Date().toISOString(),
  };
}

export function createDecision(existing: Decision[], input: DecisionInput): Decision {
  return {
    id: nextId("D", existing),
    step: input.step,
    text: input.text,
    reason: input.reason,
    who: input.who ?? "капитан",
    createdAt: new Date().toISOString(),
  };
}

export function formatQuestion(question: Question): string {
  const lines = [
    `[${question.id}] ${question.text}`,
    `Почему важно: ${question.why}`,
  ];
  if (question.options?.length) lines.push(`Варианты: ${question.options.join(" / ")}`);
  if (question.recommended) lines.push(`Рекомендация: ${question.recommended}`);
  lines.push(`Блокирует шаг: ${question.blocking ? "да" : "нет"}`);
  return lines.join("\n");
}

export function formatRecommendation(recommendation: Recommendation): string {
  return [
    `[РЕКОМЕНДАЦИЯ ${recommendation.id}] ${recommendation.text}`,
    `Почему: ${recommendation.rationale}`,
    `Уверенность: ${recommendation.confidence}`,
    `Что изменит: ${recommendation.changeCondition}`,
    `Статус: ${recommendation.status}`,
  ].join("\n");
}

export function openBlockingQuestions(questions: Question[]): Question[] {
  return questions.filter((question) => question.blocking && question.status === "open");
}

export function proposedRecommendations(recommendations: Recommendation[]): Recommendation[] {
  return recommendations.filter((recommendation) => recommendation.status === "proposed");
}

export function protocolSummary(questions: Question[], recommendations: Recommendation[]): string {
  const open = questions.filter((question) => question.status === "open");
  const proposed = proposedRecommendations(recommendations);
  return [
    `Открытых вопросов: ${open.length}`,
    `Блокирующих: ${openBlockingQuestions(questions).length}`,
    `Рекомендаций ждут решения: ${proposed.length}`,
  ].join(". ");
}
