const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        db.run(`CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_text TEXT NOT NULL,
            ai_text TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )`);

        // Initialize default system prompt if not exists
        db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('system_prompt', 'You are a helpful and friendly Voice AI Assistant. You should respond in Vietnamese. Give very short, concise conversational answers usually fitting in 1-2 sentences.')`);
        db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('voice', 'alloy')`);
    }
});

module.exports = db;
