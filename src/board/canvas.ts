import type { AppConfig } from "../config.js";
import type { State } from "../state/schema.js";
import { STEPS, stepById } from "../state/schema.js";
import { gateReport } from "../state/machine.js";
import { writeJsonAtomic } from "../utils/fs.js";

interface CanvasNode {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide: "right" | "left" | "top" | "bottom";
  toNode: string;
  toSide: "right" | "left" | "top" | "bottom";
  label?: string;
}

interface CanvasFile {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

function short(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function stepNodeId(index: number): string {
  return `step-${STEPS[index].number}`;
}

export function buildCanvas(state: State): CanvasFile {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const report = gateReport(state);
  const current = stepById(state.step);

  nodes.push({
    id: "project",
    type: "text",
    text: [
      "# Aillix Agent",
      "",
      `**Задание:** ${short(state.task, 240)}`,
      "",
      `**Шаг:** ${current.number}. ${current.title}`,
      `**Владелец:** ${current.owner}`,
      `**Статус:** ${state.status}`,
      `**Артефактов:** ${Object.keys(state.artifacts).length} из ${STEPS.length}`,
      `**Вопросов:** ${state.questions.length}`,
      `**Рекомендаций:** ${state.recommendations.length}`,
    ].join("\n"),
    x: 0,
    y: 0,
    width: 420,
    height: 250,
    color: "5",
  });

  STEPS.forEach((step, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const artifact = state.artifacts[step.id] ?? "";
    const isCurrent = step.id === state.step;
    const done = Boolean(artifact) && !isCurrent;
    const gate = isCurrent
      ? report.passed
        ? "гейт пройден"
        : `блокеры: ${report.blockers.join(", ") || "нет"}`
      : done
        ? "готов"
        : "ожидает";
    nodes.push({
      id: stepNodeId(index),
      type: "text",
      text: [
        `## ${String(step.number).padStart(2, "0")}. ${step.title}`,
        `Владелец: ${step.owner}`,
        `Артефакт: ${artifact ? "есть" : "нет"}`,
        `Гейт: ${gate}`,
      ].join("\n"),
      x: 520 + column * 340,
      y: row * 190,
      width: 300,
      height: 160,
      color: isCurrent ? "3" : done ? "4" : undefined,
    });
  });

  for (let index = 0; index < STEPS.length - 1; index += 1) {
    edges.push({
      id: `edge-step-${index + 1}-${index + 2}`,
      fromNode: stepNodeId(index),
      fromSide: "right",
      toNode: stepNodeId(index + 1),
      toSide: "left",
    });
  }

  const currentIndex = STEPS.findIndex((step) => step.id === state.step);
  if (currentIndex >= 0) {
    edges.push({
      id: "edge-project-current",
      fromNode: "project",
      fromSide: "right",
      toNode: stepNodeId(currentIndex),
      toSide: "left",
      label: "сейчас",
    });
  }

  state.questions.forEach((question, index) => {
    const id = `question-${question.id}`;
    const stepIndex = STEPS.findIndex((step) => step.id === question.step);
    nodes.push({
      id,
      type: "text",
      text: [
        `### ${question.id}${question.blocking ? " · блокирующий" : ""}`,
        short(question.text, 220),
        `Статус: ${question.status}`,
      ].join("\n"),
      x: 520,
      y: 620 + index * 150,
      width: 380,
      height: 120,
      color: question.status === "open" ? (question.blocking ? "1" : "2") : "4",
    });
    if (stepIndex >= 0) {
      edges.push({
        id: `edge-question-${question.id}`,
        fromNode: id,
        fromSide: "right",
        toNode: stepNodeId(stepIndex),
        toSide: "bottom",
        label: "вопрос",
      });
    }
  });

  state.recommendations.forEach((recommendation, index) => {
    const id = `recommendation-${recommendation.id}`;
    const stepIndex = STEPS.findIndex((step) => step.id === recommendation.step);
    nodes.push({
      id,
      type: "text",
      text: [
        `### ${recommendation.id} · ${recommendation.status}`,
        short(recommendation.text, 220),
        `Уверенность: ${recommendation.confidence}`,
      ].join("\n"),
      x: 960,
      y: 620 + index * 150,
      width: 380,
      height: 120,
      color: recommendation.status === "proposed" ? "5" : "4",
    });
    if (stepIndex >= 0) {
      edges.push({
        id: `edge-recommendation-${recommendation.id}`,
        fromNode: id,
        fromSide: "right",
        toNode: stepNodeId(stepIndex),
        toSide: "bottom",
        label: "рекомендация",
      });
    }
  });

  state.decisions.forEach((decision, index) => {
    const id = `decision-${decision.id}`;
    const stepIndex = STEPS.findIndex((step) => step.id === decision.step);
    nodes.push({
      id,
      type: "text",
      text: [
        `### ${decision.id} · решение`,
        short(decision.text, 220),
        `Кто: ${decision.who}`,
      ].join("\n"),
      x: 1400,
      y: 620 + index * 150,
      width: 380,
      height: 120,
      color: "6",
    });
    if (stepIndex >= 0) {
      edges.push({
        id: `edge-decision-${decision.id}`,
        fromNode: id,
        fromSide: "right",
        toNode: stepNodeId(stepIndex),
        toSide: "bottom",
        label: "решение",
      });
    }
  });

  return { nodes, edges };
}

export async function writeCanvas(state: State, config: AppConfig): Promise<void> {
  if (!config.canvasFile) return;
  await writeJsonAtomic(config.canvasFile, buildCanvas(state));
}
