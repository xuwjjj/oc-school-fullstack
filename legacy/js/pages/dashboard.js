registerPage('dashboard', renderDashboard);

function renderDashboard() {
  return isReadOnly() ? renderStudentDashboard() : renderAdminDashboard();
}

function renderAdminDashboard() {
  const ts = DB.students.filter(function (s) { return s.status === 'active'; }).length;
  const td = DB.divisions.length;
  const tt = DB.teachers.filter(function (t) { return t.status === 'active'; }).length;

  let h = '<div class="stats-grid">' +
    '<div class="stat-card gold"><div class="stat-icon">👥</div><div class="stat-val">' + ts + '</div><div class="stat-label">الطلبة المسجلين</div></div>' +
    '<div class="stat-card blue"><div class="stat-icon">🏫</div><div class="stat-val">' + td + '</div><div class="stat-label">الشُعب الدراسية</div></div>' +
    '<div class="stat-card green"><div class="stat-icon">👨‍🏫</div><div class="stat-val">' + tt + '</div><div class="stat-label">الكادر التدريسي</div></div>' +
    '</div>';

  if (ts === 0) {
    h += '<div class="section"><div class="section-body" style="text-align:center;padding:40px">' +
      '<div style="font-size:3rem;margin-bottom:12px">📭</div>' +
      '<div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">قاعدة بيانات الطلبة فارغة!</div>' +
      '<div style="color:var(--text2);margin-bottom:20px">الرجاء إدخال أسماء الطلاب لبدء العمل على النظام.</div>' +
      '<div style="display:flex;gap:12px;justify-content:center">' +
      '<button class="btn btn-primary" onclick="navigate(\'students\')">➕ إضافة يدوية</button>' +
      '<button class="btn btn-ai" onclick="navigate(\'import\')">📂 استيراد من ملف (PDF/Excel)</button>' +
      '</div></div></div>';
  }

  h += '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">⚡</span> إجراءات سريعة للمشرف</div></div>' +
    '<div class="section-body" style="display:flex;gap:12px;flex-wrap:wrap">' +
    '<button class="btn btn-primary" onclick="navigate(\'students\')">➕ طالب جديد</button>' +
    '<button class="btn" onclick="navigate(\'import\')">📂 استيراد ملفات</button>' +
    '<button class="btn" onclick="navigate(\'attendance\')">📋 الحضور</button>' +
    '<button class="btn" onclick="navigate(\'customize\')">🎨 تخصيص</button>' +
    '</div></div>';
  return h;
}

function renderStudentDashboard() {
  const myData = DB.students.find(function (s) { return s.name === AppState.currentUser.name; });
  let h = '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">🎓</span> بوابة الطالب الشخصية</div></div><div class="section-body">';
  h += '<div style="font-size:1.2rem; margin-bottom: 24px; color:var(--text)">مرحباً بك يا <strong>' + escapeHtml(AppState.currentUser.name) + '</strong> في منصتك التعليمية</div>';

  if (!myData) {
    h += '<div class="readonly-notice">عذراً، بياناتك الأكاديمية غير مرتبطة بعد. يرجى مراجعة الإدارة للتأكد من تطابق اسم حسابك مع سجلات المدرسة.</div>';
  } else {
    const myDiv = getStudentDiv(myData);
    h += '<div style="margin-bottom:24px; display:inline-block; padding:8px 16px; background:var(--bg3); border-radius:var(--radius); border:1px solid var(--border)">' +
      'الشعبة والصف: <span style="font-weight:bold; color:var(--gold)">' + escapeHtml(getDivLabel(myDiv)) + '</span></div>';

    const myNotes = DB.notes.filter(function (n) { return n.studentId === myData.id; });
    if (myNotes.length > 0) {
      h += '<div style="margin-bottom: 30px;">';
      h += '<div style="font-weight:700; color:var(--danger); margin-bottom:12px; font-size:1.05rem">✉️ رسائل الإدارة والتنبيهات الخاصة بك:</div>';
      myNotes.slice().reverse().forEach(function (n) {
        h += '<div style="background:rgba(239,68,68,0.1); border-right:4px solid var(--danger); padding:16px; margin-bottom:8px; border-radius:var(--radius)">' +
          '<div style="font-size:0.8rem; color:var(--danger); margin-bottom:6px; font-weight:bold">📅 ' + escapeHtml(n.date) + ' - بواسطة: ' + escapeHtml(n.author) + '</div>' +
          '<div style="line-height:1.6">' + n.text + '</div></div>';
      });
      h += '</div>';
    }

    h += '<div style="font-weight:700; color:var(--gold); margin-bottom:12px; font-size:1.05rem">📊 ملخص الدرجات الأكاديمية:</div>';
    h += '<div class="tbl-wrap" style="margin-bottom: 30px;"><table><thead><tr><th>المادة</th><th>الفصل الأول</th><th>نصف السنة</th><th>الفصل الثاني</th><th>النهائي</th></tr></thead><tbody>';
    let total = 0, maxTotal = 0, isFail = false;
    DB.subjects.forEach(function (sub) {
      const gr = studentGrades(myData, sub.id);
      total += gr.final;
      maxTotal += sub.maxGrade;
      if (gr.final < sub.passGrade) isFail = true;
      h += '<tr><td class="td-name">' + escapeHtml(sub.name) + '</td><td>' + gr.q1 + '</td><td>' + gr.mid + '</td><td>' + gr.q2 + '</td>' +
        '<td style="font-weight:bold; color:' + (gr.final >= sub.passGrade ? 'var(--success)' : 'var(--danger)') + '">' + gr.final + ' / ' + sub.maxGrade + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<div style="margin-bottom:30px; padding:16px; background:var(--bg3); border-radius:var(--radius); border:1px solid var(--border); display:flex; justify-content:space-between">' +
      '<div>المجموع الكلي: <strong>' + total + ' / ' + maxTotal + '</strong></div>' +
      '<div>النتيجة المتوقعة: <strong style="color:' + (isFail ? 'var(--danger)' : 'var(--success)') + '">' + (isFail ? 'مكمل / يحتاج تحسين' : 'ناجح / ممتاز') + '</strong></div></div>';

    let absCount = 0;
    Object.keys(DB.attendance).forEach(function (key) {
      if (DB.attendance[key][myData.id] === 'absent') absCount++;
    });
    h += '<div style="font-weight:700; color:var(--gold); margin-bottom:12px; font-size:1.05rem">📋 سجل الغياب:</div>';
    h += '<div style="background:var(--bg); border:1px solid var(--border); padding:20px; border-radius:var(--radius2); display:flex; align-items:center; gap:16px">' +
      '<div style="font-size:2.5rem; opacity:0.8">🚶</div><div>' +
      '<div style="color:var(--text2); margin-bottom:4px">إجمالي أيام الغياب المسجلة لك حتى الآن:</div>' +
      '<div style="color:' + (absCount >= 10 ? 'var(--danger)' : 'var(--text)') + '; font-size:1.5rem; font-weight:bold; font-family:\'JetBrains Mono\'">' + absCount + ' <span style="font-size:1rem; font-weight:normal">أيام</span></div>' +
      (absCount >= 10 ? '<div style="color:var(--danger); font-size:0.8rem; margin-top:4px">لقد تجاوزت الحد المسموح للغياب!</div>' : '') +
      '</div></div>';
  }
  h += '</div></div>';
  return h;
}
