# План подключения агента на Linux

Пошаговый план для чистого Linux-ноутбука. Только локальный контур: агент, OpenCode, Console и ключи живут на ноутбуке. Рабочий репозиторий хакатона — отдельно.

## 0. Что получится

```text
Ноутбук
  ├── /opt/aillix-agent
  │   ├── Aillix Agent
  │   ├── OpenCode
  │   ├── Obsidian Kanban/Canvas
  │   ├── T-Invest MCP
  │   ├── Console 127.0.0.1:8787
  │   └── .env с токенами
  └── /work/hackathon
      └── новый репозиторий Работы
```

- Код агента не попадает в Работу.
- Глобально Ollama; в проекте `agent` — OpenCode Go DeepSeek V4.1 Flash.
- T-Invest MCP — sandbox и read-only токен.
- Без интернета работают state, Console и локальная доска.
- Всё работает на ноутбуке.

## 1. Ноутбук

Рекомендуется Ubuntu 24.04 или Debian 12.

1. Включите полное шифрование диска (LUKS) при установке.
2. Создайте двух пользователей:
   - `aillix` — агент, ключи, Obsidian, T-Invest;
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

5. Установите VS Code. Всё локально.

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
BOARD_FILE=../board/KANBAN.md
CANVAS_FILE=../board/AILLIX_CANVAS.canvas

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

Доска Obsidian:

```bash
mkdir -p /opt/aillix-board
```

В `.env`:

```env
BOARD_FILE=../aillix-board/KANBAN.md
CANVAS_FILE=../aillix-board/AILLIX_CANVAS.canvas
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

После запуска OpenCode откройте `/mcps` и проверьте `t-invest`.
Если CLI показывает пусто, ориентируйтесь на `/mcps` в TUI.

## 7. Модель: Ollama глобально, OpenCode Go в проекте

На боевом Linux глобальная модель OpenCode — локальная Ollama.
В проекте `agent` модель задана явно:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode-go/deepseek-v4.1-flash",
  "default_agent": "hackathon"
}
```

То есть `/opt/aillix-agent` использует OpenCode Go и
DeepSeek V4.1 Flash 1017, даже если глобально стоит Ollama.

1. Проверьте подключение OpenCode Go:

```bash
opencode auth list
```

Должно быть `OpenCode Go ... stored`.

2. Откройте OpenCode:

```bash
cd /opt/aillix-agent
opencode
```

3. Выберите модель:

```text
/models
```

В статус-баре должно быть `deepseek-v4.1-flash`, а не `*-free`.

4. Проверьте ответ:

```text
Ответь одним словом: тест.
```

Если аккаунта OpenCode Go нет — один раз:

```text
/connect
```

Выбрать OpenCode Go, вставить API key. Ключ сохраняется в базе
OpenCode, не в проекте; повторять для каждой папки не нужно.

Если новая папка всё равно просит подключение:

- проверить `opencode auth list`;
- проверить `opencode service status`;
- проверить `XDG_DATA_HOME` и `OPENCODE_DB`;
- проверить, нет ли в папке своего `opencode.jsonc`.

Подробно: `OPENCODE_GO.md`.

### 7.1. Ollama как резерв

Проверьте Ollama:

```bash
ollama list
ollama ps
```

Если сервис не запущен:

```bash
ollama serve
```

Если модели нет:

```bash
ollama pull <model>
```

В `/models` выбрать `ollama/<model>`.

Практика:

- локальная модель медленнее облачной;
- держите Ollama запущенной;
- не запускайте несколько тяжёлых задач параллельно;
- заложите +20–30% времени к таймингу;
- если Ollama недоступна — OpenCode Go или ручные шаблоны.

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
| Aillix Agent | личный `markmus11012020-max` | `aillix-agent` |
| Работа хакатона | хакатонный | отдельный `work` |

Репозиторий агента: `https://github.com/markmus11012020-max/aillix-agent`.

Репозиторий должен быть **Private**. В Work не должно быть кода агента.

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

Репозиторий уже создан: `https://github.com/markmus11012020-max/aillix-agent`.

На Linux-ноутбуке проще клонировать его по SSH:

```bash
git clone git@github-agent:markmus11012020-max/aillix-agent.git /opt/aillix-agent
```

Если каталог уже существует и это не git-репозиторий:

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
git remote add origin git@github-agent:markmus11012020-max/aillix-agent.git
git remote -v
git push -u origin main
```

Если репозиторий уже склонирован по HTTPS, переключите remote на SSH:

```bash
git remote set-url origin git@github-agent:markmus11012020-max/aillix-agent.git
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

## 11. Obsidian

1. Установите Obsidian.
2. Создайте vault:

```bash
mkdir -p /opt/aillix-board
```

3. В `.env`:

```env
BOARD_FILE=../aillix-board/KANBAN.md
CANVAS_FILE=../aillix-board/AILLIX_CANVAS.canvas
```

4. Включите плагин Kanban:
   - Settings → Community plugins → Browse → Kanban → Install → Enable.

5. Запустите агента и проверьте доску:

```bash
cd /opt/aillix-agent
npm run smoke
```

6. Откройте в Obsidian:
   - `KANBAN.md` — Kanban;
   - `AILLIX_CANVAS.canvas` — карта.

Правило: доска односторонняя. Агент пишет, человек читает. Ручные правки будут перезаписаны.

Если Obsidian недоступен, `KANBAN.md` открывается как обычный markdown, state не теряется.

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
- OpenCode Go key хранится в OpenCode, не в проекте; если используется Ollama, ключ не нужен.
- T-Invest token — read-only, sandbox.
- После хакатона отозвать T-Invest-токен и ротировать OpenCode Go key, если он использовался.
- При необходимости удалить `/opt/aillix-agent` и затереть свободное место.
- Всё работает на ноутбуке.

## 14. Офлайн-режим

Работают:

- state;
- артефакты;
- Console;
- локальная доска `KANBAN.md`;
- шаблоны карточки и линт.

Не работают:

- LLM-запросы;
- T-Invest, если внешний.

Действия:

1. Включить hotspot.
2. Если LLM недоступен — работать по шаблонам вручную.
3. Если Obsidian недоступен — открыть `KANBAN.md` как markdown.
4. Карточку всё равно собрать и отправить до 20:00.

## 15. Проверка до 21.11

- [ ] Linux установлен, диск зашифрован.
- [ ] Node.js 20+ и npm работают.
- [ ] OpenCode установлен, `opencode --version` отвечает.
- [ ] Сертификаты Минцифры установлены, TLS проверен.
- [ ] `opencode auth list` — OpenCode Go.
- [ ] `/models` → `opencode-go/deepseek-v4.1-flash`.
- [ ] Если Ollama: `ollama list`, `ollama ps`, тестовый ответ.
- [ ] Если OpenCode Go: `/connect`, API key, тестовый ответ.
- [ ] Тестовый ответ LLM получен.
- [ ] T-Invest MCP: `npm run smoke:tinvest`.
- [ ] Агент собран: `npm run build`.
- [ ] Тесты: `npm test`.
- [ ] `.env` заполнен, `chmod 600`.
- [ ] `./start.sh` запускается.
- [ ] `/mcps` — `t-invest`.
- [ ] Console открывается на 8787.
- [ ] `hackathon_status` работает.
- [ ] Obsidian Kanban и Canvas работают.
- [ ] Offline-режим проверен.
- [ ] GitHub: два аккаунта, два ключа, два remote.
- [ ] Рабочий репозиторий отдельно от агента.

## 16. Troubleshooting

| Симптом | Что делать |
|---|---|
| `opencode: command not found` | Добавить `$HOME/.opencode/bin` в PATH |
| `node: command not found` | Установить Node через nvm |
| TLS-ошибка T-Invest | Установить сертификаты Минцифры, проверить `NODE_EXTRA_CA_CERTS` |
| `/connect` не показывает OpenCode Go | Проверить подписку и API key в console; или использовать Ollama |
| Каждая папка просит `/connect` | `opencode auth list`, `opencode service status`, проверить `OPENCODE_DB` и проектный `opencode.jsonc` |
| Ollama не отвечает | `ollama serve`, `ollama list`, `ollama ps` |
| `Model unavailable` | `/models`, выбрать доступную локальную или облачную модель |
| `t-invest` не подключён | Проверить `T_INVEST_MCP_URL`, токен, сертификаты |
| MCP not connected | `/mcps`, проверить T-Invest токен и сертификаты |
| Плагин не загрузился | Проверить `.opencode/plugins/aillix.js` и `npm run build` |
| Kanban не открывается как доска | Проверить frontmatter `kanban-plugin: board` и плагин Kanban |
| Canvas пустой | `npm run canvas`, проверить `STATE.json` |
| Console не открывается | Проверить `UI_PORT` и `UI_TOKEN` |
| Нет интернета | Локальная доска, ручной режим, hotspot |
