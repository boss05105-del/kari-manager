const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const KEYS_FILE = path.join(__dirname, '../db/vapid-keys.json');

function getVapidKeys() {
  if (fs.existsSync(KEYS_FILE)) {
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
  console.log('Generated new VAPID keys');
  return keys;
}

function initWebPush() {
  const keys = getVapidKeys();
  webpush.setVapidDetails(
    'mailto:admin@kari-manager.ru',
    keys.publicKey,
    keys.privateKey
  );
  return keys.publicKey;
}

module.exports = { initWebPush, getVapidKeys };
