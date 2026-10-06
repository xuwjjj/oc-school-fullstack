import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dbDir, 'school.db');

fs.mkdirSync(dbDir, { recursive: true });

const SQL = await initSqlJs({
  locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
});

let db;
if (fs.existsSync(dbPath)) {
  const fileBuffer = fs.readFileSync(dbPath);
  db = new SQL.Database(new Uint8Array(fileBuffer));
} else {
  db = new SQL.Database();
}

db.save = () => {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
};

const sqlPrepare = db.prepare.bind(db);
db.prepare = (sql) => {
  const statement = sqlPrepare(sql);

  return {
    get(...params) {
      if (params.length) statement.bind(params);
      const row = statement.step() ? statement.getAsObject() : undefined;
      statement.free();
      return row;
    },
    all(...params) {
      if (params.length) statement.bind(params);
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      statement.free();
      return rows;
    },
    run(...params) {
      if (params.length) statement.bind(params);
      while (statement.step()) {}
      const changes = db.getRowsModified();
      statement.free();

      const idStatement = sqlPrepare('SELECT last_insert_rowid() AS id');
      idStatement.step();
      const lastInsertRowid = idStatement.getAsObject().id;
      idStatement.free();

      return { changes, lastInsertRowid };
    }
  };
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    media_type TEXT DEFAULT 'text',
    media_url TEXT,
    visibility TEXT NOT NULL CHECK(visibility IN ('public', 'private', 'teachers')),
    author_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    guardian_name TEXT,
    guardian_phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late')),
    notes TEXT,
    recorded_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, date),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    score REAL NOT NULL,
    max_score REAL NOT NULL,
    teacher_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    room TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const userColumns = db.exec('PRAGMA table_info(users)')[0]?.values || [];
const hasPasswordHash = userColumns.some((row) => row[1] === 'password_hash');
if (!hasPasswordHash) {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
}

db.save();

const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;

if (Boolean(adminUsername) !== Boolean(adminPassword)) {
  throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must both be configured');
}

if (adminUsername && adminPassword) {
  const adminEmail = process.env.ADMIN_EMAIL || `${adminUsername}@school.local`;
  const adminName = process.env.ADMIN_NAME || 'المشرف العام';
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUsername);

  if (!existing) {
    db.prepare(`
      INSERT INTO users (name, username, email, password_hash, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run(adminName, adminUsername, adminEmail, bcrypt.hashSync(adminPassword, 10));
    db.save();
  } else if (!existing.password_hash) {
    db.prepare(`
      UPDATE users
      SET email = ?, password_hash = ?, role = 'admin', name = ?
      WHERE username = ?
    `).run(adminEmail, bcrypt.hashSync(adminPassword, 10), adminName, adminUsername);
    db.save();
  }
}

export default db;
