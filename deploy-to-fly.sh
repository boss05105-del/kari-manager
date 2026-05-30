#!/bin/bash
set -e

APP_NAME="kari-manager"
REGION="ams"

echo ""
echo "================================================"
echo "  Деплой Kari Manager на Fly.io (бесплатно)"
echo "================================================"
echo ""

# Проверяем flyctl
if ! command -v flyctl &> /dev/null; then
  echo "📦 Устанавливаю flyctl..."
  curl -L https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
fi

echo "✅ flyctl найден: $(flyctl version)"
echo ""

# Логин
echo "🔐 Вход в Fly.io (откроется браузер)..."
flyctl auth login

echo ""
echo "🚀 Создаю приложение на Fly.io..."

# Создаём приложение (если не существует)
if flyctl apps list | grep -q "$APP_NAME"; then
  echo "   Приложение уже существует, пропускаю создание"
else
  flyctl apps create "$APP_NAME" --org personal 2>/dev/null || {
    # Если имя занято — добавляем случайный суффикс
    SUFFIX=$(cat /dev/urandom | env LC_CTYPE=C tr -dc 'a-z0-9' | fold -w 4 | head -n 1)
    APP_NAME="kari-manager-${SUFFIX}"
    echo "   Имя занято, использую: $APP_NAME"
    sed -i '' "s/app = \"kari-manager\"/app = \"${APP_NAME}\"/" fly.toml
    flyctl apps create "$APP_NAME" --org personal
  }
fi

echo ""
echo "💾 Создаю постоянное хранилище для базы данных..."
flyctl volumes create kari_data \
  --region "$REGION" \
  --size 1 \
  --app "$APP_NAME" 2>/dev/null || echo "   Том уже существует"

echo ""
echo "🔑 Генерирую JWT секрет..."
JWT_SECRET=$(openssl rand -hex 32)
flyctl secrets set JWT_SECRET="$JWT_SECRET" --app "$APP_NAME"

echo ""
echo "🏗️  Собираю и деплою приложение..."
echo "   (это займёт 3-5 минут в первый раз)"
echo ""
flyctl deploy --app "$APP_NAME" --region "$REGION"

echo ""
echo "🌱 Заполняю базу данных тестовыми данными..."
flyctl ssh console --app "$APP_NAME" --command "node /app/backend/db/seed.js" 2>/dev/null || \
  echo "   (Seed можно запустить позже через: flyctl ssh console -a $APP_NAME)"

echo ""
URL="https://${APP_NAME}.fly.dev"
echo "================================================"
echo ""
echo "✅ ГОТОВО! Приложение запущено:"
echo ""
echo "   $URL"
echo ""
echo "   Директора:  $URL  (установить как PWA)"
echo "   Админ:      $URL/admin"
echo ""
echo "   Логин: admin / admin123"
echo ""
echo "   Приложение работает 24/7 без Mac!"
echo ""
echo "================================================"

# Сохраняем URL
echo "$URL" > /tmp/kari-cloud-url.txt
open "$URL" 2>/dev/null || true
