# План подключения агента на Linux

Пошаговый план для чистого Linux-ноутбука. Только локальный контур: агент, OpenCode, Console и ключи живут на ноутбуке. Рабочий репозиторий хакатона — отдельно.

## 0. Что получится

```text
Ноутбук
  ├── /opt/aillix-agent
  │   ├── Aillix Agent
  │   ├── OpenCode
  │   ├── Kaiten MCP
  │   ├── T-Invest MCP
  │   ├── Console 127.0.0.1:8787
  │   └── .env с токенами
  └── /work/hackathon
      └── новый репозиторий Работы
```

- Код агента не попадает в Работу.
- OpenCode Go подключается один раз на ноутбуке.
- T-Invest MCP — sandbox и read-only токен.
- Без интернета работают state, Console и локальная доска.
- VPS и удалённый сервер не используются.

## 1. Ноутбук

Рекомендуется Ubuntu 24.04 или Debian 12.

1. Включите полное шифрование диска (LUKS) при установке.
2. Создайте двух пользователей:
   - `aillix` — агент, ключи, Kaiten, T-Invest;
   - `work` — хакатон, рабочий репозиторий.
   Если второй пользователь не нужен, используйте два каталога: `/opt/aillix-agent` и `/work/hackathon`.
3. Обновите систему:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential ca-certificates
```

4. Установите Node.js 20+. Проще через `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
node --version
npm --version
```

5. Установите VS Code. Remote-SSH не нужен: всё локально.

## 2. Разделение каталогов

```bash
sudo mkdir -p /opt/aillix-agent
sudo chown -R "$USER":"$USER" /opt/aillix-agent
mkdir -p /work/hackathon
```

- `/opt/aillix-agent` — инструмент. Приватный репозиторий или архив.
- `/work/hackathon` — Работа. Новый репозиторий создаётся в начале хакатона.
- В `/work/hackathon` не должно быть `agent/`, `state/`, `.env`, `node_modules`.

## 3. Установка OpenCode

```bash
curl -fsSL https://opencode.ai/v2/install | bash
```

Или через npm:

```bash
npm install -g @opencode/cli
```

Проверка:

```bash
opencode --version
```

Если команда не найдена:

```bash
export PATH="$HOME/.opencode/bin:$PATH"
source ~/.bashrc
```

## 4. Сертификаты Минцифры

Нужны для T-Invest MCP.

1. Скачайте с `https://www.gosuslugi.ru/landing/crt`:
   - `Russian_Trusted_Root_CA.cer`
   - `Russian_Trusted_Sub_CA.cer`

2. Положите в `~/certs`:

```bash
mkdir -p ~/certs
```

3. Установите в систему:

```bash
sudo cp ~/certs/Russian_Trusted_Root_CA.cer /usr/local/share/ca-certificates/Russian_Trusted_Root_CA.crt
sudo cp ~/certs/Russian_Trusted_Sub_CA.cer /usr/local/share/ca-certificates/Russian_Trusted_Sub_CA.crt
sudo update-ca-certificates
```

4. Соберите bundle для Node/OpenCode:

```bash
cat ~/certs/Russian_Trusted_Root_CA.cer ~/certs/Russian_Trusted_Sub_CA.cer > ~/certs/russian-trusted.pem
```

5. Проверьте TLS:

```bash
curl -I https://sandbox-invest-public-api.tbank.ru/mcp
```

Если TLS проходит — сертификаты установлены. Код ответа может быть 401/405, это нормально.

`start.sh` сам подхватит `~/certs/russian-trusted.pem` и выставит `NODE_EXTRA_CA_CERTS` и `SSL_CERT_FILE`. Если bundle лежит в другом месте, задайте в `.env`:

```env
T_INVEST_CA_BUNDLE=/path/to/russian-trusted.pem
```

## 5. Установка агента

Скопируйте проект в `/opt/aillix-agent`:

```bash
cd /opt/aillix-agent
npm install
npm run build
npm test
```

Создайте `.env`:

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Заполните:

```env
KAITEN_API_URL=https://<domain>.kaiten.ru/api/latest
KAITEN_API_TOKEN=<token>
KAITEN_BOARD_ID=<board_id>
KAITEN_READ_ONLY=0
BOARD_BACKEND=kaiten

T_INVEST_MCP_URL=https://sandbox-invest-public-api.tbank.ru/mcp
T_INVEST_TOKEN=<read-only token>
T_INVEST_READ_ONLY=1

HACKATHON_START=2026-11-21T10:00:00+03:00
HACKATHON_DEADLINE=2026-11-21T22:00:00+03:00
HACKATHON_TARGET=2026-11-21T20:00:00+03:00
CARD_LIMIT=6000
UI_PORT=8787
UI_TOKEN=
```

Если Kaiten нет:

```env
BOARD_BACKEND=local
KAITEN_READ_ONLY=1
```

Сделайте скрипт запуска исполняемым:

```bash
chmod +x start.sh
```

## 6. T-Invest MCP

- URL: `https://sandbox-invest-public-api.tbank.ru/mcp`.
- Авторизация: `Authorization: Bearer <T_INVEST_TOKEN>`.
- Токен — из личного кабинета Т-Инвестиций.
- Для аналитики — только чтение.
- Торговые права не нужны.
- Prod-URL не используем на хакатоне.

Проверка:

```bash
cd /opt/aillix-agent
npm run smoke:tinvest
```

Если 401/403 — токен или права. Если TLS-ошибка — сертификаты.

После запуска OpenCode:

```text
opencode mcp list
```

Должны быть `kaiten` и `t-invest` в статусе `connected`.

## 7. Подключение OpenCode Go

1. Откройте TUI:

```bash
cd /opt/aillix-agent
opencode
```

2. Выполните:

```text
/connect
```

3. Выберите **OpenCode Go**.
4. Вставьте API key из `https://opencode.ai/console`.
5. Выберите модель:

```text
/models
```

6. Проверьте:

```text
Ответь одним словом: тест.
```

Если ответ есть — модель работает. Агент наследует модель сессии. Отдельный LLM-ключ в `agent/.env` не нужен.

## 8. Запуск агента

```bash
cd /opt/aillix-agent
./start.sh
```

Скрипт:

- загружает `.env`;
- подхватывает сертификаты Минцифры;
- собирает проект;
- запускает OpenCode;
- Console доступна на `http://127.0.0.1:8787`.

В OpenCode:

```text
/hackathon start <текст задания>
```

Или в Console: «Пульт» → «Старт».

## 9. Рабочий репозиторий

В начале хакатона:

```bash
mkdir -p /work/hackathon
cd /work/hackathon
git init
git remote add origin git@github-hack:<hack-account>/<work-repo>.git
```

`.gitignore` в Work:

```gitignore
.env
state/
node_modules/
dist/
```

Правило:

- агент пишет карточку в `/opt/aillix-agent/card/CARD.md`;
- капитан проверяет и копирует текст в `/work/hackathon` и на платформу;
- кода агента в Work нет.

## 10. GitHub: два аккаунта

| Что | Аккаунт | Репозиторий |
|---|---|---|
| Aillix Agent | личный | приватный `aillix-agent` |
| Работа хакатона | хакатонный | отдельный `work` |

### 10.1. Два SSH-ключа

```bash
ssh-keygen -t ed25519 -C "aillix-agent" -f ~/.ssh/id_ed25519_agent
ssh-keygen -t ed25519 -C "hackathon-work" -f ~/.ssh/id_ed25519_hack
```

Добавьте публичные ключи:

```bash
cat ~/.ssh/id_ed25519_agent.pub
cat ~/.ssh/id_ed25519_hack.pub
```

- первый — в личный GitHub;
- второй — в хакатонный GitHub.

`~/.ssh/config`:

```sshconfig
Host github-agent
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_agent
  IdentitiesOnly yes

Host github-hack
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_hack
  IdentitiesOnly yes
```

Проверка:

```bash
ssh -T git@github-agent
ssh -T git@github-hack
```

### 10.2. Две git-identity

`~/.gitconfig`:

```gitconfig
[user]
  name = Aillix
  email = personal@example.com

[includeIf "gitdir:/opt/aillix-agent/"]
  path = ~/.gitconfig-agent

[includeIf "gitdir:/work/hackathon/"]
  path = ~/.gitconfig-hack
```

`~/.gitconfig-agent`:

```gitconfig
[user]
  name = Aillix
  email = personal@example.com
```

`~/.gitconfig-hack`:

```gitconfig
[user]
  name = Hack Team
  email = hack@example.com
```

Проверка в каждом репозитории:

```bash
git config --show-origin --get user.email
```

### 10.3. Пуш агента

1. Создайте **приватный** репозиторий `aillix-agent` в личном аккаунте.
2. На ноутбуке:

```bash
cd /opt/aillix-agent
git init
git add .
git status --short
```

Проверьте, что нет `.env`, `state/STATE.json`, `card/CARD.md`, `node_modules/`, `dist/`.

```bash
git commit -m "feat: Aillix Agent v1.0"
git branch -M main
git remote add origin git@github-agent:<personal>/aillix-agent.git
git remote -v
git push -u origin main
```

### 10.4. Пуш Работы

```bash
cd /work/hackathon
git add .
git commit -m "feat: hackathon work"
git push -u origin main
```

### 10.5. Защита от перепутывания

- разные SSH-ключи;
- разные remote: `github-agent` и `github-hack`;
- проверка `git remote -v` перед push;
- проверка `git config --show-origin --get user.email`;
- pre-push hook в агенте:

```bash
#!/usr/bin/env bash
remote="$2"
if [[ "$remote" != *"github-agent"* ]]; then
  echo "Wrong remote: $remote. Expected github-agent." >&2
  exit 1
fi
```

В Work — тот же hook, но с `github-hack`.

## 11. Kaiten

1. Создайте доску и колонки:

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

2. Проверьте доступ:

```bash
cd /opt/aillix-agent
npm run seed
npm run smoke
```

3. Если колонок не хватает, `seed` покажет список. Создайте их в Kaiten.

4. Если Kaiten недоступен:

```bash
export BOARD_BACKEND=local
./start.sh
```

Агент будет писать в `KANBAN.md`.

## 12. Console

- Открывается на `http://127.0.0.1:8787`.
- Слушает только localhost.
- Если задан `UI_TOKEN`, введите его в «Настройки».
- Экраны: Пульт, Задание, Варианты, Карточка, Вопросы, Рекомендации, Доска, Журнал, Настройки.
- «Дальше» отправляет команду в OpenCode.
- «Собрать» просит агента собрать карточку.
- «Проверить» запускает линт.

## 13. Безопасность

- LUKS на диске.
- Отдельный пользователь или каталог для агента.
- `.env` с `chmod 600`.
- Токены не в Git, не в карточке, не на скриншотах.
- OpenCode Go key хранится в OpenCode, не в проекте.
- T-Invest token — read-only, sandbox.
- После хакатона отозвать Kaiten-токен, T-Invest-токен и ротировать OpenCode Go key.
- При необходимости удалить `/opt/aillix-agent` и затереть свободное место.
- VPS и удалённый сервер не используются.

## 14. Офлайн-режим

Работают:

- state;
- артефакты;
- Console;
- локальная доска `KANBAN.md`;
- шаблоны карточки и линт.

Не работают:

- LLM-запросы;
- Kaiten и T-Invest, если они внешние.

Действия:

1. Включить hotspot.
2. Если LLM недоступен — работать по шаблонам вручную.
3. Если Kaiten недоступен — `BOARD_BACKEND=local`.
4. Карточку всё равно собрать и отправить до 20:00.

## 15. Проверка до 21.11

- [ ] Linux установлен, диск зашифрован.
- [ ] Node.js 20+ и npm работают.
- [ ] OpenCode установлен, `opencode --version` отвечает.
- [ ] Сертификаты Минцифры установлены, TLS проверен.
- [ ] `/connect` → OpenCode Go → API key.
- [ ] `/models` → модель выбрана.
- [ ] Тестовый ответ LLM получен.
- [ ] T-Invest MCP: `npm run smoke:tinvest`.
- [ ] Агент собран: `npm run build`.
- [ ] Тесты: `npm test`.
- [ ] `.env` заполнен, `chmod 600`.
- [ ] `./start.sh` запускается.
- [ ] `opencode mcp list` — `kaiten` и `t-invest`.
- [ ] Console открывается на 8787.
- [ ] `hackathon_status` работает.
- [ ] Kaiten или `KANBAN.md` работает.
- [ ] Offline-режим проверен.
- [ ] GitHub: два аккаунта, два ключа, два remote.
- [ ] Рабочий репозиторий отдельно от агента.

## 16. Troubleshooting

| Симптом | Что делать |
|---|---|
| `opencode: command not found` | Добавить `$HOME/.opencode/bin` в PATH |
| `node: command not found` | Установить Node через nvm |
| TLS-ошибка T-Invest | Установить сертификаты Минцифры, проверить `NODE_EXTRA_CA_CERTS` |
| `/connect` не показывает OpenCode Go | Проверить подписку и API key в console |
| `Model unavailable` | `/models`, выбрать доступную модель |
| `t-invest` не подключён | Проверить `T_INVEST_MCP_URL`, токен, сертификаты |
| MCP not connected | `opencode mcp list`, проверить `dist/mcp/server.js` |
| Плагин не загрузился | Проверить `.opencode/plugins/aillix.js` и `npm run build` |
| 401 Kaiten | Проверить `KAITEN_API_TOKEN` |
| 403 Kaiten | Проверить права токена |
| 404 Kaiten | Проверить `KAITEN_BOARD_ID` и колонки |
| 429 Kaiten | Подождать, сработает backoff |
| Console не открывается | Проверить `UI_PORT` и `UI_TOKEN` |
| Нет интернета | `BOARD_BACKEND=local`, ручной режим, hotspot |
