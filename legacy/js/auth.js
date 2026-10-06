const ADMIN_NAV_IDS = [
  'nav-students', 'nav-import', 'nav-divisions', 'nav-attendance', 'nav-grades',
  'nav-subjects', 'nav-teachers', 'nav-reports', 'nav-accounts', 'nav-customize',
  'nav-admin-sec', 'nav-students-sec'
];

function switchLoginMode(mode) {
  document.querySelectorAll('.login-tab').forEach(function (tab, i) {
    tab.classList.toggle('active', ['admin', 'student', 'register'][i] === mode);
  });
  ['admin', 'student', 'register'].forEach(function (m) {
    const el = $('login-mode-' + m);
    if (el) el.style.display = m === mode ? 'block' : 'none';
  });
  $('login-error').style.display = 'none';
}

function showLoginError(msg) {
  const el = $('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function isValidEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (!re.test(email)) return false;
  const domain = email.split('@')[1].toLowerCase();
  const blocked = ['example.com', 'test.com', 'fake.com', 'mail.com', '123.com', 'tempmail.com', 'yopmail.com'];
  if (blocked.includes(domain)) return false;
  return domain.includes('.');
}

function doAdminLogin() {
  const u = $('admin-user').value.trim();
  const p = $('admin-pass').value;
  if (u === ACCOUNTS.admin.username && p === ACCOUNTS.admin.password) {
    AppState.currentUser = { role: 'admin', name: ACCOUNTS.admin.name, username: u };
    saveSession();
    enterApp();
  } else {
    showLoginError('❌ اسم المستخدم أو كلمة المرور غير صحيحة');
  }
}

function doStudentLogin() {
  const e = $('stu-email').value.trim().toLowerCase();
  const p = $('stu-pass').value;
  const acc = ACCOUNTS.students.find(function (s) { return s.email === e && s.password === p; });
  if (acc) {
    AppState.currentUser = { role: 'student', name: acc.name, email: acc.email };
    saveSession();
    enterApp();
  } else {
    showLoginError('❌ البريد الإلكتروني أو كلمة المرور غير صحيحة');
  }
}

function doRegister() {
  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim().toLowerCase();
  const pass = $('reg-pass').value;
  const pass2 = $('reg-pass2').value;

  if (!name) return showLoginError('❌ يرجى إدخال الاسم الكامل');
  if (!isValidEmail(email)) return showLoginError('❌ يرجى إدخال بريد إلكتروني حقيقي وصالح (مثل Gmail أو Yahoo)');
  if (pass.length < 6) return showLoginError('❌ يجب أن تتكون كلمة المرور من 6 أحرف على الأقل');
  if (pass !== pass2) return showLoginError('❌ كلمتا المرور غير متطابقتين');
  if (ACCOUNTS.students.find(function (s) { return s.email === email; })) {
    return showLoginError('❌ هذا البريد مسجل مسبقاً');
  }

  ACCOUNTS.students.push({ email: email, password: pass, name: name });
  saveData();
  switchLoginMode('student');
  $('stu-email').value = email;
  alert('✅ تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن.');
}

function doLogout() {
  AppState.currentUser = null;
  saveSession();
  $('login-screen').style.display = 'flex';
  $('app').style.display = 'none';
}

function enterApp() {
  if (!AppState.currentUser) {
    doLogout();
    return;
  }

  saveSession();
  $('login-screen').style.display = 'none';
  $('app').style.display = 'block';
  $('user-name').textContent = AppState.currentUser.name;
  $('user-avatar').textContent = AppState.currentUser.name[0];
  $('user-role-display').textContent = isAdmin() ? '🔒 وضع المشرف (صلاحيات كاملة)' : '🎓 بوابة الطالب';

  ADMIN_NAV_IDS.forEach(function (id) {
    const el = $(id);
    if (el) el.style.display = isAdmin() ? '' : 'none';
  });

  applyCustomizations();
  navigate('dashboard');
  checkResponsive();
}

function openProfileModal() {
  const user = AppState.currentUser;
  openModal(
    '<div class="modal-head"><h3>👤 الملف الشخصي</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">' +
    '<div style="padding:14px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--border)"><div style="font-size:.7rem;color:var(--text3)">الاسم</div><div style="font-weight:700;margin-top:3px">' + escapeHtml(user.name) + '</div></div>' +
    '<div style="padding:14px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--border)"><div style="font-size:.7rem;color:var(--text3)">الصلاحية</div><div style="font-weight:700;margin-top:3px">' + (isAdmin() ? 'مشرف النظام' : 'طالب') + '</div></div>' +
    '</div>' +
    '<div style="font-weight:700;color:var(--gold);margin-bottom:12px">🔐 تغيير كلمة المرور</div>' +
    '<div class="form-grid" style="grid-template-columns:1fr">' +
    '<div class="form-group"><label>كلمة المرور الحالية</label><input type="password" id="cp-old"></div>' +
    '<div class="form-group"><label>كلمة المرور الجديدة</label><input type="password" id="cp-new"></div>' +
    '<div class="form-group"><label>تأكيد الجديدة</label><input type="password" id="cp-new2"></div>' +
    '</div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="changePassword()">تغيير كلمة المرور</button><button class="btn" onclick="closeModal()">إغلاق</button></div>'
  );
}

function changePassword() {
  const o = $('cp-old').value;
  const n = $('cp-new').value;
  const n2 = $('cp-new2').value;
  if (n.length < 6) return alert('❌ يجب أن تتكون كلمة المرور من 6 أحرف على الأقل');
  if (n !== n2) return alert('❌ كلمتا المرور الجديدتان غير متطابقتين');

  if (isAdmin()) {
    if (o !== ACCOUNTS.admin.password) return alert('❌ كلمة المرور الحالية خاطئة');
    ACCOUNTS.admin.password = n;
  } else {
    const acc = ACCOUNTS.students.find(function (s) { return s.email === AppState.currentUser.email; });
    if (!acc || o !== acc.password) return alert('❌ كلمة المرور الحالية خاطئة');
    acc.password = n;
  }
  saveData();
  alert('✅ تم تغيير كلمة المرور بنجاح!');
  closeModal();
}
