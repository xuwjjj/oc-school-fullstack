registerPage('students', renderStudents);
registerPage('import', renderImport);

function divisionSelectHtml(idAttr) {
  return DB.divisions.map(function (d) {
    return '<option value="' + d.id + '">' + escapeHtml(getDivLabel(d)) + '</option>';
  }).join('');
}

function renderStudents() {
  AppState.selectedStudents = [];
  return '<div class="section"><div class="section-head">' +
    '<div class="section-title"><span class="sec-icon">👥</span> السجل العام للطلاب</div>' +
    '<div class="section-actions">' +
    '<div class="search-box"><input placeholder="بحث بالاسم أو الرقم..." oninput="AppState.studentsFilter.search=this.value;refreshStudents()"></div>' +
    '<select class="btn" onchange="AppState.studentsFilter.div=this.value;refreshStudents()" style="min-width:160px"><option value="all">جميع الشُعب</option>' + divisionSelectHtml() + '</select>' +
    '<button class="btn btn-primary" onclick="openAddStudentModal()">➕ طالب جديد</button>' +
    '</div></div><div class="section-body">' +
    '<div id="bulk-actions-bar" class="bulk-bar" style="display:none">' +
    '<span class="b-count">تم تحديد <span id="sel-count">0</span> طلاب</span>' +
    '<button class="btn btn-primary btn-sm" onclick="openBulkMoveModal()">🔄 نقل لشعبة أخرى</button>' +
    '<button class="btn btn-danger btn-sm" onclick="bulkDeleteStudents()">🗑️ حذف المحدد</button>' +
    '</div><div id="students-table-area">' + renderStudentsTable() + '</div></div></div>';
}

function renderStudentsTable() {
  const filter = AppState.studentsFilter;
  const sts = DB.students.filter(function (s) {
    if (filter.div !== 'all' && s.divisionId !== parseInt(filter.div, 10)) return false;
    if (filter.search && !s.name.includes(filter.search) && !String(s.sid).includes(filter.search)) return false;
    return true;
  });
  if (!sts.length) return '<div class="empty-state"><div class="empty-icon">📭</div><p>لا بيانات أو لم يتم إضافة طلاب بعد</p></div>';

  let h = '<div class="tbl-wrap"><table><thead><tr>';
  h += '<th style="width:40px"><input type="checkbox" id="check-all-sts" onchange="toggleAllStudents(this)"></th>';
  h += '<th>#</th><th>الرقم</th><th>الاسم</th><th>الشعبة</th><th>الجنس</th><th>إجراءات الإدارة</th></tr></thead><tbody>';
  sts.slice(0, 60).forEach(function (s, i) {
    const d = getStudentDiv(s);
    const isChecked = AppState.selectedStudents.includes(s.id) ? 'checked' : '';
    h += '<tr><td><input type="checkbox" class="stu-checkbox" value="' + s.id + '" ' + isChecked + ' onchange="toggleStudentSelection(' + s.id + ', this.checked)"></td>' +
      '<td class="td-id">' + (i + 1) + '</td><td class="td-id">' + escapeHtml(s.sid) + '</td><td class="td-name">' + escapeHtml(s.name) + '</td>' +
      '<td>' + escapeHtml(d ? getDivLabel(d) : '—') + '</td><td>' + escapeHtml(s.gender) + '</td><td>' +
      '<button class="btn btn-sm" onclick="viewStudent(' + s.id + ')" title="عرض السجل والدرجات">👁️</button> ' +
      '<button class="btn btn-sm" style="color:var(--warning)" onclick="openSendNoteModal(' + s.id + ')" title="إرسال تنبيه/ملاحظة فردية">✉️</button> ' +
      '<button class="btn btn-sm btn-danger" onclick="deleteStudent(' + s.id + ')" title="حذف">🗑️</button>' +
      '</td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

function refreshStudents() {
  const a = $('students-table-area');
  if (!a) return;
  a.innerHTML = renderStudentsTable();
  updateBulkActionBar();
}

function toggleStudentSelection(id, isChecked) {
  if (isChecked && !AppState.selectedStudents.includes(id)) AppState.selectedStudents.push(id);
  else if (!isChecked) AppState.selectedStudents = AppState.selectedStudents.filter(function (sid) { return sid !== id; });
  updateBulkActionBar();
}

function toggleAllStudents(checkbox) {
  const checkboxes = document.querySelectorAll('.stu-checkbox');
  AppState.selectedStudents = [];
  checkboxes.forEach(function (cb) {
    cb.checked = checkbox.checked;
    if (checkbox.checked) AppState.selectedStudents.push(parseInt(cb.value, 10));
  });
  updateBulkActionBar();
}

function updateBulkActionBar() {
  const bar = $('bulk-actions-bar');
  const count = $('sel-count');
  if (!bar || !count) return;
  if (AppState.selectedStudents.length > 0) {
    bar.style.display = 'flex';
    count.textContent = AppState.selectedStudents.length;
  } else {
    bar.style.display = 'none';
  }
}

function bulkDeleteStudents() {
  if (!AppState.selectedStudents.length) return;
  if (!confirm('هل أنت متأكد 100% أنك تريد حذف (' + AppState.selectedStudents.length + ') طالب بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.')) return;
  DB.students = DB.students.filter(function (s) { return !AppState.selectedStudents.includes(s.id); });
  AppState.selectedStudents = [];
  saveData();
  refreshStudents();
}

function openBulkMoveModal() {
  if (!AppState.selectedStudents.length) return;
  openModal(
    '<div class="modal-head"><h3>🔄 نقل الطلاب المحددين (' + AppState.selectedStudents.length + ')</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-group"><label>اختر الشعبة الجديدة الوجهة:</label><select id="bulk-move-div">' + divisionSelectHtml() + '</select></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="bulkMoveStudents()">💾 تأكيد النقل الجماعي</button><button class="btn" onclick="closeModal()">إلغاء</button></div>'
  );
}

function bulkMoveStudents() {
  const newDivId = parseInt($('bulk-move-div').value, 10);
  let movedCount = 0;
  DB.students.forEach(function (s) {
    if (AppState.selectedStudents.includes(s.id)) {
      s.divisionId = newDivId;
      movedCount++;
    }
  });
  saveData();
  AppState.selectedStudents = [];
  closeModal();
  alert('✅ تم نقل ' + movedCount + ' طالب للشعبة الجديدة بنجاح.');
}

function openAddStudentModal() {
  openModal(
    '<div class="modal-head"><h3>➕ إضافة طالب</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid"><div class="form-group"><label>الاسم</label><input id="ns-name"></div>' +
    '<div class="form-group"><label>الشعبة</label><select id="ns-div">' + divisionSelectHtml() + '</select></div>' +
    '<div class="form-group"><label>الجنس</label><select id="ns-gender"><option>ذكر</option><option>أنثى</option></select></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="saveNewStudent()">💾 حفظ</button></div>'
  );
}

function saveNewStudent() {
  const name = $('ns-name').value.trim();
  if (!name) return alert('أدخل الاسم');
  DB.students.push(createStudent({
    name: name,
    divisionId: parseInt($('ns-div').value, 10),
    gender: $('ns-gender').value
  }));
  saveData();
  closeModal();
  navigate('students');
}

function viewStudent(id) {
  const s = DB.students.find(function (x) { return x.id === id; });
  if (!s) return;
  let g = '<table><thead><tr><th>المادة</th><th>الفصل الأول</th><th>نصف السنة</th><th>الفصل الثاني</th><th>النهائي</th></tr></thead><tbody>';
  DB.subjects.forEach(function (sub) {
    const gr = studentGrades(s, sub.id);
    g += '<tr><td class="td-name">' + escapeHtml(sub.name) + '</td><td class="td-id">' + gr.q1 + '</td><td class="td-id">' + gr.mid + '</td><td class="td-id">' + gr.q2 + '</td>' +
      '<td style="font-weight:700">' + gr.final + ' / ' + sub.maxGrade + '</td></tr>';
  });
  g += '</tbody></table>';
  openModal('<div class="modal-head"><h3>👤 ' + escapeHtml(s.name) + '</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="tbl-wrap">' + g + '</div></div>');
}

function deleteStudent(id) {
  if (!confirm('تأكيد الحذف؟')) return;
  DB.students = DB.students.filter(function (s) { return s.id !== id; });
  saveData();
  navigate('students');
}

function openSendNoteModal(id) {
  const s = DB.students.find(function (x) { return x.id === id; });
  if (!s) return;
  openModal(
    '<div class="modal-head"><h3>✉️ إرسال رسالة/تنبيه للطالب: ' + escapeHtml(s.name) + '</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div style="margin-bottom:12px; color:var(--text2); font-size:0.85rem">ستظهر هذه الرسالة في اللوحة الشخصية للطالب فقط.</div>' +
    '<div class="form-group"><label>نص الرسالة</label><textarea id="note-text" rows="4"></textarea></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="saveNote(' + id + ')">✉️ إرسال للطالب</button></div>'
  );
}

function saveNote(id) {
  const txt = $('note-text').value.trim();
  if (!txt) return alert('الرجاء كتابة نص الرسالة');
  DB.notes.push({
    id: DB.nextId.note++,
    studentId: id,
    text: nlToBr(txt),
    date: todayIso(),
    author: AppState.currentUser.name
  });
  saveData();
  closeModal();
  alert('✅ تم إرسال الرسالة بنجاح، سيراها الطالب في لوحته الشخصية.');
}

function renderImport() {
  return '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">📂</span> استيراد قوائم الطلبة</div></div><div class="section-body">' +
    '<div class="tabs" id="import-tabs">' +
    '<div class="tab active" onclick="showImportTab(\'manual\')">⌨️ إدخال يدوي</div>' +
    '<div class="tab" onclick="showImportTab(\'pdf\')">📕 استيراد من PDF</div>' +
    '<div class="tab" onclick="showImportTab(\'file\')">📄 Excel / TXT</div></div>' +
    '<div id="import-tab-manual">' +
    '<div class="form-group" style="margin-bottom:12px"><label>أدخل الأسماء (كل اسم في سطر جديد):</label>' +
    '<textarea id="manual-names" rows="8" style="width:100%;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:\'Noto Naskh Arabic\',serif;font-size:.9rem;line-height:2;resize:vertical" placeholder="محمد أحمد علي&#10;فاطمة حسين خالد"></textarea></div>' +
    '<button class="btn btn-primary" onclick="processManualNames()">📋 معالجة الأسماء</button></div>' +
    '<div id="import-tab-pdf" style="display:none">' +
    '<div class="upload-zone" ondragover="event.preventDefault();this.classList.add(\'dragover\')" ondragleave="this.classList.remove(\'dragover\')" ondrop="event.preventDefault();this.classList.remove(\'dragover\');handlePDFDrop(event.dataTransfer.files)">' +
    '<div class="upload-icon">📕</div><p>ارفع ملف PDF يحتوي على أسماء الطلبة</p><small>سيتم استخراج النصوص تلقائياً عبر المتصفح</small>' +
    '<input type="file" accept=".pdf" onchange="handlePDFDrop(this.files)"></div>' +
    '<div id="pdf-progress" style="display:none;margin-top:16px"><span id="pdf-status" style="font-size:0.85rem"></span><div class="progress-bar"><div class="fill" id="pdf-fill" style="width:0%"></div></div></div></div>' +
    '<div id="import-tab-file" style="display:none">' +
    '<div class="upload-zone" ondragover="event.preventDefault();this.classList.add(\'dragover\')" ondragleave="this.classList.remove(\'dragover\')" ondrop="event.preventDefault();this.classList.remove(\'dragover\');handleFileDrop(event.dataTransfer.files)">' +
    '<div class="upload-icon">📊</div><p>ارفع ملف Excel أو Text</p><small>XLSX, CSV, TXT</small>' +
    '<input type="file" accept=".txt,.csv,.xlsx,.xls" onchange="handleFileDrop(this.files)"></div></div>' +
    '<div id="import-preview" style="display:none;margin-top:24px"><div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">✅</span> <span id="import-count">0</span> اسم مستخرج</div>' +
    '<div class="section-actions"><button class="btn btn-sm btn-danger" onclick="clearImport()">🗑️ إلغاء</button></div></div>' +
    '<div class="section-body"><div class="preview-names" id="preview-names-list"></div>' +
    '<div style="margin-top:16px;padding:16px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--border)">' +
    '<div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;align-items:end"><div class="form-group"><label>اختر الشعبة لإضافتهم إليها</label>' +
    '<select id="import-target-div">' + divisionSelectHtml() + '</select></div>' +
    '<div><button class="btn btn-primary" onclick="confirmImport()" style="width:100%">✅ تأكيد الاستيراد</button></div></div></div></div></div></div></div></div>';
}

function showImportTab(tab) {
  ['manual', 'pdf', 'file'].forEach(function (t) {
    const el = $('import-tab-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('#import-tabs .tab').forEach(function (t, i) {
    t.classList.toggle('active', ['manual', 'pdf', 'file'][i] === tab);
  });
}

function processManualNames() {
  const names = $('manual-names').value.split(/[\n\r]+/).map(function (l) { return l.trim(); }).filter(function (n) { return n.length > 3; });
  if (names.length) showImportPreview(names);
  else alert('الرجاء إدخال أسماء.');
}

async function handlePDFDrop(files) {
  if (!files || !files.length) return;
  const file = files[0];
  $('pdf-progress').style.display = 'block';
  $('pdf-status').textContent = '📕 قراءة ' + file.name;
  $('pdf-fill').style.width = '10%';
  try {
    const buf = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let txt = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const c = await pg.getTextContent();
      txt += c.items.map(function (x) { return x.str; }).join(' ') + '\n';
      $('pdf-fill').style.width = Math.round(10 + ((i / pdf.numPages) * 90)) + '%';
      $('pdf-status').textContent = '📖 معالجة صفحة ' + i + ' من ' + pdf.numPages;
    }
    $('pdf-status').textContent = '✅ تم استخراج النصوص، جاري البحث عن الأسماء...';
    const names = txt.split(/[\n\r]+/).map(function (l) { return l.replace(/^\d+[.\-)\s]*/, '').trim(); }).filter(function (n) {
      const words = n.split(/\s+/).filter(function (w) { return /^[\u0600-\u06FF]+$/.test(w); });
      return words.length >= 2 && words.length <= 5;
    });
    if (names.length) showImportPreview(names);
    else alert('لم يتم العثور على أسماء عربية واضحة في هذا الـ PDF.');
  } catch (err) {
    $('pdf-status').textContent = '❌ فشل القراءة: ' + err.message;
  }
}

function handleFileDrop(files) {
  if (!files || !files.length) return;
  const file = files[0];
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const names = [];
        data.forEach(function (row) {
          if (!Array.isArray(row)) return;
          row.forEach(function (cell) {
            const s = String(cell || '').trim();
            if (s && /[\u0600-\u06FF]/.test(s) && s.split(/\s+/).length >= 2) names.push(s);
          });
        });
        if (names.length) showImportPreview(names);
        else alert('لم يتم العثور على أسماء في الملف');
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = function (e) {
      const names = e.target.result.split(/[\n\r]+/).map(function (l) { return l.replace(/^\d+[.\-)\s]*/, '').trim(); }).filter(function (n) { return n.length > 3 && /[\u0600-\u06FF]/.test(n); });
      if (names.length) showImportPreview(names);
      else alert('لم يتم العثور على أسماء');
    };
    reader.readAsText(file);
  }
}

function showImportPreview(names) {
  AppState.importedNames = names;
  $('import-preview').style.display = 'block';
  $('import-count').textContent = names.length;
  renderImportPreview();
  $('import-preview').scrollIntoView({ behavior: 'smooth' });
}

function renderImportPreview() {
  $('preview-names-list').innerHTML = AppState.importedNames.map(function (n, i) {
    return '<div class="preview-row"><span class="pr">' + (i + 1) + '</span><span class="pn">' + escapeHtml(n) + '</span>' +
      '<select style="width:70px;padding:3px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:.72rem" id="ig-' + i + '"><option>ذكر</option><option>أنثى</option></select>' +
      '<span class="px" onclick="AppState.importedNames.splice(' + i + ',1);renderImportPreview()">✕</span></div>';
  }).join('');
  $('import-count').textContent = AppState.importedNames.length;
}

function clearImport() {
  AppState.importedNames = [];
  $('import-preview').style.display = 'none';
}

function confirmImport() {
  if (!AppState.importedNames.length) return;
  const divId = parseInt($('import-target-div').value, 10);
  const div = DB.divisions.find(function (d) { return d.id === divId; });
  if (!div) return;
  let added = 0;
  AppState.importedNames.forEach(function (name, i) {
    const genderEl = $('ig-' + i);
    DB.students.push(createStudent({
      name: name,
      divisionId: divId,
      gender: genderEl ? genderEl.value : 'ذكر',
      notes: 'مستورد'
    }));
    added++;
  });
  AppState.importedNames = [];
  $('import-preview').style.display = 'none';
  saveData();
  alert('✅ تم إضافة ' + added + ' طالب لشعبة ' + getDivLabel(div) + ' بنجاح!');
  navigate('students');
}
