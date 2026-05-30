const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// В продакшене CORS не нужен — фронтенд и бэкенд на одном домене
if (!isProd) {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'],
    credentials: true
  }));
}

app.use(express.json({ limit: '5mb' }));

const { initDatabase } = require('./db/database');
initDatabase();
require('./db/migrate');
const { initWebPush } = require('./utils/vapid');
initWebPush();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/facts', require('./routes/facts'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/push', require('./routes/push'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Отдаём фронтенд (в продакшене)
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const { setupScheduler } = require('./utils/scheduler');
setupScheduler();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server: http://localhost:${PORT}`);
});

module.exports = app;
