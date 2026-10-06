import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';

const API = 'http://localhost:4000/api';
const importHeaders = {
  name: new Set(['name', 'student', 'student name', 'student_name', 'اسم الطالب', 'الاسم', 'الاسم الكامل']),
  grade: new Set(['grade', 'grade level', 'grade_level', 'class', 'المرحلة', 'الصف', 'الشعبة']),
  guardian: new Set(['guardian', 'guardian name', 'guardian_name', 'اسم ولي الأمر', 'ولي الأمر']),
  phone: new Set(['phone', 'guardian phone', 'guardian_phone', 'هاتف ولي الأمر', 'رقم ولي الأمر'])
};

function mapStudentRows(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((cell) => String(cell ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
  const nameIndex = headers.findIndex((header) => importHeaders.name.has(header));
  const hasHeaders = nameIndex >= 0;
  const indexes = Object.fromEntries(Object.entries(importHeaders).map(([field, values]) => [
    field,
    headers.findIndex((header) => values.has(header))
  ]));

  return (hasHeaders ? rows.slice(1) : rows)
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim()))
    .map((row) => {
      const valueAt = (index) => index >= 0 ? String(row[index] ?? '').trim() : '';
      return hasHeaders ? {
        name: valueAt(indexes.name),
        grade_level: valueAt(indexes.grade),
        guardian_name: valueAt(indexes.guardian),
        guardian_phone: valueAt(indexes.phone)
      } : { name: valueAt(0) };
    });
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('oc_school_token') || '');
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('login');
  const [section, setSection] = useState('dashboard');
  const [tab, setTab] = useState('public');
  const [posts, setPosts] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [grades, setGrades] = useState([]);
  const [staff, setStaff] = useState([]);
  const [exams, setExams] = useState([]);
  const [overview, setOverview] = useState({
    studentCount: 0,
    staffCount: 0,
    examCount: 0,
    avgGrade: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    attendanceSnapshot: []
  });
  const [importMessage, setImportMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [form, setForm] = useState({
    name: '', username: '', email: '', password: '', title: '', text: '', visibility: 'public', mediaType: 'text', mediaUrl: '',
    studentName: '', gradeLevel: '', guardianName: '', guardianPhone: '', studentStatus: 'active',
    attendanceStudentId: '', attendanceDate: new Date().toISOString().slice(0, 10), attendanceStatus: 'present', attendanceNotes: '',
    gradeStudentId: '', gradeSubject: '', gradeExamName: '', gradeScore: '', gradeMaxScore: '',
    staffName: '', staffRole: 'teacher', staffEmail: '', staffPhone: '', staffDepartment: '',
    examTitle: '', examSubject: '', examDate: new Date().toISOString().slice(0, 10), examDuration: '60', examRoom: ''
  });

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher' || isAdmin;
  const isStudent = user?.role === 'student';

  const fetchJson = async (path, options = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    const data = await res.json();
    return data;
  };

  const refreshData = async () => {
    if (!token) return;
    const [overviewRes, studentsRes, attendanceRes, gradesRes, staffRes, examsRes] = await Promise.all([
      fetchJson('/dashboard/overview'),
      fetchJson('/students'),
      fetchJson('/attendance'),
      fetchJson('/grades'),
      fetchJson('/staff'),
      fetchJson('/exams')
    ]);

    if (overviewRes.success) setOverview(overviewRes.overview);
    if (studentsRes.success) setStudents(studentsRes.students || []);
    if (attendanceRes.success) setAttendance(attendanceRes.attendance || []);
    if (gradesRes.success) setGrades(gradesRes.grades || []);
    if (staffRes.success) setStaff(staffRes.staff || []);
    if (examsRes.success) setExams(examsRes.exams || []);
  };

  useEffect(() => {
    if (token) {
      fetchJson('/auth/me')
        .then((d) => {
          if (d.success) {
            setUser(d.user);
            setSection(d.user.role === 'student' ? 'forum' : 'dashboard');
            setTab('public');
            setPage('dashboard');
          } else {
            localStorage.removeItem('oc_school_token');
            setToken('');
            setUser(null);
            setPage('login');
          }
        })
        .catch(() => {
          localStorage.removeItem('oc_school_token');
          setToken('');
          setUser(null);
          setPage('login');
        });
    }
  }, [token]);

  useEffect(() => {
    if (!token || !user || user.role === 'student') return;
    refreshData();
  }, [token, user?.role]);

  useEffect(() => {
    if (!token) return;
    fetchPosts();
  }, [token, tab]);

  const fetchPosts = async () => {
    const data = await fetchJson('/posts');
    if (data.success) {
      const visiblePosts = data.posts.filter((post) => {
        if (tab === 'public') return post.visibility === 'public';
        if (tab === 'private') return post.visibility === 'private';
        return post.visibility === 'teachers';
      });
      setPosts(visiblePosts);
    }
  };

  const onLogin = async (event) => {
    event.preventDefault();
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username, password: form.password })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || 'Login failed');
      return;
    }
    localStorage.setItem('oc_school_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setTab('public');
    setSection(data.user.role === 'student' ? 'forum' : 'dashboard');
    setPage('dashboard');
  };

  const onRegister = async (event) => {
    event.preventDefault();
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        username: form.username,
        email: form.email,
        password: form.password,
        role: 'student'
      })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || 'Registration failed');
      return;
    }
    localStorage.setItem('oc_school_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setTab('public');
    setSection('forum');
    setPage('dashboard');
  };

  const onCreatePost = async (event) => {
    event.preventDefault();
    const data = await fetchJson('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        text: form.text,
        mediaType: form.mediaType,
        mediaUrl: form.mediaUrl,
        visibility: form.visibility
      })
    });
    if (!data.success) {
      alert(data.message || 'Failed');
      return;
    }
    setForm({ ...form, title: '', text: '', mediaUrl: '' });
    fetchPosts();
  };

  const handleCreateStudent = async (event) => {
    event.preventDefault();
    const data = await fetchJson('/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.studentName,
        grade_level: form.gradeLevel,
        guardian_name: form.guardianName,
        guardian_phone: form.guardianPhone,
        status: form.studentStatus
      })
    });
    if (!data.success) {
      alert(data.message || 'Failed to create student');
      return;
    }
    setForm({ ...form, studentName: '', gradeLevel: '', guardianName: '', guardianPhone: '', studentStatus: 'active' });
    refreshData();
  };

  const handleImportStudents = (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setImportMessage('');
    setIsImporting(true);
    (async () => {
      try {
        const extension = file.name.split('.').pop()?.toLowerCase();
        const rows = extension === 'xlsx'
          ? await readXlsxFile(file)
          : ['csv', 'tsv', 'txt'].includes(extension)
            ? Papa.parse(await file.text(), { skipEmptyLines: 'greedy' }).data
            : null;

        if (!rows) {
          throw new Error('الصيغ المدعومة: CSV وTSV وTXT وExcel XLSX');
        }

        const importedRows = mapStudentRows(rows);
        if (!importedRows.length) {
          throw new Error('لم نعثر على أسماء في الملف');
        }

        const result = await fetchJson('/students/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students: importedRows })
        });
        setImportMessage(result.message || 'تعذر استيراد الملف');
        if (result.success) await refreshData();
      } catch (error) {
        setImportMessage(error.message || 'تعذر قراءة الملف');
      } finally {
        setIsImporting(false);
        input.value = '';
      }
    })();
  };

  const handleCreateAttendance = async (event) => {
    event.preventDefault();
    if (!form.attendanceStudentId) {
      alert('ابحث عن الطالب واختر اسمه من القائمة أولاً');
      return;
    }
    const data = await fetchJson('/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: Number(form.attendanceStudentId),
        date: form.attendanceDate,
        status: form.attendanceStatus,
        notes: form.attendanceNotes
      })
    });
    if (!data.success) {
      alert(data.message || 'Failed to save attendance');
      return;
    }
    setForm({ ...form, attendanceStudentId: '', attendanceNotes: '', attendanceStatus: 'present' });
    setAttendanceSearch('');
    refreshData();
  };

  const handleCreateGrade = async (event) => {
    event.preventDefault();
    const data = await fetchJson('/grades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: Number(form.gradeStudentId),
        subject: form.gradeSubject,
        exam_name: form.gradeExamName,
        score: Number(form.gradeScore),
        max_score: Number(form.gradeMaxScore)
      })
    });
    if (!data.success) {
      alert(data.message || 'Failed to save grade');
      return;
    }
    setForm({ ...form, gradeStudentId: '', gradeSubject: '', gradeExamName: '', gradeScore: '', gradeMaxScore: '' });
    refreshData();
  };

  const handleCreateStaff = async (event) => {
    event.preventDefault();
    const data = await fetchJson('/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.staffName,
        role: form.staffRole,
        email: form.staffEmail,
        phone: form.staffPhone,
        department: form.staffDepartment
      })
    });
    if (!data.success) {
      alert(data.message || 'Failed to create staff member');
      return;
    }
    setForm({ ...form, staffName: '', staffEmail: '', staffPhone: '', staffDepartment: '', staffRole: 'teacher' });
    refreshData();
  };

  const handleCreateExam = async (event) => {
    event.preventDefault();
    const data = await fetchJson('/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.examTitle,
        subject: form.examSubject,
        exam_date: form.examDate,
        duration_minutes: Number(form.examDuration),
        room: form.examRoom
      })
    });
    if (!data.success) {
      alert(data.message || 'Failed to create exam');
      return;
    }
    setForm({ ...form, examTitle: '', examSubject: '', examRoom: '', examDuration: '60' });
    refreshData();
  };

  const logout = () => {
    localStorage.removeItem('oc_school_token');
    setToken('');
    setUser(null);
    setPage('login');
    setSection('forum');
  };

  const renderForumSection = () => (
    <>
      <div className="forum-tabs">
        <button onClick={() => setTab('public')} className={tab === 'public' ? 'active' : ''}>إعلانات عامة</button>
        {isTeacher && <button onClick={() => setTab('private')} className={tab === 'private' ? 'active' : ''}>منتدى خاص</button>}
        {(isTeacher || isStudent) && <button onClick={() => setTab('teachers')} className={tab === 'teachers' ? 'active' : ''}>قنوات المعلمين</button>}
      </div>

      {!isStudent && <form onSubmit={onCreatePost} className="post-form">
        <h3>نشر منشور</h3>
        <input placeholder="عنوان المنشور" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="اكتب نص المنشور" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        <div className="row">
          <select value={form.mediaType} onChange={(e) => setForm({ ...form, mediaType: e.target.value })}>
            <option value="text">نص</option>
            <option value="image">صورة</option>
            <option value="video">فيديو</option>
          </select>
          <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
            <option value="public">عام</option>
            {isTeacher && <option value="private">خاص</option>}
            {isTeacher && <option value="teachers">خاص بالمعلمين</option>}
          </select>
        </div>
        {form.mediaType !== 'text' && (
          <input placeholder="رابط الصورة أو الفيديو" value={form.mediaUrl} onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })} />
        )}
        <button type="submit">نشر</button>
      </form>}

      <div className="posts">
        {posts.length === 0 ? (
          <div className="empty">لا توجد منشورات في هذا القسم</div>
        ) : posts.map((post) => (
          <article className="post-card" key={post.id}>
            <div className="post-head">
              <strong>{post.title}</strong>
              <span>{post.visibility}</span>
            </div>
            <p>{post.text}</p>
            {post.media_type !== 'text' && post.media_url && (
              post.media_type === 'image' ? <img src={post.media_url} alt={post.title} /> : <video controls src={post.media_url} />
            )}
            <small>بواسطة: {post.author_name} • {new Date(post.created_at).toLocaleDateString('ar-IQ')}</small>
          </article>
        ))}
      </div>
    </>
  );

  const renderStudents = () => (
    <div className="module-box">
      <h3>إدارة الطلاب</h3>
      {(isAdmin || isTeacher) && (
        <section className="student-import-box">
          <div>
            <h4>استيراد أسماء الطلاب</h4>
            <p>ارفع CSV أو TSV أو TXT أو Excel XLSX. يقبل قائمة أسماء أو أعمدة للصف وولي الأمر.</p>
          </div>
          <div className="student-import-actions">
            <label className="file-upload-button">
              {isImporting ? 'جارٍ الاستيراد...' : '📁 اختيار ملف'}
              <input type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,text/plain,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleImportStudents} disabled={isImporting} />
            </label>
            <a
              className="template-download"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent('\uFEFFname,grade_level,guardian_name,guardian_phone\nأحمد علي,الأول,علي محمد,07xxxxxxxx')}`}
              download="students-template.csv"
            >تحميل نموذج CSV</a>
          </div>
          {importMessage && <p className="import-message" role="status">{importMessage}</p>}
        </section>
      )}
      <form onSubmit={handleCreateStudent} className="module-form">
        <div className="row">
          <input placeholder="اسم الطالب" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
          <input placeholder="المرحلة" value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} />
        </div>
        <div className="row">
          <input placeholder="اسم ولي الأمر" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
          <input placeholder="هاتف ولي الأمر" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
        </div>
        <div className="row">
          <select value={form.studentStatus} onChange={(e) => setForm({ ...form, studentStatus: e.target.value })}>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
            <option value="pending">قيد الانتظار</option>
          </select>
          <button type="submit">إضافة طالب</button>
        </div>
      </form>

      <table className="data-table">
        <thead>
          <tr><th>الاسم</th><th>المرحلة</th><th>ولي الأمر</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id}>
              <td>{student.name}</td>
              <td>{student.grade_level}</td>
              <td>{student.guardian_name || '-'}</td>
              <td>{student.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const attendanceMatches = students.filter((student) =>
    `${student.name} ${student.grade_level}`.toLocaleLowerCase('ar').includes(attendanceSearch.trim().toLocaleLowerCase('ar'))
  ).slice(0, 8);

  const renderAttendance = () => (
    <div className="module-box">
      <h3>الحضور</h3>
      <form onSubmit={handleCreateAttendance} className="module-form">
        <div className="row">
          <div className="attendance-name-search">
            <input
              type="search"
              value={attendanceSearch}
              placeholder="اكتب اسم الطالب للبحث"
              autoComplete="off"
              onChange={(event) => {
                setAttendanceSearch(event.target.value);
                setForm({ ...form, attendanceStudentId: '' });
              }}
            />
            {attendanceSearch && !form.attendanceStudentId && (
              <div className="attendance-search-results" role="listbox">
                {attendanceMatches.length ? attendanceMatches.map((student) => (
                  <button
                    type="button"
                    key={student.id}
                    role="option"
                    onClick={() => {
                      setForm({ ...form, attendanceStudentId: String(student.id) });
                      setAttendanceSearch(`${student.name} - ${student.grade_level}`);
                    }}
                  >{student.name} <small>{student.grade_level}</small></button>
                )) : <span>لا يوجد طالب بهذا الاسم</span>}
              </div>
            )}
          </div>
          <input type="date" value={form.attendanceDate} onChange={(e) => setForm({ ...form, attendanceDate: e.target.value })} />
        </div>
        <div className="row">
          <select value={form.attendanceStatus} onChange={(e) => setForm({ ...form, attendanceStatus: e.target.value })}>
            <option value="present">حضور</option>
            <option value="absent">غياب</option>
            <option value="late">متأخر</option>
          </select>
          <input placeholder="ملاحظات" value={form.attendanceNotes} onChange={(e) => setForm({ ...form, attendanceNotes: e.target.value })} />
        </div>
        <button type="submit">حفظ الحضور</button>
      </form>

      <table className="data-table">
        <thead>
          <tr><th>الطالب</th><th>التاريخ</th><th>الحالة</th><th>ملاحظات</th></tr>
        </thead>
        <tbody>
          {attendance.map((row) => (
            <tr key={row.id}>
              <td>{row.student_name}</td>
              <td>{row.date}</td>
              <td>{row.status}</td>
              <td>{row.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="absence-summary">
        <div className="absence-summary-heading">
          <h4>عدد مرات الغياب وتواريخها</h4>
          <span>{students.length} طالب</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>اسم الطالب</th><th>عدد مرات الغياب</th><th>تواريخ الغياب</th></tr></thead>
            <tbody>
              {students.map((student) => {
                const absences = attendance.filter((record) => Number(record.student_id) === Number(student.id) && record.status === 'absent');
                return (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td><strong className="absence-count">{absences.length}</strong></td>
                    <td>{absences.length ? absences.map((record) => record.date).join('، ') : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const renderGrades = () => (
    <div className="module-box">
      <h3>الدرجات</h3>
      <form onSubmit={handleCreateGrade} className="module-form">
        <div className="row">
          <select value={form.gradeStudentId} onChange={(e) => setForm({ ...form, gradeStudentId: e.target.value })}>
            <option value="">اختر الطالب</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.name}</option>
            ))}
          </select>
          <input placeholder="المادة" value={form.gradeSubject} onChange={(e) => setForm({ ...form, gradeSubject: e.target.value })} />
        </div>
        <div className="row">
          <input placeholder="اسم الاختبار" value={form.gradeExamName} onChange={(e) => setForm({ ...form, gradeExamName: e.target.value })} />
          <input placeholder="الدرجة" type="number" value={form.gradeScore} onChange={(e) => setForm({ ...form, gradeScore: e.target.value })} />
        </div>
        <div className="row">
          <input placeholder="الدرجة النهائية" type="number" value={form.gradeMaxScore} onChange={(e) => setForm({ ...form, gradeMaxScore: e.target.value })} />
          <button type="submit">إضافة درجة</button>
        </div>
      </form>

      <table className="data-table">
        <thead>
          <tr><th>الطالب</th><th>المادة</th><th>الاختبار</th><th>الدرجة</th></tr>
        </thead>
        <tbody>
          {grades.map((grade) => (
            <tr key={grade.id}>
              <td>{grade.student_name}</td>
              <td>{grade.subject}</td>
              <td>{grade.exam_name}</td>
              <td>{grade.score} / {grade.max_score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderStaff = () => (
    <div className="module-box">
      <h3>العاملون</h3>
      {isAdmin && (
        <form onSubmit={handleCreateStaff} className="module-form">
          <div className="row">
            <input placeholder="اسم الموظف" value={form.staffName} onChange={(e) => setForm({ ...form, staffName: e.target.value })} />
            <select value={form.staffRole} onChange={(e) => setForm({ ...form, staffRole: e.target.value })}>
              <option value="teacher">معلم</option>
              <option value="admin">مشرف</option>
              <option value="assistant">مساعد</option>
            </select>
          </div>
          <div className="row">
            <input placeholder="البريد" type="email" value={form.staffEmail} onChange={(e) => setForm({ ...form, staffEmail: e.target.value })} />
            <input placeholder="الهاتف" value={form.staffPhone} onChange={(e) => setForm({ ...form, staffPhone: e.target.value })} />
          </div>
          <div className="row">
            <input placeholder="القسم" value={form.staffDepartment} onChange={(e) => setForm({ ...form, staffDepartment: e.target.value })} />
            <button type="submit">إضافة موظف</button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr><th>الاسم</th><th>الدور</th><th>القسم</th><th>الهاتف</th></tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id}>
              <td>{member.name}</td>
              <td>{member.role}</td>
              <td>{member.department || '-'}</td>
              <td>{member.phone || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderExams = () => (
    <div className="module-box">
      <h3>الامتحانات</h3>
      {(isAdmin || isTeacher) && (
        <form onSubmit={handleCreateExam} className="module-form">
          <div className="row">
            <input placeholder="عنوان الاختبار" value={form.examTitle} onChange={(e) => setForm({ ...form, examTitle: e.target.value })} />
            <input placeholder="المادة" value={form.examSubject} onChange={(e) => setForm({ ...form, examSubject: e.target.value })} />
          </div>
          <div className="row">
            <input type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
            <input placeholder="مدة الاختبار (دقائق)" type="number" value={form.examDuration} onChange={(e) => setForm({ ...form, examDuration: e.target.value })} />
          </div>
          <div className="row">
            <input placeholder="الغرفة" value={form.examRoom} onChange={(e) => setForm({ ...form, examRoom: e.target.value })} />
            <button type="submit">إضافة اختبار</button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr><th>العنوان</th><th>المادة</th><th>التاريخ</th><th>الغرفة</th></tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <tr key={exam.id}>
              <td>{exam.title}</td>
              <td>{exam.subject}</td>
              <td>{exam.exam_date}</td>
              <td>{exam.room || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderReports = () => (
    <div className="module-box">
      <h3>التقارير</h3>
      <div className="stats-grid">
        <div className="stat-card"><span>عدد الطلاب</span><strong>{overview.studentCount}</strong></div>
        <div className="stat-card"><span>عدد الموظفين</span><strong>{overview.staffCount}</strong></div>
        <div className="stat-card"><span>عدد الامتحانات</span><strong>{overview.examCount}</strong></div>
        <div className="stat-card"><span>متوسط الدرجات</span><strong>{overview.avgGrade || 0}%</strong></div>
        <div className="stat-card"><span>الحضور</span><strong>{overview.presentCount}</strong></div>
        <div className="stat-card"><span>الغياب</span><strong>{overview.absentCount}</strong></div>
      </div>

      <div className="mini-list">
        <h4>أحدث الطلاب</h4>
        {overview.latestStudents?.map((student) => (
          <div key={student.id} className="mini-item">{student.name} • {student.grade_level}</div>
        )) || <div className="empty">لا توجد بيانات</div>}
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="dashboard-home">
      <div className="stats-grid dashboard-stats">
        <div className="stat-card stat-students"><span>الطلاب المسجلين</span><strong>{overview.studentCount ?? 0}</strong><small>إجمالي سجل الطلاب</small></div>
        <div className="stat-card stat-attendance"><span>الشعب الدراسية</span><strong>{new Set(students.map((student) => student.grade_level).filter(Boolean)).size}</strong><small>الشعب التي تضم طلاباً</small></div>
        <div className="stat-card stat-staff"><span>الكادر التدريسي</span><strong>{overview.staffCount ?? 0}</strong><small>إجمالي العاملين</small></div>
      </div>

      {students.length === 0 ? (
        <section className="student-empty-state">
          <div className="empty-icon" aria-hidden="true">✉</div>
          <h2>قاعدة بيانات الطلبة فارغة!</h2>
          <p>الرجاء إدخال أسماء الطلاب لبدء العمل على النظام.</p>
          <button className="primary-action" onClick={() => setSection('students')}>＋ إضافة طالب يدوية</button>
        </section>
      ) : (
        <section className="dashboard-student-list">
          <div className="section-heading"><h2>أحدث الطلاب</h2><button onClick={() => setSection('students')}>عرض سجل الطلاب</button></div>
          <div className="mini-list">
            {overview.latestStudents?.map((student) => (
              <div key={student.id} className="mini-item">{student.name}<span>{student.grade_level}</span></div>
            ))}
          </div>
        </section>
      )}

      <section className="quick-actions">
        <h3>إجراءات سريعة للمشرف <span aria-hidden="true">ϟ</span></h3>
        <div className="quick-action-buttons">
          <button className="primary-action" onClick={() => setSection('students')}>＋ طالب جديد</button>
          <button onClick={() => setSection('attendance')}>▤ الحضور</button>
          <button onClick={() => setSection('forum')}>▣ المنشورات</button>
          <button onClick={() => setSection('reports')}>◉ التقارير</button>
        </div>
      </section>
    </div>
  );

  return (
    <div className="app-shell">
      {page === 'login' || page === 'register' ? (
        <div className="auth-card">
          <h1>منظومة إدارة المدارس</h1>
          <div className="auth-tabs">
            <button onClick={() => setPage('login')}>تسجيل الدخول</button>
            <button onClick={() => setPage('register')}>إنشاء حساب</button>
          </div>

          {page === 'login' ? (
            <form onSubmit={onLogin} className="auth-form">
              <label>اسم المستخدم</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <label>كلمة المرور</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="submit">دخول</button>
            </form>
          ) : (
            <form onSubmit={onRegister} className="auth-form">
              <label>الاسم الكامل</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <label>اسم المستخدم</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <label>البريد الإلكتروني</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <label>كلمة المرور</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="submit">إنشاء حساب</button>
            </form>
          )}
        </div>
      ) : (
        <div className="dashboard">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <h2>النظام الذكي <span aria-hidden="true">▤</span></h2>
              <small>منظومة إدارة المدارس</small>
            </div>
            <div className="sidebar-nav">
              {isStudent ? (
                <>
                  <span className="nav-label">المحتوى</span>
                  <button onClick={() => { setSection('forum'); setTab('public'); }} className={section === 'forum' && tab === 'public' ? 'active' : ''}><span>▣</span> الإعلانات العامة</button>
                  <button onClick={() => { setSection('forum'); setTab('teachers'); }} className={section === 'forum' && tab === 'teachers' ? 'active' : ''}><span>♟</span> قنوات المعلمين</button>
                </>
              ) : (
                <>
              <span className="nav-label">الرئيسية</span>
              <button onClick={() => setSection('dashboard')} className={section === 'dashboard' ? 'active' : ''}><span>▦</span> لوحة القيادة</button>
              <span className="nav-label">إدارة الطلبة</span>
              <button onClick={() => setSection('students')} className={section === 'students' ? 'active' : ''}><span>♟</span> سجل الطلبة</button>
              <button onClick={() => setSection('students')}><span>📁</span> استيراد الطلبة</button>
              <button onClick={() => setSection('students')}><span>🏫</span> الشعب والصفوف</button>
              <button onClick={() => setSection('attendance')} className={section === 'attendance' ? 'active' : ''}><span>▤</span> سجل الحضور والغياب</button>
              <span className="nav-label">الشؤون الأكاديمية</span>
              <button onClick={() => setSection('grades')} className={section === 'grades' ? 'active' : ''}><span>▧</span> سجل الدرجات</button>
              <button onClick={() => setSection('exams')} className={section === 'exams' ? 'active' : ''}><span>◎</span> جدول الامتحانات</button>
              <span className="nav-label">الإدارة</span>
              <button onClick={() => setSection('staff')} className={section === 'staff' ? 'active' : ''}><span>♟</span> الكادر التدريسي</button>
              <button onClick={() => setSection('forum')} className={section === 'forum' ? 'active' : ''}><span>▣</span> المنشورات والإعلانات</button>
              <button onClick={() => setSection('reports')} className={section === 'reports' ? 'active' : ''}><span>◉</span> التقارير</button>
                </>
              )}
            </div>
            <div className="sidebar-footer">
              <span>{isStudent ? 'وضع الطالب · مشاهدة فقط' : '🔒 وضع المشرف (صلاحيات كاملة)'}</span>
              <button onClick={logout}>تسجيل الخروج</button>
            </div>
          </aside>

          <main className="content">
            <div className="topbar">
              <div className="topbar-title">
                <strong>{section === 'dashboard' ? 'لوحة القيادة' : section === 'students' ? 'إدارة الطلبة' : section === 'attendance' ? 'سجل الحضور والغياب' : section === 'grades' ? 'سجل الدرجات' : section === 'staff' ? 'الكادر التدريسي' : section === 'exams' ? 'جدول الامتحانات' : section === 'reports' ? 'التقارير' : tab === 'teachers' ? 'قنوات المعلمين' : tab === 'public' ? 'الإعلانات العامة' : 'المنشورات والإعلانات'}</strong>
                <span>مرحباً، {user?.name || 'المشرف'}</span>
              </div>
              <span className="role">● متصل الآن</span>
            </div>

            {isStudent ? (
              section === 'forum' && renderForumSection()
            ) : (
              <>
                {section === 'dashboard' && renderDashboard()}
                {section === 'forum' && renderForumSection()}
                {section === 'students' && renderStudents()}
                {section === 'attendance' && renderAttendance()}
                {section === 'grades' && renderGrades()}
                {section === 'staff' && renderStaff()}
                {section === 'exams' && renderExams()}
                {section === 'reports' && renderReports()}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
