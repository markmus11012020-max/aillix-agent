export interface LintOptions {
  limit: number;
}

export interface LintIssue {
  code: string;
  message: string;
}

export interface LintResult {
  passed: boolean;
  errors: LintIssue[];
  warnings: LintIssue[];
  charsLf: number;
  charsCrlf: number;
  limit: number;
  reserve: number;
}

export function countChars(text: string): { lf: number; crlf: number } {
  const lf = text.length;
  const newlines = (text.match(/\n/g) ?? []).length;
  return { lf, crlf: lf + newlines };
}

export function lintCard(text: string, options: LintOptions): LintResult {
  const errors: LintIssue[] = [];
  const warnings: LintIssue[] = [];
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const { lf, crlf } = countChars(normalized);

  if (!normalized) {
    errors.push({ code: "empty", message: "Карточка пустая." });
  }

  const blocks = [
    /пользовател/i,
    /решени/i,
    /роль\s+ai|ai-агент/i,
    /mvp/i,
    /техническ|архитектур/i,
    /план/i,
  ];
  if (blocks.filter((pattern) => pattern.test(normalized)).length < 6) {
    errors.push({ code: "blocks", message: "Не все 6 блоков найдены." });
  }

  if (!/ai-агент/i.test(normalized)) {
    errors.push({ code: "direction", message: "Не указано направление «AI-агент»." });
  }
  if (!/hitl|человек подтвержда/i.test(normalized)) {
    errors.push({ code: "hitl", message: "HITL не описан." });
  }
  if (!/mcp/i.test(normalized)) {
    errors.push({ code: "mcp", message: "T-Invest MCP не указан." });
  }
  if (!/риск/i.test(normalized)) {
    errors.push({ code: "risks", message: "Риски не описаны." });
  }
  if (!/вариант/i.test(normalized)) {
    warnings.push({ code: "options", message: "Нет упоминания трёх вариантов." });
  }

  const directAdvice = /(покупать|покупайте|продавать|продавайте|рекомендую\s+(купить|продать))/i;
  if (directAdvice.test(normalized)) {
    errors.push({ code: "advice", message: "Есть прямые рекомендации «покупать/продавать»." });
  }
  if (/100\s*%|гарантиру/i.test(normalized)) {
    errors.push({ code: "guarantee", message: "Есть «100%» или «гарантирует» без замера." });
  }
  if (/старый проект|старый домен|прежний проект|прежний домен/i.test(normalized)) {
    errors.push({ code: "legacy", message: "Есть ссылка на старый проект или домен." });
  }
  if (/gpl|mpl|agpl/i.test(normalized)) {
    errors.push({ code: "license", message: "Есть упоминание GPL/MPL/AGPL." });
  }
  if (/Bearer\s+[A-Za-z0-9._-]+|API_TOKEN\s*=/i.test(normalized)) {
    errors.push({ code: "secret", message: "Похоже на токен или ключ." });
  }
  if (/<\/?[a-z][^>]*>/i.test(normalized)) {
    errors.push({ code: "html", message: "В карточке есть HTML-разметка." });
  }
  if (/https?:\/\//i.test(normalized)) {
    errors.push({ code: "url", message: "В карточке есть внешняя ссылка — удалить или проверить." });
  }
  if (/(игнорируй|ignore)\s+(предыдущ|previous|инструкц|instructions)|system\s+prompt/i.test(normalized)) {
    errors.push({ code: "injection", message: "Похоже на prompt injection в тексте карточки." });
  }
  if (/^#{1,6}\s/m.test(normalized) || /```/.test(normalized)) {
    errors.push({ code: "markdown", message: "В карточке есть markdown-заголовки или блоки кода." });
  }

  const sentences = normalized.split(/[.!?]\s+/).filter(Boolean);
  const longSentences = sentences.filter((sentence) => sentence.split(/\s+/).length > 25);
  if (longSentences.length > 0) {
    warnings.push({
      code: "long-sentences",
      message: `Предложений длиннее 25 слов: ${longSentences.length}.`,
    });
  }

  if (crlf > options.limit) {
    errors.push({
      code: "limit",
      message: `CRLF ${crlf} > лимита ${options.limit}.`,
    });
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    charsLf: lf,
    charsCrlf: crlf,
    limit: options.limit,
    reserve: options.limit - crlf,
  };
}
