import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = process.env.BUDGET_DATABASE_PATH || path.join(dataDir, 'budgeting.db');
mkdirSync(path.dirname(dbPath), { recursive: true });

function run(sql: string) {
  return execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' });
}
export const quote = (value: unknown) => `'${String(value ?? '').replaceAll("'", "''")}'`;
export function initDb() {
  run(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS budget_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, year INTEGER NOT NULL, month TEXT NOT NULL, department TEXT NOT NULL, category TEXT NOT NULL, budget REAL NOT NULL, actual REAL NOT NULL, description TEXT DEFAULT '', department_code TEXT DEFAULT '', subcategory TEXT DEFAULT '', transaction_date TEXT DEFAULT '', pic TEXT DEFAULT '', cost_center TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(year,month,department,category));
    CREATE TABLE IF NOT EXISTS budget_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, request_date TEXT NOT NULL, department TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT NOT NULL, pic TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Draft', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS master_departments (code TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS master_categories (code TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, active INTEGER NOT NULL DEFAULT 1);`);
}
export function query<T>(sql: string): T[] {
  initDb();
  const output = execFileSync('sqlite3', ['-json', dbPath, sql], { encoding: 'utf8' }).trim();
  return output ? JSON.parse(output) as T[] : [];
}
export function execute(sql: string) { initDb(); run(sql); }
export { dbPath };
