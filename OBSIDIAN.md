# Aillix Agent — Obsidian Kanban и Canvas

## 1. Роль Obsidian

Obsidian — **односторонняя витрина**. Источник истины — `state/STATE.json` и `state/local-board.json`. Агент пишет `KANBAN.md` и `AILLIX_CANVAS.canvas`, человек читает. Ручные правки доски будут перезаписаны.

## 2. Vault

Рекомендуемый vault:

```text
D:\Invest-Premarket\board
```

Файлы:

```text
board/
  KANBAN.md
  AILLIX_CANVAS.canvas
```

Пути в `agent/.env`:

```env
BOARD_FILE=../board/KANBAN.md
CANVAS_FILE=../board/AILLIX_CANVAS.canvas
```

## 3. Установка

1. Установить Obsidian.
2. Открыть vault `D:\Invest-Premarket\board`.
3. Settings → Community plugins → включить Kanban.
4. Открыть `KANBAN.md` и проверить, что видны колонки.
5. Открыть `AILLIX_CANVAS.canvas` и проверить карту.

Плагин Kanban читает frontmatter:

```yaml
---
kanban-plugin: board
---
```

Без него файл откроется как обычный markdown.

## 4. Формат доски

- 14 колонок: `00 Inbox` … `12 Done`, `Questions`.
- Карточка: `- [ ] CARD-001 | Название`.
- Метаданные: `external_id`, `lane`, `description`, `comment`.
- Дорожки `Captain`, `Developer`, `Both` — как поле `lane`.
- `external_id = aillix:step:NN` защищает от дублей.

## 5. Canvas

Canvas генерируется из `STATE.json`:

```powershell
npm run canvas
```

На карте:

- проект и текущий шаг;
- 11 шагов с владельцем и статусом артефакта;
- вопросы;
- рекомендации;
- решения;
- связи шаг → вопрос → решение.

Canvas — витрина, не источник истины. Ручные правки будут перезаписаны.

## 6. Проверка

```powershell
npm run smoke
```

Скрипт показывает:

- путь к `KANBAN.md`;
- путь к `AILLIX_CANVAS.canvas`;
- число колонок и карточек.

## 7. Ограничения

- Нет двусторонней синхронизации.
- Drag-and-drop в Obsidian не меняет state.
- Во время работы агента доску не редактируем.
- Если нужна ручная правка — остановить агента, сделать бэкап, править после.
- Облачная синхронизация vault во время прогона не рекомендуется.

## 8. Отказы

- Obsidian не установлен → `KANBAN.md` открывается любым редактором.
- Плагин Kanban не работает → файл остаётся валидным markdown.
- Canvas не открывается → `npm run canvas`, продолжить без него.
- Потерян `KANBAN.md` → `hackathon_sync` перерисует из state.
