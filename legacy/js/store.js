const STORAGE = {
  accounts: 'smartSchool_accounts',
  db: 'smartSchool_db',
  session: 'smartSchool_session'
};

const DEFAULT_ACCOUNTS = {
  admin: { username: 'admin', name: 'المشرف العام' },
  students: []
};

const DEFAULT_DB = {
  school: { name: 'إعدادية الصدرين', code: 'SCH-2024-0847', city: 'بغداد', type: 'ثانوية', year: '2025-2026' },
  grades_levels: [
    { id: 1, name: 'الأول المتوسط' }, { id: 2, name: 'الثاني المتوسط' }, { id: 3, name: 'الثالث المتوسط' },
    { id: 4, name: 'الرابع العلمي' }, { id: 5, name: 'الخامس العلمي' }, { id: 6, name: 'السادس العلمي' }
  ],
  divisions: [
    { id: 1, levelId: 4, name: 'أ', capacity: 40 }, { id: 2, levelId: 4, name: 'ب', capacity: 40 },
    { id: 3, levelId: 5, name: 'أ', capacity: 38 }, { id: 4, levelId: 5, name: 'ب', capacity: 38 },
    { id: 5, levelId: 6, name: 'أ', capacity: 35 }, { id: 6, levelId: 1, name: 'أ', capacity: 42 }
  ],
  subjects: [
    { id: 1, name: 'الرياضيات', maxGrade: 100, passGrade: 50 },
    { id: 2, name: 'اللغة العربية', maxGrade: 100, passGrade: 50 },
    { id: 3, name: 'اللغة الإنجليزية', maxGrade: 100, passGrade: 50 },
    { id: 4, name: 'الفيزياء', maxGrade: 100, passGrade: 50 },
    { id: 5, name: 'الكيمياء', maxGrade: 100, passGrade: 50 },
    { id: 6, name: 'الأحياء', maxGrade: 100, passGrade: 50 },
    { id: 7, name: 'التربية الإسلامية', maxGrade: 100, passGrade: 50 },
    { id: 8, name: 'الاجتماعيات', maxGrade: 50, passGrade: 25 }
  ],
  students: [],
  teachers: [],
  attendance: {},
  announcements: [
    {
      id: 1,
      title: 'ترحيب بالعام الجديد',
      body: 'نرحب بالطلبة في العام الدراسي الجديد. يرجى الالتزام بالتعليمات المدرسية والمواظبة على الحضور.',
      date: '2025-10-01',
      priority: 'normal',
      author: 'الإدارة'
    }
  ],
  communityPosts: [],
  exams: [],
  notes: [],
  nextId: { student: 1001, announcement: 2, exam: 1, teacher: 1, exam_entry: 1, note: 1 },
  customize: { accentColor: '#d4a54a', fontSize: '14px' }
};

let ACCOUNTS;
let DB;

const AppState = {
  currentPage: 'dashboard',
  currentUser: null,
  forumTab: 'public',
  studentsFilter: { div: 'all', search: '' },
  attDiv: null,
  attDate: new Date().toISOString().slice(0, 10),
  attSearch: '',
  gradeDiv: null,
  gradeSub: null,
  importedNames: [],
  selectedStudents: []
};

function parseStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function migrateDb(db) {
  if (!db.nextId) db.nextId = { student: 1001, announcement: 2, exam: 1, teacher: 1, exam_entry: 1, note: 1 };
  if (!db.teachers) db.teachers = [];
  if (!db.exams) db.exams = [];
  if (!db.notes) db.notes = [];
  if (!db.nextId.note) db.nextId.note = 1;
  if (!db.customize) db.customize = { accentColor: '#d4a54a', fontSize: '14px' };
  if (!db.attendance) db.attendance = {};
  (db.students || []).forEach(function (s) {
    if (!s.grades) s.grades = emptyGrades();
  });
  return db;
}

function loadStore() {
  ACCOUNTS = parseStored(STORAGE.accounts, JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS)));
  DB = migrateDb(parseStored(STORAGE.db, JSON.parse(JSON.stringify(DEFAULT_DB))));
  AppState.currentUser = parseStored(STORAGE.session, null);
}

function saveData() {
  localStorage.setItem(STORAGE.accounts, JSON.stringify(ACCOUNTS));
  localStorage.setItem(STORAGE.db, JSON.stringify(DB));
}

function saveSession() {
  if (!AppState.currentUser) {
    localStorage.removeItem(STORAGE.session);
    return;
  }

  const safeUser = {
    role: AppState.currentUser.role,
    name: AppState.currentUser.name,
    username: AppState.currentUser.username,
    email: AppState.currentUser.email
  };

  localStorage.setItem(STORAGE.session, JSON.stringify(safeUser));
}

function factoryReset() {
  if (!confirm('تحذير خطير جداً ⚠️:\nسيتم مسح جميع بيانات الطلاب، الشُعب، الحضور، الدرجات، الإعلانات والحسابات بشكل نهائي!\n\nهل أنت متأكد 100% أنك تريد تصفير المنظومة بالكامل؟')) return;
  localStorage.removeItem(STORAGE.db);
  localStorage.removeItem(STORAGE.accounts);
  location.reload();
}
