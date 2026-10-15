import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import db from './db.js';
import { createDatabaseBackup, getDatabaseBackup, listDatabaseBackups } from './backups.js';
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

function ensureSchoolClass(gradeLevel, section) {
  db.prepare('INSERT OR IGNORE INTO school_classes (grade_level, section) VALUES (?, ?)').run(gradeLevel, section);
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

app.post('/api/users/teachers', requireAuth, requireRole('admin'), (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!name || name.length > 160 || !/^[A-Za-z0-9._-]{3,40}$/.test(username)) {
    return res.status(400).json({ success: false, message: 'أدخل الاسم واسم مستخدم من 3 إلى 40 حرفاً إنجليزياً أو رقماً' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'أدخل بريداً إلكترونياً صالحاً' });
  }
  if (password.length < 8 || password.length > 200) {
    return res.status(400).json({ success: false, message: 'كلمة مرور المعلم يجب أن تكون بين 8 و200 حرف' });
  }
  if (findUserByUsername(username)) {
    return res.status(409).json({ success: false, message: 'اسم المستخدم مسجل مسبقاً' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ success: false, message: 'البريد الإلكتروني مسجل مسبقاً' });
  }

  const teacher = createUser({ name, username, email, password, role: 'teacher' });
  return res.status(201).json({ success: true, teacher });
});

app.get('/api/users/teachers', requireAuth, requireRole('admin'), (req, res) => {
  const teachers = dbAll(`
    SELECT id, name, username, email, created_at
    FROM users WHERE role = 'teacher'
    ORDER BY name, username
  `);
  res.json({ success: true, teachers });
});

app.delete('/api/users/teachers/:id', requireAuth, requireRole('admin'), (req, res) => {
  const result = db.prepare("DELETE FROM users WHERE id = ? AND role = 'teacher'").run(req.params.id);
  if (!result.changes) return res.status(404).json({ success: false, message: 'حساب المعلم غير موجود' });
  db.save();
  res.json({ success: true });
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
  const rows = dbAll('SELECT * FROM students ORDER BY grade_level, section, name');
  res.json({ success: true, students: rows });
});

app.get('/api/classes', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const classes = dbAll(`
    SELECT c.*, COUNT(s.id) AS student_count
    FROM school_classes c
    LEFT JOIN students s ON s.grade_level = c.grade_level AND s.section = c.section
    GROUP BY c.id
    ORDER BY c.grade_level, c.section
  `);
  res.json({ success: true, classes });
});

app.post('/api/classes', requireAuth, requireRole('admin'), (req, res) => {
  const gradeLevel = typeof req.body?.grade_level === 'string' ? req.body.grade_level.trim() : '';
  const section = typeof req.body?.section === 'string' ? req.body.section.trim() : '';
  if (!gradeLevel || !section || gradeLevel.length > 100 || section.length > 60) {
    return res.status(400).json({ success: false, message: 'أدخل اسم الصف والشعبة بشكل صحيح' });
  }

  const existing = db.prepare('SELECT id FROM school_classes WHERE grade_level = ? AND section = ?').get(gradeLevel, section);
  if (existing) return res.status(409).json({ success: false, message: 'هذا الصف وهذه الشعبة مسجلان مسبقاً' });

  const result = db.prepare('INSERT INTO school_classes (grade_level, section) VALUES (?, ?)').run(gradeLevel, section);
  db.save();
  res.status(201).json({
    success: true,
    schoolClass: db.prepare('SELECT *, 0 AS student_count FROM school_classes WHERE id = ?').get(result.lastInsertRowid)
  });
});

app.put('/api/classes/:id', requireAuth, requireRole('admin'), (req, res) => {
  const schoolClass = db.prepare('SELECT * FROM school_classes WHERE id = ?').get(req.params.id);
  if (!schoolClass) return res.status(404).json({ success: false, message: 'الصف أو الشعبة غير موجودين' });

  const gradeLevel = typeof req.body?.grade_level === 'string' ? req.body.grade_level.trim() : '';
  const section = typeof req.body?.section === 'string' ? req.body.section.trim() : '';
  if (!gradeLevel || !section || gradeLevel.length > 100 || section.length > 60) {
    return res.status(400).json({ success: false, message: 'أدخل اسم الصف والشعبة بشكل صحيح' });
  }

  const duplicate = db.prepare(
    'SELECT id FROM school_classes WHERE grade_level = ? AND section = ? AND id <> ?'
  ).get(gradeLevel, section, req.params.id);
  if (duplicate) return res.status(409).json({ success: false, message: 'هذا الصف وهذه الشعبة مسجلان مسبقاً' });

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare('UPDATE school_classes SET grade_level = ?, section = ? WHERE id = ?')
      .run(gradeLevel, section, req.params.id);
    db.prepare('UPDATE students SET grade_level = ?, section = ? WHERE grade_level = ? AND section = ?')
      .run(gradeLevel, section, schoolClass.grade_level, schoolClass.section);
    db.exec('COMMIT');
    db.save();
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Class update failed:', error);
    return res.status(500).json({ success: false, message: 'تعذر تعديل الصف والشعبة' });
  }

  res.json({
    success: true,
    schoolClass: db.prepare('SELECT * FROM school_classes WHERE id = ?').get(req.params.id)
  });
});

app.delete('/api/classes/:id', requireAuth, requireRole('admin'), (req, res) => {
  const schoolClass = db.prepare('SELECT * FROM school_classes WHERE id = ?').get(req.params.id);
  if (!schoolClass) return res.status(404).json({ success: false, message: 'الصف أو الشعبة غير موجودين' });

  const studentCount = db.prepare(
    'SELECT COUNT(*) AS total FROM students WHERE grade_level = ? AND section = ?'
  ).get(schoolClass.grade_level, schoolClass.section).total;
  if (studentCount) {
    return res.status(409).json({ success: false, message: 'لا يمكن حذف شعبة تحتوي على طلاب' });
  }

  db.prepare('DELETE FROM school_classes WHERE id = ?').run(req.params.id);
  db.save();
  res.json({ success: true });
});

app.post('/api/students', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const { guardian_name, guardian_phone, status = 'active' } = req.body || {};
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const gradeLevel = typeof req.body?.grade_level === 'string' ? req.body.grade_level.trim() : '';
  const section = typeof req.body?.section === 'string' && req.body.section.trim()
    ? req.body.section.trim()
    : 'غير محدد';
  if (!name || !gradeLevel) {
    return res.status(400).json({ success: false, message: 'أدخل اسم الطالب والصف' });
  }

  ensureSchoolClass(gradeLevel, section);
  const result = db.prepare(`
    INSERT INTO students (name, grade_level, section, guardian_name, guardian_phone, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, gradeLevel, section, guardian_name || '', guardian_phone || '', status);

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
    section: typeof row?.section === 'string' ? row.section.trim() : '',
    guardianName: typeof row?.guardian_name === 'string' ? row.guardian_name.trim() : '',
    guardianPhone: typeof row?.guardian_phone === 'string' ? row.guardian_phone.trim() : ''
  })).filter((student) => student.name && student.name.length <= 160);

  let skipped = rows.length - studentsToImport.length;
  if (!studentsToImport.length) {
    return res.status(400).json({ success: false, message: 'تأكد من وجود عمود اسم الطالب في الملف' });
  }

  let imported = 0;
  try {
    db.exec('BEGIN TRANSACTION');
    for (const student of studentsToImport) {
      const section = student.section || 'غير محدد';
      const gradeLevel = student.gradeLevel || 'غير محدد';
      const duplicate = db.prepare(`
        SELECT id FROM students WHERE name = ? AND grade_level = ? AND section = ?
      `).get(student.name, gradeLevel, section);
      if (duplicate) {
        skipped += 1;
        continue;
      }
      ensureSchoolClass(gradeLevel, section);
      db.prepare(`
        INSERT INTO students (name, grade_level, section, guardian_name, guardian_phone, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(student.name, gradeLevel, section, student.guardianName, student.guardianPhone);
      imported += 1;
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
    imported,
    skipped,
    message: `تمت إضافة ${imported} طالب${skipped ? `، وتجاوز ${skipped} اسماً غير صالح أو مسجلاً مسبقاً` : ''}`
  });
});

app.put('/api/students/:id', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const { guardian_name, guardian_phone, status } = req.body || {};
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const gradeLevel = typeof req.body?.grade_level === 'string' ? req.body.grade_level.trim() : '';
  const section = typeof req.body?.section === 'string' && req.body.section.trim()
    ? req.body.section.trim()
    : 'غير محدد';
  if (!name || !gradeLevel) {
    return res.status(400).json({ success: false, message: 'أدخل اسم الطالب والصف' });
  }

  ensureSchoolClass(gradeLevel, section);
  db.prepare(`
    UPDATE students
    SET name = ?, grade_level = ?, section = ?, guardian_name = ?, guardian_phone = ?, status = ?
    WHERE id = ?
  `).run(name, gradeLevel, section, guardian_name || '', guardian_phone || '', status || 'active', req.params.id);

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
    SELECT a.*, s.name AS student_name, s.grade_level, s.section
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
  if (!['present', 'absent', 'late'].includes(status) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, message: 'حالة الحضور أو التاريخ غير صالح' });
  }
  if (!db.prepare('SELECT id FROM students WHERE id = ?').get(student_id)) {
    return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
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
    SELECT g.*, s.name AS student_name, s.grade_level, s.section
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

app.post('/api/grades/import', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const gradeLevel = typeof req.body?.grade_level === 'string' ? req.body.grade_level.trim() : '';
  const section = typeof req.body?.section === 'string' ? req.body.section.trim() : '';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const examName = typeof req.body?.exam_name === 'string' ? req.body.exam_name.trim() : '';
  const maxScore = Number(req.body?.max_score);
  const rows = req.body?.students;

  if (!gradeLevel || !section || !subject || !examName || subject.length > 100 || examName.length > 100) {
    return res.status(400).json({ success: false, message: 'اختر الصف والشعبة وأدخل اسم المادة والاختبار' });
  }
  if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1_000_000) {
    return res.status(400).json({ success: false, message: 'الدرجة النهائية يجب أن تكون أكبر من صفر' });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'لم يتم العثور على أسماء ودرجات صالحة' });
  }
  if (rows.length > 500) {
    return res.status(413).json({ success: false, message: 'الحد الأقصى لاستيراد الدرجات هو 500 طالب' });
  }
  if (!db.prepare('SELECT id FROM school_classes WHERE grade_level = ? AND section = ?').get(gradeLevel, section)) {
    return res.status(404).json({ success: false, message: 'الصف والشعبة المحددان غير موجودين؛ أضفهما أولاً' });
  }

  const studentsToGrade = [];
  const seenNames = new Set();
  for (const [index, row] of rows.entries()) {
    const name = typeof row?.name === 'string' ? row.name.trim() : '';
    const rawScore = row?.score;
    const score = Number(rawScore);
    if (
      !name || name.length > 160 || rawScore === null || rawScore === undefined
      || String(rawScore).trim() === '' || !Number.isFinite(score) || score < 0 || score > maxScore
    ) {
      return res.status(400).json({
        success: false,
        message: `تحقق من اسم الطالب والدرجة في السطر ${index + 2}؛ الدرجة يجب أن تكون من 0 إلى ${maxScore}`
      });
    }

    const normalizedName = name.normalize('NFC').toLocaleLowerCase('ar');
    if (seenNames.has(normalizedName)) {
      return res.status(400).json({ success: false, message: `اسم الطالب مكرر في الملف: ${name}` });
    }
    seenNames.add(normalizedName);
    studentsToGrade.push({ name, score });
  }

  for (const studentRow of studentsToGrade) {
    const matchCount = db.prepare(`
      SELECT COUNT(*) AS total FROM students WHERE name = ? AND grade_level = ? AND section = ?
    `).get(studentRow.name, gradeLevel, section).total;
    if (matchCount > 1) {
      return res.status(409).json({
        success: false,
        message: `يوجد أكثر من طالب بالاسم نفسه في هذه الشعبة: ${studentRow.name}؛ وحّد الأسماء قبل استيراد الدرجات`
      });
    }
  }

  let studentsAdded = 0;
  let gradesAdded = 0;
  let gradesUpdated = 0;
  try {
    db.exec('BEGIN TRANSACTION');
    for (const studentRow of studentsToGrade) {
      let student = db.prepare(`
        SELECT id FROM students WHERE name = ? AND grade_level = ? AND section = ?
      `).get(studentRow.name, gradeLevel, section);

      if (!student) {
        const result = db.prepare(`
          INSERT INTO students (name, grade_level, section, status)
          VALUES (?, ?, ?, 'active')
        `).run(studentRow.name, gradeLevel, section);
        student = { id: result.lastInsertRowid };
        studentsAdded += 1;
      }

      const existingGrade = db.prepare(`
        SELECT id FROM grades WHERE student_id = ? AND subject = ? AND exam_name = ?
      `).get(student.id, subject, examName);
      if (existingGrade) {
        db.prepare(`
          UPDATE grades SET score = ?, max_score = ?, teacher_name = ? WHERE id = ?
        `).run(studentRow.score, maxScore, req.user.name || req.user.username, existingGrade.id);
        gradesUpdated += 1;
      } else {
        db.prepare(`
          INSERT INTO grades (student_id, subject, exam_name, score, max_score, teacher_name)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(student.id, subject, examName, studentRow.score, maxScore, req.user.name || req.user.username);
        gradesAdded += 1;
      }
    }
    db.exec('COMMIT');
    db.save();
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Grade import failed:', error);
    return res.status(500).json({ success: false, message: 'تعذر استيراد الدرجات؛ لم يتم حفظ أي تغيير' });
  }

  return res.status(201).json({
    success: true,
    studentsAdded,
    gradesAdded,
    gradesUpdated,
    message: `تمت إضافة ${studentsAdded} طالب جديد، وإضافة ${gradesAdded} درجة وتحديث ${gradesUpdated} درجة`
  });
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

app.get('/api/reports/students/:id', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });

  const studentGrades = dbAll(
    'SELECT * FROM grades WHERE student_id = ? ORDER BY created_at DESC, id DESC',
    [req.params.id]
  );
  const attendanceHistory = dbAll(
    'SELECT date, status, notes, recorded_by FROM attendance WHERE student_id = ? ORDER BY date DESC, id DESC',
    [req.params.id]
  );
  const absences = attendanceHistory.filter((record) => record.status === 'absent');

  res.json({
    success: true,
    report: {
      student,
      grades: studentGrades,
      attendance: attendanceHistory,
      absenceCount: absences.length,
      absenceDates: absences.map((record) => record.date)
    }
  });
});

app.get('/api/reports/frequent-absences', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const rawMinimum = req.query.minimum ?? '3';
  const minimum = Number(rawMinimum);
  if (!Number.isInteger(minimum) || minimum < 1 || minimum > 366) {
    return res.status(400).json({ success: false, message: 'حد الغياب يجب أن يكون بين يوم واحد و366 يوماً' });
  }

  const studentsWithFrequentAbsences = dbAll(`
    SELECT s.id, s.name, s.grade_level, s.section, COUNT(a.id) AS absence_count,
      (
        SELECT GROUP_CONCAT(absent_days.date, ', ')
        FROM (
          SELECT date FROM attendance
          WHERE student_id = s.id AND status = 'absent'
          ORDER BY date DESC
        ) AS absent_days
      ) AS absence_dates
    FROM students s
    JOIN attendance a ON a.student_id = s.id AND a.status = 'absent'
    GROUP BY s.id, s.name, s.grade_level, s.section
    HAVING COUNT(a.id) >= ?
    ORDER BY absence_count DESC, s.grade_level, s.section, s.name
  `, [minimum]);

  res.json({ success: true, minimum, students: studentsWithFrequentAbsences });
});

app.get('/api/backups', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ success: true, backups: listDatabaseBackups() });
});

app.post('/api/backups/create', requireAuth, requireRole('admin'), (req, res) => {
  try {
    db.save();
    const backups = createDatabaseBackup();
    return res.status(201).json({ success: true, backups });
  } catch (error) {
    console.error('Manual database backup failed:', error);
    return res.status(500).json({ success: false, message: 'تعذر إنشاء النسخة الاحتياطية' });
  }
});

app.get('/api/backups/:name', requireAuth, requireRole('admin'), (req, res) => {
  const backupPath = getDatabaseBackup(req.params.name);
  if (!backupPath) return res.status(404).json({ success: false, message: 'النسخة الاحتياطية غير موجودة' });

  return res.download(backupPath, req.params.name, (error) => {
    if (error && !res.headersSent) {
      console.error('Database backup download failed:', error);
      res.status(500).json({ success: false, message: 'تعذر تنزيل النسخة الاحتياطية' });
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

createDatabaseBackup();
const dailyBackupTimer = setInterval(() => {
  try {
    createDatabaseBackup();
    console.log('Daily database backup created');
  } catch (error) {
    console.error('Daily database backup failed:', error);
  }
}, 24 * 60 * 60 * 1000);
dailyBackupTimer.unref();

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
