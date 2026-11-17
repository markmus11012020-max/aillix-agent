import { STEPS, type State } from "../state/schema.js";
import { countChars, lintCard } from "./lint.js";

export function joinArtifacts(state: State): string {
  return STEPS.map((step) => {
    const content = state.artifacts[step.id] ?? "_нет артефакта_";
    return `## ${step.number}. ${step.title}\n\n${content}`;
  }).join("\n\n");
}

export function buildCardPrompt(template: string, artifacts: string): string {
  return [
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
}

export { countChars, lintCard };
