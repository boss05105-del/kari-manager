const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function dbGet(sql, params = []) {
  const { rows } = await pool.query(toPositional(sql), params);
  return rows[0] || null;
}

async function dbAll(sql, params = []) {
  const { rows } = await pool.query(toPositional(sql), params);
  return rows;
}

async function dbRun(sql, params = []) {
  return pool.query(toPositional(sql), params);
}

async function dbExec(sql) {
  return pool.query(sql);
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'director')),
      full_name TEXT NOT NULL,
      store_id INTEGER,
      profile_completed INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS stores (
      id SERIAL PRIMARY KEY,
      store_number TEXT UNIQUE NOT NULL,
      name TEXT,
      director_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL,
      director_id INTEGER NOT NULL,
      plan_date DATE NOT NULL,
      ui_percent REAL,
      gold_qty REAL,
      silver_qty REAL,
      finmoll_qty REAL,
      kari_qty REAL,
      yandex_qty REAL,
      items_per_receipt REAL,
      conversion_shoes REAL,
      conversion_insoles REAL,
      sbp_share REAL,
      mp_install_qty REAL,
      comment TEXT NOT NULL,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      is_late INTEGER DEFAULT 0,
      UNIQUE(store_id, plan_date)
    );

    CREATE TABLE IF NOT EXISTS daily_facts (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL,
      director_id INTEGER NOT NULL,
      fact_date DATE NOT NULL,
      ui_percent REAL,
      gold_qty REAL,
      silver_qty REAL,
      finmoll_qty REAL,
      kari_qty REAL,
      yandex_qty REAL,
      items_per_receipt REAL,
      conversion_shoes REAL,
      conversion_insoles REAL,
      sbp_share REAL,
      mp_install_qty REAL,
      what_helped TEXT NOT NULL,
      obstacles TEXT NOT NULL,
      tomorrow_actions TEXT NOT NULL,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      is_late INTEGER DEFAULT 0,
      UNIQUE(store_id, fact_date)
    );

    CREATE TABLE IF NOT EXISTS action_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_plans_store_date ON daily_plans(store_id, plan_date);
    CREATE INDEX IF NOT EXISTS idx_facts_store_date ON daily_facts(store_id, fact_date);
    CREATE INDEX IF NOT EXISTS idx_plans_date ON daily_plans(plan_date);
    CREATE INDEX IF NOT EXISTS idx_facts_date ON daily_facts(fact_date);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
  `);

  console.log('Database initialized');
}

module.exports = { pool, dbGet, dbAll, dbRun, dbExec, initDatabase };
