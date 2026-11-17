# Aillix Agent — ARCHITECTURE

## 1. Компоненты

```text
OpenCode
  ├── plugin (TypeScript)
  │   ├── hackathon_* tools
  │   ├── state machine
  │   ├── HITL / permissions
  │   ├── Kaiten / local board
  │   └── Console HTTP server
  ├── MCP servers
  │   ├── kaiten (local)
  │   └── t-invest (remote sandbox)
  ├── agents
  │   ├── hackathon
  │   ├── hackathon-captain
  │   ├── hackathon-developer
  │   └── hackathon-reviewer
  └── commands
      └── /hackathon ...
```

## 2. Поток данных

```text
Задание
  → orchestrator
  → captain / developer / reviewer
  → артефакт шага
  → STATE.json
  → Kaiten или KANBAN.md
  → Console
  → человек
  → решение
  → следующий шаг
```

## 3. State machine

| # | Шаг | Владелец | Артефакт | Колонка |
|---|---|---|---|---|
| 1 | Intake | captain | `01_intake.md` | 01 Intake |
| 2 | User | captain | `02_user.md` | 02 User |
| 3 | Options | captain | `03_options.md` | 03 Options |
| 4 | Compare | captain | `04_compare.md` | 04 Compare |
| 5 | Value | captain | `05_value.md` | 05 Value |
| 6 | AI/MCP | developer | `06_ai_mcp.md` | 06 AI/MCP |
| 7 | MVP | developer | `07_mvp.md` | 07 MVP |
| 8 | Architecture/Risks | developer | `08_architecture.md` | 08 Arch/Risks |
| 9 | Plan | developer | `09_plan.md` | 09 Plan |
| 10 | Card | orchestrator | `10_card.md` | 10 Card |
| 11 | Red Team | reviewer | `11_red_team.md` | 11 HITL |

## 4. Гейты

- артефакт создан;
- нет открытых блокирующих вопросов;
- нет `TODO`;
- шаговые проверки: A/B/C, матрица, HITL, MCP, must-have, риски, даты, 6 блоков, blocker.

## 5. Доска

- Kaiten: `GET /boards/{id}`, `POST /cards`, `PATCH /cards/{id}`, `POST /cards/{id}/comments`.
- Local: `state/local-board.json` → `KANBAN.md`.
- `external_id = aillix:step:NN` защищает от дублей.
- `Questions` — отдельная колонка.
- `10 Card` — финальная карточка.
- `11 HITL` — человек.
- `12 Done` — только после человека.

## 6. T-Invest MCP

- Remote Streamable HTTP.
- Sandbox: `https://sandbox-invest-public-api.tbank.ru/mcp`.
- Auth: `Authorization: Bearer <T_INVEST_TOKEN>`.
- Token: read-only, sandbox.
- Сертификаты Минцифры: `Russian_Trusted_Root_CA`, `Russian_Trusted_Sub_CA`.
- `start.sh` выставляет `NODE_EXTRA_CA_CERTS` и `SSL_CERT_FILE`.
- Проверка: `npm run smoke:tinvest`, затем `/mcps`.
- Торговые права не используются.

## 7. Console

- HTTP-сервер в плагине.
- `GET /api/state` — состояние, пульт, доска, карточка.
- `POST /api/answer` — ответ на вопрос.
- `POST /api/recommendation` — решение по рекомендации.
- `POST /api/decision` — решение капитана.
- `POST /api/next` — отправить команду в OpenCode.
- `POST /api/card/assemble` — собрать карточку.
- `POST /api/check` — линт.
- `POST /api/sync` — синхронизация.
- Только `127.0.0.1`, опциональный `UI_TOKEN`.

## 8. Хранилище

```text
state/
  STATE.json
  STATE.md
  QUESTIONS.md
  RECOMMENDATIONS.md
  DECISIONS.md
  artifacts/
  local-board.json
card/
  CARD.md
```

## 9. Безопасность

- токен Kaiten и T-Invest только в `.env`;
- T-Invest token read-only, sandbox;
- сертификаты Минцифры установлены;
- Console только локально;
- удаление карточек запрещено;
- HITL и отправка — только человек;
- shell запрещён;
- `.env` запрещён для записи агентом;
- только локальный контур.
