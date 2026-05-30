#!/bin/bash
# Автозапуск Kari Manager

APP_DIR="/Users/ahmed/Desktop/Планы на день/kari-manager"
LOG="/tmp/kari-manager.log"
URL_FILE="/tmp/kari-public-url.txt"

echo "$(date): Starting Kari Manager..." >> "$LOG"

# Запускаем сервер
cd "$APP_DIR"
NODE_ENV=production /Users/ahmed/.nvm/versions/node/v24.16.0/bin/node backend/server.js >> "$LOG" 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID" >> "$LOG"

# Ждём старта сервера
sleep 5

# Запускаем туннель и сохраняем URL
/tmp/cloudflared tunnel --url http://localhost:3001 --no-autoupdate 2>&1 | \
  tee -a "$LOG" | \
  grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | \
  head -1 | \
  tee "$URL_FILE" &

echo "$(date): Services started" >> "$LOG"

# Ждём завершения сервера (чтобы KeepAlive перезапустил если упадёт)
wait $SERVER_PID
