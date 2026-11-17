# Kaiten API — рабочий конспект

## 1. База

```text
https://<domain>.kaiten.ru/api/latest
Authorization: Bearer <token>
Content-Type: application/json
```

Лимит: 50 запросов/сек. При 429 — backoff и повтор. Токен не печатать и не логировать.

## 2. Доска

```http
GET /boards/{id}
```

Возвращает `id`, `title`, `columns[]`, `lanes[]`. Используется для маппинга названий колонок и дорожек в ID.

## 3. Карточки

```http
GET /cards?board_id={id}&limit=100&offset=0
GET /cards/{card_id}
POST /cards
PATCH /cards/{card_id}
```

Создание:

```json
{
  "board_id": 1,
  "title": "STEP 03: Три варианта",
  "description": "Артефакт шага",
  "column_id": 10,
  "lane_id": 2,
  "external_id": "aillix:step:03",
  "position": 2
}
```

Обновление и перемещение:

```json
{
  "column_id": 11,
  "lane_id": 2,
  "description": "Новый текст"
}
```

Поля:

- `title` — заголовок;
- `description` — markdown по умолчанию;
- `column_id`, `lane_id` — положение;
- `external_id` — идемпотентность;
- `owner_id`, `responsible_id` — люди;
- `due_date` — ISO 8601;
- `condition` — 1 live, 2 archived.

## 4. Комментарии

```http
POST /cards/{card_id}/comments
```

```json
{ "text": "Черновик или рекомендация" }
```

## 5. Ошибки

| Код | Значение | Действие |
|---|---|---|
| 401 | токен | проверить `KAITEN_API_TOKEN` |
| 402 | тариф | проверить тариф Kaiten |
| 403 | права | проверить права токена |
| 404 | не найдено | проверить board_id, column_id, card_id |
| 429 | лимит | backoff, повтор |

## 6. Маппинг колонок

```text
00 Inbox
01 Intake
02 User
03 Options
04 Compare
05 Value
06 AI/MCP
07 MVP
08 Arch/Risks
09 Plan
10 Card
11 HITL
12 Done
Questions
```

## 7. Правила

- не удалять карточки;
- не переводить в `12 Done` без человека;
- не использовать реальные сделки;
- не хранить токен в state;
- не создавать дубли: `external_id` обязателен для шагов, вопросов и финальной карточки.
