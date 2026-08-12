import type { ReportType } from '@/lib/reports';

export type ReportRow = Record<string, unknown>;
export type LocalImport = {
  id: string;
  reportType: ReportType;
  fileName: string;
  sheetName: string;
  rowCount: number;
  createdAt: string;
  storageMode: 'local';
};

export const IMPORT_HISTORY_KEY = 'budgeting_import_history';
export const localKey = (reportType: ReportType) => `budgeting_report_${reportType}`;
const available = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function read<T>(key: string, fallback: T): T {
  if (!available()) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export const getLocalRows = (reportType: ReportType) => read<ReportRow[]>(localKey(reportType), []);
export const getLocalHistory = () => read<LocalImport[]>(IMPORT_HISTORY_KEY, []);

export function saveLocalImport(input: Omit<LocalImport, 'id' | 'createdAt' | 'rowCount' | 'storageMode'> & { rows: ReportRow[] }, strategy: 'replace' | 'new') {
  if (!available()) throw new Error('Penyimpanan browser tidak tersedia.');
  const id = globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const batch = input.rows.map(row => ({ ...row, __localImportId: id }));
  const existing = getLocalRows(input.reportType);
  const oldHistory = getLocalHistory();
  const item: LocalImport = { id, reportType: input.reportType, fileName: input.fileName, sheetName: input.sheetName, rowCount: batch.length, createdAt: new Date().toISOString(), storageMode: 'local' };
  window.localStorage.setItem(localKey(input.reportType), JSON.stringify(strategy === 'replace' ? batch : [...existing, ...batch]));
  window.localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify([item, ...(strategy === 'replace' ? oldHistory.filter(x => x.reportType !== input.reportType) : oldHistory)]));
  window.dispatchEvent(new CustomEvent('budgeting-local-data-changed'));
  return item;
}

export function removeLocalImport(id: string) {
  if (!available()) return;
  const history = getLocalHistory();
  const item = history.find(entry => entry.id === id);
  if (!item) return;
  const rows = getLocalRows(item.reportType).filter(row => row.__localImportId !== id);
  window.localStorage.setItem(localKey(item.reportType), JSON.stringify(rows));
  window.localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(history.filter(entry => entry.id !== id)));
  window.dispatchEvent(new CustomEvent('budgeting-local-data-changed'));
}
