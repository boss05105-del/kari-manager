const { pool } = require('./database');

async function migrate() {
  // profile_completed already in schema from initDatabase
  // Just ensure admin users are marked as completed
  await pool.query(`UPDATE users SET profile_completed = 1 WHERE role = 'admin'`);
  console.log('Migration complete');
}

migrate().catch(console.error);
module.exports = { migrate };
