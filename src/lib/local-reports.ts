import type { ReportType } from "@/lib/reports";

export type Company = "1001" | "maison_y";
export const COMPANY_LABELS: Record<Company, string> = {
  "1001": "1001",
  maison_y: "Maison Y",
};
export type ReportRow = Record<string, unknown>;
export type LocalImport = {
  id: string;
  company: Company;
  reportType: ReportType;
  fileName: string;
  sheetName: string;
  rowCount: number;
  createdAt: string;
  storageMode: "local";
};

export const IMPORT_HISTORY_KEY = "budgeting_import_history";
export const localKey = (company: Company, reportType: ReportType) =>
  `budgeting_report_${company}_${reportType}`;
const legacyKey = (reportType: ReportType) => `budgeting_report_${reportType}`;
const available = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";
function read<T>(key: string, fallback: T): T {
  if (!available()) return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Old, unscoped imports belong to 1001. Copy only when the new key is absent so
// existing browser data survives and the migration cannot duplicate rows.
function migrateLegacy(reportType: ReportType) {
  if (!available()) return;
  const target = localKey("1001", reportType);
  if (localStorage.getItem(target) === null) {
    const legacy = localStorage.getItem(legacyKey(reportType));
    if (legacy !== null) localStorage.setItem(target, legacy);
  }
}
export function getLocalRows(company: Company, reportType: ReportType) {
  if (company === "1001") migrateLegacy(reportType);
  return read<ReportRow[]>(localKey(company, reportType), []);
}
export function getLocalHistory(company?: Company) {
  const items = read<
    Array<Omit<LocalImport, "company"> & { company?: Company }>
  >(IMPORT_HISTORY_KEY, []).map(
    (x) => ({ ...x, company: x.company ?? "1001" }) as LocalImport,
  );
  return company ? items.filter((x) => x.company === company) : items;
}

export function saveLocalImport(
  input: {
    company: Company;
    reportType: ReportType;
    fileName: string;
    sheetName: string;
    rows: ReportRow[];
  },
  strategy: "replace" | "new",
) {
  if (!available()) throw new Error("Penyimpanan browser tidak tersedia.");
  const id = crypto?.randomUUID?.() ?? `local-${Date.now()}`;
  const batch = input.rows.map((row) => ({ ...row, __localImportId: id }));
  const existing = getLocalRows(input.company, input.reportType);
  const history = getLocalHistory();
  const item: LocalImport = {
    id,
    company: input.company,
    reportType: input.reportType,
    fileName: input.fileName,
    sheetName: input.sheetName,
    rowCount: batch.length,
    createdAt: new Date().toISOString(),
    storageMode: "local",
  };
  localStorage.setItem(
    localKey(input.company, input.reportType),
    JSON.stringify(strategy === "replace" ? batch : [...existing, ...batch]),
  );
  localStorage.setItem(
    IMPORT_HISTORY_KEY,
    JSON.stringify([
      item,
      ...(strategy === "replace"
        ? history.filter(
            (x) =>
              x.company !== input.company || x.reportType !== input.reportType,
          )
        : history),
    ]),
  );
  window.dispatchEvent(new CustomEvent("budgeting-local-data-changed"));
  return item;
}
export function removeLocalImport(id: string) {
  if (!available()) return;
  const history = getLocalHistory();
  const item = history.find((x) => x.id === id);
  if (!item) return;
  const rows = getLocalRows(item.company, item.reportType).filter(
    (row) => row.__localImportId !== id,
  );
  localStorage.setItem(
    localKey(item.company, item.reportType),
    JSON.stringify(rows),
  );
  localStorage.setItem(
    IMPORT_HISTORY_KEY,
    JSON.stringify(history.filter((x) => x.id !== id)),
  );
  window.dispatchEvent(new CustomEvent("budgeting-local-data-changed"));
}
