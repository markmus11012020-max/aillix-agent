# Aillix Agent — RUNBOOK

## 1. До старта

### Linux

```bash
cd /opt/aillix-agent
cp .env.example .env
chmod 600 .env
# заполнить KAITEN_API_URL, KAITEN_API_TOKEN, KAITEN_BOARD_ID
npm install
npm run build
npm test
chmod +x start.sh
npm run setup:kaiten -- --dry-run
npm run setup:kaiten
npm run seed
```

### Windows

```powershell
cd D:\Invest-Premarket\agent
copy .env.example .env
# заполнить KAITEN_API_URL, KAITEN_API_TOKEN, KAITEN_BOARD_ID
npm install
npm run build
npm test
npm run setup:kaiten -- --dry-run
npm run setup:kaiten
npm run seed
```

Проверить:

- `npm run seed` — «Все колонки Aillix на месте»;
- `npm run smoke` — Kaiten отвечает;
- `node dist/mcp/server.js` запускается без ошибок;
- `/mcps` показывает Kaiten и T-Invest;
- Console открывается на `http://127.0.0.1:8787`;
- токен не попал в Git и логи;
- OpenCode Go подключён: `/connect` → API key → `/models`;
- сертификаты Минцифры установлены;
- `npm run smoke:tinvest` проходит TLS и токен;
- `ssh -T git@github-agent` и `ssh -T git@github-hack` отвечают;
- `git remote -v` в агенте и Work указывает на разные аккаунты.

## 2. Утро 21.11

1. Запустить `./start.sh` на Linux или `.\start.ps1` на Windows.
2. Открыть OpenCode.
3. Проверить `/hackathon status`.
4. Открыть Console.
5. Проверить доску: `hackathon_sync` или `/hackathon sync`.
6. Убедиться, что `STATE.json` создан.

## 3. Запуск

```text
/hackathon start <текст задания>
```

Или в Console: «Пульт» → «Дальше».

## 4. Цикл шага

1. `/hackathon next` — получить директиву.
2. Оркестратор вызывает субагента:
   - `hackathon-captain` для шагов 1–5, 10;
   - `hackathon-developer` для шагов 6–9;
   - `hackathon-reviewer` для шага 11.
3. Субагент выдаёт артефакт, вопросы и рекомендации.
4. Оркестратор записывает артефакт через `hackathon_record`.
5. Капитан отвечает на вопросы и принимает рекомендации.
6. `/hackathon next` — проверить гейт и перейти дальше.

## 5. Вопросы

- не больше 3 за шаг;
- блокирующий вопрос останавливает шаг;
- ответ фиксируется в `DECISIONS.md`;
- карточка вопроса закрывается в Kaiten или `KANBAN.md`.

## 6. Рекомендации

- не больше 3 за шаг;
- помечены `[РЕКОМЕНДАЦИЯ]`;
- капитан принимает, отклоняет или откладывает;
- в карточку попадают только принятые решения.

## 7. Карточка

1. `/hackathon card` — получить шаблон и артефакты.
2. Собрать `card/CARD.md`.
3. `/hackathon check` — линт.
4. Исправить blocker.
5. Капитан читает вслух.
6. Инженер объясняет схему без AI.
7. Скопировать карточку на платформу.
8. Сохранить подтверждение и бэкап.

## 8. Время

| Время | Действие |
|---|---|
| 12:30 | стоп новым вариантам |
| 17:00 | стоп новым доказательствам |
| 19:30 | стоп правкам текста |
| 20:00 | отправка |
| 22:00 | крайний срок |

## 9. Если Kaiten недоступен

1. `BOARD_BACKEND=local`.
2. Перезапустить.
3. Работать в `KANBAN.md`.
4. Console покажет локальную доску.
5. Синхронизировать Kaiten позже, если доступ появится.

## 10. Если LLM недоступен

1. Работать по шаблонам вручную.
2. Заполнять `STATE.json` и артефакты.
3. Использовать `templates/card.md` и `templates/lint.md`.
4. Карточка всё равно должна быть собрана.

## 11. Если Console не открывается

1. Проверить порт 8787.
2. Проверить `UI_TOKEN`.
3. Проверить лог OpenCode.
4. Работать в TUI: `/hackathon status`, `/hackathon next`.

## 12. Финал

- карточка отправлена;
- подтверждение сохранено;
- бэкап `state/` и `card/`;
- дебриф: 3 что сработало, 3 что улучшить.
