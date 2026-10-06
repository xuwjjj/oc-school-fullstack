function $(id) {
  return document.getElementById(id);
}

function updateDate() {
  const el = $('date-display');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('ar-IQ', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function checkResponsive() {
  const btn = $('menu-btn');
  if (btn) btn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
}

function toggleSidebar() {
  $('sidebar').classList.toggle('open');
}

function openModal(html) {
  $('modal-content').innerHTML = html;
  $('modal-overlay').classList.add('show');
}

function closeModal() {
  $('modal-overlay').classList.remove('show');
  if (['divisions', 'students', 'attendance', 'grades', 'teachers', 'exams'].includes(AppState.currentPage)) {
    navigate(AppState.currentPage);
  }
}

function applyCustomizations() {
  if (!DB.customize) return;
  document.documentElement.style.setProperty('--gold', DB.customize.accentColor);
  document.documentElement.style.setProperty('--gold2', DB.customize.accentColor);
  document.documentElement.style.setProperty('--gold3', DB.customize.accentColor);
  document.documentElement.style.fontSize = DB.customize.fontSize;
}

function bindUiEvents() {
  window.addEventListener('resize', checkResponsive);
  $('modal-overlay').addEventListener('click', function (e) {
    if (e.target === $('modal-overlay')) closeModal();
  });
  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.addEventListener('click', function () {
      const page = item.dataset.page;
      if (page) navigate(page);
      if (window.innerWidth <= 768) $('sidebar').classList.remove('open');
    });
  });
  document.querySelectorAll('[data-login-mode]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchLoginMode(tab.dataset.loginMode);
    });
  });
  $('btn-admin-login').addEventListener('click', doAdminLogin);
  $('btn-student-login').addEventListener('click', doStudentLogin);
  $('btn-register').addEventListener('click', doRegister);
  $('btn-logout').addEventListener('click', doLogout);
  $('btn-profile').addEventListener('click', openProfileModal);
  $('menu-btn').addEventListener('click', toggleSidebar);
}
