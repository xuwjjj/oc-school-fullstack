import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.join(__dirname, '..', 'data', 'school.db');
const backupsPath = path.join(__dirname, '..', 'data', 'backups');
const backupNamePattern = /^school-\d{8}T\d{9}Z\.db$/;
const backupsToKeep = 30;

function listDatabaseBackups() {
  if (!fs.existsSync(backupsPath)) return [];

  return fs.readdirSync(backupsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && backupNamePattern.test(entry.name))
    .map((entry) => {
      const filePath = path.join(backupsPath, entry.name);
      const stats = fs.statSync(filePath);
      return {
        name: entry.name,
        size: stats.size,
        createdAt: stats.mtime.toISOString()
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function createDatabaseBackup() {
  if (!fs.existsSync(databasePath)) {
    throw new Error('Cannot create a database backup because the database file does not exist');
  }

  fs.mkdirSync(backupsPath, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
  const name = `school-${timestamp}.db`;
  fs.copyFileSync(databasePath, path.join(backupsPath, name), fs.constants.COPYFILE_EXCL);

  const backups = listDatabaseBackups();
  for (const backup of backups.slice(backupsToKeep)) {
    fs.unlinkSync(path.join(backupsPath, backup.name));
  }

  return listDatabaseBackups();
}

function getDatabaseBackup(name) {
  if (typeof name !== 'string' || !backupNamePattern.test(name)) return null;
  const filePath = path.join(backupsPath, name);
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : null;
}

export { createDatabaseBackup, getDatabaseBackup, listDatabaseBackups };
