const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.CHAT_DATABASE_URL || path.join(__dirname, 'chat.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Chat database connection error:', err);
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

    // Agents table
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
    `, (err) => {
      if (err) {
        console.error('Error creating agents table:', err);
      } else {
        // Insert demo agents if table is empty
        db.get('SELECT COUNT(*) as count FROM agents', (err, row) => {
          if (!err && row.count === 0) {
            const demoAgents = [
              { agent_id: 'agent-001', name: 'Priya Fernando' },
              { agent_id: 'agent-002', name: 'Kasun Silva' },
              { agent_id: 'agent-003', name: 'Dilani Perera' }
            ];
            
            demoAgents.forEach(agent => {
              db.run(
                'INSERT INTO agents (agent_id, name, status, current_chats, max_chats) VALUES (?, ?, ?, ?, ?)',
                [agent.agent_id, agent.name, 'available', 0, 5]
              );
            });
            console.log('✅ Demo agents initialized');
          }
        });
      }
      console.log('✅ Chat database tables initialized');
    });
  });
}

module.exports = db;
