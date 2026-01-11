const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Create database connection - use environment variable
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'auth.db');
const db = new sqlite3.Database(
  DB_PATH,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error('Database connection error:', err.message);
    } else {
      console.log('✅ Connected to SQLite database');
      initializeTables();
    }
  }
);

// Initialize tables
function initializeTables() {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      name TEXT,
      password_hash TEXT NOT NULL,
      account_number TEXT UNIQUE,
      account_type TEXT DEFAULT 'prepaid',
      account_balance DECIMAL(10,2) DEFAULT 0,
      current_bill DECIMAL(10,2) DEFAULT 0,
      data_remaining DECIMAL(10,2) DEFAULT 0,
      minutes_remaining INTEGER DEFAULT 0,
      reset_token TEXT,
      reset_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bills table
  db.run(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'pending',
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Services table
  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price DECIMAL(10,2),
      is_active BOOLEAN DEFAULT 1
    )
  `);

  // User services (subscriptions)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      status TEXT DEFAULT 'inactive',
      activated_at DATETIME,
      deactivated_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    )
  `);

  // Insert default data
  insertDefaultData();
  // Migrate any legacy plaintext passwords to bcrypt hashes
  migratePasswords();
  // Migrate database schema and add missing columns
  migrateDatabaseSchema();
}

function insertDefaultData() {
  // Insert default users (hash passwords)
  const defaultUsersPlain = [
    { phone: '0771441117', email: 'supun@email.com', name: 'Supun Shaminda', password: 'password123', account: 'STL000001' },
    { phone: '0779876543', email: 'kamal@email.com', name: 'Kamal Silva', password: 'password456', account: 'STL000002' },
    { phone: '0765554444', email: 'sunil@email.com', name: 'Sunil Fernando', password: 'password789', account: 'STL000003' }
  ];

  const salt = bcrypt.genSaltSync(10);
  defaultUsersPlain.forEach(u => {
    const hash = bcrypt.hashSync(u.password, salt);
    db.run(
      `INSERT OR IGNORE INTO users (phone, email, name, password_hash, account_number) VALUES (?, ?, ?, ?, ?)`,
      [u.phone, u.email, u.name, hash, u.account],
      (err) => { if (err) console.error('Error inserting user:', err.message); }
    );
  });

  // Insert telecom services
  const services = [
    ['4G Data Pack', 'Monthly 50GB data package', 1200.00],
    ['International Roaming', 'Global roaming service', 500.00],
    ['Ring-back Tone', 'Custom ring-back tone', 100.00],
    ['Call Waiting', 'Call waiting service', 50.00],
    ['SMS Pack', 'Monthly 1000 SMS', 200.00]
  ];

  services.forEach(service => {
    db.run(
      `INSERT OR IGNORE INTO services (name, description, price) VALUES (?, ?, ?)`,
      service,
      (err) => { if (err) console.error('Error inserting service:', err.message); }
    );
  });

  console.log('✅ Default data inserted');
}

// Migrate plaintext password_hash values to bcrypt hashes (legacy fix)
function migratePasswords() {
  db.all(`SELECT id, password_hash FROM users`, [], (err, rows) => {
    if (err) {
      console.error('Password migration query error:', err.message);
      return;
    }

    const salt = bcrypt.genSaltSync(10);

    rows.forEach(row => {
      const current = row.password_hash || '';
      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      const isHashed = current.startsWith('$2');
      if (!isHashed && current.length > 0) {
        const newHash = bcrypt.hashSync(current, salt);
        db.run(
          `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [newHash, row.id],
          (updateErr) => {
            if (updateErr) {
              console.error(`Error migrating password for user ${row.id}:`, updateErr.message);
            }
          }
        );
      }
    });

    console.log('✅ Password migration completed');
  });
}

// Migrate database schema - add missing columns to existing users table
function migrateDatabaseSchema() {
  // Check if columns exist, if not add them
  db.all("PRAGMA table_info(users)", [], (err, columns) => {
    if (err) {
      console.error('Error checking table schema:', err.message);
      return;
    }

    const columnNames = columns.map(col => col.name);
    
    // Add account_type if missing
    if (!columnNames.includes('account_type')) {
      db.run(
        `ALTER TABLE users ADD COLUMN account_type TEXT DEFAULT 'prepaid'`,
        (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding account_type column:', err.message);
          } else if (!err) {
            console.log('✅ Added account_type column');
          }
        }
      );
    }

    // Add current_bill if missing
    if (!columnNames.includes('current_bill')) {
      db.run(
        `ALTER TABLE users ADD COLUMN current_bill DECIMAL(10,2) DEFAULT 0`,
        (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding current_bill column:', err.message);
          } else if (!err) {
            console.log('✅ Added current_bill column');
          }
        }
      );
    }

    // Add account_balance if missing
    if (!columnNames.includes('account_balance')) {
      db.run(
        `ALTER TABLE users ADD COLUMN account_balance DECIMAL(10,2) DEFAULT 0`,
        (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding account_balance column:', err.message);
          } else if (!err) {
            console.log('✅ Added account_balance column');
          }
        }
      );
    }

    // Add data_remaining if missing
    if (!columnNames.includes('data_remaining')) {
      db.run(
        `ALTER TABLE users ADD COLUMN data_remaining DECIMAL(10,2) DEFAULT 0`,
        (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding data_remaining column:', err.message);
          } else if (!err) {
            console.log('✅ Added data_remaining column');
          }
        }
      );
    }

    // Add minutes_remaining if missing
    if (!columnNames.includes('minutes_remaining')) {
      db.run(
        `ALTER TABLE users ADD COLUMN minutes_remaining INTEGER DEFAULT 0`,
        (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding minutes_remaining column:', err.message);
          } else if (!err) {
            console.log('✅ Added minutes_remaining column');
          }
        }
      );
    }

    // Add reset_token if missing
    if (!columnNames.includes('reset_token')) {
      db.run(
        `ALTER TABLE users ADD COLUMN reset_token TEXT`,
        (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding reset_token column:', err.message);
          } else if (!err) {
            console.log('✅ Added reset_token column');
          }
        }
      );
    }

    // Add reset_expires if missing
    if (!columnNames.includes('reset_expires')) {
      db.run(
        `ALTER TABLE users ADD COLUMN reset_expires DATETIME`,
        (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding reset_expires column:', err.message);
          } else if (!err) {
            console.log('✅ Added reset_expires column');
          }
        }
      );
    }
  });
}

module.exports = db;