# منظومة إدارة المدارس

مشروع كامل لإدارة المدرسة، يتكون من واجهة React/Vite وخادم Express وقاعدة بيانات SQLite عبر `sql.js`.

## بنية المشروع

- `client/`: الواجهة الحالية، ملفات المصدر في `src/` ومخرجات البناء في `dist/`.
- `server/`: واجهة API والمصادقة وقاعدة البيانات.
- `server/data/`: قاعدة البيانات المحلية، ولا تُرفع إلى Git.
- `legacy/`: نسخة HTML/CSS/JavaScript القديمة المحفوظة للأرشفة، وليست مدخل التطبيق الحالي.
- `logs/`: سجلات البناء والتشخيص.

## التشغيل على Windows

```powershell
npm.cmd install
npm.cmd --prefix server install
npm.cmd --prefix client install
npm.cmd run dev
```

تعمل الواجهة عادة على `http://localhost:5173` وواجهة API على `http://localhost:4000`.

## البناء

```powershell
npm.cmd --prefix client run build
```

## استيراد الطلاب

تدعم صفحة سجل الطلاب ملفات CSV وTSV وTXT وExcel بصيغة XLSX. يمكن للملف أن يحتوي أسماء فقط، أو أعمدة الاسم والصف وبيانات ولي الأمر.

## الأدوار

التسجيل العام ينشئ حساب طالب للقراءة فقط. إدارة بيانات المدرسة متاحة للأدوار المخولة، ويتم التحقق من الصلاحيات في الخادم.
