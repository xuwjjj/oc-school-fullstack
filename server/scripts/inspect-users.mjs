import db from '../src/db.js';

console.log(JSON.stringify(db.prepare('SELECT id, username, role FROM users').all(), null, 2));
