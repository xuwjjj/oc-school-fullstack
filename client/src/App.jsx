import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';

const API = 'http://localhost:4000/api';
const getLocalDate = () => {
  const now = new Date();
  const localOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - localOffset).toISOString().slice(0, 10);
};
const importHeaders = {
  name: new Set(['name', 'student', 'student name', 'student_name', 'اسم الطالب', 'الاسم', 'الاسم الكامل']),
  grade: new Set(['grade', 'grade level', 'grade_level', 'class', 'المرحلة', 'الصف']),
  section: new Set(['section', 'section name', 'الشعبة', 'الصف الفرعي']),
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
        section: valueAt(indexes.section),
        guardian_name: valueAt(indexes.guardian),
        guardian_phone: valueAt(indexes.phone)
      } : { name: valueAt(0) };
    });
}

function mapGradeRows(rows) {
  if (!rows.length) throw new Error('الملف فارغ');
  const headers = rows[0].map((cell) => String(cell ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
  const nameIndex = headers.findIndex((header) => importHeaders.name.has(header));
  const scoreHeaders = new Set(['score', 'mark', 'marks', 'grade', 'الدرجة', 'درجة', 'درجة الطالب', 'درجات']);
  const scoreIndex = headers.findIndex((header) => scoreHeaders.has(header));
  if (nameIndex < 0 || scoreIndex < 0) {
    throw new Error('يجب أن يحتوي الملف على عمودين باسم الطالب والدرجة');
  }

  return rows.slice(1)
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim()))
    .map((row, index) => {
      const name = String(row[nameIndex] ?? '').trim();
      const rawScore = row[scoreIndex];
      const normalizedScore = typeof rawScore === 'number'
        ? rawScore
        : Number(String(rawScore ?? '').trim().replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(',', '.'));
      if (!name || !Number.isFinite(normalizedScore)) {
        throw new Error(`تأكد من اسم الطالب والدرجة في السطر ${index + 2}`);
      }
      return { name, score: normalizedScore };
    });
}

function downloadCsv(filename, rows) {
  const safeRows = rows.map((row) => row.map((value) => {
    if (typeof value === 'number' || value === null || value === undefined) return value ?? '';
    const text = String(value);
    return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  }));
  const csv = Papa.unparse(safeRows);
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('oc_school_token') || '');
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('login');
  const [section, setSection] = useState('dashboard');
  const [tab, setTab] = useState('public');
  const [posts, setPosts] = useState([]);
  const [students, setStudents] = useState([]);
  const [schoolClasses, setSchoolClasses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [frequentAbsentees, setFrequentAbsentees] = useState([]);
  const [minimumAbsences, setMinimumAbsences] = useState(3);
  const [databaseBackups, setDatabaseBackups] = useState([]);
  const [grades, setGrades] = useState([]);
  const [staff, setStaff] = useState([]);
  const [teacherAccounts, setTeacherAccounts] = useState([]);
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
  const [attendanceClassId, setAttendanceClassId] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [studentReport, setStudentReport] = useState(null);
  const [classMessage, setClassMessage] = useState('');
  const [editingClassId, setEditingClassId] = useState(null);
  const [editingClassGrade, setEditingClassGrade] = useState('');
  const [editingClassSection, setEditingClassSection] = useState('');
  const [importClassId, setImportClassId] = useState('');
  const [gradeImportClassId, setGradeImportClassId] = useState('');
  const [gradeImportSubject, setGradeImportSubject] = useState('');
  const [gradeImportExam, setGradeImportExam] = useState('');
  const [gradeImportMaxScore, setGradeImportMaxScore] = useState('100');
  const [gradeImportRows, setGradeImportRows] = useState([]);
  const [gradeImportMessage, setGradeImportMessage] = useState('');
  const [isGradeImporting, setIsGradeImporting] = useState(false);
  const [teacherAccount, setTeacherAccount] = useState({ name: '', username: '', email: '', password: '' });
  const [teacherAccountMessage, setTeacherAccountMessage] = useState('');
  const [form, setForm] = useState({
    name: '', username: '', email: '', password: '', title: '', text: '', visibility: 'public', mediaType: 'text', mediaUrl: '',
    studentName: '', gradeLevel: '', studentSection: '', guardianName: '', guardianPhone: '', studentStatus: 'active',
    newClassGrade: '', newClassSection: '',
    attendanceDate: getLocalDate(),
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
    const [overviewRes, studentsRes, classesRes, attendanceRes, gradesRes, staffRes, examsRes, frequentAbsencesRes, backupsRes, teacherAccountsRes] = await Promise.all([
      fetchJson('/dashboard/overview'),
      fetchJson('/students'),
      fetchJson('/classes'),
      fetchJson('/attendance'),
      fetchJson('/grades'),
      fetchJson('/staff'),
      fetchJson('/exams'),
      fetchJson(`/reports/frequent-absences?minimum=${minimumAbsences}`),
      isAdmin ? fetchJson('/backups') : Promise.resolve({ success: false }),
      isAdmin ? fetchJson('/users/teachers') : Promise.resolve({ success: false })
    ]);

    if (overviewRes.success) setOverview(overviewRes.overview);
    if (studentsRes.success) setStudents(studentsRes.students || []);
    if (classesRes.success) setSchoolClasses(classesRes.classes || []);
    if (attendanceRes.success) setAttendance(attendanceRes.attendance || []);
    if (frequentAbsencesRes.success) setFrequentAbsentees(frequentAbsencesRes.students || []);
    if (gradesRes.success) setGrades(gradesRes.grades || []);
    if (staffRes.success) setStaff(staffRes.staff || []);
    if (examsRes.success) setExams(examsRes.exams || []);
    if (backupsRes.success) setDatabaseBackups(backupsRes.backups || []);
    if (teacherAccountsRes.success) setTeacherAccounts(teacherAccountsRes.teachers || []);
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
        section: form.studentSection,
        guardian_name: form.guardianName,
        guardian_phone: form.guardianPhone,
        status: form.studentStatus
      })
    });
    if (!data.success) {
      alert(data.message || 'Failed to create student');
      return;
    }
    setForm({ ...form, studentName: '', guardianName: '', guardianPhone: '', studentStatus: 'active' });
    refreshData();
  };

  const handleCreateClass = async (event) => {
    event.preventDefault();
    const data = await fetchJson('/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade_level: form.newClassGrade, section: form.newClassSection })
    });
    if (!data.success) {
      setClassMessage(data.message || 'تعذر إضافة الصف والشعبة');
      return;
    }

    setClassMessage('تمت إضافة الصف والشعبة بنجاح');
    setForm({ ...form, newClassGrade: '', newClassSection: '' });
    await refreshData();
  };

  const handleDeleteClass = async (schoolClass) => {
    if (!window.confirm(`حذف ${schoolClass.grade_level} - شعبة ${schoolClass.section}؟`)) return;
    const data = await fetchJson(`/classes/${schoolClass.id}`, { method: 'DELETE' });
    if (!data.success) {
      setClassMessage(data.message || 'تعذر حذف الصف والشعبة');
      return;
    }
    setClassMessage('تم حذف الصف والشعبة');
    await refreshData();
  };

  const beginEditClass = (schoolClass) => {
    setEditingClassId(schoolClass.id);
    setEditingClassGrade(schoolClass.grade_level);
    setEditingClassSection(schoolClass.section);
    setClassMessage('');
  };

  const handleUpdateClass = async (event, schoolClass) => {
    event.preventDefault();
    const data = await fetchJson(`/classes/${schoolClass.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade_level: editingClassGrade, section: editingClassSection })
    });
    if (!data.success) {
      setClassMessage(data.message || 'تعذر تعديل الصف والشعبة');
      return;
    }
    setEditingClassId(null);
    setClassMessage('تم تعديل الصف والشعبة وتحديث بيانات طلابها');
    await refreshData();
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
        const selectedClass = schoolClasses.find((item) => String(item.id) === importClassId);
        const studentsToImport = selectedClass
          ? importedRows.map((student) => ({
            ...student,
            grade_level: selectedClass.grade_level,
            section: selectedClass.section
          }))
          : importedRows;

        const result = await fetchJson('/students/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students: studentsToImport })
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

  const handleGradeImportFile = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setGradeImportRows([]);
    setGradeImportMessage('');
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const rows = extension === 'xlsx'
        ? await readXlsxFile(file)
        : ['csv', 'tsv', 'txt'].includes(extension)
          ? Papa.parse(await file.text(), {
            skipEmptyLines: 'greedy',
            delimiter: extension === 'tsv' ? '\t' : ''
          }).data
          : null;
      if (!rows) throw new Error('الصيغ المدعومة: CSV وTSV وTXT وExcel XLSX');

      const parsedRows = mapGradeRows(rows);
      if (!parsedRows.length) throw new Error('لم نعثر على درجات في الملف');
      if (parsedRows.length > 500) throw new Error('الحد الأقصى هو 500 طالب في الملف الواحد');
      const names = parsedRows.map((student) => student.name.normalize('NFC').toLocaleLowerCase('ar'));
      if (new Set(names).size !== names.length) throw new Error('يوجد اسم طالب مكرر في الملف؛ احذف التكرار قبل الرفع');

      setGradeImportRows(parsedRows);
      setGradeImportMessage(`تمت قراءة ${parsedRows.length} طالب. راجع الصف والشعبة والمادة ثم احفظ الدرجات.`);
    } catch (error) {
      setGradeImportMessage(error.message || 'تعذر قراءة ملف الدرجات');
    } finally {
      input.value = '';
    }
  };

  const handleImportGrades = async (event) => {
    event.preventDefault();
    if (!gradeImportRows.length) {
      setGradeImportMessage('اختر ملفاً يحتوي أسماء الطلاب ودرجاتهم أولاً');
      return;
    }
    if (!gradeImportClassId || !gradeImportSubject.trim() || !gradeImportExam.trim()) {
      setGradeImportMessage('اختر الصف والشعبة وأدخل المادة واسم الاختبار');
      return;
    }

    setIsGradeImporting(true);
    setGradeImportMessage('');
    try {
      const schoolClass = schoolClasses.find((item) => String(item.id) === gradeImportClassId);
      if (!schoolClass) throw new Error('الصف والشعبة المحددان غير موجودين');
      const result = await fetchJson('/grades/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade_level: schoolClass.grade_level,
          section: schoolClass.section,
          subject: gradeImportSubject,
          exam_name: gradeImportExam,
          max_score: Number(gradeImportMaxScore),
          students: gradeImportRows
        })
      });
      if (!result.success) throw new Error(result.message || 'تعذر حفظ درجات الطلاب');

      setGradeImportMessage(result.message);
      setGradeImportRows([]);
      setGradeImportExam('');
      await refreshData();
    } catch (error) {
      setGradeImportMessage(error.message || 'تعذر حفظ درجات الطلاب');
    } finally {
      setIsGradeImporting(false);
    }
  };

  const markStudentAttendance = async (student, status) => {
    const data = await fetchJson('/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: Number(student.id),
        date: form.attendanceDate,
        status,
        notes: ''
      })
    });
    if (!data.success) {
      alert(data.message || 'تعذر حفظ الحضور');
      return;
    }
    await refreshData();
  };

  const loadStudentReport = async (student) => {
    const data = await fetchJson(`/reports/students/${student.id}`);
    if (!data.success) {
      alert(data.message || 'تعذر تحميل تقرير الطالب');
      return;
    }
    setStudentReport(data.report);
  };

  const handleAbsenceThresholdChange = async (event) => {
    event.preventDefault();
    const data = await fetchJson(`/reports/frequent-absences?minimum=${minimumAbsences}`);
    if (!data.success) {
      alert(data.message || 'تعذر تحميل تقرير الغياب المتكرر');
      return;
    }
    setFrequentAbsentees(data.students || []);
  };

  const createDatabaseBackup = async () => {
    const data = await fetchJson('/backups/create', { method: 'POST' });
    if (!data.success) {
      alert(data.message || 'تعذر إنشاء النسخة الاحتياطية');
      return;
    }
    setDatabaseBackups(data.backups || []);
  };

  const downloadDatabaseBackup = async (name) => {
    const response = await fetch(`${API}/backups/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const data = await response.json();
      alert(data.message || 'تعذر تنزيل النسخة الاحتياطية');
      return;
    }

    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportStudentReport = () => {
    if (!studentReport) return;
    const headers = ['اسم الطالب', 'الصف', 'الشعبة', 'المادة', 'الاختبار', 'الدرجة', 'عدد الغيابات', 'تواريخ الغياب'];
    const report = studentReport;
    const rows = report.grades.length
      ? report.grades.map((grade) => [
        report.student.name,
        report.student.grade_level,
        report.student.section || 'غير محدد',
        grade.subject,
        grade.exam_name,
        `${grade.score} / ${grade.max_score}`,
        report.absenceCount,
        report.absenceDates.join('، ')
      ])
      : [[
        report.student.name,
        report.student.grade_level,
        report.student.section || 'غير محدد',
        '',
        '',
        '',
        report.absenceCount,
        report.absenceDates.join('، ')
      ]];
    downloadCsv(`student-report-${report.student.id}.csv`, [headers, ...rows]);
  };

  const exportFrequentAbsentees = () => {
    const rows = [
      ['اسم الطالب', 'الصف', 'الشعبة', 'عدد أيام الغياب', 'تواريخ الغياب'],
      ...frequentAbsentees.map((student) => [
        student.name,
        student.grade_level,
        student.section || 'غير محدد',
        Number(student.absence_count),
        student.absence_dates || ''
      ])
    ];
    downloadCsv('frequent-absences.csv', rows);
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

  const handleCreateTeacherAccount = async (event) => {
    event.preventDefault();
    const data = await fetchJson('/users/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacherAccount)
    });
    if (!data.success) {
      setTeacherAccountMessage(data.message || 'تعذر إنشاء حساب المعلم');
      return;
    }

    setTeacherAccount({ name: '', username: '', email: '', password: '' });
    setTeacherAccountMessage(`تم إنشاء حساب المعلم ${data.teacher.name} بنجاح`);
    await refreshData();
  };

  const handleDeleteTeacherAccount = async (teacher) => {
    if (!window.confirm(`إلغاء حساب دخول المعلم ${teacher.name}؟`)) return;
    const data = await fetchJson(`/users/teachers/${teacher.id}`, { method: 'DELETE' });
    if (!data.success) {
      setTeacherAccountMessage(data.message || 'تعذر إلغاء حساب المعلم');
      return;
    }
    setTeacherAccountMessage(`تم إلغاء حساب ${teacher.name}`);
    await refreshData();
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
            <p>ارفع CSV أو TSV أو TXT أو Excel XLSX. اختر صفاً وشعبة لتعيينها لكل الأسماء، أو اتركها فارغة لاستخدام بيانات الملف.</p>
          </div>
          <div className="student-import-actions">
            <select value={importClassId} onChange={(event) => setImportClassId(event.target.value)}>
              <option value="">استخدم الصف والشعبة من الملف</option>
              {schoolClasses.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.grade_level} - شعبة {schoolClass.section}
                </option>
              ))}
            </select>
            <label className="file-upload-button">
              {isImporting ? 'جارٍ الاستيراد...' : '📁 اختيار ملف'}
              <input type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,text/plain,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleImportStudents} disabled={isImporting} />
            </label>
            <a
              className="template-download"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent('\uFEFFname,grade_level,section,guardian_name,guardian_phone\nأحمد علي,الأول متوسط,أ,علي محمد,07xxxxxxxx')}`}
              download="students-template.csv"
            >تحميل نموذج CSV</a>
          </div>
          {importMessage && <p className="import-message" role="status">{importMessage}</p>}
        </section>
      )}
      <form onSubmit={handleCreateStudent} className="module-form">
        <div className="row">
          <input placeholder="اسم الطالب" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
          <select
            value={form.gradeLevel}
            onChange={(e) => setForm({ ...form, gradeLevel: e.target.value, studentSection: '' })}
            required
          >
            <option value="">اختر الصف</option>
            {[...new Set(schoolClasses.map((schoolClass) => schoolClass.grade_level))].map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <select
            value={form.studentSection}
            onChange={(e) => setForm({ ...form, studentSection: e.target.value })}
            required
            disabled={!form.gradeLevel}
          >
            <option value="">اختر الشعبة</option>
            {schoolClasses.filter((schoolClass) => schoolClass.grade_level === form.gradeLevel).map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.section}>{schoolClass.section}</option>
            ))}
          </select>
          {schoolClasses.length === 0 && isAdmin && (
            <button type="button" className="text-action" onClick={() => setSection('classes')}>أضف صفاً وشعبة أولاً</button>
          )}
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
          <tr><th>الاسم</th><th>الصف</th><th>الشعبة</th><th>ولي الأمر</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id}>
              <td>{student.name}</td>
              <td>{student.grade_level}</td>
              <td>{student.section || 'غير محدد'}</td>
              <td>{student.guardian_name || '-'}</td>
              <td>{student.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const selectedAttendanceClass = schoolClasses.find((schoolClass) => String(schoolClass.id) === attendanceClassId);
  const attendanceMatches = students.filter((student) => {
    const matchesName = `${student.name} ${student.grade_level} ${student.section || ''}`
      .toLocaleLowerCase('ar').includes(attendanceSearch.trim().toLocaleLowerCase('ar'));
    const matchesClass = !selectedAttendanceClass
      || (student.grade_level === selectedAttendanceClass.grade_level && (student.section || 'غير محدد') === selectedAttendanceClass.section);
    return matchesName && matchesClass;
  }).slice(0, 30);

  const renderAttendance = () => (
    <div className="module-box">
      <section className="attendance-register">
        <div className="section-heading">
          <div>
            <h3>تسجيل الحضور والغياب</h3>
            <p>ابحث عن الطالب، ثم اضغط × لتسجيل غيابه في التاريخ المحدد.</p>
          </div>
          <label className="attendance-date-field">التاريخ
          <input type="date" value={form.attendanceDate} onChange={(e) => setForm({ ...form, attendanceDate: e.target.value })} />
          </label>
        </div>
        <div className="row attendance-filters">
          <input
            type="search"
            value={attendanceSearch}
            placeholder="اكتب اسم الطالب للبحث"
            autoComplete="off"
            onChange={(event) => setAttendanceSearch(event.target.value)}
          />
          <select value={attendanceClassId} onChange={(event) => setAttendanceClassId(event.target.value)}>
            <option value="">كل الصفوف والشعب</option>
            {schoolClasses.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.grade_level} - شعبة {schoolClass.section}</option>
            ))}
          </select>
        </div>
        <div className="attendance-roster">
          {attendanceMatches.length ? attendanceMatches.map((student) => {
            const record = attendance.find((entry) => Number(entry.student_id) === Number(student.id) && entry.date === form.attendanceDate);
            const absent = record?.status === 'absent';
            return (
              <div className={`attendance-student ${absent ? 'is-absent' : ''}`} key={student.id}>
                <div>
                  <strong>{student.name}</strong>
                  <span>{student.grade_level} · شعبة {student.section || 'غير محدد'}</span>
                </div>
                <span className={`attendance-status ${absent ? 'status-absent' : record ? 'status-present' : ''}`}>
                  {absent ? 'غائب' : record?.status === 'late' ? 'متأخر' : record ? 'حاضر' : 'غير مسجل'}
                </span>
                <button
                  type="button"
                  className={`absence-toggle ${absent ? 'mark-present' : ''}`}
                  aria-label={absent ? `إلغاء غياب ${student.name}` : `تسجيل غياب ${student.name}`}
                  title={absent ? 'إلغاء الغياب وتسجيل الحضور' : 'تسجيل غياب'}
                  onClick={() => markStudentAttendance(student, absent ? 'present' : 'absent')}
                >{absent ? '✓' : '×'}</button>
              </div>
            );
          }) : (
            <div className="empty">{students.length ? 'لا يوجد طالب مطابق للبحث' : 'أضف الطلاب أولاً لتسجيل الحضور'}</div>
          )}
          {attendanceMatches.length === 30 && <p className="attendance-limit">تظهر أول 30 نتيجة؛ اكتب اسماً أدق للبحث.</p>}
        </div>
      </section>

      <table className="data-table">
        <thead>
          <tr><th>الطالب</th><th>الصف والشعبة</th><th>التاريخ</th><th>الحالة</th><th>ملاحظات</th></tr>
        </thead>
        <tbody>
          {attendance.map((row) => (
            <tr key={row.id}>
              <td>{row.student_name}</td>
              <td>{row.grade_level} - {row.section || 'غير محدد'}</td>
              <td>{row.date}</td>
              <td>{row.status === 'absent' ? 'غائب' : row.status === 'late' ? 'متأخر' : 'حاضر'}</td>
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
        <section className="teacher-account-box">
          <h4>إنشاء حساب دخول لمعلم</h4>
          <p>سيستخدم المعلم هذه البيانات لتسجيل الدخول ورفع قوائم الطلاب والدرجات.</p>
          <form className="module-form" onSubmit={handleCreateTeacherAccount}>
            <div className="row">
              <input required maxLength="160" placeholder="اسم المعلم" value={teacherAccount.name} onChange={(event) => setTeacherAccount({ ...teacherAccount, name: event.target.value })} />
              <input required minLength="3" maxLength="40" pattern="[A-Za-z0-9._-]+" placeholder="اسم المستخدم (إنجليزي)" value={teacherAccount.username} onChange={(event) => setTeacherAccount({ ...teacherAccount, username: event.target.value })} />
            </div>
            <div className="row">
              <input required type="email" placeholder="البريد الإلكتروني" value={teacherAccount.email} onChange={(event) => setTeacherAccount({ ...teacherAccount, email: event.target.value })} />
              <input required type="password" minLength="8" maxLength="200" placeholder="كلمة المرور (8 أحرف على الأقل)" value={teacherAccount.password} onChange={(event) => setTeacherAccount({ ...teacherAccount, password: event.target.value })} />
            </div>
            <button type="submit">إنشاء حساب المعلم</button>
          </form>
          {teacherAccountMessage && <p className="import-message" role="status">{teacherAccountMessage}</p>}
          {teacherAccounts.length > 0 && (
            <div className="teacher-account-list">
              <h5>حسابات المعلمين</h5>
              {teacherAccounts.map((teacher) => (
                <div className="teacher-account-row" key={teacher.id}>
                  <div><strong>{teacher.name}</strong><span>{teacher.username} · {teacher.email}</span></div>
                  <button type="button" onClick={() => handleDeleteTeacherAccount(teacher)}>إلغاء الحساب</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
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

      <section className="frequent-absence-report">
        <div className="frequent-absence-heading">
          <div>
            <h4>الطلاب كثيرو الغياب</h4>
            <p>قائمة الطلاب الذين بلغ غيابهم الحد المحدد أو تجاوزه.</p>
          </div>
          <button type="button" onClick={exportFrequentAbsentees} disabled={!frequentAbsentees.length}>
            تنزيل القائمة بصيغة Excel CSV
          </button>
        </div>
        <form className="absence-threshold-form" onSubmit={handleAbsenceThresholdChange}>
          <label htmlFor="absence-threshold">حدّ الغياب (أيام)</label>
          <input
            id="absence-threshold"
            type="number"
            min="1"
            max="366"
            required
            value={minimumAbsences}
            onChange={(event) => setMinimumAbsences(Number(event.target.value))}
          />
          <button type="submit">تحديث القائمة</button>
        </form>
        {frequentAbsentees.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>اسم الطالب</th><th>الصف والشعبة</th><th>عدد الغيابات</th><th>تواريخ الغياب</th></tr></thead>
              <tbody>
                {frequentAbsentees.map((student) => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.grade_level} · {student.section || 'غير محدد'}</td>
                    <td><strong className="absence-count">{student.absence_count}</strong></td>
                    <td>{student.absence_dates || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="report-empty">لا يوجد طالب بلغ حد الغياب الحالي ({minimumAbsences} أيام).</p>}
      </section>

      <section className="student-report-search">
        <div>
          <h4>تقرير طالب</h4>
          <p>ابحث بالاسم لعرض الصف والشعبة والدرجات وسجل الغياب.</p>
        </div>
        <input
          type="search"
          value={reportSearch}
          placeholder="اكتب اسم الطالب"
          onChange={(event) => setReportSearch(event.target.value)}
        />
        {reportSearch.trim() && (
          <div className="report-search-results">
            {students.filter((student) =>
              student.name.toLocaleLowerCase('ar').includes(reportSearch.trim().toLocaleLowerCase('ar'))
            ).slice(0, 10).map((student) => (
              <button type="button" key={student.id} onClick={() => loadStudentReport(student)}>
                <strong>{student.name}</strong>
                <span>{student.grade_level} · شعبة {student.section || 'غير محدد'}</span>
              </button>
            ))}
            {!students.some((student) =>
              student.name.toLocaleLowerCase('ar').includes(reportSearch.trim().toLocaleLowerCase('ar'))
            ) && <span className="empty">لا يوجد طالب بهذا الاسم</span>}
          </div>
        )}
      </section>

      {studentReport && (
        <section className="student-report-print">
          <div className="report-title-row">
            <div>
              <span className="report-eyebrow">منظومة إدارة المدارس</span>
              <h2>التقرير الدراسي للطالب</h2>
            </div>
            <div className="report-actions">
              <button type="button" className="export-report-button" onClick={exportStudentReport}>تنزيل Excel CSV</button>
              <button type="button" className="print-report-button" onClick={() => window.print()}>طباعة / PDF</button>
            </div>
          </div>
          <div className="student-report-summary">
            <div><span>اسم الطالب</span><strong>{studentReport.student.name}</strong></div>
            <div><span>الصف</span><strong>{studentReport.student.grade_level}</strong></div>
            <div><span>الشعبة</span><strong>{studentReport.student.section || 'غير محدد'}</strong></div>
            <div><span>عدد أيام الغياب</span><strong className="absence-count">{studentReport.absenceCount}</strong></div>
          </div>

          <div className="report-section">
            <h3>درجات المواد الدراسية</h3>
            {studentReport.grades.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>المادة</th><th>الاختبار</th><th>الدرجة</th><th>التاريخ</th></tr></thead>
                  <tbody>
                    {studentReport.grades.map((grade) => (
                      <tr key={grade.id}>
                        <td>{grade.subject}</td>
                        <td>{grade.exam_name}</td>
                        <td>{grade.score} / {grade.max_score}</td>
                        <td>{grade.created_at?.slice(0, 10) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="report-empty">لا توجد درجات مسجلة لهذا الطالب.</p>}
          </div>

          <div className="report-section">
            <h3>سجل الغيابات</h3>
            {studentReport.absenceDates.length
              ? <p className="absence-dates">{studentReport.absenceDates.join(' · ')}</p>
              : <p className="report-empty">لا توجد غيابات مسجلة.</p>}
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="database-backup-panel">
          <div className="frequent-absence-heading">
            <div>
              <h4>النسخ الاحتياطية</h4>
              <p>نسخة تلقائية كل 24 ساعة أثناء تشغيل الخادم، مع الاحتفاظ بآخر 30 نسخة.</p>
            </div>
            <button type="button" onClick={createDatabaseBackup}>إنشاء نسخة الآن</button>
          </div>
          {databaseBackups.length ? (
            <div className="backup-list">
              {databaseBackups.map((backup) => (
                <div className="backup-row" key={backup.name}>
                  <div>
                    <strong>{new Date(backup.createdAt).toLocaleString('ar-IQ')}</strong>
                    <span>{(backup.size / 1024).toFixed(1)} كيلوبايت</span>
                  </div>
                  <button type="button" onClick={() => downloadDatabaseBackup(backup.name)}>تنزيل نسخة قاعدة البيانات</button>
                </div>
              ))}
            </div>
          ) : <p className="report-empty">لم تُنشأ نسخة احتياطية بعد.</p>}
        </section>
      )}
    </div>
  );

  const renderClasses = () => (
    <div className="module-box">
      <div className="section-heading">
        <div>
          <h3>إدارة الصفوف والشُعب</h3>
          <p>{isAdmin ? 'أضف الصف الدراسي ثم أنشئ الشُعب التابعة له.' : 'اختر الصف والشعبة لرفع قائمة طلابك.'}</p>
        </div>
        <span>{schoolClasses.length} شعبة</span>
      </div>
      {isAdmin && (
        <form onSubmit={handleCreateClass} className="module-form class-create-form">
          <div className="row">
            <input
              required
              maxLength="100"
              placeholder="اسم الصف (مثال: الأول متوسط)"
              value={form.newClassGrade}
              onChange={(event) => setForm({ ...form, newClassGrade: event.target.value })}
            />
            <input
              required
              maxLength="60"
              placeholder="اسم الشعبة (مثال: أ)"
              value={form.newClassSection}
              onChange={(event) => setForm({ ...form, newClassSection: event.target.value })}
            />
          </div>
          <button type="submit">إضافة الصف والشعبة</button>
          {classMessage && <p className="import-message" role="status">{classMessage}</p>}
        </form>
      )}

      <section className="student-import-box class-roster-import">
        <div>
          <h4>رفع قائمة طلاب للشعبة</h4>
          <p>اختر الصف والشعبة وارفع ملف CSV أو Excel يحتوي أسماء الطلاب. تُسجّل الأسماء الجديدة في الشعبة المحددة.</p>
        </div>
        <div className="student-import-actions">
          <select
            aria-label="اختر الصف والشعبة لقائمة الطلاب"
            value={importClassId}
            onChange={(event) => setImportClassId(event.target.value)}
            required
          >
            <option value="">اختر الصف والشعبة</option>
            {schoolClasses.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.grade_level} - شعبة {schoolClass.section}
              </option>
            ))}
          </select>
          <label className="file-upload-button">
            {isImporting ? 'جارٍ رفع القائمة...' : '📁 اختيار قائمة الطلاب'}
            <input
              type="file"
              accept=".csv,.tsv,.txt,.xlsx"
              disabled={isImporting || !importClassId}
              onChange={handleImportStudents}
            />
          </label>
        </div>
        {importMessage && <p className="import-message" role="status">{importMessage}</p>}
      </section>

      <div className="class-list">
        {schoolClasses.length ? schoolClasses.map((schoolClass) => (
          editingClassId === schoolClass.id ? (
            <form className="class-card class-edit-form" key={schoolClass.id} onSubmit={(event) => handleUpdateClass(event, schoolClass)}>
              <input required maxLength="100" aria-label="اسم الصف" value={editingClassGrade} onChange={(event) => setEditingClassGrade(event.target.value)} />
              <input required maxLength="60" aria-label="اسم الشعبة" value={editingClassSection} onChange={(event) => setEditingClassSection(event.target.value)} />
              <button type="submit" className="save-class-button">حفظ</button>
              <button type="button" className="cancel-class-button" onClick={() => setEditingClassId(null)}>إلغاء</button>
            </form>
          ) : (
            <article className="class-card" key={schoolClass.id}>
              <div>
                <strong>{schoolClass.grade_level}</strong>
                <span>شعبة {schoolClass.section}</span>
              </div>
              <span className="class-student-count">{schoolClass.student_count} طالب</span>
              {isAdmin && (
                <div className="class-actions">
                  <button type="button" className="edit-class-button" onClick={() => beginEditClass(schoolClass)}>تعديل</button>
                  <button
                    type="button"
                    className="delete-class-button"
                    disabled={Number(schoolClass.student_count) > 0}
                    title={Number(schoolClass.student_count) ? 'انقل الطلاب إلى شعبة أخرى قبل الحذف' : 'حذف الشعبة'}
                    onClick={() => handleDeleteClass(schoolClass)}
                  >حذف</button>
                </div>
              )}
            </article>
          )
        )) : <div className="empty">لا توجد صفوف أو شُعب بعد. أضف أول صف وشعبة للبدء.</div>}
      </div>
    </div>
  );

  const renderGradeImport = () => (
    <div className="module-box">
      <h3>استيراد درجات الطلاب</h3>
      <section className="grade-import-guide">
        <p>اختر الصف والشعبة والمادة، ثم ارفع ملفاً يحتوي عمودي <strong>name</strong> و<strong>score</strong> أو «اسم الطالب» و«الدرجة». إذا لم يكن الاسم موجوداً في الشعبة، يُضاف طالب جديد، وتُحفظ درجته.</p>
        <a
          className="template-download"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent('\uFEFFname,score\nأحمد علي,85\nفاطمة حسن,92')}`}
          download="student-grades-template.csv"
        >تحميل نموذج الدرجات</a>
      </section>

      <form className="module-form grade-import-form" onSubmit={handleImportGrades}>
        <div className="row">
          <select value={gradeImportClassId} onChange={(event) => setGradeImportClassId(event.target.value)} required>
            <option value="">اختر الصف والشعبة</option>
            {schoolClasses.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.grade_level} - شعبة {schoolClass.section}
              </option>
            ))}
          </select>
          <input
            required
            maxLength="100"
            placeholder="المادة (مثال: الرياضيات)"
            value={gradeImportSubject}
            onChange={(event) => setGradeImportSubject(event.target.value)}
          />
        </div>
        <div className="row">
          <input
            required
            maxLength="100"
            placeholder="اسم الاختبار أو الفصل"
            value={gradeImportExam}
            onChange={(event) => setGradeImportExam(event.target.value)}
          />
          <input
            required
            type="number"
            min="0.01"
            step="any"
            placeholder="الدرجة النهائية"
            value={gradeImportMaxScore}
            onChange={(event) => setGradeImportMaxScore(event.target.value)}
          />
        </div>
        <label className="grade-file-picker">
          {gradeImportRows.length ? `تم تجهيز ${gradeImportRows.length} درجة · اختر ملفاً آخر للتبديل` : '📁 اختر ملف CSV أو Excel للدرجات'}
          <input type="file" accept=".csv,.tsv,.txt,.xlsx" onChange={handleGradeImportFile} />
        </label>
        {gradeImportRows.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>اسم الطالب</th><th>الدرجة</th></tr></thead>
              <tbody>
                {gradeImportRows.slice(0, 10).map((row, index) => (
                  <tr key={`${row.name}-${index}`}><td>{row.name}</td><td>{row.score} / {gradeImportMaxScore || '-'}</td></tr>
                ))}
              </tbody>
            </table>
            {gradeImportRows.length > 10 && <p className="report-empty">معاينة أول 10 طلاب من أصل {gradeImportRows.length}.</p>}
          </div>
        )}
        <button type="submit" disabled={isGradeImporting || !gradeImportRows.length}>
          {isGradeImporting ? 'جارٍ حفظ الدرجات...' : 'حفظ درجات الصف والشعبة'}
        </button>
        {gradeImportMessage && <p className="import-message" role="status">{gradeImportMessage}</p>}
      </form>
    </div>
  );

  const renderDashboard = () => (
    <div className="dashboard-home">
      <div className="stats-grid dashboard-stats">
        <div className="stat-card stat-students"><span>الطلاب المسجلين</span><strong>{overview.studentCount ?? 0}</strong><small>إجمالي سجل الطلاب</small></div>
        <div className="stat-card stat-attendance"><span>الصفوف والشُعب</span><strong>{schoolClasses.length}</strong><small>إجمالي الشعب المسجلة</small></div>
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
          <div className="auth-emblem" aria-hidden="true">🏛️</div>
          <h1>منظومة إدارة المدارس</h1>
          <p className="auth-subtitle">النظام الذكي</p>
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
          <footer className="auth-footer">© 2026 النظام الذكي</footer>
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
              <button onClick={() => setSection('classes')} className={section === 'classes' ? 'active' : ''}><span>🏫</span> الشعب والصفوف</button>
              <button onClick={() => setSection('attendance')} className={section === 'attendance' ? 'active' : ''}><span>▤</span> سجل الحضور والغياب</button>
              <span className="nav-label">الشؤون الأكاديمية</span>
              <button onClick={() => setSection('grades')} className={section === 'grades' ? 'active' : ''}><span>▧</span> سجل الدرجات</button>
              <button onClick={() => setSection('grade-import')} className={section === 'grade-import' ? 'active' : ''}><span>📥</span> استيراد درجات الطلبة</button>
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
                <strong>{section === 'dashboard' ? 'لوحة القيادة' : section === 'students' ? 'إدارة الطلبة' : section === 'classes' ? 'الصفوف والشُعب' : section === 'attendance' ? 'سجل الحضور والغياب' : section === 'grades' ? 'سجل الدرجات' : section === 'grade-import' ? 'استيراد درجات الطلبة' : section === 'staff' ? 'الكادر التدريسي' : section === 'exams' ? 'جدول الامتحانات' : section === 'reports' ? 'التقارير' : tab === 'teachers' ? 'قنوات المعلمين' : tab === 'public' ? 'الإعلانات العامة' : 'المنشورات والإعلانات'}</strong>
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
                {section === 'classes' && renderClasses()}
                {section === 'attendance' && renderAttendance()}
                {section === 'grades' && renderGrades()}
                {section === 'grade-import' && renderGradeImport()}
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
