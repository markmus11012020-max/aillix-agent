$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Aillix Agent: подготовка..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js не найден. Установите Node.js 20+."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm не найден."
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Установка зависимостей..."
  npm install
}

if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
      $name, $value = $line.Split("=", 2)
      [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
    }
  }
} else {
  Write-Host "Файл .env не найден. Доска: KANBAN.md."
}

$certBundle = if ($env:T_INVEST_CA_BUNDLE) { $env:T_INVEST_CA_BUNDLE } else { Join-Path $HOME "certs\russian-trusted.pem" }
if (Test-Path -LiteralPath $certBundle) {
  $env:NODE_EXTRA_CA_CERTS = $certBundle
  $env:SSL_CERT_FILE = $certBundle
  Write-Host "Сертификаты Минцифры: $certBundle"
} else {
  Write-Host "Сертификаты Минцифры не найдены: $certBundle"
  Write-Host "T-Invest MCP может не подключиться. См. agent/LINUX.md."
}

Write-Host "Сборка..."
npm run build

Write-Host ""
$uiPort = $env:UI_PORT
if (-not $uiPort) { $uiPort = "8787" }
if (-not $env:BOARD_FILE) { $env:BOARD_FILE = "..\board\KANBAN.md" }
if (-not $env:CANVAS_FILE) { $env:CANVAS_FILE = "..\board\AILLIX_CANVAS.canvas" }
Write-Host "Доска: $env:BOARD_FILE"
Write-Host "Canvas: $env:CANVAS_FILE"
Write-Host "Aillix Console: http://127.0.0.1:$uiPort"
Write-Host "Запуск OpenCode..."
opencode
