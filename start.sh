#!/bin/bash
set -e

echo "🚀 Kari Manager — запуск системы"
echo "================================="

# Backend setup
echo ""
echo "📦 Установка зависимостей бэкенда..."
cd backend
cp -n .env.example .env 2>/dev/null || true
npm install

echo ""
echo "🗄️  Инициализация и наполнение базы данных..."
node db/seed.js

echo ""
echo "▶️  Запуск бэкенда (порт 3001)..."
npm start &
BACKEND_PID=$!

cd ../frontend

echo ""
echo "📦 Установка зависимостей фронтенда..."
npm install

echo ""
echo "▶️  Запуск фронтенда (порт 5173)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================="
echo "✅ Система запущена!"
echo ""
echo "  🌐 Веб-панель:  http://localhost:5173"
echo "  🔌 API:         http://localhost:3001/api"
echo ""
echo "  👤 Руководитель: admin / admin123"
echo "  👤 Директор:     dir11392 / store11392"
echo ""
echo "  Для мобильных: откройте http://<ваш-IP>:5173"
echo "  и добавьте на рабочий стол (PWA)"
echo ""
echo "  Нажмите Ctrl+C для остановки"
echo "================================="

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
