const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'],
    credentials: true
  }));
}

app.use(express.json({ limit: '5mb' }));

async function start() {
  const { initDatabase, dbGet } = require('./db/database');

  // Try to init DB but don't block server startup if Neon is sleeping
  // queryWithRetry in each route will handle reconnection on first real request
  try {
    await initDatabase();
    // Auto-seed on first run
    const count = await dbGet('SELECT COUNT(*) as c FROM users');
    if (parseInt(count.c) === 0) {
      console.log('Empty database — running seed...');
      const seed = require('./db/seed');
      await seed();
      console.log('Seed complete.');
    }
  } catch (e) {
    console.warn('DB init skipped (Neon sleeping):', e.message);
    // Retry init in background after 10s
    setTimeout(async () => {
      try {
        await initDatabase();
        console.log('DB init completed on retry.');
      } catch (e2) {
        console.error('DB init retry failed:', e2.message);
      }
    }, 10000);
  }

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
}

start().catch(e => { console.error('Startup error:', e); process.exit(1); });
module.exports = app;
