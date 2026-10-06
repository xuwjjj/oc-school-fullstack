const PAGE_TITLES = {
  dashboard: 'لوحة القيادة',
  students: 'سجل الطلبة',
  import: 'استيراد الطلبة',
  divisions: 'الشُعب والصفوف',
  attendance: 'سجل الحضور والغياب',
  grades: 'سجل الدرجات',
  subjects: 'المواد الدراسية',
  exams: 'جدول الامتحانات',
  teachers: 'الكادر التدريسي',
  announcements: 'التعليمات والإعلانات',
  reports: 'التقارير والشهادات',
  accounts: 'إدارة الحسابات',
  customize: 'تخصيص الموقع'
};

const STUDENT_BLOCKED = [
  'students', 'import', 'divisions', 'attendance', 'grades', 'subjects',
  'teachers', 'reports', 'accounts', 'customize'
];

const PAGE_RENDERERS = {};

function registerPage(name, renderer) {
  PAGE_RENDERERS[name] = renderer;
}

function navigate(page) {
  if (isReadOnly() && STUDENT_BLOCKED.includes(page)) return;

  AppState.currentPage = page;
  AppState.selectedStudents = [];
  document.querySelectorAll('.nav-item').forEach(function (n) {
    n.classList.toggle('active', n.dataset.page === page);
  });
  $('page-title').innerHTML = (PAGE_TITLES[page] || page) + '<span>— ' + escapeHtml(DB.school.name) + '</span>';
  const area = $('content-area');
  area.scrollTop = 0;
  area.innerHTML = '<div class="animate-in">' + renderPage(page) + '</div>';
}

function renderPage(page) {
  const renderer = PAGE_RENDERERS[page];
  return renderer ? renderer() : '';
}
