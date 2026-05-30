const { getDb } = require('./database');

function migrate() {
  const db = getDb();

  // Add profile_completed to users
  try {
    db.exec('ALTER TABLE users ADD COLUMN profile_completed INTEGER DEFAULT 0');
    console.log('Added profile_completed column');
  } catch {}

  // Set existing non-default users as already completed (admin)
  db.prepare("UPDATE users SET profile_completed = 1 WHERE role = 'admin'").run();

  // Push subscriptions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
  `);
  console.log('Push subscriptions table ready');
}

migrate();
module.exports = { migrate };
