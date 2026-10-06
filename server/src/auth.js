import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db.js';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters');
}
const JWT_EXPIRES_IN = '7d';

export function issueToken(user) {
  return jwt.sign({ id: user.id, role: user.role, username: user.username, name: user.name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function createUser({ name, username, email, password, role }) {
  const passwordHash = hashPassword(password);
  const result = db.prepare(`
    INSERT INTO users (name, username, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, username, email, passwordHash, role);

  db.save();
  const lastId = Number(result.lastInsertRowid ?? result.lastInsertId ?? 0);
  return db.prepare('SELECT id, name, username, email, role FROM users WHERE id = ?').get(lastId);
}

export function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function getUserById(id) {
  return db.prepare('SELECT id, name, username, email, role FROM users WHERE id = ?').get(id);
}
