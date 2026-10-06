function isAdmin() {
  return AppState.currentUser && AppState.currentUser.role === 'admin';
}

function isReadOnly() {
  return AppState.currentUser && AppState.currentUser.role === 'student';
}

function isTeacherUser() {
  if (!AppState.currentUser) return false;
  if (isAdmin()) return true;
  return (DB.teachers || []).some(function (teacher) {
    return teacher.name === AppState.currentUser.name;
  });
}

function adminOnly(html) {
  return isAdmin() ? html : '';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getLevelName(id) {
  const level = DB.grades_levels.find(function (l) { return l.id === id; });
  return level ? level.name : '';
}

function getDivLabel(d) {
  if (!d) return '—';
  return getLevelName(d.levelId) + ' / ' + d.name;
}

function getStudentsByDiv(id) {
  return DB.students.filter(function (s) { return s.divisionId === id && s.status === 'active'; });
}

function getStudentDiv(s) {
  return DB.divisions.find(function (d) { return d.id === s.divisionId; });
}

function emptyGrades() {
  const grades = {};
  DB.subjects.forEach(function (sub) {
    grades[sub.id] = { q1: 0, mid: 0, q2: 0, final: 0 };
  });
  return grades;
}

function createStudent(fields) {
  const id = DB.nextId.student++;
  const year = String(DB.school.year).split('-')[0];
  return {
    id: id,
    sid: year + '-' + String(id).padStart(4, '0'),
    name: fields.name,
    divisionId: fields.divisionId,
    gender: fields.gender || 'ذكر',
    dob: '2008-01-01',
    phone: '',
    status: 'active',
    grades: emptyGrades(),
    notes: fields.notes || ''
  };
}

function studentGrades(student, subjectId) {
  if (!student.grades) student.grades = emptyGrades();
  if (!student.grades[subjectId]) student.grades[subjectId] = { q1: 0, mid: 0, q2: 0, final: 0 };
  return student.grades[subjectId];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nlToBr(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function linkifyDetails(text) {
  const escaped = nlToBr(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, function (url) {
    return '<a href="' + url + '" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline">🔗 اضغط هنا لفتح المرفق / الصورة</a>';
  });
}

function stripHtmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a href="([^"]+)"[^>]*>.*?<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '');
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
