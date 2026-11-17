import { describe, expect, it } from "vitest";
import {
  createDecision,
  createQuestion,
  createRecommendation,
  formatQuestion,
  formatRecommendation,
  openBlockingQuestions,
} from "../src/state/protocol.js";

describe("protocol", () => {
  it("creates sequential question ids", () => {
    const first = createQuestion([], {
      step: "intake",
      text: "Вопрос 1",
      why: "Причина",
      blocking: true,
    });
    const second = createQuestion([first], {
      step: "intake",
      text: "Вопрос 2",
      why: "Причина",
    });
    expect(first.id).toBe("Q-001");
    expect(second.id).toBe("Q-002");
    expect(openBlockingQuestions([first, second])).toHaveLength(1);
  });

  it("creates recommendations and decisions", () => {
    const recommendation = createRecommendation([], {
      step: "options",
      text: "Выбрать A",
      rationale: "Лучше по MCP",
      confidence: "high",
    });
    expect(recommendation.id).toBe("R-001");
    expect(formatRecommendation(recommendation)).toContain("РЕКОМЕНДАЦИЯ");

    const decision = createDecision([], {
      step: "options",
      text: "Выбрать A",
      reason: "Капитан согласен",
    });
    expect(decision.id).toBe("D-001");
  });

  it("formats a question", () => {
    const question = createQuestion([], {
      step: "user",
      text: "Кто пользователь?",
      why: "Нужен один сегмент",
      blocking: false,
    });
    expect(formatQuestion(question)).toContain("Кто пользователь?");
  });
});
