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
  echo "Файл .env не найден. Доска: KANBAN.md."
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

MOCK_PID=""
if [[ "${T_INVEST_MCP_URL:-}" == http://127.0.0.1:8790* ]]; then
  echo "Запуск mock T-Invest MCP..."
  npx tsx scripts/mock-tinvest-mcp.ts >"${TMPDIR:-/tmp}/aillix-mock-tinvest.log" 2>&1 &
  MOCK_PID=$!
  trap 'if [ -n "${MOCK_PID:-}" ]; then kill "$MOCK_PID" 2>/dev/null || true; fi' EXIT
  for _ in $(seq 1 20); do
    if curl -sf --max-time 1 http://127.0.0.1:8790/health >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
  if curl -sf --max-time 3 http://127.0.0.1:8790/health >/dev/null 2>&1; then
    echo "Mock T-Invest MCP: http://127.0.0.1:8790/mcp"
  else
    echo "Mock T-Invest MCP не поднялся. Лог: ${TMPDIR:-/tmp}/aillix-mock-tinvest.log" >&2
  fi
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "OpenCode не найден. Установите: curl -fsSL https://opencode.ai/v2/install | bash" >&2
  exit 1
fi

echo ""
echo "Доска: ${BOARD_FILE:-../board/KANBAN.md}"
echo "Canvas: ${CANVAS_FILE:-../board/AILLIX_CANVAS.canvas}"
echo "Aillix Console: http://127.0.0.1:${UI_PORT:-8787}"
echo "T-Invest MCP: ${T_INVEST_MCP_URL:-не задан}"
echo "Запуск OpenCode..."
opencode service restart >/dev/null 2>&1 || true
sleep 1
opencode
