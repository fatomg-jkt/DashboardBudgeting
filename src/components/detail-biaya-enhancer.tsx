"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, X } from "lucide-react";
import { detectHeaderRow, downloadTemplate } from "@/lib/import-utils";

type Company = "1001" | "maison_y";
type Sheet = { name: string; rows: string[][] };
type DetailRow = {
  deskripsi_coa: string;
  department: string;
  periode: string;
  anggaran: number;
  aktual: number;
};
type ApiRow = Record<string, unknown>;

type DepartmentPair = {
  department: string;
  budgetIndex: number;
  actualIndex: number;
};

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

const PERIODS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

const DEPARTMENTS = [
  "DEVELOPMENT",
  "FAT",
  "HRD",
  "MANAGEMENT KIKI",
  "MANAGEMENT UMA",
  "MARKETING",
  "MERCHANDISE",
  "OPERASIONAL",
  "PURCHASING",
  "WAREHOUSE",
] as const;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value ?? "")
    .trim()
    .replace(/^rp\s*/i, "")
    .replace(/%/g, "")
    .replace(/\s/g, "");
  if (!text || text === "-") return 0;
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/^\(|\)$/g, "");
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replaceAll(".", "").replace(",", ".");
  } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replaceAll(",", "");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function normalizeDepartment(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function inferDepartment(header: string) {
  return normalizeDepartment(
    header.replace(/\s*[-–—:]?\s*(aktual|actual|anggaran|budget)\s*$/i, ""),
  );
}

function normalizePeriod(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  const aliases: Record<string, string> = {
    jan: "Januari",
    januari: "Januari",
    january: "Januari",
    feb: "Februari",
    februari: "Februari",
    february: "Februari",
    mar: "Maret",
    maret: "Maret",
    march: "Maret",
    apr: "April",
    april: "April",
    mei: "Mei",
    may: "Mei",
    jun: "Juni",
    juni: "Juni",
    june: "Juni",
    jul: "Juli",
    juli: "Juli",
    july: "Juli",
    agu: "Agustus",
    agustus: "Agustus",
    aug: "Agustus",
    august: "Agustus",
    sep: "September",
    september: "September",
    okt: "Oktober",
    oktober: "Oktober",
    oct: "Oktober",
    october: "Oktober",
    nov: "November",
    november: "November",
    des: "Desember",
    desember: "Desember",
    dec: "Desember",
    december: "Desember",
  };
  if (aliases[raw]) return aliases[raw];
  for (const [alias, period] of Object.entries(aliases)) {
    if (raw.includes(alias)) return period;
  }
  return String(value ?? "").trim();
}

function discoverDepartmentPairs(headers: string[]): DepartmentPair[] {
  const normalized = headers.map(normalizeHeader);
  const map = new Map<string, { budgetIndex?: number; actualIndex?: number }>();

  normalized.forEach((header, index) => {
    const budgetMatch = header.match(/^(.*)_(anggaran|budget)$/);
    const actualMatch = header.match(/^(.*)_(aktual|actual)$/);
    if (budgetMatch?.[1]) {
      const department = normalizeDepartment(budgetMatch[1].replace(/_/g, " "));
      const current = map.get(department) ?? {};
      current.budgetIndex = index;
      map.set(department, current);
    }
    if (actualMatch?.[1]) {
      const department = normalizeDepartment(actualMatch[1].replace(/_/g, " "));
      const current = map.get(department) ?? {};
      current.actualIndex = index;
      map.set(department, current);
    }
  });

  return Array.from(map.entries())
    .filter(([, indexes]) => indexes.budgetIndex !== undefined && indexes.actualIndex !== undefined)
    .map(([department, indexes]) => ({
      department,
      budgetIndex: indexes.budgetIndex as number,
      actualIndex: indexes.actualIndex as number,
    }));
}

function parseSheet(sheet: Sheet, headerRow: number): DetailRow[] {
  const headers = (sheet.rows[headerRow] ?? []).map((value) => String(value ?? "").trim());
  const normalized = headers.map(normalizeHeader);
  const coaIndex = normalized.findIndex(
    (value) => value.includes("deskripsi") || value.includes("coa") || value === "description",
  );
  if (coaIndex < 0) return [];

  const periodIndex = normalized.findIndex((value) =>
    ["periode", "period", "bulan", "month"].includes(value),
  );
  const departmentIndex = normalized.findIndex((value) =>
    ["department", "departemen", "dept"].includes(value),
  );
  const genericBudgetIndex = normalized.findIndex((value) =>
    ["anggaran", "budget"].includes(value),
  );
  const genericActualIndex = normalized.findIndex((value) =>
    ["aktual", "actual"].includes(value),
  );

  const namedPairs = discoverDepartmentPairs(headers);
  const fallbackPeriod = normalizePeriod(sheet.name);
  const result: DetailRow[] = [];

  sheet.rows.slice(headerRow + 1).forEach((row) => {
    const coa = String(row[coaIndex] ?? "").trim();
    if (!coa) return;
    const periode =
      normalizePeriod(periodIndex >= 0 ? row[periodIndex] : "") || fallbackPeriod || "Semua Periode";

    if (departmentIndex >= 0 && genericBudgetIndex >= 0 && genericActualIndex >= 0) {
      const department = normalizeDepartment(row[departmentIndex]);
      if (department) {
        result.push({
          deskripsi_coa: coa,
          department,
          periode,
          anggaran: numberValue(row[genericBudgetIndex]),
          aktual: numberValue(row[genericActualIndex]),
        });
      }
    }

    namedPairs.forEach((pair) => {
      result.push({
        deskripsi_coa: coa,
        department: pair.department,
        periode,
        anggaran: numberValue(row[pair.budgetIndex]),
        aktual: numberValue(row[pair.actualIndex]),
      });
    });
  });

  return result.filter((row) => row.department.length > 0);
}

function parseAllSheets(sheets: Sheet[]) {
  return sheets.flatMap((sheet) => parseSheet(sheet, detectHeaderRow(sheet.rows)));
}

function fromApiRow(value: unknown): DetailRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as ApiRow;
  const deskripsi = String(row.deskripsi_coa ?? row.deskripsi ?? row.description ?? "").trim();
  const department = normalizeDepartment(row.department ?? row.departemen ?? "");
  if (!deskripsi || !department) return null;
  return {
    deskripsi_coa: deskripsi,
    department,
    periode: normalizePeriod(row.periode ?? row.bulan ?? row.month ?? "") || "Semua Periode",
    anggaran: numberValue(row.anggaran ?? row.budget),
    aktual: numberValue(row.aktual ?? row.actual),
  };
}

function isOverBudget(row: DetailRow) {
  return row.aktual > row.anggaran;
}

function DepartmentTable({ department, rows }: { department: string; rows: DetailRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gold-500/20 bg-zinc-950/80">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-blue-900 text-white">
          <tr>
            <th className="px-4 py-3 text-left">Deskripsi COA</th>
            <th className="px-4 py-3 text-right">{department} - Anggaran</th>
            <th className="px-4 py-3 text-right">{department} - Aktual</th>
            <th className="px-4 py-3 text-right">% Analisis Variance</th>
            <th className="px-4 py-3 text-left">Status Budget</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const variancePct = row.anggaran
              ? ((row.aktual - row.anggaran) / row.anggaran) * 100
              : row.aktual > 0
                ? 100
                : 0;
            const over = isOverBudget(row);
            return (
              <tr
                key={`${department}-${row.periode}-${row.deskripsi_coa}-${index}`}
                className="border-b border-zinc-800"
              >
                <td className="px-4 py-3">{row.deskripsi_coa}</td>
                <td className="px-4 py-3 text-right">{nf.format(row.anggaran)}</td>
                <td className="px-4 py-3 text-right">{nf.format(row.aktual)}</td>
                <td
                  className={
                    over
                      ? "px-4 py-3 text-right font-semibold text-red-400"
                      : "px-4 py-3 text-right font-semibold text-emerald-400"
                  }
                >
                  {pf.format(variancePct)}%
                </td>
                <td
                  className={
                    over
                      ? "px-4 py-3 font-semibold text-red-400"
                      : "px-4 py-3 font-semibold text-emerald-400"
                  }
                >
                  {over ? "Over Budget" : "Under Budget"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailTables({ rows, preview = false }: { rows: DetailRow[]; preview?: boolean }) {
  const grouped = new Map<string, DetailRow[]>();
  rows.forEach((row) => {
    const current = grouped.get(row.department) ?? [];
    current.push(row);
    grouped.set(row.department, current);
  });

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([department, departmentRows]) => (
        <div key={department} className="space-y-2">
          {grouped.size > 1 && <h3 className="font-semibold text-gold-300">{department}</h3>}
          <DepartmentTable
            department={department}
            rows={preview ? departmentRows.slice(0, 12) : departmentRows}
          />
        </div>
      ))}
    </div>
  );
}

function UploadModal({
  company,
  onClose,
  onSaved,
}: {
  company: Company;
  onClose: () => void;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const parsedRows = useMemo(() => parseAllSheets(sheets), [sheets]);
  const departmentCount = useMemo(
    () => new Set(parsedRows.map((row) => row.department)).size,
    [parsedRows],
  );

  async function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    setFile(nextFile);
    setBusy("Membaca seluruh sheet dan departemen...");
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", nextFile);
      const response = await fetch("/api/upload/preview", {
        method: "POST",
        body: formData,
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object") {
        throw new Error("File Excel gagal dibaca.");
      }
      const data = payload as { sheets?: Sheet[]; error?: string };
      if (!Array.isArray(data.sheets)) throw new Error(data.error || "File Excel gagal dibaca.");
      setSheets(data.sheets);
    } catch (caught) {
      setSheets([]);
      setError(caught instanceof Error ? caught.message : "File Excel gagal dibaca.");
    } finally {
      setBusy("");
    }
  }

  async function save(strategy: "cancel" | "replace" = "cancel") {
    if (!file || parsedRows.length === 0) return;
    setBusy("Menyimpan data semua departemen...");
    setError("");
    try {
      const response = await fetch("/api/report-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          reportType: "budget_detail_biaya",
          fileName: file.name,
          sheetName: sheets.length > 1 ? "Semua Sheet" : sheets[0]?.name ?? "Sheet1",
          headers: ["periode", "deskripsi_coa", "department", "anggaran", "aktual"],
          rows: parsedRows,
          strategy,
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      const data = payload && typeof payload === "object" ? (payload as { error?: string }) : {};

      if (response.status === 409 && strategy === "cancel") {
        if (window.confirm("Data Laporan Per Detail Biaya yang sama sudah ada. Ganti data tersebut?")) {
          await save("replace");
        }
        return;
      }
      if (!response.ok) throw new Error(data.error || "Data gagal disimpan.");
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal disimpan.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-4 md:p-10">
      <div className="mx-auto max-w-7xl rounded-2xl border border-gold-500/20 bg-zinc-950 p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Upload Laporan Per Detail Biaya</h2>
            <p className="text-sm text-zinc-400">
              Satu file dapat berisi seluruh departemen dan beberapa sheet.
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup">
            <X />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            className="secondary-button"
            onClick={() => downloadTemplate("budget_detail_biaya")}
          >
            Download Template
          </button>
          <button className="gold-button" onClick={() => inputRef.current?.click()}>
            Pilih File Excel
          </button>
          <input
            ref={inputRef}
            hidden
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </div>

        {busy && <p className="mt-4 text-gold-300">{busy}</p>}
        {error && <div className="error mt-4">{error}</div>}

        {sheets.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 rounded-xl border border-zinc-800 p-4 md:grid-cols-3">
              <div><span className="text-xs text-zinc-400">Sheet terbaca</span><p className="font-semibold">{sheets.length}</p></div>
              <div><span className="text-xs text-zinc-400">Departemen terbaca</span><p className="font-semibold">{departmentCount}</p></div>
              <div><span className="text-xs text-zinc-400">Total data</span><p className="font-semibold">{parsedRows.length} baris</p></div>
            </div>

            {parsedRows.length > 0 ? (
              <DetailTables rows={parsedRows} preview />
            ) : (
              <div className="error">
                Format belum dikenali. Gunakan Deskripsi COA dan pasangan kolom seperti DEVELOPMENT - Anggaran / DEVELOPMENT - Aktual. File boleh berisi pasangan kolom untuk semua departemen.
              </div>
            )}

            <div className="flex justify-end">
              <button
                disabled={busy.length > 0 || parsedRows.length === 0}
                className="gold-button disabled:opacity-40"
                onClick={() => save()}
              >
                {busy.startsWith("Menyimpan") ? "Menyimpan..." : "Import & Simpan Semua Departemen"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DetailBiayaEnhancer() {
  const [active, setActive] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [periodFilter, setPeriodFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [coaFilter, setCoaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const syncCompany = useCallback(() => {
    setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001");
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/reports?reportType=budget_detail_biaya&company=${company}`,
        { cache: "no-store" },
      );
      const payload: unknown = await response.json();
      if (!response.ok || !Array.isArray(payload)) {
        setRows([]);
        return;
      }
      setRows(
        payload
          .map(fromApiRow)
          .filter((row): row is DetailRow => row !== null),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    const enabled =
      window.location.pathname === "/budget-vs-actual" &&
      new URLSearchParams(window.location.search).get("view") === "detail-biaya";
    setActive(enabled);
    if (!enabled) return;

    syncCompany();
    const main = document.querySelector("main");
    const content = main?.children.item(1) as HTMLElement | null;
    if (content) {
      content.classList.add("detail-biaya-host");
      setHost(content);
    }

    const title = main?.querySelector("header h1");
    const previousTitle = title?.textContent ?? "";
    if (title) title.textContent = "Laporan Per Detail Biaya";

    const handleClick = () => window.setTimeout(syncCompany, 0);
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      content?.classList.remove("detail-biaya-host");
      if (title) title.textContent = previousTitle;
    };
  }, [syncCompany]);

  useEffect(() => {
    if (active) void loadRows();
  }, [active, loadRows]);

  useEffect(() => {
    setPeriodFilter("all");
    setDepartmentFilter("all");
    setCoaFilter("all");
    setStatusFilter("all");
  }, [company]);

  const coaOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.deskripsi_coa))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (periodFilter !== "all" && row.periode !== periodFilter) return false;
        if (departmentFilter !== "all" && row.department !== departmentFilter) return false;
        if (coaFilter !== "all" && row.deskripsi_coa !== coaFilter) return false;
        if (statusFilter === "over" && !isOverBudget(row)) return false;
        if (statusFilter === "under" && isOverBudget(row)) return false;
        return true;
      }),
    [rows, periodFilter, departmentFilter, coaFilter, statusFilter],
  );

  if (!active || !host) return null;

  return createPortal(
    <div className="detail-biaya-root space-y-6">
      <style>{`.detail-biaya-host > :not(.detail-biaya-root){display:none!important}`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Laporan Per Detail Biaya</h2>
          <p className="text-sm text-zinc-400">
            Deskripsi COA · [Departemen] Anggaran · [Departemen] Aktual · % Analisis Variance · Status Budget
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="secondary-button"
            onClick={() => downloadTemplate("budget_detail_biaya")}
          >
            Download Template
          </button>
          <button
            className="gold-button flex items-center gap-2"
            onClick={() => setModalOpen(true)}
          >
            <Upload className="h-4 w-4" /> Upload Excel
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs text-zinc-400">
            Periode
            <select
              className="input mt-1 w-full"
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value)}
            >
              <option value="all">Semua Periode</option>
              {PERIODS.map((period) => <option key={period} value={period}>{period}</option>)}
            </select>
          </label>

          <label className="text-xs text-zinc-400">
            Departemen
            <select
              className="input mt-1 w-full"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <option value="all">Semua Departemen</option>
              {DEPARTMENTS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-zinc-400">
            Deskripsi COA
            <select
              className="input mt-1 w-full"
              value={coaFilter}
              onChange={(event) => setCoaFilter(event.target.value)}
            >
              <option value="all">Semua Deskripsi COA</option>
              {coaOptions.map((coa) => <option key={coa} value={coa}>{coa}</option>)}
            </select>
          </label>

          <label className="text-xs text-zinc-400">
            Status Budget
            <select
              className="input mt-1 w-full"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="over">Over Budget</option>
              <option value="under">Under Budget</option>
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <p>Memuat data...</p>
      ) : rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gold-500/30 bg-zinc-950/60 p-12 text-center">
          <h2 className="text-xl font-semibold">Belum ada data Laporan Per Detail Biaya</h2>
          <p className="mt-2 text-zinc-400">
            Upload satu file Excel yang dapat berisi seluruh departemen.
          </p>
          <button className="gold-button mt-5" onClick={() => setModalOpen(true)}>
            Upload Excel
          </button>
        </section>
      ) : filteredRows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/60 p-10 text-center text-zinc-400">
          Tidak ada data yang sesuai dengan pilihan filter.
        </section>
      ) : (
        <DetailTables rows={filteredRows} />
      )}

      {modalOpen && (
        <UploadModal
          company={company}
          onClose={() => setModalOpen(false)}
          onSaved={() => void loadRows()}
        />
      )}
    </div>,
    host,
  );
}
