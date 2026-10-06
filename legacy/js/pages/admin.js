registerPage('reports', renderReports);
registerPage('accounts', renderAccounts);
registerPage('customize', renderCustomize);

function renderReports() {
  const ts = DB.students.length;
  let passed = 0;
  let failed = 0;
  DB.students.forEach(function (s) {
    let isPassed = true;
    DB.subjects.forEach(function (sub) {
      const g = studentGrades(s, sub.id);
      if (g.final < sub.passGrade) isPassed = false;
    });
    if (isPassed) passed++;
    else failed++;
  });
  const passPct = ts > 0 ? Math.round((passed / ts) * 100) : 0;

  return '<div class="stats-grid">' +
    '<div class="stat-card green"><div class="stat-val">' + passPct + '%</div><div class="stat-label">نسبة النجاح العامة بالمدرسة</div></div>' +
    '<div class="stat-card blue"><div class="stat-val">' + passed + '</div><div class="stat-label">إجمالي الطلبة الناجحين</div></div>' +
    '<div class="stat-card red"><div class="stat-val">' + failed + '</div><div class="stat-label">إجمالي الطلبة المكملين/الراسبين</div></div></div>' +
    '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">📑</span> إصدار الشهادات المدرسية ونتائج الطلاب</div></div>' +
    '<div class="section-body"><div class="form-grid" style="align-items:end; grid-template-columns:1fr 1fr auto;">' +
    '<div class="form-group"><label>1. اختر الشعبة</label><select id="rep-div" onchange="loadRepStudents()"><option value="">-- اختر من القائمة --</option>' + divisionSelectHtml() + '</select></div>' +
    '<div class="form-group"><label>2. اختر الطالب</label><select id="rep-stu"><option value="">-- يرجى اختيار الشعبة أولاً --</option></select></div>' +
    '<button class="btn btn-primary" style="height:42px" onclick="generateReportCard()">📄 عرض وطباعة الشهادة للطالب</button>' +
    '</div></div></div>';
}

function loadRepStudents() {
  const divId = $('rep-div').value;
  const stuSel = $('rep-stu');
  if (!divId) {
    stuSel.innerHTML = '<option value="">--</option>';
    return;
  }
  const sts = getStudentsByDiv(parseInt(divId, 10));
  if (!sts.length) {
    stuSel.innerHTML = '<option value="">لا يوجد طلاب في هذه الشعبة</option>';
    return;
  }
  stuSel.innerHTML = sts.map(function (s) {
    return '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>';
  }).join('');
}

function generateReportCard() {
  const sid = $('rep-stu').value;
  if (!sid) return alert('الرجاء اختيار الطالب أولاً');
  const s = DB.students.find(function (x) { return x.id == sid; });
  const d = getStudentDiv(s);
  let total = 0;
  let maxTotal = 0;
  let isFail = false;
  let rows = '';
  DB.subjects.forEach(function (sub) {
    const gr = studentGrades(s, sub.id);
    total += gr.final;
    maxTotal += sub.maxGrade;
    if (gr.final < sub.passGrade) isFail = true;
    rows += '<tr><td style="border:1px solid #000; padding:10px; font-weight:bold">' + escapeHtml(sub.name) + '</td>' +
      '<td style="border:1px solid #000; padding:10px; text-align:center; font-family:monospace; font-size:1.1rem">' + gr.final + ' / ' + sub.maxGrade + '</td>' +
      '<td style="border:1px solid #000; padding:10px; text-align:center; font-weight:bold">' + (gr.final >= sub.passGrade ? 'ناجح' : 'راسب') + '</td></tr>';
  });
  const percentage = maxTotal ? Math.round((total / maxTotal) * 100) : 0;
  const rc = '<div id="print-area" class="report-card-wrap">' +
    '<div style="text-align:center; margin-bottom: 20px;"><h2>' + escapeHtml(DB.school.name) + '</h2>' +
    '<h4>شهادة دراسية للعام الدراسي ' + escapeHtml(DB.school.year) + '</h4></div>' +
    '<div style="display:flex; justify-content:space-between; margin-bottom:20px; font-weight:bold; font-size:1.1rem; border-bottom:2px solid #000; padding-bottom:10px;">' +
    '<div>اسم الطالب الرباعي: <span style="color:#333">' + escapeHtml(s.name) + '</span></div>' +
    '<div>الصف والشعبة: <span style="color:#333">' + escapeHtml(getDivLabel(d)) + '</span></div></div>' +
    '<table style="width:100%; border-collapse:collapse; margin-bottom:20px;"><thead><tr>' +
    '<th style="border:1px solid #000; padding:10px; text-align:center; background:#eee">المادة الدراسية</th>' +
    '<th style="border:1px solid #000; padding:10px; text-align:center; background:#eee">الدرجة النهائية</th>' +
    '<th style="border:1px solid #000; padding:10px; text-align:center; background:#eee">النتيجة</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div style="display:flex; justify-content:space-between; align-items:center; background:#eee; padding:15px; border:1px solid #000; font-weight:bold; font-size:1.2rem;">' +
    '<div>المجموع الكلي: ' + total + ' من ' + maxTotal + '</div><div>المعدل: ' + percentage + '%</div><div>النتيجة النهائية: ' + (isFail ? 'مكمل' : 'ناجح') + '</div></div>' +
    '<div style="margin-top:40px; display:flex; justify-content:space-between; font-weight:bold;"><div>توقيع مدير المدرسة:<br><br>.........................</div><div>ختم المدرسة:<br><br>.........................</div></div></div>';

  openModal(
    '<div class="modal-head"><h3>📑 معاينة وطباعة الشهادة المدرسية</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body" style="background:#e2e8f0; padding:20px; display:flex; justify-content:center;"><div style="width: 100%; max-width: 800px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">' + rc + '</div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="window.print()" style="font-size:1.1rem; padding:10px 24px;">🖨️ طباعة الشهادة الورقية</button><button class="btn" onclick="closeModal()">إغلاق</button></div>'
  );
}

function renderAccounts() {
  let h = '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">👤</span> حسابات الطلبة</div></div>' +
    '<div class="section-body"><div class="tbl-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>كلمة المرور</th></tr></thead><tbody>';
  ACCOUNTS.students.forEach(function (s) {
    h += '<tr><td class="td-name">' + escapeHtml(s.name) + '</td><td>' + escapeHtml(s.email) + '</td><td>••••••••</td></tr>';
  });
  h += '</tbody></table></div></div></div>';
  return h;
}

function renderCustomize() {
  const colors = ['#d4a54a', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];
  return '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">🎨</span> تخصيص الموقع</div></div><div class="section-body">' +
    '<div style="margin-bottom:24px"><div style="font-weight:700;color:var(--gold);margin-bottom:12px">🏫 بيانات المدرسة</div><div class="form-grid">' +
    '<div class="form-group"><label>اسم المدرسة</label><input id="sch-name" value="' + escapeHtml(DB.school.name) + '" onchange="updateSchoolField(\'name\', this.value)"></div>' +
    '<div class="form-group"><label>العام الدراسي</label><input id="sch-year" value="' + escapeHtml(DB.school.year) + '" onchange="updateSchoolField(\'year\', this.value)"></div>' +
    '</div></div><div style="margin-bottom:24px"><div style="font-weight:700;color:var(--gold);margin-bottom:12px">🎨 لون التمييز الأساسي</div><div class="color-pick">' +
    colors.map(function (c) {
      return '<div class="color-swatch ' + (c === DB.customize.accentColor ? 'active' : '') + '" style="background:' + c + '" onclick="setAccentColor(\'' + c + '\')"></div>';
    }).join('') +
    '</div></div><div style="margin-bottom:24px"><div style="font-weight:700;color:var(--gold);margin-bottom:12px">📐 حجم الخط العام</div><div style="display:flex;gap:8px">' +
    '<button class="btn" onclick="setFontSize(\'13px\')">صغير</button>' +
    '<button class="btn btn-primary" onclick="setFontSize(\'14px\')">متوسط</button>' +
    '<button class="btn" onclick="setFontSize(\'15px\')">كبير</button></div></div>' +
    '<div style="margin-top:40px; padding-top:20px; border-top:1px solid var(--border)">' +
    '<div style="font-weight:700;color:var(--danger);margin-bottom:12px">⚠️ منطقة الخطر</div>' +
    '<button class="btn btn-danger" onclick="factoryReset()">🗑️ إعادة ضبط المصنع (مسح كل البيانات)</button></div></div></div>';
}

function updateSchoolField(field, value) {
  DB.school[field] = value;
  saveData();
  if (field === 'name') navigate('customize');
}

function setAccentColor(c) {
  DB.customize.accentColor = c;
  saveData();
  applyCustomizations();
  if (AppState.currentPage === 'customize') navigate('customize');
}

function setFontSize(sz) {
  DB.customize.fontSize = sz;
  saveData();
  applyCustomizations();
}
