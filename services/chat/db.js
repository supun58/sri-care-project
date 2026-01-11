const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'chat.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Connected to chat database');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    // Chat sessions table
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        status TEXT DEFAULT 'active',
        agent_id TEXT,
        agent_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME
      )
    `);

    // Messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        sender_id TEXT,
        sender_name TEXT,
        message TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        read_by_agent BOOLEAN DEFAULT 0,
        read_by_user BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
      )
    `);

    // Agents table (for demo - in production this would be a separate service)
    db.run(`
      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'available',
        current_chats INTEGER DEFAULT 0,
        max_chats INTEGER DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert demo agents
    db.run(`
      INSERT OR IGNORE INTO agents (agent_id, name, status, max_chats) 
      VALUES 
        ('agent_1', 'Priya Fernando', 'available', 5),
        ('agent_2', 'Kasun Silva', 'available', 5),
        ('agent_3', 'Dilani Perera', 'available', 5)
    `);

    console.log('✅ Database tables initialized');
  });
}

module.exports = db;
