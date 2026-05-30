#!/bin/bash
set -e

APP_DIR="/Users/ahmed/Desktop/Планы на день/kari-manager"
cd "$APP_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     Деплой Kari Manager — бесплатно, 24/7, без карты ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Шаг 1/3: Скачиваю GitHub CLI..."

# Определяем архитектуру
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  GH_URL="https://github.com/cli/cli/releases/download/v2.49.2/gh_2.49.2_macOS_arm64.tar.gz"
else
  GH_URL="https://github.com/cli/cli/releases/download/v2.49.2/gh_2.49.2_macOS_amd64.tar.gz"
fi

curl -sL "$GH_URL" -o /tmp/gh.tar.gz
tar -xzf /tmp/gh.tar.gz -C /tmp
GH=$(find /tmp -name "gh" -type f | head -1)
chmod +x "$GH"
echo "✅ GitHub CLI готов"

echo ""
echo "Шаг 2/3: Вход в GitHub (откроется браузер)..."
"$GH" auth login --web -h github.com

echo ""
echo "Шаг 3/3: Создаю репозиторий и загружаю код..."
# Коммитим все изменения
git add -A
git commit -m "Deploy to cloud" 2>/dev/null || true

# Создаём публичный репо (если не существует)
"$GH" repo create kari-manager --public --source=. --remote=origin --push 2>/dev/null || {
  # Репо уже существует — просто пушим
  GITHUB_USER=$("$GH" api user --jq '.login')
  git remote set-url origin "https://github.com/$GITHUB_USER/kari-manager.git" 2>/dev/null || \
    git remote add origin "https://github.com/$GITHUB_USER/kari-manager.git"
  git push -u origin main --force
}

GITHUB_USER=$("$GH" api user --jq '.login')
REPO_URL="https://github.com/$GITHUB_USER/kari-manager"

echo ""
echo "✅ Код загружен: $REPO_URL"
echo ""
echo "══════════════════════════════════════════════════════"
echo ""
echo "Теперь нужно создать базу данных и запустить сервер."
echo "Открываю нужные страницы в браузере..."
echo ""

# Открываем Neon для создания БД
open "https://neon.tech" 2>/dev/null

echo "┌─────────────────────────────────────────────────────┐"
echo "│  ИНСТРУКЦИЯ (займёт 5 минут):                       │"
echo "│                                                     │"
echo "│  1. NEON.TECH (только что открылось):               │"
echo "│     • Sign in with Google                           │"
echo "│     • Create Project → имя: kari                   │"
echo "│     • Скопируйте строку подключения:                │"
echo "│       'Connection string' (начинается с postgres://)│"
echo "│                                                     │"
echo "│  2. RENDER.COM (откроется после нажатия Enter):     │"
echo "│     • New Web Service → Connect GitHub              │"
echo "│     • Выберите репозиторий: kari-manager            │"
echo "│     • Build Command:                                │"
echo "│       npm install --prefix backend &&               │"
echo "│       npm install --prefix frontend &&              │"
echo "│       npm run build --prefix frontend               │"
echo "│     • Start Command: node backend/server.js         │"
echo "│     • Environment Variables → Add:                 │"
echo "│       DATABASE_URL = [вставьте строку из Neon]      │"
echo "│       NODE_ENV = production                         │"
echo "│     • Create Web Service                            │"
echo "│                                                     │"
echo "│  3. UptimeRobot (чтобы не засыпал):                │"
echo "│     • После деплоя: uptimerobot.com                 │"
echo "│     • New Monitor → HTTP → URL вашего приложения   │"
echo "│     • Интервал: 5 минут                             │"
echo "└─────────────────────────────────────────────────────┘"
echo ""
read -p "Нажмите Enter для открытия Render.com → "

open "https://render.com" 2>/dev/null

echo ""
echo "Ваш GitHub репозиторий: $REPO_URL"
echo ""
echo "Когда деплой завершится — приложение будет доступно"
echo "по адресу вида: https://kari-manager.onrender.com"
echo ""
