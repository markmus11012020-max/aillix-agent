#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ не найден. Установите Node.js и повторите." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm не найден." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Установка зависимостей..."
  npm install
fi

if [ -f .env ]; then
  sed -i 's/\r$//' .env
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
else
  export BOARD_BACKEND=local
  echo "Файл .env не найден. Будет использована локальная доска KANBAN.md."
fi

CERT_BUNDLE="${T_INVEST_CA_BUNDLE:-$HOME/certs/russian-trusted.pem}"
if [ -f "$CERT_BUNDLE" ]; then
  export NODE_EXTRA_CA_CERTS="$CERT_BUNDLE"
  export SSL_CERT_FILE="$CERT_BUNDLE"
  echo "Сертификаты Минцифры: $CERT_BUNDLE"
else
  echo "Сертификаты Минцифры не найдены: $CERT_BUNDLE"
  echo "T-Invest MCP может не подключиться. См. LINUX.md, шаг 4."
fi

echo "Сборка..."
npm run build

if ! command -v opencode >/dev/null 2>&1; then
  echo "OpenCode не найден. Установите: curl -fsSL https://opencode.ai/v2/install | bash" >&2
  exit 1
fi

echo ""
echo "Aillix Console: http://127.0.0.1:${UI_PORT:-8787}"
echo "Запуск OpenCode..."
exec opencode
