const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/skill_for_skill.db');
console.log('Opening DB at:', dbPath);
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        return;
    }
    db.all('SELECT id, first_name, last_name, email, role, skills_teach FROM users', [], (err, rows) => {
        if (err) {
            console.error('Error querying users:', err);
            return;
        }
        console.log('USERS IN DB:', JSON.stringify(rows, null, 2));
        db.close();
    });
});
