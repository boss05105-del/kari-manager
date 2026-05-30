const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kari.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'director')),
      full_name TEXT NOT NULL,
      store_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_number TEXT UNIQUE NOT NULL,
      name TEXT,
      director_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (director_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      comment TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_late INTEGER DEFAULT 0,
      UNIQUE(store_id, plan_date),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (director_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      what_helped TEXT NOT NULL,
      obstacles TEXT NOT NULL,
      tomorrow_actions TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_late INTEGER DEFAULT 0,
      UNIQUE(store_id, fact_date),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (director_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS action_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_plans_store_date ON daily_plans(store_id, plan_date);
    CREATE INDEX IF NOT EXISTS idx_facts_store_date ON daily_facts(store_id, fact_date);
    CREATE INDEX IF NOT EXISTS idx_plans_date ON daily_plans(plan_date);
    CREATE INDEX IF NOT EXISTS idx_facts_date ON daily_facts(fact_date);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
  `);

  console.log('Database initialized');
}

module.exports = { getDb, initDatabase };
