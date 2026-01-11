const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/queue.db');

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Database opening error:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        createTables();
    }
});

function createTables() {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (!err) {
            // Create default admin if not exists
            const bcrypt = require('bcryptjs');
            const crypto = require('crypto');

            // Allow admin credentials to be set via environment variables
            const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
            let ADMIN_PASS = process.env.ADMIN_PASSWORD;

            db.get("SELECT id FROM users WHERE username = ?", [ADMIN_USER], (err, row) => {
                if (!row) {
                    // If no password provided in env, generate a random secure one
                    if (!ADMIN_PASS) {
                        ADMIN_PASS = crypto.randomBytes(8).toString('hex');
                        console.log('================================================================');
                        console.log('SECURITY WARNING: No ADMIN_PASSWORD provided.');
                        console.log(`Generated temporary admin password for user '${ADMIN_USER}': ${ADMIN_PASS}`);
                        console.log('PLEASE CHANGE THIS PASSWORD IMMEDIATELY AFTER LOGIN!');
                        console.log('================================================================');
                    }

                    const salt = bcrypt.genSaltSync(10);
                    const hash = bcrypt.hashSync(ADMIN_PASS, salt);
                    db.run("INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')", [ADMIN_USER, hash]);
                    console.log(`Default admin user '${ADMIN_USER}' created.`);
                }
            });
        }
    });

    // Queue Table
    db.run(`CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT,
        mobile TEXT,
        pdf_path TEXT,
        original_filename TEXT,
        status TEXT DEFAULT 'pending',
        message TEXT,
        retries INTEGER DEFAULT 0,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (!err) {
            // Migration: Add user_id column if it doesn't exist
            db.all("PRAGMA table_info(queue)", (err, columns) => {
                if (!columns.some(c => c.name === 'user_id')) {
                    db.run("ALTER TABLE queue ADD COLUMN user_id INTEGER", (err) => {
                        if (!err) console.log('Migrated queue table: added user_id column');
                    });
                }
            });
        }
    });
}

// Wrapper for async/await
const dbAsync = {
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    },
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
};

module.exports = dbAsync;
