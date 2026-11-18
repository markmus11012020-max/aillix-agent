# Aillix Agent — OpenCode Go и модель DeepSeek V4.1 Flash

## 1. Модель

Точный ID:

```text
opencode-go/deepseek-v4.1-flash
```

Отображаемое имя: **DeepSeek V4.1 Flash 1017**.

Варианты: `low`, `high`, `max`.

Важно: корневой `model` в конфиге не сохраняет вариант.
Если нужен вариант, выбирайте его через `/models` или указывайте
`#high` / `#max` в модели агента или команды.

## 2. Конфиг проекта

В `agent/opencode.jsonc` уже задано:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode-go/deepseek-v4.1-flash",
  "default_agent": "hackathon"
}
```

Это значит: в папке `agent` OpenCode использует OpenCode Go и DeepSeek
V4.1 Flash, даже если глобальная модель — Ollama.

## 3. Глобальный конфиг

Если OpenCode Go нужен во всех папках, а не только в `agent`:

```text
~/.config/opencode/opencode.jsonc
```

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode-go/deepseek-v4.1-flash"
}
```

На Linux это `/home/<user>/.config/opencode/opencode.jsonc`.
На Windows — `C:\Users\<user>\.config\opencode\opencode.jsonc`.

Не ставьте глобальную модель, если хотите сохранить Ollama по умолчанию
для остальных папок. Тогда достаточно проектного конфига в `agent`.

## 4. Почему новая папка просит подключение

Сохранённые ключи OpenCode Go живут не в папке проекта, а в базе
OpenCode:

```text
~/.local/share/opencode/opencode.db
```

Проверка:

```bash
opencode auth list
```

Должно быть:

```text
OpenCode Go  ...  stored
```

Если аккаунт есть, `/connect` в новой папке не нужен.

Причины повторного запроса:

1. Запущен другой сервер OpenCode или другая база.
2. Другой `XDG_DATA_HOME` или `OPENCODE_DB`.
3. В папке есть свой `opencode.jsonc`, который переопределяет модель.
4. Выбрана модель `opencode/*-free`, а не `opencode-go/*`.
5. Аккаунт OpenCode Go удалён или не активирован.

Проверить активную модель:

```bash
opencode auth list
opencode models | grep deepseek
```

В TUI:

```text
/models
```

## 5. Первичное подключение

Один раз:

```text
/connect
```

Выбрать **OpenCode Go**, вставить API key.

Или через CLI:

```bash
opencode auth login "OpenCode Go" --method key
```

Ключ сохраняется в базе OpenCode, не в проекте.
Повторять для каждой папки не нужно.

## 6. Если ключ удобнее держать в окружении

Для сервера OpenCode можно использовать переменную окружения
OpenCode Console, если ваш билд поддерживает env-подключение:

```bash
opencode service set env OPENCODE_API_KEY oc_sk_...
```

Проверить:

```bash
opencode auth list
```

В `auth list` появится подключение типа `environment`.

Не храните ключ в Git, в `agent/.env`, в карточке и на скриншотах.
`OPENCODE_API_KEY` относится к серверу OpenCode, а не к проекту.

Если env-подключение не появляется, используйте `/connect` или
`opencode auth login`.

## 7. Проверка

В папке `agent`:

```bash
opencode run --standalone "Ответь одним словом: тест"
```

В статус-баре должно быть:

```text
deepseek-v4.1-flash
```

В TUI:

```text
/models
```

Выбрать:

```text
opencode-go/deepseek-v4.1-flash
```

## 8. Ollama как резерв

Если OpenCode Go недоступен:

```text
/models
```

Выбрать `ollama/<model>`.

Проверка Ollama:

```bash
ollama list
ollama ps
```

Ollama медленнее. На тестовом дне заложить +20–30% времени,
если работаете на ней.

## 9. Частые ошибки

| Симптом | Причина | Что делать |
|---|---|---|
| Каждая папка просит `/connect` | другой сервер/база или проект переопределяет модель | `opencode auth list`, проверить `opencode.jsonc` |
| В статус-баре `*-free` | выбран `opencode/*-free` | `/models`, выбрать `opencode-go/deepseek-v4.1-flash` |
| `Model unavailable` | нет активного OpenCode Go или модель отключена | `/connect`, `opencode auth list`, `/models` |
| Модель есть, но ответа нет | ключ/лимит/сеть | проверить Console, баланс, сеть |
| Нужен вариант `high` | корневой model не хранит variant | выбрать в `/models` или указать `#high` в агенте/команде |
