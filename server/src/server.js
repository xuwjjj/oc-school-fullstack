import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import db from './db.js';
import { issueToken, verifyToken, comparePassword, createUser, findUserByUsername, findUserByEmail, getUserById, hashPassword } from './auth.js';

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 4000);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
    return callback(null, isLocalhost ? origin : false);
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, try again later.' }
});

function dbAll(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function getAuthUser(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = verifyToken(token);
    return getUserById(payload.id);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
}

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  const { name, username, email, password } = req.body || {};
  if (!name || !username || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }
  if (findUserByUsername(username)) {
    return res.status(409).json({ success: false, message: 'Username already exists' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ success: false, message: 'Email already exists' });
  }

  const user = createUser({ name, username, email, password, role: 'student' });
  const token = issueToken(user);
  return res.status(201).json({ success: true, token, user });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const user = findUserByUsername(username);

  if (!user || !user.password_hash || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = issueToken(user);
  return res.json({ success: true, token, user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role } });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.get('/api/dashboard/overview', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const studentCount = db.prepare('SELECT COUNT(*) AS total FROM students').get().total;
  const staffCount = db.prepare('SELECT COUNT(*) AS total FROM staff').get().total;
  const examCount = db.prepare('SELECT COUNT(*) AS total FROM exams').get().total;
  const attendanceSnapshot = dbAll('SELECT status, COUNT(*) AS total FROM attendance GROUP BY status');
  const gradeRows = dbAll('SELECT score, max_score FROM grades');
  const avgGrade = gradeRows.length
    ? gradeRows.reduce((sum, row) => sum + (Number(row.score) / Number(row.max_score || 1)) * 100, 0) / gradeRows.length
    : 0;

  const overview = {
    studentCount,
    staffCount,
    examCount,
    attendanceSnapshot,
    avgGrade: Number(avgGrade.toFixed(1)),
    presentCount: (attendanceSnapshot.find(row => row.status === 'present') || { total: 0 }).total,
    absentCount: (attendanceSnapshot.find(row => row.status === 'absent') || { total: 0 }).total,
    lateCount: (attendanceSnapshot.find(row => row.status === 'late') || { total: 0 }).total,
    latestStudents: dbAll('SELECT * FROM students ORDER BY created_at DESC LIMIT 5'),
    upcomingExams: dbAll('SELECT * FROM exams ORDER BY exam_date DESC LIMIT 5')
  };

  res.json({ success: true, overview });
});

app.get('/api/students', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const rows = dbAll('SELECT * FROM students ORDER BY created_at DESC');
  res.json({ success: true, students: rows });
});

app.post('/api/students', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const { name, grade_level, guardian_name, guardian_phone, status = 'active' } = req.body || {};
  if (!name || !grade_level) {
    return res.status(400).json({ success: false, message: 'Name and grade level are required' });
  }

  const result = db.prepare(`
    INSERT INTO students (name, grade_level, guardian_name, guardian_phone, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, grade_level, guardian_name || '', guardian_phone || '', status);

  db.save();
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, student });
});

app.post('/api/students/import', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const rows = req.body?.students;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'لم يتم العثور على أسماء صالحة للاستيراد' });
  }
  if (rows.length > 500) {
    return res.status(413).json({ success: false, message: 'الحد الأقصى للاستيراد هو 500 طالب في المرة الواحدة' });
  }

  const studentsToImport = rows.map((row) => ({
    name: typeof row?.name === 'string' ? row.name.trim() : '',
    gradeLevel: typeof row?.grade_level === 'string' ? row.grade_level.trim() : '',
    guardianName: typeof row?.guardian_name === 'string' ? row.guardian_name.trim() : '',
    guardianPhone: typeof row?.guardian_phone === 'string' ? row.guardian_phone.trim() : ''
  })).filter((student) => student.name && student.name.length <= 160);

  const skipped = rows.length - studentsToImport.length;
  if (!studentsToImport.length) {
    return res.status(400).json({ success: false, message: 'تأكد من وجود عمود اسم الطالب في الملف' });
  }

  try {
    db.exec('BEGIN TRANSACTION');
    for (const student of studentsToImport) {
      db.prepare(`
        INSERT INTO students (name, grade_level, guardian_name, guardian_phone, status)
        VALUES (?, ?, ?, ?, 'active')
      `).run(student.name, student.gradeLevel || 'غير محدد', student.guardianName, student.guardianPhone);
    }
    db.exec('COMMIT');
    db.save();
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Student import failed:', error);
    return res.status(500).json({ success: false, message: 'تعذر استيراد الأسماء، لم يتم حفظ أي سجل' });
  }

  return res.status(201).json({
    success: true,
    imported: studentsToImport.length,
    skipped,
    message: `تم استيراد ${studentsToImport.length} طالب${skipped ? ` وتجاوز ${skipped} صفوف غير صالحة` : ''}`
  });
});

app.put('/api/students/:id', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const { name, grade_level, guardian_name, guardian_phone, status } = req.body || {};
  if (!name || !grade_level) {
    return res.status(400).json({ success: false, message: 'Name and grade level are required' });
  }

  db.prepare(`
    UPDATE students
    SET name = ?, grade_level = ?, guardian_name = ?, guardian_phone = ?, status = ?
    WHERE id = ?
  `).run(name, grade_level, guardian_name || '', guardian_phone || '', status || 'active', req.params.id);

  db.save();
  res.json({ success: true, student: db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id) });
});

app.delete('/api/students/:id', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM attendance WHERE student_id = ?').run(req.params.id);
  db.prepare('DELETE FROM grades WHERE student_id = ?').run(req.params.id);
  db.save();
  res.json({ success: true, message: 'Student deleted' });
});

app.get('/api/attendance', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const rows = dbAll(`
    SELECT a.*, s.name AS student_name, s.grade_level
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    ORDER BY a.date DESC, a.id DESC
  `);
  res.json({ success: true, attendance: rows });
});

app.post('/api/attendance', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const { student_id, date, status, notes } = req.body || {};
  if (!student_id || !date || !status) {
    return res.status(400).json({ success: false, message: 'Student, date and status are required' });
  }

  const existing = db.prepare('SELECT * FROM attendance WHERE student_id = ? AND date = ?').get(student_id, date);
  if (existing) {
    db.prepare(`
      UPDATE attendance
      SET status = ?, notes = ?, recorded_by = ?
      WHERE id = ?
    `).run(status, notes || '', req.user.name || req.user.username, existing.id);
  } else {
    db.prepare(`
      INSERT INTO attendance (student_id, date, status, notes, recorded_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(student_id, date, status, notes || '', req.user.name || req.user.username);
  }

  db.save();
  res.status(201).json({ success: true, message: 'Attendance recorded' });
});

app.get('/api/grades', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const rows = dbAll(`
    SELECT g.*, s.name AS student_name, s.grade_level
    FROM grades g
    JOIN students s ON s.id = g.student_id
    ORDER BY g.created_at DESC
  `);
  res.json({ success: true, grades: rows });
});

app.post('/api/grades', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const { student_id, subject, exam_name, score, max_score } = req.body || {};
  if (!student_id || !subject || !exam_name || !score || !max_score) {
    return res.status(400).json({ success: false, message: 'Student, subject, exam, score and max score are required' });
  }

  const result = db.prepare(`
    INSERT INTO grades (student_id, subject, exam_name, score, max_score, teacher_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(student_id, subject, exam_name, Number(score), Number(max_score), req.user.name || req.user.username);

  db.save();
  const grade = db.prepare('SELECT * FROM grades WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, grade });
});

app.get('/api/staff', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const rows = dbAll('SELECT * FROM staff ORDER BY created_at DESC');
  res.json({ success: true, staff: rows });
});

app.post('/api/staff', requireAuth, requireRole('admin'), (req, res) => {
  const { name, role, email, phone, department } = req.body || {};
  if (!name || !role) {
    return res.status(400).json({ success: false, message: 'Name and role are required' });
  }

  const result = db.prepare(`
    INSERT INTO staff (name, role, email, phone, department)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, role, email || '', phone || '', department || '');

  db.save();
  const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, member });
});

app.get('/api/exams', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const rows = dbAll('SELECT * FROM exams ORDER BY exam_date DESC');
  res.json({ success: true, exams: rows });
});

app.post('/api/exams', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const { title, subject, exam_date, duration_minutes, room } = req.body || {};
  if (!title || !subject || !exam_date) {
    return res.status(400).json({ success: false, message: 'Title, subject and exam date are required' });
  }

  const result = db.prepare(`
    INSERT INTO exams (title, subject, exam_date, duration_minutes, room)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, subject, exam_date, Number(duration_minutes || 60), room || '');

  db.save();
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, exam });
});

app.get('/api/reports', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const studentCount = db.prepare('SELECT COUNT(*) AS total FROM students').get().total;
  const staffCount = db.prepare('SELECT COUNT(*) AS total FROM staff').get().total;
  const attendanceRows = dbAll('SELECT status, COUNT(*) AS total FROM attendance GROUP BY status');
  const gradeRows = db.prepare('SELECT ROUND(AVG(score / max_score) * 100, 1) AS avg_score FROM grades WHERE max_score > 0').get();

  res.json({
    success: true,
    report: {
      studentCount,
      staffCount,
      attendance: attendanceRows,
      averageScore: Number(gradeRows?.avg_score || 0),
      latestDate: db.prepare('SELECT date FROM attendance ORDER BY date DESC LIMIT 1').get()?.date || null
    }
  });
});

app.get('/api/posts', requireAuth, (req, res) => {
  const rows = dbAll(`
    SELECT * FROM posts
    WHERE visibility = 'public'
       OR (visibility = 'private' AND ?) = 1
       OR visibility = 'teachers'
    ORDER BY created_at DESC
  `, [req.user.role === 'admin' || req.user.role === 'teacher' ? 1 : 0]);

  res.json({ success: true, posts: rows });
});

app.post('/api/posts', authLimiter, requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const { title, text, mediaType, mediaUrl, visibility = 'public' } = req.body || {};
  if (!title || !text) {
    return res.status(400).json({ success: false, message: 'Title and text are required' });
  }

  if ((visibility === 'private' || visibility === 'teachers') && req.user.role === 'student') {
    return res.status(403).json({ success: false, message: 'You cannot post in this section' });
  }

  const result = db.prepare(`
    INSERT INTO posts (title, text, media_type, media_url, visibility, author_id, author_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, text, mediaType || 'text', mediaType === 'text' ? null : (mediaUrl || ''), visibility, req.user.id, req.user.name);

  db.save();
  const lastId = Number(result.lastInsertRowid ?? result.lastInsertId ?? 0);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(lastId);
  res.status(201).json({ success: true, post });
});

app.put('/api/posts/:id', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
  if (req.user.role !== 'admin' && req.user.id !== post.author_id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { title, text, mediaType, mediaUrl, visibility } = req.body || {};
  if (!title || !text) return res.status(400).json({ success: false, message: 'Title and text are required' });

  db.prepare(`
    UPDATE posts
    SET title = ?, text = ?, media_type = ?, media_url = ?, visibility = ?
    WHERE id = ?
  `).run(title, text, mediaType || 'text', mediaType === 'text' ? null : (mediaUrl || ''), visibility || post.visibility, req.params.id);

  db.save();
  res.json({ success: true, post: db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) });
});

app.delete('/api/posts/:id', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
  if (req.user.role !== 'admin' && req.user.id !== post.author_id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  db.save();
  res.json({ success: true, message: 'Post deleted' });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
