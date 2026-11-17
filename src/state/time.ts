export interface TimeStatus {
  now: Date;
  elapsedMin: number;
  remainingMin: number;
  targetRemainingMin: number;
  nextStop: Date | null;
  nextStopLabel: string;
  pastStops: Array<{ at: Date; label: string }>;
}

interface StopRule {
  hours: number;
  minutes: number;
  label: string;
}

const STOP_RULES: StopRule[] = [
  { hours: 12, minutes: 30, label: "стоп новым вариантам" },
  { hours: 17, minutes: 0, label: "стоп новым доказательствам" },
  { hours: 19, minutes: 30, label: "стоп правкам текста" },
  { hours: 20, minutes: 0, label: "отправка" },
  { hours: 22, minutes: 0, label: "крайний срок" },
];

function atTime(start: Date, hours: number, minutes: number): Date {
  const result = new Date(start);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest} мин`;
  return `${hours} ч ${rest} мин`;
}

export function getTimeStatus(startIso: string, deadlineIso: string, targetIso: string, now = new Date()): TimeStatus {
  const start = new Date(startIso);
  const deadline = new Date(deadlineIso);
  const target = new Date(targetIso);

  const stops = STOP_RULES.map((rule) => ({
    at: atTime(start, rule.hours, rule.minutes),
    label: rule.label,
  }));

  const next = stops.find((stop) => stop.at.getTime() > now.getTime()) ?? null;
  const past = stops.filter((stop) => stop.at.getTime() <= now.getTime());

  return {
    now,
    elapsedMin: minutesBetween(start, now),
    remainingMin: minutesBetween(now, deadline),
    targetRemainingMin: minutesBetween(now, target),
    nextStop: next?.at ?? null,
    nextStopLabel: next?.label ?? "дедлайн",
    pastStops: past,
  };
}

export function timeWarning(status: TimeStatus): string | null {
  if (status.remainingMin <= 60) return "До дедлайна меньше часа. Только отправка и бэкап.";
  if (status.targetRemainingMin <= 60) return "До целевой отправки меньше часа. Заканчивайте карточку.";
  if (status.nextStop && minutesBetween(status.now, status.nextStop) <= 15) {
    return `Через 15 минут: ${status.nextStopLabel}.`;
  }
  return null;
}

export const CUT_ORDER = [
  "видео и скриншоты",
  "вопросы жюри — короткая версия",
  "детали архитектуры — оставить 5 компонентов",
  "nice-to-have",
  "блок 6 — план MVP до 5 пунктов",
  "блок 5 — оставить 3 риска",
  "описания вариантов — сократить, но не количество",
];
