const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbInstanceId = "db_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);

let db;

const sqlite3 = require('sqlite3').verbose();
const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || '../database/skill_for_skill.db');
const dbDir = path.dirname(dbPath);

let finalPath = dbPath;

// Ensure the database directory exists
try {
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
} catch (writeErr) {
    console.warn('⚠️ Could not create database directory. Falling back to in-memory SQLite:', writeErr.message);
    finalPath = ':memory:';
}

db = new sqlite3.Database(finalPath, (err) => {
    if (err) {
        console.error('❌ Failed to open SQLite database:', err.message);
        process.exit(1);
    }
    console.log(`📦 Connected to SQLite database at: ${finalPath}`);
    initializeDatabase();
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS system_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                executed_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                username TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL,
                password TEXT NOT NULL,
                bio TEXT DEFAULT '',
                avatar TEXT DEFAULT '',
                skills_teach TEXT DEFAULT '',
                skills_learn TEXT DEFAULT '',
                credits_earned INTEGER DEFAULT 15,
                skills_taught_count INTEGER DEFAULT 0,
                hours_learned INTEGER DEFAULT 0,
                achievements TEXT,
                recent_activity TEXT,
                theme TEXT DEFAULT 'light',
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating users table:', err.message);
            } else {
                console.log('✔️ Database tables initialized successfully.');
                // Migration: Ensure theme column exists in users table for existing databases
                db.run(`ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light'`, () => {});
                // Migration: Ensure all user credit balances and transactions are converted to whole integers
                db.run(`UPDATE users SET credits_earned = ROUND(credits_earned)`, () => {});
                db.run(`UPDATE transactions SET amount = ROUND(amount)`, () => {});
                db.run(`UPDATE session_completions SET credits_transferred = ROUND(credits_transferred)`, () => {});
            }
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS session_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                sender_name TEXT NOT NULL,
                sender_avatar TEXT DEFAULT '',
                recipient_id INTEGER NOT NULL,
                recipient_name TEXT NOT NULL,
                recipient_avatar TEXT DEFAULT '',
                skill TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating session_requests table:', err.message);
            } else {
                console.log('✔️ session_requests table initialized successfully.');
            }
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER UNIQUE,
                sender_id INTEGER NOT NULL,
                recipient_id INTEGER NOT NULL,
                skill TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                room_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'scheduled',
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating sessions table:', err.message);
            } else {
                console.log('✔️ sessions table initialized successfully.');
            }
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS session_completions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL UNIQUE,
                teacher_id INTEGER NOT NULL,
                learner_id INTEGER NOT NULL,
                skill TEXT NOT NULL,
                credits_transferred INTEGER DEFAULT 1,
                completed_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating session_completions table:', err.message);
            } else {
                console.log('✔️ session_completions table initialized successfully.');
            }
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                partner_id INTEGER NOT NULL,
                partner_name TEXT NOT NULL,
                session_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                skill TEXT NOT NULL,
                session_date TEXT,
                session_time TEXT,
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating transactions table:', err.message);
            } else {
                console.log('✔️ transactions table initialized successfully.');
            }
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS user_daily_call_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                usage_date TEXT NOT NULL,
                seconds_used INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
                UNIQUE(user_id, usage_date)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating user_daily_call_usage table:', err.message);
            } else {
                console.log('✔️ user_daily_call_usage table initialized successfully.');
            }
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS payment_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_name TEXT NOT NULL,
                user_email TEXT NOT NULL,
                transaction_ref TEXT DEFAULT '',
                status TEXT DEFAULT 'Pending Verification',
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating payment_requests table:', err.message);
            } else {
                console.log('✔️ payment_requests table initialized successfully.');
                
                db.run(`
                    CREATE TABLE IF NOT EXISTS teacher_applications (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL UNIQUE,
                        qualifications TEXT NOT NULL,
                        skills TEXT NOT NULL,
                        experience TEXT NOT NULL,
                        hourly_fee REAL NOT NULL,
                        status TEXT DEFAULT 'pending',
                        created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
                        updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
                    )
                `, (tErr) => {
                    if (tErr) {
                        console.error('❌ Error creating teacher_applications table:', tErr.message);
                    } else {
                        console.log('✔️ teacher_applications table initialized successfully.');
                        db.run(`
                            CREATE TABLE IF NOT EXISTS withdrawal_requests (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                teacher_id INTEGER NOT NULL,
                                teacher_name TEXT NOT NULL,
                                teacher_email TEXT NOT NULL,
                                amount REAL NOT NULL,
                                payment_method TEXT NOT NULL,
                                payout_details TEXT NOT NULL,
                                status TEXT DEFAULT 'pending',
                                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
                                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
                            )
                        `, (wErr) => {
                            if (wErr) {
                                console.error('❌ Error creating withdrawal_requests table:', wErr.message);
                            } else {
                                console.log('✔️ withdrawal_requests table initialized successfully.');
                            }

                            db.run(`
                                CREATE TABLE IF NOT EXISTS notifications (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    user_id INTEGER NOT NULL,
                                    title TEXT NOT NULL,
                                    message TEXT NOT NULL,
                                    type TEXT DEFAULT 'info',
                                    link TEXT DEFAULT '',
                                    is_read INTEGER DEFAULT 0,
                                    created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
                                )
                            `, (nErr) => {
                                if (nErr) {
                                    console.error('❌ Error creating notifications table:', nErr.message);
                                } else {
                                    console.log('✔️ notifications table initialized successfully.');
                                    seedInitialNotifications();
                                }
                                runMigrations();
                            });
                        });
                    }
                });
            }
        });
    });
}

function seedInitialNotifications() {
    db.get("SELECT COUNT(*) as cnt FROM notifications", (err, row) => {
        if (!err && row && row.cnt === 0) {
            console.log("🔔 Seeding initial notifications from session requests and transactions...");
            db.all("SELECT * FROM session_requests", (sErr, reqs) => {
                if (!sErr && reqs) {
                    reqs.forEach(req => {
                        db.run(
                            `INSERT INTO notifications (user_id, title, message, type, link, is_read, created_at)
                             VALUES (?, ?, ?, ?, ?, 0, ?)`,
                            [
                                req.recipient_id,
                                `New Session Request for ${req.skill}`,
                                `${req.sender_name} requested a session for ${req.skill} on ${req.date} at ${req.time}.`,
                                'request',
                                'session-request.html',
                                req.created_at || new Date().toISOString()
                            ]
                        );
                        if (req.status === 'accepted' || req.status === 'scheduled') {
                            db.run(
                                `INSERT INTO notifications (user_id, title, message, type, link, is_read, created_at)
                                 VALUES (?, ?, ?, ?, ?, 0, ?)`,
                                [
                                    req.sender_id,
                                    `Session Request Accepted: ${req.skill}`,
                                    `${req.recipient_name} accepted your session request for ${req.skill}.`,
                                    'success',
                                    'my-sessions.html',
                                    req.updated_at || new Date().toISOString()
                                ]
                            );
                        }
                    });
                }
            });
            db.all("SELECT * FROM transactions", (tErr, txs) => {
                if (!tErr && txs) {
                    txs.forEach(tx => {
                        const isEarned = tx.type === 'earned' || tx.type === 'credit';
                        db.run(
                            `INSERT INTO notifications (user_id, title, message, type, link, is_read, created_at)
                             VALUES (?, ?, ?, ?, ?, 0, ?)`,
                            [
                                tx.user_id,
                                isEarned ? `Time Credits Earned! 💰` : `Time Credits Spent`,
                                isEarned ? `You earned ${tx.amount} Time Credit(s) for teaching ${tx.skill}.` : `You spent ${tx.amount} Time Credit(s) for learning ${tx.skill}.`,
                                isEarned ? 'success' : 'info',
                                'credits.html',
                                tx.created_at || new Date().toISOString()
                            ]
                        );
                    });
                }
            });
        }
    });
}

function runMigrations() {
    db.serialize(() => {
        const columns = [
            { name: 'bio', type: "TEXT DEFAULT ''" },
            { name: 'avatar', type: "TEXT DEFAULT ''" },
            { name: 'skills_teach', type: "TEXT DEFAULT ''" },
            { name: 'skills_learn', type: "TEXT DEFAULT ''" },
            { name: 'credits_earned', type: "INTEGER DEFAULT 15" },
            { name: 'skills_taught_count', type: "INTEGER DEFAULT 0" },
            { name: 'hours_learned', type: "INTEGER DEFAULT 0" },
            { name: 'achievements', type: "TEXT" },
            { name: 'recent_activity', type: "TEXT" },
            { name: 'is_premium', type: "INTEGER DEFAULT 0" }
        ];

        for (const col of columns) {
            db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error(`❌ Migration Error adding ${col.name}:`, err.message);
                }
            });
        }

        db.run(`ALTER TABLE session_requests ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {});
        db.run(`ALTER TABLE session_requests ADD COLUMN is_paid INTEGER DEFAULT 0`, (err) => {});
        db.run(`ALTER TABLE session_requests ADD COLUMN fee_amount REAL DEFAULT 0`, (err) => {});
        db.run(`ALTER TABLE session_requests ADD COLUMN message TEXT DEFAULT ''`, (err) => {});
        db.run(`ALTER TABLE session_requests ADD COLUMN payment_proof TEXT DEFAULT ''`, (err) => {});
        db.run(`ALTER TABLE session_requests ADD COLUMN start_time TEXT DEFAULT ''`, (err) => {});
        db.run(`ALTER TABLE session_requests ADD COLUMN end_time TEXT DEFAULT ''`, (err) => {});
        db.run(`ALTER TABLE session_requests ADD COLUMN duration REAL DEFAULT 1.0`, (err) => {});

        db.run(`ALTER TABLE payment_requests ADD COLUMN request_id INTEGER`, (err) => {});
        db.run(`ALTER TABLE payment_requests ADD COLUMN teacher_id INTEGER`, (err) => {});
        db.run(`ALTER TABLE payment_requests ADD COLUMN teacher_name TEXT DEFAULT ''`, (err) => {});
        db.run(`ALTER TABLE payment_requests ADD COLUMN amount REAL DEFAULT 0`, (err) => {});
        db.run(`ALTER TABLE payment_requests ADD COLUMN payment_proof TEXT DEFAULT ''`, (err) => {});

        db.run(`ALTER TABLE transactions ADD COLUMN session_date TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                // Column already exists
            }
        });

        db.run(`ALTER TABLE transactions ADD COLUMN session_time TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                // Column already exists
            }
        });

        // Repair existing transaction records missing skill or session date/time
        db.run(`
            UPDATE transactions 
            SET skill = (
                SELECT skill FROM sessions 
                WHERE sessions.id = transactions.session_id OR sessions.request_id = transactions.session_id
            )
            WHERE (skill = 'undefined' OR skill IS NULL OR skill = '') 
              AND EXISTS (SELECT 1 FROM sessions WHERE sessions.id = transactions.session_id OR sessions.request_id = transactions.session_id)
        `);

        db.run(`
            UPDATE transactions 
            SET session_date = (
                SELECT date FROM sessions 
                WHERE sessions.id = transactions.session_id OR sessions.request_id = transactions.session_id
            ),
            session_time = (
                SELECT time FROM sessions 
                WHERE sessions.id = transactions.session_id OR sessions.request_id = transactions.session_id
            )
            WHERE (session_date IS NULL OR session_date = '')
              AND EXISTS (SELECT 1 FROM sessions WHERE sessions.id = transactions.session_id OR sessions.request_id = transactions.session_id)
        `);

        // Perform one-time migration of existing timestamps to IST (UTC+5:30)
        db.get(`SELECT id FROM system_migrations WHERE name = 'migrate_timestamps_to_ist'`, (err, row) => {
            if (!err && !row) {
                console.log("🕒 Migrating existing database timestamps to IST (UTC+5:30)...");
                db.run(`UPDATE users SET created_at = datetime(created_at, '+5 hours', '+30 minutes') WHERE created_at IS NOT NULL`);
                db.run(`UPDATE session_requests SET created_at = datetime(created_at, '+5 hours', '+30 minutes'), updated_at = datetime(updated_at, '+5 hours', '+30 minutes') WHERE created_at IS NOT NULL`);
                db.run(`UPDATE sessions SET created_at = datetime(created_at, '+5 hours', '+30 minutes') WHERE created_at IS NOT NULL`);
                db.run(`UPDATE session_completions SET completed_at = datetime(completed_at, '+5 hours', '+30 minutes') WHERE completed_at IS NOT NULL`);
                db.run(`UPDATE transactions SET created_at = datetime(created_at, '+5 hours', '+30 minutes') WHERE created_at IS NOT NULL`);
                db.run(`UPDATE user_daily_call_usage SET created_at = datetime(created_at, '+5 hours', '+30 minutes'), updated_at = datetime(updated_at, '+5 hours', '+30 minutes') WHERE created_at IS NOT NULL`);
                db.run(`INSERT INTO system_migrations (name) VALUES ('migrate_timestamps_to_ist')`, (insErr) => {
                    if (!insErr) console.log("✔️ Existing timestamps migrated to IST successfully.");
                });
            }
        });
    });
}

const dbQuery = {
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else {
                    const lastID = this ? this.lastID : undefined;
                    const changes = this ? this.changes : undefined;
                    resolve({ id: lastID, changes: changes });
                }
            });
        });
    },
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

module.exports = { db, dbQuery, dbInstanceId };
