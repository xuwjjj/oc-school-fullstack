registerPage('divisions', renderDivisions);
registerPage('attendance', renderAttendance);
registerPage('grades', renderGrades);
registerPage('subjects', renderSubjects);

function renderDivisions() {
  let h = '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">🏫</span> الشُعب</div>' +
    '<div class="section-actions"><button class="btn btn-primary" onclick="openAddDivModal()">➕ إضافة شعبة</button></div></div><div class="section-body">';
  DB.grades_levels.forEach(function (lv) {
    const divs = DB.divisions.filter(function (d) { return d.levelId === lv.id; });
    if (!divs.length) return;
    h += '<div style="margin-bottom:20px"><div style="font-size:.9rem;font-weight:700;color:var(--gold);margin-bottom:12px">📌 ' + escapeHtml(lv.name) + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">';
    divs.forEach(function (d) {
      const sts = getStudentsByDiv(d.id);
      const pct = d.capacity > 0 ? ((sts.length / d.capacity) * 100).toFixed(0) : 0;
      const badge = pct > 90 ? 'badge-danger' : pct > 70 ? 'badge-warning' : 'badge-success';
      const fill = pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--success)';
      h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius2);padding:16px">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:8px">' +
        '<div style="font-weight:800;display:flex;gap:8px;align-items:center">شعبة ' + escapeHtml(d.name) +
        ' <span style="cursor:pointer;font-size:0.85rem;opacity:0.8" onclick="openEditDivModal(' + d.id + ')" title="تعديل">✏️</span>' +
        '<span style="cursor:pointer;font-size:0.85rem;opacity:0.8;color:var(--danger)" onclick="deleteDiv(' + d.id + ')" title="حذف">🗑️</span></div>' +
        '<span class="badge ' + badge + '">' + pct + '%</span></div>' +
        '<div style="font-size:.78rem;color:var(--text2);margin-bottom:8px">👥 ' + sts.length + ' / ' + d.capacity + '</div>' +
        '<div class="progress-bar" style="margin:0"><div class="fill" style="width:' + pct + '%;background:' + fill + '"></div></div>' +
        '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);text-align:center">' +
        '<button class="btn btn-sm" onclick="manageDivision(' + d.id + ')" style="width:100%;justify-content:center">👥 إدارة طلبة الشعبة</button></div></div>';
    });
    h += '</div></div>';
  });
  h += '</div></div>';
  return h;
}

function openAddDivModal() {
  const levels = DB.grades_levels.map(function (l) { return '<option value="' + l.id + '">' + escapeHtml(l.name) + '</option>'; }).join('');
  openModal(
    '<div class="modal-head"><h3>➕ إضافة شعبة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid"><div class="form-group"><label>المرحلة</label><select id="nd-lv">' + levels + '</select></div>' +
    '<div class="form-group"><label>الرمز</label><input id="nd-name" maxlength="2" placeholder="أ، ب، ج..."></div>' +
    '<div class="form-group"><label>السعة القصوى</label><input type="number" id="nd-cap" value="40"></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="saveNewDiv()">💾 حفظ</button></div>'
  );
}

function saveNewDiv() {
  DB.divisions.push({
    id: Date.now(),
    levelId: parseInt($('nd-lv').value, 10),
    name: $('nd-name').value.trim() || '?',
    capacity: parseInt($('nd-cap').value, 10) || 40
  });
  saveData();
  closeModal();
  navigate('divisions');
}

function openEditDivModal(id) {
  const d = DB.divisions.find(function (x) { return x.id === id; });
  if (!d) return;
  const levels = DB.grades_levels.map(function (l) {
    return '<option value="' + l.id + '"' + (l.id === d.levelId ? ' selected' : '') + '>' + escapeHtml(l.name) + '</option>';
  }).join('');
  openModal(
    '<div class="modal-head"><h3>✏️ تعديل شعبة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid"><div class="form-group"><label>المرحلة</label><select id="ed-lv">' + levels + '</select></div>' +
    '<div class="form-group"><label>الرمز</label><input id="ed-name" maxlength="2" value="' + escapeHtml(d.name) + '"></div>' +
    '<div class="form-group"><label>السعة القصوى</label><input type="number" id="ed-cap" value="' + d.capacity + '"></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="updateDiv(' + id + ')">💾 حفظ التعديلات</button></div>'
  );
}

function updateDiv(id) {
  const d = DB.divisions.find(function (x) { return x.id === id; });
  if (!d) return;
  d.levelId = parseInt($('ed-lv').value, 10);
  d.name = $('ed-name').value.trim() || '?';
  d.capacity = parseInt($('ed-cap').value, 10) || 40;
  saveData();
  closeModal();
  navigate('divisions');
}

function deleteDiv(id) {
  const sts = getStudentsByDiv(id);
  if (sts.length > 0 && !confirm('⚠️ تحذير: هذه الشعبة تحتوي على ' + sts.length + ' طالب مسجل!\nهل أنت متأكد من حذفها؟ (سيبقى الطلاب في النظام بدون شعبة)')) return;
  if (!confirm('هل تريد فعلاً حذف هذه الشعبة بشكل نهائي؟')) return;
  DB.divisions = DB.divisions.filter(function (d) { return d.id !== id; });
  saveData();
  navigate('divisions');
}

function manageDivision(divId) {
  const div = DB.divisions.find(function (d) { return d.id === divId; });
  if (!div) return;
  openModal(
    '<div class="modal-head"><h3>👥 إدارة طلبة: ' + escapeHtml(getDivLabel(div)) + '</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; align-items:center">' +
    '<input type="text" id="quick-add-name" placeholder="أدخل اسم الطالب لرفعه للشعبة..." style="flex:1; min-width:180px; padding:8px 12px; border-radius:var(--radius); border:1px solid var(--border); background:var(--bg); color:var(--text); outline:none">' +
    '<select id="quick-add-gender" style="padding:8px 12px; border-radius:var(--radius); border:1px solid var(--border); background:var(--bg); color:var(--text); outline:none"><option>ذكر</option><option>أنثى</option></select>' +
    '<button class="btn btn-primary" onclick="quickAddStudentToDiv(' + divId + ')">➕ رفع الاسم</button>' +
    '<button class="btn" onclick="sortDivisionStudents(' + divId + ')">🔤 ترتيب أبجدي</button></div>' +
    '<div class="tbl-wrap" id="div-students-table" style="max-height: 50vh; overflow-y: auto;">' + renderDivStudentsTable(divId) + '</div></div>'
  );
}

function renderDivStudentsTable(divId) {
  const sts = getStudentsByDiv(divId);
  if (!sts.length) return '<p>الشعبة فارغة</p>';
  return '<table><thead><tr><th>الرقم</th><th>الاسم (اضغط للتعديل)</th><th>الجنس</th><th>حذف</th></tr></thead><tbody>' +
    sts.map(function (s) {
      return '<tr><td class="td-id">' + escapeHtml(s.sid) + '</td><td class="td-name">' +
        '<input type="text" value="' + escapeHtml(s.name) + '" onchange="updateStudentNameFast(' + s.id + ',this.value)" style="background:transparent;border:none;color:var(--gold);font-family:inherit;font-weight:700;width:100%;outline:none;border-bottom:1px dashed transparent;"></td>' +
        '<td>' + escapeHtml(s.gender) + '</td><td><button class="btn btn-sm btn-danger" onclick="removeStudentFromDiv(' + s.id + ',' + divId + ')">🗑️</button></td></tr>';
    }).join('') + '</tbody></table>';
}

function updateStudentNameFast(sid, val) {
  const s = DB.students.find(function (x) { return x.id === sid; });
  if (s && val.trim()) {
    s.name = val.trim();
    saveData();
  }
}

function removeStudentFromDiv(sid, divId) {
  if (!confirm('تأكيد مسح الطالب من الشعبة؟')) return;
  DB.students = DB.students.filter(function (s) { return s.id !== sid; });
  saveData();
  $('div-students-table').innerHTML = renderDivStudentsTable(divId);
}

function sortDivisionStudents(divId) {
  const other = DB.students.filter(function (s) { return s.divisionId !== divId; });
  const divSt = DB.students.filter(function (s) { return s.divisionId === divId; });
  divSt.sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); });
  DB.students = other.concat(divSt);
  saveData();
  $('div-students-table').innerHTML = renderDivStudentsTable(divId);
}

function quickAddStudentToDiv(divId) {
  const n = $('quick-add-name').value.trim();
  if (!n) return;
  DB.students.push(createStudent({
    name: n,
    divisionId: divId,
    gender: $('quick-add-gender').value
  }));
  saveData();
  $('div-students-table').innerHTML = renderDivStudentsTable(divId);
  $('quick-add-name').value = '';
}

function renderAttendance() {
  return '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">📋</span> الحضور</div>' +
    '<div class="section-actions"><div class="search-box"><input placeholder="بحث بالاسم أو الرقم..." value="' + escapeHtml(AppState.attSearch) + '" oninput="AppState.attSearch=this.value;refreshAtt()"></div>' +
    '<input type="date" class="btn" value="' + AppState.attDate + '" onchange="AppState.attDate=this.value;refreshAtt()">' +
    '<select class="btn" onchange="AppState.attDiv=this.value===\'all\'?null:parseInt(this.value,10);refreshAtt()"><option value="all">— الشعبة —</option>' + divisionSelectHtml() + '</select>' +
    '</div></div><div class="section-body" id="att-area">' + renderAttTable() + '</div></div>';
}

function renderAttTable() {
  if (!AppState.attDiv) return '<div class="empty-state"><div class="empty-icon">📋</div><p>الرجاء اختيار الشعبة لعرض السجل</p></div>';
  const sts = getStudentsByDiv(AppState.attDiv);
  const key = AppState.attDiv + '-' + AppState.attDate;
  if (!DB.attendance[key]) {
    DB.attendance[key] = {};
    sts.forEach(function (s) { DB.attendance[key][s.id] = 'present'; });
  }
  let filtered = sts;
  if (AppState.attSearch) {
    filtered = sts.filter(function (s) { return s.name.includes(AppState.attSearch) || String(s.sid).includes(AppState.attSearch); });
  }
  if (!filtered.length) return '<div class="empty-state"><p>لم يتم العثور على طلاب مطابقة لعملية البحث</p></div>';

  const lbl = { present: 'حاضر ✅', absent: 'غائب ❌', leave: 'إجازة 📝' };
  const cls = { present: 'badge-success', absent: 'badge-danger', leave: 'badge-warning' };
  let h = '<div style="margin-bottom:12px"><button class="btn btn-sm btn-success" onclick="markAllAtt(\'present\')">✅ تعيين الكل كحاضر</button></div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>الاسم</th><th style="text-align:center">الحالة</th></tr></thead><tbody>';
  filtered.forEach(function (s) {
    const st = DB.attendance[key][s.id] || 'present';
    h += '<tr><td class="td-name">' + escapeHtml(s.name) + '</td><td style="text-align:center"><span class="badge ' + cls[st] + '" style="cursor:pointer" onclick="cycleAtt(' + s.id + ')">' + lbl[st] + '</span></td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

function refreshAtt() {
  const a = $('att-area');
  if (a) a.innerHTML = renderAttTable();
}

function cycleAtt(sid) {
  const key = AppState.attDiv + '-' + AppState.attDate;
  const st = ['present', 'absent', 'leave'];
  const cur = DB.attendance[key][sid] || 'present';
  DB.attendance[key][sid] = st[(st.indexOf(cur) + 1) % 3];
  saveData();
  refreshAtt();
  checkAbsenceWarning(sid);
}

function markAllAtt(status) {
  const key = AppState.attDiv + '-' + AppState.attDate;
  Object.keys(DB.attendance[key]).forEach(function (k) {
    DB.attendance[key][k] = status;
    checkAbsenceWarning(k);
  });
  saveData();
  refreshAtt();
}

function checkAbsenceWarning(sid) {
  const student = DB.students.find(function (x) { return x.id == sid; });
  if (!student) return;
  let absentDays = 0;
  Object.keys(DB.attendance).forEach(function (key) {
    if (DB.attendance[key][sid] === 'absent') absentDays++;
  });
  if (absentDays >= 10 && !student.hasAbsenceWarning) {
    student.hasAbsenceWarning = true;
    const div = getStudentDiv(student);
    const divName = div ? getDivLabel(div) : 'غير محدد';
    DB.announcements.unshift({
      id: DB.nextId.announcement++,
      title: '⚠️ تحذير وتجاوز الغياب المسموح: ' + student.name,
      body: 'تنبيه هام من الإدارة المدرسية:<br>تجاوز الطالب <strong>' + escapeHtml(student.name) + '</strong> (الصف والشعبة: ' + escapeHtml(divName) + ') الحد الأقصى لأيام الغياب (10 أيام).<br><br><span style="color:var(--danger); font-weight:bold; font-size:1.05rem;">مخالفة التزام بحضور، فصل مع حضور ولي امر طالب غداً الى المدرسة.</span>',
      date: todayIso(),
      priority: 'high',
      author: 'النظام الآلي'
    });
    saveData();
    alert('⚠️ إشعار ذكي:\nتم إدراج الطالب [' + student.name + '] في سجل المحذرين لتجاوزه 10 أيام غياب، وتم نشر تحذير تلقائي.');
  }
}

function renderGrades() {
  const subs = DB.subjects.map(function (s) { return '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>'; }).join('');
  return '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">📝</span> الدرجات</div>' +
    '<div class="section-actions"><select class="btn" onchange="AppState.gradeDiv=this.value===\'all\'?null:parseInt(this.value,10);refreshGrades()"><option value="all">— الشعبة —</option>' + divisionSelectHtml() + '</select>' +
    '<select class="btn" onchange="AppState.gradeSub=this.value===\'all\'?null:parseInt(this.value,10);refreshGrades()"><option value="all">— المادة —</option>' + subs + '</select>' +
    '</div></div><div class="section-body" id="grades-area">' + renderGradesTable() + '</div></div>';
}

function renderGradesTable() {
  if (!AppState.gradeDiv || !AppState.gradeSub) return '<div class="empty-state"><p>اختر الشعبة والمادة</p></div>';
  const sts = getStudentsByDiv(AppState.gradeDiv);
  const sub = DB.subjects.find(function (s) { return s.id === AppState.gradeSub; });
  let h = '<div class="tbl-wrap"><table><thead><tr><th>الاسم</th><th>فصل 1</th><th>نصف السنة</th><th>فصل 2</th><th>النهائي</th></tr></thead><tbody>';
  sts.forEach(function (s) {
    const g = studentGrades(s, AppState.gradeSub);
    const inp = function (f) {
      return '<input type="number" value="' + g[f] + '" style="width:50px;text-align:center" onchange="updateGrade(' + s.id + ',' + AppState.gradeSub + ',\'' + f + '\',this.value)">';
    };
    h += '<tr><td class="td-name">' + escapeHtml(s.name) + '</td><td>' + inp('q1') + '</td><td>' + inp('mid') + '</td><td>' + inp('q2') + '</td>' +
      '<td style="font-weight:bold">' + g.final + ' / ' + sub.maxGrade + '</td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

function updateGrade(sid, subId, field, val) {
  const s = DB.students.find(function (x) { return x.id === sid; });
  if (!s) return;
  const g = studentGrades(s, subId);
  g[field] = parseInt(val, 10) || 0;
  g.final = Math.round(g.q1 * 0.25 + g.mid * 0.25 + g.q2 * 0.5);
  saveData();
  refreshGrades();
}

function refreshGrades() {
  const a = $('grades-area');
  if (a) a.innerHTML = renderGradesTable();
}

function renderSubjects() {
  let h = '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">📚</span> المواد الدراسية</div>' +
    '<div class="section-actions"><button class="btn btn-primary" onclick="openAddSubModal()">➕ إضافة مادة</button></div></div>' +
    '<div class="section-body"><div class="tbl-wrap"><table><thead><tr><th>المادة</th><th>الدرجة القصوى</th><th>درجة النجاح</th><th>إجراءات</th></tr></thead><tbody>';
  DB.subjects.forEach(function (s) {
    h += '<tr><td class="td-name">' + escapeHtml(s.name) + '</td><td class="td-id">' + s.maxGrade + '</td><td class="td-id">' + s.passGrade + '</td><td>' +
      '<button class="btn btn-sm" onclick="openEditSubModal(' + s.id + ')">✏️ تعديل</button> ' +
      '<button class="btn btn-sm btn-danger" onclick="deleteSub(' + s.id + ')">🗑️ حذف</button></td></tr>';
  });
  h += '</tbody></table></div></div></div>';
  return h;
}

function openAddSubModal() {
  openModal(
    '<div class="modal-head"><h3>➕ إضافة مادة دراسية</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid"><div class="form-group"><label>اسم المادة</label><input id="ns-sub-name"></div>' +
    '<div class="form-group"><label>الدرجة القصوى</label><input type="number" id="ns-sub-max" value="100"></div>' +
    '<div class="form-group"><label>درجة النجاح</label><input type="number" id="ns-sub-pass" value="50"></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="saveSub()">💾 حفظ</button></div>'
  );
}

function saveSub() {
  const n = $('ns-sub-name').value.trim();
  if (!n) return alert('يرجى إدخال اسم المادة');
  DB.subjects.push({
    id: Date.now(),
    name: n,
    maxGrade: parseInt($('ns-sub-max').value, 10) || 100,
    passGrade: parseInt($('ns-sub-pass').value, 10) || 50
  });
  saveData();
  closeModal();
  navigate('subjects');
}

function openEditSubModal(id) {
  const s = DB.subjects.find(function (x) { return x.id === id; });
  if (!s) return;
  openModal(
    '<div class="modal-head"><h3>✏️ تعديل المادة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid"><div class="form-group"><label>اسم المادة</label><input id="es-sub-name" value="' + escapeHtml(s.name) + '"></div>' +
    '<div class="form-group"><label>الدرجة القصوى</label><input type="number" id="es-sub-max" value="' + s.maxGrade + '"></div>' +
    '<div class="form-group"><label>درجة النجاح</label><input type="number" id="es-sub-pass" value="' + s.passGrade + '"></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="updateSub(' + id + ')">💾 حفظ التعديلات</button></div>'
  );
}

function updateSub(id) {
  const s = DB.subjects.find(function (x) { return x.id === id; });
  if (!s) return;
  s.name = $('es-sub-name').value.trim() || s.name;
  s.maxGrade = parseInt($('es-sub-max').value, 10) || 100;
  s.passGrade = parseInt($('es-sub-pass').value, 10) || 50;
  saveData();
  closeModal();
  navigate('subjects');
}

function deleteSub(id) {
  if (!confirm('هل تريد فعلاً حذف هذه المادة؟')) return;
  DB.subjects = DB.subjects.filter(function (s) { return s.id !== id; });
  saveData();
  navigate('subjects');
}
