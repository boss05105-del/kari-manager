#!/bin/bash
URL=$(cat /tmp/kari-public-url.txt 2>/dev/null)
if [ -z "$URL" ]; then
  echo "⏳ Туннель ещё запускается, подождите 10 секунд..."
  sleep 10
  URL=$(cat /tmp/kari-public-url.txt 2>/dev/null)
fi
if [ -n "$URL" ]; then
  echo ""
  echo "✅ Ваша ссылка (работает с любого устройства):"
  echo ""
  echo "   $URL"
  echo ""
  open "$URL" 2>/dev/null
else
  echo "❌ Туннель не запущен. Запустите: ./autostart.sh"
fi
