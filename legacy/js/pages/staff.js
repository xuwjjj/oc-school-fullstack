registerPage('teachers', renderTeachers);
registerPage('exams', renderExams);
registerPage('announcements', renderAnnouncements);

function renderTeachers() {
  let h = '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">👨‍🏫</span> الكادر التدريسي</div>' +
    '<div class="section-actions"><button class="btn btn-primary" onclick="openAddTeacherModal()">➕ إضافة معلم</button></div></div><div class="section-body">';
  if (!DB.teachers || !DB.teachers.length) {
    h += '<div class="empty-state"><div class="empty-icon">👨‍🏫</div><p>قاعدة البيانات فارغة، لم يتم إضافة معلمين بعد.</p></div>';
  } else {
    h += '<div class="tbl-wrap"><table><thead><tr><th>الاسم</th><th>المادة التي يدرسها</th><th>رقم الهاتف</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
    DB.teachers.forEach(function (t) {
      const statusBadge = t.status === 'active' ? '<span class="badge badge-success">مباشر ✅</span>' : '<span class="badge badge-warning">في إجازة 📝</span>';
      h += '<tr><td class="td-name">' + escapeHtml(t.name) + '</td><td>' + escapeHtml(t.subject) + '</td><td class="td-id">' + escapeHtml(t.phone || '—') + '</td><td>' + statusBadge + '</td><td>' +
        '<button class="btn btn-sm" onclick="openEditTeacherModal(' + t.id + ')">✏️ تعديل</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="deleteTeacher(' + t.id + ')">🗑️ حذف</button></td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '</div></div>';
  return h;
}

function openAddTeacherModal() {
  openModal(
    '<div class="modal-head"><h3>➕ إضافة معلم جديد</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid" style="grid-template-columns:1fr 1fr">' +
    '<div class="form-group" style="grid-column: span 2"><label>الاسم الكامل</label><input id="nt-name" placeholder="مثال: أ. أحمد محمد"></div>' +
    '<div class="form-group"><label>المادة التي يدرسها</label><input id="nt-sub" placeholder="مثال: الرياضيات"></div>' +
    '<div class="form-group"><label>رقم الهاتف</label><input id="nt-phone" placeholder="07..."></div>' +
    '<div class="form-group"><label>الحالة</label><select id="nt-status"><option value="active">مباشر (على رأس العمل)</option><option value="leave">في إجازة</option></select></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="saveTeacher()">💾 حفظ وبيانات المعلم</button></div>'
  );
}

function saveTeacher() {
  const name = $('nt-name').value.trim();
  if (!name) return alert('الرجاء إدخال اسم المعلم');
  DB.teachers.push({
    id: DB.nextId.teacher++,
    name: name,
    subject: $('nt-sub').value.trim() || 'غير محدد',
    phone: $('nt-phone').value.trim(),
    status: $('nt-status').value
  });
  saveData();
  closeModal();
  navigate('teachers');
}

function openEditTeacherModal(id) {
  const t = DB.teachers.find(function (x) { return x.id === id; });
  if (!t) return;
  openModal(
    '<div class="modal-head"><h3>✏️ تعديل بيانات المعلم</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid" style="grid-template-columns:1fr 1fr">' +
    '<div class="form-group" style="grid-column: span 2"><label>الاسم الكامل</label><input id="et-name" value="' + escapeHtml(t.name) + '"></div>' +
    '<div class="form-group"><label>المادة التي يدرسها</label><input id="et-sub" value="' + escapeHtml(t.subject) + '"></div>' +
    '<div class="form-group"><label>رقم الهاتف</label><input id="et-phone" value="' + escapeHtml(t.phone) + '"></div>' +
    '<div class="form-group"><label>الحالة</label><select id="et-status">' +
    '<option value="active"' + (t.status === 'active' ? ' selected' : '') + '>مباشر (على رأس العمل)</option>' +
    '<option value="leave"' + (t.status === 'leave' ? ' selected' : '') + '>في إجازة</option></select></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="updateTeacher(' + id + ')">💾 حفظ التعديلات</button></div>'
  );
}

function updateTeacher(id) {
  const t = DB.teachers.find(function (x) { return x.id === id; });
  if (!t) return;
  t.name = $('et-name').value.trim() || t.name;
  t.subject = $('et-sub').value.trim() || 'غير محدد';
  t.phone = $('et-phone').value.trim();
  t.status = $('et-status').value;
  saveData();
  closeModal();
  navigate('teachers');
}

function deleteTeacher(id) {
  if (!confirm('هل تريد فعلاً حذف هذا المعلم من قاعدة البيانات؟')) return;
  DB.teachers = DB.teachers.filter(function (t) { return t.id !== id; });
  saveData();
  navigate('teachers');
}

function renderExams() {
  let h = '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">🎯</span> جداول الامتحانات</div>' +
    '<div class="section-actions"><button class="btn btn-primary" onclick="openAddExamModal()">➕ إضافة امتحان أو جدول</button></div></div><div class="section-body">';
  if (!DB.exams || !DB.exams.length) {
    h += '<div class="empty-state"><div class="empty-icon">📝</div><p>لا توجد امتحانات أو جداول مضافة حالياً.</p></div>';
  } else {
    h += '<div style="display:grid; gap:16px;">';
    DB.exams.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).forEach(function (ex) {
      h += '<div style="border:1px solid var(--border); border-radius:var(--radius2); background:var(--bg); padding:16px;">' +
        '<div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:12px; flex-wrap:wrap; gap:8px">' +
        '<div><div style="font-weight:800; font-size:1.1rem; color:var(--text)">' + escapeHtml(ex.title) + '</div>' +
        '<div style="font-size:0.8rem; color:var(--text3); margin-top:4px">الفئة المستهدفة: <span style="color:var(--gold)">' + escapeHtml(ex.target) + '</span></div></div>' +
        '<div style="display:flex; gap:8px; align-items:center"><span class="date-badge" style="background:var(--bg3)">📅 ' + escapeHtml(ex.date) + '</span>' +
        '<button class="btn btn-sm" onclick="openEditExamModal(' + ex.id + ')">✏️</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="deleteExam(' + ex.id + ')">🗑️</button></div></div>' +
        '<div style="font-size:0.9rem; line-height:1.6; color:var(--text2)">' + ex.details + '</div></div>';
    });
    h += '</div>';
  }
  h += '</div></div>';
  return h;
}

function openAddExamModal() {
  openModal(
    '<div class="modal-head"><h3>➕ إضافة جدول امتحان</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid" style="grid-template-columns:1fr">' +
    '<div class="form-group"><label>عنوان الامتحان (مثال: امتحانات نصف السنة)</label><input id="ne-title"></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="form-group"><label>تاريخ البدء</label><input type="date" id="ne-date" value="' + todayIso() + '"></div>' +
    '<div class="form-group"><label>المرحلة المستهدفة</label><input id="ne-target" placeholder="مثال: جميع المراحل، أو الرابع العلمي"></div></div>' +
    '<div class="form-group"><label>التفاصيل أو رابط الجدول</label><textarea id="ne-details" rows="5" style="resize:vertical; font-family:\'Noto Naskh Arabic\',serif"></textarea></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="saveExam()">📢 نشر وتعميم الجدول</button></div>'
  );
}

function saveExam() {
  const t = $('ne-title').value.trim();
  if (!t) return alert('الرجاء كتابة عنوان الامتحان');
  DB.exams.push({
    id: DB.nextId.exam_entry++,
    title: t,
    date: $('ne-date').value,
    target: $('ne-target').value.trim() || 'عام',
    details: linkifyDetails($('ne-details').value.trim())
  });
  saveData();
  closeModal();
  navigate('exams');
}

function openEditExamModal(id) {
  const ex = DB.exams.find(function (x) { return x.id === id; });
  if (!ex) return;
  const plainDetails = stripHtmlToText(ex.details);
  openModal(
    '<div class="modal-head"><h3>✏️ تعديل جدول الامتحان</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid" style="grid-template-columns:1fr">' +
    '<div class="form-group"><label>عنوان الامتحان</label><input id="ee-title" value="' + escapeHtml(ex.title) + '"></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="form-group"><label>تاريخ البدء</label><input type="date" id="ee-date" value="' + escapeHtml(ex.date) + '"></div>' +
    '<div class="form-group"><label>المرحلة المستهدفة</label><input id="ee-target" value="' + escapeHtml(ex.target) + '"></div></div>' +
    '<div class="form-group"><label>التفاصيل أو رابط الجدول</label><textarea id="ee-details" rows="5" style="resize:vertical">' + escapeHtml(plainDetails) + '</textarea></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="updateExam(' + id + ')">💾 حفظ التعديلات</button></div>'
  );
}

function updateExam(id) {
  const ex = DB.exams.find(function (x) { return x.id === id; });
  if (!ex) return;
  const t = $('ee-title').value.trim();
  if (!t) return alert('الرجاء إدخال العنوان');
  ex.title = t;
  ex.date = $('ee-date').value;
  ex.target = $('ee-target').value.trim() || 'عام';
  ex.details = linkifyDetails($('ee-details').value.trim());
  saveData();
  closeModal();
  navigate('exams');
}

function deleteExam(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الجدول الامتحاني؟')) return;
  DB.exams = DB.exams.filter(function (e) { return e.id !== id; });
  saveData();
  navigate('exams');
}

function renderAnnouncements() {
  const forumTab = AppState.forumTab || 'public';
  const canCreatePrivate = isAdmin() || isTeacherUser();
  let h = '<div class="section"><div class="section-head"><div class="section-title"><span class="sec-icon">📢</span> الإعلانات والمنتدى</div>' +
    '<div class="section-actions"><button class="btn btn-primary" onclick="openCommunityPostModal()">➕ نشر منشور جديد</button></div></div>' +
    '<div class="section-body">' +
    '<div class="tabs" style="margin-bottom:18px">' +
    '<button class="tab ' + (forumTab === 'public' ? 'active' : '') + '" onclick="switchForumTab(\'public\')">إعلانات عامة</button>' +
    '<button class="tab ' + (forumTab === 'private' ? 'active' : '') + '" onclick="switchForumTab(\'private\')">منتدى خاص</button>' +
    '<button class="tab ' + (forumTab === 'teacher' ? 'active' : '') + '" onclick="switchForumTab(\'teacher\')">منشورات المعلمين</button>' +
    '</div>';

  if (!DB.announcements.length && (!DB.communityPosts || !DB.communityPosts.length)) {
    h += '<div class="empty-state"><div class="empty-icon">📢</div><p>لا توجد منشورات أو إعلانات حتى الآن</p></div>';
  }

  if (DB.announcements.length) {
    h += '<div style="margin-bottom:22px"><div style="font-weight:800;color:var(--gold);margin-bottom:12px">🏛️ إعلانات الإدارة</div>';
    DB.announcements.forEach(function (a) {
      const border = a.priority === 'high' ? 'border-right:4px solid var(--danger)' : 'border-right:4px solid var(--accent)';
      h += '<div style="padding:20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius2);margin-bottom:16px;' + border + ';box-shadow:0 4px 12px rgba(0,0,0,0.1)">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:12px;flex-wrap:wrap;gap:8px">' +
        '<div style="font-weight:800;font-size:1.1rem;color:var(--text);display:flex;align-items:center;gap:8px">' +
        (a.priority === 'high' ? '<span class="badge badge-danger">هام وعاجل</span> ' : '') + escapeHtml(a.title) + '</div>' +
        adminOnly('<div style="display:flex;gap:6px"><button class="btn btn-sm" onclick="openEditAnnModal(' + a.id + ')">✏️ تعديل</button><button class="btn btn-sm btn-danger" onclick="deleteAnn(' + a.id + ')">🗑️ حذف</button></div>') +
        '</div><div style="font-size:0.9rem;color:var(--text2);line-height:1.8;font-family:\'Noto Naskh Arabic\',serif;margin-bottom:16px">' + a.body + '</div>' +
        '<div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text3);background:var(--bg3);padding:8px 12px;border-radius:6px">' +
        '<span>📅 ' + escapeHtml(a.date) + '</span><span>✍️ بواسطة: <span style="font-weight:700;color:var(--gold)">' + escapeHtml(a.author) + '</span></span></div></div>';
    });
    h += '</div>';
  }

  const communityPosts = getVisibleForumPosts(forumTab);
  if (communityPosts.length) {
    h += '<div><div style="font-weight:800;color:var(--gold);margin:12px 0 14px">' +
      (forumTab === 'public' ? '💬 المنتدى العام' : forumTab === 'private' ? '🔒 المنتدى الخاص' : '👨‍🏫 منشورات المعلمين') +
      '</div>';
    communityPosts.forEach(function (post) {
      const mediaHtml = renderForumMedia(post);
      h += '<div style="padding:20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius2);margin-bottom:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08)">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:12px;flex-wrap:wrap">' +
        '<div>' +
        '<div style="font-weight:800;color:var(--text);font-size:1.02rem">' + escapeHtml(post.title) + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text3);margin-top:4px">' +
        '<span class="badge badge-gold">' + (post.visibility === 'public' ? 'عام' : post.visibility === 'private' ? 'خاص' : 'معلم') + '</span> ' +
        '📅 ' + escapeHtml(post.date) + ' • ✍️ ' + escapeHtml(post.author) +
        '</div>' +
        '</div>' +
        (isAdmin() || (AppState.currentUser && post.author === AppState.currentUser.name) ? '<div style="display:flex;gap:6px"><button class="btn btn-sm" onclick="openEditCommunityPost(' + post.id + ')">✏️ تعديل</button><button class="btn btn-sm btn-danger" onclick="deleteCommunityPost(' + post.id + ')">🗑️ حذف</button></div>' : '') +
        '</div>' +
        '<div style="font-size:0.88rem;line-height:1.8;color:var(--text2);margin-bottom:12px">' + (post.text || 'لا يوجد نص مرفق.') + '</div>' +
        (mediaHtml ? '<div style="margin-bottom:12px">' + mediaHtml + '</div>' : '') +
        '</div>';
    });
    h += '</div>';
  }

  if (!DB.announcements.length && !communityPosts.length) {
    h += '<div class="empty-state"><div class="empty-icon">📭</div><p>لا توجد منشورات في هذا القسم حتى الآن.</p></div>';
  }

  h += '</div></div>';
  return h;
}

function switchForumTab(mode) {
  AppState.forumTab = mode;
  navigate('announcements');
}

function getVisibleForumPosts(mode) {
  const posts = Array.isArray(DB.communityPosts) ? DB.communityPosts : [];
  return posts.filter(function (post) {
    if (!post || !post.visibility) return false;
    if (mode === 'public') return post.visibility === 'public';
    if (mode === 'private') return post.visibility === 'private' && (isAdmin() || isTeacherUser());
    if (mode === 'teacher') return post.visibility === 'teachers' && (isAdmin() || isTeacherUser());
    return false;
  }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
}

function renderForumMedia(post) {
  if (!post.mediaUrl) return '';
  if (post.mediaType === 'image') {
    return '<img src="' + escapeHtml(post.mediaUrl) + '" alt="' + escapeHtml(post.title) + '" style="max-width:100%;border-radius:10px;border:1px solid var(--border);max-height:360px;object-fit:cover;" />';
  }
  if (post.mediaType === 'video') {
    return '<video controls style="max-width:100%;border-radius:10px;border:1px solid var(--border);max-height:360px;background:#000"><source src="' + escapeHtml(post.mediaUrl) + '" /></video>';
  }
  return '';
}

function openCommunityPostModal() {
  if (!AppState.currentUser) {
    alert('يجب تسجيل الدخول أولاً لإضافة منشور');
    return;
  }

  const options = isAdmin() || isTeacherUser()
    ? '<option value="public">عام</option><option value="private">خاص</option><option value="teachers">خاص بالمعلمين</option>'
    : '<option value="public">عام</option>';

  openModal(
    '<div class="modal-head"><h3>➕ نشر منشور جديد</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid" style="grid-template-columns:1fr">' +
    '<div class="form-group"><label>عنوان المنشور</label><input id="cp-title" placeholder="عنوان المنشور"></div>' +
    '<div class="form-group"><label>نص المنشور</label><textarea id="cp-text" rows="5" placeholder="اكتب نصك هنا..."></textarea></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="form-group"><label>نوع المحتوى</label><select id="cp-type"><option value="text">نص فقط</option><option value="image">صورة</option><option value="video">فيديو</option></select></div>' +
    '<div class="form-group"><label>النوع/الرؤية</label><select id="cp-visibility">' + options + '</select></div></div>' +
    '<div class="form-group"><label>رابط الصورة/الفيديو</label><input id="cp-media" placeholder="https://... أو رابط الملف"></div>' +
    '</div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="saveCommunityPost()">📢 نشر</button><button class="btn" onclick="closeModal()">إلغاء</button></div>'
  );
}

function saveCommunityPost() {
  if (!AppState.currentUser) return alert('يجب تسجيل الدخول أولاً');

  const title = $('cp-title').value.trim();
  const text = $('cp-text').value.trim();
  const visibility = $('cp-visibility').value;
  const mediaType = $('cp-type').value;
  const mediaUrl = $('cp-media').value.trim();

  if (!title || !text) return alert('يرجى كتابة عنوان المنشور والنص');

  if ((visibility === 'private' || visibility === 'teachers') && !(isAdmin() || isTeacherUser())) {
    return alert('لا تملك صلاحية للنشر في هذا القسم');
  }

  DB.communityPosts = DB.communityPosts || [];
  DB.communityPosts.unshift({
    id: Date.now(),
    title: title,
    text: nlToBr(text),
    date: todayIso(),
    author: AppState.currentUser.name,
    visibility: visibility,
    mediaType: mediaType,
    mediaUrl: mediaType === 'text' ? '' : mediaUrl
  });

  saveData();
  closeModal();
  navigate('announcements');
}

function openEditCommunityPost(id) {
  const post = (DB.communityPosts || []).find(function (item) { return item.id === id; });
  if (!post) return;
  const plainText = stripHtmlToText(post.text);
  openModal(
    '<div class="modal-head"><h3>✏️ تعديل المنشور</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid" style="grid-template-columns:1fr">' +
    '<div class="form-group"><label>عنوان المنشور</label><input id="ep-title" value="' + escapeHtml(post.title) + '"></div>' +
    '<div class="form-group"><label>نص المنشور</label><textarea id="ep-text" rows="5">' + escapeHtml(plainText) + '</textarea></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="form-group"><label>نوع المحتوى</label><select id="ep-type"><option value="text"' + (post.mediaType === 'text' || !post.mediaType ? ' selected' : '') + '>نص فقط</option><option value="image"' + (post.mediaType === 'image' ? ' selected' : '') + '>صورة</option><option value="video"' + (post.mediaType === 'video' ? ' selected' : '') + '>فيديو</option></select></div>' +
    '<div class="form-group"><label>النوع/الرؤية</label><select id="ep-visibility"><option value="public"' + (post.visibility === 'public' ? ' selected' : '') + '>عام</option><option value="private"' + (post.visibility === 'private' ? ' selected' : '') + '>خاص</option><option value="teachers"' + (post.visibility === 'teachers' ? ' selected' : '') + '>خاص بالمعلمين</option></select></div></div>' +
    '<div class="form-group"><label>رابط الصورة/الفيديو</label><input id="ep-media" value="' + escapeHtml(post.mediaUrl || '') + '"></div>' +
    '</div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="updateCommunityPost(' + id + ')">💾 حفظ</button><button class="btn" onclick="closeModal()">إلغاء</button></div>'
  );
}

function updateCommunityPost(id) {
  const post = (DB.communityPosts || []).find(function (item) { return item.id === id; });
  if (!post) return;
  const title = $('ep-title').value.trim();
  const text = $('ep-text').value.trim();
  const visibility = $('ep-visibility').value;
  const mediaType = $('ep-type').value;
  const mediaUrl = $('ep-media').value.trim();
  if (!title || !text) return alert('يرجى إدخال العنوان والنص');

  post.title = title;
  post.text = nlToBr(text);
  post.visibility = visibility;
  post.mediaType = mediaType;
  post.mediaUrl = mediaType === 'text' ? '' : mediaUrl;
  post.date = todayIso();
  saveData();
  closeModal();
  navigate('announcements');
}

function deleteCommunityPost(id) {
  if (!confirm('هل تريد حذف هذا المنشور نهائياً؟')) return;
  DB.communityPosts = (DB.communityPosts || []).filter(function (post) { return post.id !== id; });
  saveData();
  navigate('announcements');
}

function openAddAnnModal() {
  openModal(
    '<div class="modal-head"><h3>➕ نشر تعليمات أو إعلان</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid" style="grid-template-columns:1fr">' +
    '<div class="form-group"><label>عنوان المنشور</label><input id="na-t"></div>' +
    '<div class="form-group"><label>النص والتفاصيل</label><textarea id="na-b" rows="6" style="resize:vertical"></textarea></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="form-group"><label>درجة الأهمية</label><select id="na-p"><option value="normal">عادي</option><option value="high">هام وعاجل جداً</option></select></div>' +
    '<div class="form-group"><label>الناشر</label><input id="na-a" value="' + escapeHtml(AppState.currentUser.name) + '"></div></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="saveAnn()">📢 نشر الآن</button><button class="btn" onclick="closeModal()">إلغاء</button></div>'
  );
}

function saveAnn() {
  const t = $('na-t').value.trim();
  const b = $('na-b').value.trim();
  if (!t || !b) return alert('الرجاء إدخال العنوان والنص بالكامل');
  DB.announcements.unshift({
    id: DB.nextId.announcement++,
    title: t,
    body: nlToBr(b),
    date: todayIso(),
    priority: $('na-p').value,
    author: $('na-a').value
  });
  saveData();
  closeModal();
  navigate('announcements');
}

function openEditAnnModal(id) {
  const ann = DB.announcements.find(function (a) { return a.id === id; });
  if (!ann) return;
  const textBody = stripHtmlToText(ann.body);
  openModal(
    '<div class="modal-head"><h3>✏️ تعديل المنشور</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-grid" style="grid-template-columns:1fr">' +
    '<div class="form-group"><label>العنوان</label><input id="ea-t" value="' + escapeHtml(ann.title) + '"></div>' +
    '<div class="form-group"><label>النص والتفاصيل</label><textarea id="ea-b" rows="6" style="resize:vertical">' + escapeHtml(textBody) + '</textarea></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="form-group"><label>الأهمية</label><select id="ea-p">' +
    '<option value="normal"' + (ann.priority === 'normal' ? ' selected' : '') + '>عادي</option>' +
    '<option value="high"' + (ann.priority === 'high' ? ' selected' : '') + '>هام وعاجل</option></select></div>' +
    '<div class="form-group"><label>الناشر</label><input id="ea-a" value="' + escapeHtml(ann.author) + '"></div></div></div></div>' +
    '<div class="modal-foot"><button class="btn btn-primary" onclick="updateAnn(' + id + ')">💾 حفظ التعديلات</button><button class="btn" onclick="closeModal()">إلغاء</button></div>'
  );
}

function updateAnn(id) {
  const ann = DB.announcements.find(function (a) { return a.id === id; });
  if (!ann) return;
  const t = $('ea-t').value.trim();
  const b = $('ea-b').value.trim();
  if (!t || !b) return alert('الرجاء إدخال العنوان والنص');
  ann.title = t;
  ann.body = nlToBr(b);
  ann.priority = $('ea-p').value;
  ann.author = $('ea-a').value;
  saveData();
  closeModal();
  navigate('announcements');
}

function deleteAnn(id) {
  if (!confirm('هل تريد فعلاً حذف هذا المنشور بشكل نهائي؟')) return;
  DB.announcements = DB.announcements.filter(function (a) { return a.id !== id; });
  saveData();
  navigate('announcements');
}
