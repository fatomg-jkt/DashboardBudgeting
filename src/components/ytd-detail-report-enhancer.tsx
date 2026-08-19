"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Upload, X } from "lucide-react";
import { detectHeaderRow, downloadTemplate } from "@/lib/import-utils";

type Company = "1001" | "maison_y";
type Sheet = { name: string; rows: string[][] };
type ApiRow = Record<string, unknown>;

type YtdRow = {
  perusahaan: string;
  tahun: string;
  bulan: string;
  department: string;
  cost_center: string;
  kode_akun: string;
  nama_akun: string;
  kategori: string;
  budget: number;
  realisasi: number;
};

type MonthlyPoint = {
  tahun: string;
  bulan: string;
  budget: number;
  actual: number;
  budgetYtd: number;
  actualYtd: number;
};

const MONTHS = [
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
];

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function normalize(value: unknown) {
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

function normalizeMonth(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
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
  for (const [alias, month] of Object.entries(aliases)) {
    if (raw.includes(alias)) return month;
  }
  return String(value ?? "").trim();
}

function pick(row: ApiRow, keys: string[]) {
  const wanted = new Set(keys.map(normalize));
  for (const [name, value] of Object.entries(row)) {
    if (wanted.has(normalize(name))) return value;
  }
  return undefined;
}

function fromApiRow(row: ApiRow): YtdRow | null {
  const bulan = normalizeMonth(pick(row, ["bulan", "month"]));
  if (!bulan || !MONTHS.includes(bulan)) return null;

  return {
    perusahaan: String(pick(row, ["perusahaan", "company"]) ?? "").trim(),
    tahun: String(pick(row, ["tahun", "year"]) ?? "").trim(),
    bulan,
    department: String(pick(row, ["department", "departemen", "dept"]) ?? "").trim(),
    cost_center: String(pick(row, ["cost center", "cost_center", "costcenter"]) ?? "").trim(),
    kode_akun: String(pick(row, ["kode akun", "kode_akun", "account code", "account_code"]) ?? "").trim(),
    nama_akun: String(pick(row, ["nama akun", "nama_akun", "account name", "account_name"]) ?? "").trim(),
    kategori: String(pick(row, ["kategori", "category"]) ?? "").trim(),
    budget: numberValue(pick(row, ["budget", "anggaran"])),
    realisasi: numberValue(pick(row, ["realisasi", "actual", "aktual"])),
  };
}

function parseSheet(sheet: Sheet, headerRow: number): YtdRow[] {
  const headers = (sheet.rows[headerRow] ?? []).map((value) => String(value ?? "").trim());
  const normalized = headers.map(normalize);

  const indexOf = (keys: string[]) =>
    normalized.findIndex((header) => keys.map(normalize).includes(header));

  const companyIndex = indexOf(["perusahaan", "company"]);
  const yearIndex = indexOf(["tahun", "year"]);
  const monthIndex = indexOf(["bulan", "month"]);
  const departmentIndex = indexOf(["department", "departemen", "dept"]);
  const costCenterIndex = indexOf(["cost center", "cost_center", "costcenter"]);
  const accountCodeIndex = indexOf(["kode akun", "kode_akun", "account code", "account_code"]);
  const accountNameIndex = indexOf(["nama akun", "nama_akun", "account name", "account_name"]);
  const categoryIndex = indexOf(["kategori", "category"]);
  const budgetIndex = indexOf(["budget", "anggaran"]);
  const actualIndex = indexOf(["realisasi", "actual", "aktual"]);

  if (monthIndex < 0 || budgetIndex < 0 || actualIndex < 0) return [];

  return sheet.rows
    .slice(headerRow + 1)
    .map((row): YtdRow => ({
      perusahaan: companyIndex >= 0 ? String(row[companyIndex] ?? "").trim() : "",
      tahun: yearIndex >= 0 ? String(row[yearIndex] ?? "").trim() : "",
      bulan: normalizeMonth(row[monthIndex]),
      department: departmentIndex >= 0 ? String(row[departmentIndex] ?? "").trim() : "",
      cost_center: costCenterIndex >= 0 ? String(row[costCenterIndex] ?? "").trim() : "",
      kode_akun: accountCodeIndex >= 0 ? String(row[accountCodeIndex] ?? "").trim() : "",
      nama_akun: accountNameIndex >= 0 ? String(row[accountNameIndex] ?? "").trim() : "",
      kategori: categoryIndex >= 0 ? String(row[categoryIndex] ?? "").trim() : "",
      budget: numberValue(row[budgetIndex]),
      realisasi: numberValue(row[actualIndex]),
    }))
    .filter((row) => row.bulan.length > 0 && MONTHS.includes(row.bulan));
}

function formatAxis(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${pf.format(value / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${pf.format(value / 1_000_000)} Jt`;
  return nf.format(value);
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
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const selected = sheets[sheetIndex];
  const rows = selected ? parseSheet(selected, headerRow) : [];

  async function choose(next?: File) {
    if (!next) return;
    setFile(next);
    setBusy("Membaca file Excel...");
    setError("");

    try {
      const form = new FormData();
      form.append("file", next);
      const response = await fetch("/api/upload/preview", { method: "POST", body: form });
      const payload: unknown = await response.json();
      const data = payload && typeof payload === "object" ? (payload as { sheets?: Sheet[]; error?: string }) : {};
      if (!response.ok || !Array.isArray(data.sheets)) {
        throw new Error(data.error || "File gagal dibaca.");
      }
      setSheets(data.sheets);
      setSheetIndex(0);
      setHeaderRow(detectHeaderRow(data.sheets[0]?.rows ?? []));
    } catch (caught) {
      setSheets([]);
      setError(caught instanceof Error ? caught.message : "File gagal dibaca.");
    } finally {
      setBusy("");
    }
  }

  async function save(strategy: "cancel" | "replace" = "cancel") {
    if (!file || !selected || rows.length === 0) return;
    setBusy("Menyimpan data YTD...");
    setError("");

    try {
      const response = await fetch("/api/report-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          reportType: "cumulative_budget_actual_ytd",
          fileName: file.name,
          sheetName: selected.name,
          headers: [
            "perusahaan",
            "tahun",
            "bulan",
            "department",
            "cost_center",
            "kode_akun",
            "nama_akun",
            "kategori",
            "budget",
            "realisasi",
          ],
          rows,
          strategy,
        }),
      });

      const payload: unknown = await response.json().catch(() => ({}));
      const data = payload && typeof payload === "object" ? (payload as { error?: string }) : {};

      if (response.status === 409 && strategy === "cancel") {
        if (window.confirm("Data Cumulative YTD sudah pernah diimport. Ganti data lama?")) {
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
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/80 p-4 md:p-10">
      <div className="mx-auto max-w-7xl rounded-2xl border border-gold-500/20 bg-zinc-950 p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Upload / Import Cumulative Budget vs Actual YTD</h2>
            <p className="text-sm text-zinc-400">
              Format: Perusahaan, Tahun, Bulan, Department, Cost Center, Kode Akun, Nama Akun, Kategori, Budget, Realisasi
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup"><X /></button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            className="secondary-button"
            onClick={() => downloadTemplate("cumulative_budget_actual_ytd")}
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
            onChange={(event) => choose(event.target.files?.[0])}
          />
        </div>

        {busy && <p className="mt-4 text-gold-300">{busy}</p>}
        {error && <div className="error mt-4">{error}</div>}

        {selected && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                Sheet
                <select
                  className="input mt-1 w-full"
                  value={sheetIndex}
                  onChange={(event) => {
                    const index = Number(event.target.value);
                    setSheetIndex(index);
                    setHeaderRow(detectHeaderRow(sheets[index]?.rows ?? []));
                  }}
                >
                  {sheets.map((sheet, index) => (
                    <option value={index} key={`${sheet.name}-${index}`}>{sheet.name}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                Baris Header
                <select
                  className="input mt-1 w-full"
                  value={headerRow}
                  onChange={(event) => setHeaderRow(Number(event.target.value))}
                >
                  {Array.from({ length: Math.min(35, selected.rows.length) }, (_, index) => (
                    <option key={index} value={index}>Baris {index + 1}</option>
                  ))}
                </select>
              </label>

              <div className="text-sm">
                <span className="text-zinc-400">Data terbaca</span>
                <p className="mt-2 font-semibold">{rows.length} baris</p>
              </div>
            </div>

            {rows.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="min-w-[1200px] w-full text-sm">
                  <thead className="bg-blue-900 text-white">
                    <tr>
                      <th className="px-3 py-2 text-left">Perusahaan</th>
                      <th className="px-3 py-2 text-left">Tahun</th>
                      <th className="px-3 py-2 text-left">Bulan</th>
                      <th className="px-3 py-2 text-left">Department</th>
                      <th className="px-3 py-2 text-left">Cost Center</th>
                      <th className="px-3 py-2 text-left">Kode Akun</th>
                      <th className="px-3 py-2 text-left">Nama Akun</th>
                      <th className="px-3 py-2 text-left">Kategori</th>
                      <th className="px-3 py-2 text-right">Budget</th>
                      <th className="px-3 py-2 text-right">Realisasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, index) => (
                      <tr className="border-b border-zinc-800" key={`${row.bulan}-${row.department}-${row.kode_akun}-${index}`}>
                        <td className="px-3 py-2">{row.perusahaan}</td>
                        <td className="px-3 py-2">{row.tahun}</td>
                        <td className="px-3 py-2">{row.bulan}</td>
                        <td className="px-3 py-2">{row.department}</td>
                        <td className="px-3 py-2">{row.cost_center}</td>
                        <td className="px-3 py-2">{row.kode_akun}</td>
                        <td className="px-3 py-2">{row.nama_akun}</td>
                        <td className="px-3 py-2">{row.kategori}</td>
                        <td className="px-3 py-2 text-right">{nf.format(row.budget)}</td>
                        <td className="px-3 py-2 text-right">{nf.format(row.realisasi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="error">
                Header wajib minimal: Bulan, Budget, Realisasi. Format lengkap mengikuti template YTD.
              </div>
            )}

            <div className="flex justify-end">
              <button
                className="gold-button"
                disabled={busy.length > 0 || rows.length === 0}
                onClick={() => save()}
              >
                {busy.startsWith("Menyimpan") ? "Menyimpan..." : "Import & Simpan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function YtdDetailReportEnhancer() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<YtdRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const active =
    typeof window !== "undefined" &&
    window.location.pathname === "/budget-vs-actual" &&
    new URLSearchParams(window.location.search).get("view") === "ytd";

  const syncCompany = useCallback(() => {
    setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001");
  }, []);

  const attach = useCallback(() => {
    if (!active) {
      setMount(null);
      return;
    }

    const legacyRoot = document.querySelector<HTMLElement>(".monthly-ytd-budget-root");
    if (!legacyRoot) return;

    legacyRoot.classList.add("ytd-detail-v2-active");
    let node = legacyRoot.querySelector<HTMLElement>("[data-ytd-detail-v2-mount]");
    if (!node) {
      node = document.createElement("div");
      node.dataset.ytdDetailV2Mount = "true";
      legacyRoot.appendChild(node);
    }
    setMount(node);
  }, [active]);

  const loadRows = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/reports?reportType=cumulative_budget_actual_ytd&company=${company}`,
        { cache: "no-store" },
      );
      const payload: unknown = await response.json();
      if (!response.ok || !Array.isArray(payload)) {
        setRows([]);
        return;
      }

      const parsed = payload
        .map((row) => fromApiRow(row as ApiRow))
        .filter((row): row is YtdRow => row !== null);

      const latest = new Map<string, YtdRow>();
      parsed.forEach((row) => {
        const key = [
          row.perusahaan,
          row.tahun,
          row.bulan,
          row.department,
          row.cost_center,
          row.kode_akun,
          row.nama_akun,
          row.kategori,
        ]
          .map((value) => value.trim().toLowerCase())
          .join("|");
        latest.set(key, row);
      });

      setRows(Array.from(latest.values()));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [active, company]);

  useEffect(() => {
    if (!active) return;
    syncCompany();
    attach();

    const observer = new MutationObserver(() => attach());
    observer.observe(document.body, { childList: true, subtree: true });

    const click = () => window.setTimeout(() => {
      syncCompany();
      attach();
    }, 0);
    document.addEventListener("click", click, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", click, true);
      document.querySelector<HTMLElement>(".monthly-ytd-budget-root")?.classList.remove("ytd-detail-v2-active");
    };
  }, [active, attach, syncCompany]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const monthly = useMemo(() => {
    const map = new Map<string, { tahun: string; bulan: string; budget: number; actual: number }>();

    rows.forEach((row) => {
      const key = `${row.tahun}|${row.bulan}`;
      const current = map.get(key) ?? { tahun: row.tahun, bulan: row.bulan, budget: 0, actual: 0 };
      current.budget += row.budget;
      current.actual += row.realisasi;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => {
      const yearCompare = a.tahun.localeCompare(b.tahun);
      if (yearCompare !== 0) return yearCompare;
      return MONTHS.indexOf(a.bulan) - MONTHS.indexOf(b.bulan);
    });
  }, [rows]);

  const currentYear = useMemo(() => {
    const years = monthly.map((row) => row.tahun).filter(Boolean).sort();
    return years.at(-1) ?? "";
  }, [monthly]);

  const yearRows = useMemo(
    () => (currentYear ? monthly.filter((row) => row.tahun === currentYear) : monthly),
    [currentYear, monthly],
  );

  const lastActualIndex = useMemo(() => {
    let result = -1;
    yearRows.forEach((row) => {
      const index = MONTHS.indexOf(row.bulan);
      if (row.actual !== 0 && index > result) result = index;
    });
    if (result >= 0) return result;

    yearRows.forEach((row) => {
      const index = MONTHS.indexOf(row.bulan);
      if (row.budget !== 0 && index > result) result = index;
    });
    return result;
  }, [yearRows]);

  const chartData = useMemo(() => {
    let budgetYtd = 0;
    let actualYtd = 0;

    return yearRows
      .filter((row) => MONTHS.indexOf(row.bulan) <= lastActualIndex)
      .map((row): MonthlyPoint => {
        budgetYtd += row.budget;
        actualYtd += row.actual;
        return {
          tahun: row.tahun,
          bulan: row.bulan,
          budget: row.budget,
          actual: row.actual,
          budgetYtd,
          actualYtd,
        };
      });
  }, [lastActualIndex, yearRows]);

  const summary = useMemo(() => {
    const annualBudget = yearRows.reduce((sum, row) => sum + row.budget, 0);
    const budgetYtd = chartData.at(-1)?.budgetYtd ?? 0;
    const actualYtd = chartData.at(-1)?.actualYtd ?? 0;
    const utilization = budgetYtd ? (actualYtd / budgetYtd) * 100 : 0;
    const remaining = budgetYtd - actualYtd;
    const throughMonth = lastActualIndex >= 0 ? MONTHS[lastActualIndex] : "-";
    return { annualBudget, budgetYtd, actualYtd, utilization, remaining, throughMonth };
  }, [chartData, lastActualIndex, yearRows]);

  const detailRows = useMemo(
    () => rows
      .filter((row) => !currentYear || row.tahun === currentYear)
      .sort((a, b) => MONTHS.indexOf(a.bulan) - MONTHS.indexOf(b.bulan)),
    [currentYear, rows],
  );

  if (!active || !mount) return null;

  return createPortal(
    <div className="ytd-detail-v2-root space-y-6">
      <style>{`
        .monthly-ytd-budget-root.ytd-detail-v2-active > :not([data-ytd-detail-v2-mount]) { display: none !important; }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Cumulative Budget vs Actual YTD</h2>
          <p className="text-sm text-zinc-400">
            Akumulasi Budget dan Realisasi dari awal tahun sampai bulan berjalan
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="secondary-button"
            onClick={() => downloadTemplate("cumulative_budget_actual_ytd")}
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

      {loading ? (
        <p>Memuat data...</p>
      ) : rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gold-500/30 bg-zinc-950/60 p-12 text-center">
          <h3 className="text-xl font-semibold">Belum ada data</h3>
          <p className="mt-2 text-zinc-400">
            Upload Excel sesuai template detail YTD untuk menampilkan ringkasan dan grafik otomatis.
          </p>
          <button className="gold-button mt-5" onClick={() => setModalOpen(true)}>
            Upload Excel
          </button>
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-4">
              <p className="text-sm text-zinc-400">Anggaran Tahunan</p>
              <p className="mt-2 text-xl font-semibold">Rp {nf.format(summary.annualBudget)}</p>
            </div>
            <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-4">
              <p className="text-sm text-zinc-400">Anggaran YTD s.d. {summary.throughMonth}</p>
              <p className="mt-2 text-xl font-semibold">Rp {nf.format(summary.budgetYtd)}</p>
            </div>
            <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-4">
              <p className="text-sm text-zinc-400">Realisasi YTD s.d. {summary.throughMonth}</p>
              <p className="mt-2 text-xl font-semibold">Rp {nf.format(summary.actualYtd)}</p>
            </div>
            <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-4">
              <p className="text-sm text-zinc-400">Realisasi Anggaran YTD</p>
              <p className="mt-2 text-xl font-semibold">{pf.format(summary.utilization)}%</p>
            </div>
            <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-4">
              <p className="text-sm text-zinc-400">Sisa Anggaran YTD</p>
              <p className={`mt-2 text-xl font-semibold ${summary.remaining < 0 ? "text-red-400" : "text-emerald-400"}`}>
                Rp {nf.format(summary.remaining)}
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Grafik Cumulative Budget vs Actual YTD</h3>
              <p className="text-sm text-zinc-400">
                Budget YTD vs Actual YTD sampai {summary.throughMonth}{currentYear ? ` ${currentYear}` : ""}
              </p>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#27272a" />
                  <XAxis dataKey="bulan" />
                  <YAxis tickFormatter={formatAxis} />
                  <Tooltip formatter={(value: number | string) => `Rp ${nf.format(Number(value))}`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="budgetYtd"
                    name="Budget YTD"
                    stroke="#2563EB"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualYtd"
                    name="Actual YTD"
                    stroke="#EF4444"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gold-500/20 bg-zinc-950/80">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Tahun</th>
                    <th className="px-4 py-3 text-left">Bulan</th>
                    <th className="px-4 py-3 text-right">Budget Bulanan</th>
                    <th className="px-4 py-3 text-right">Realisasi Bulanan</th>
                    <th className="px-4 py-3 text-right">Budget YTD</th>
                    <th className="px-4 py-3 text-right">Actual YTD</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row) => (
                    <tr key={`${row.tahun}-${row.bulan}`} className="border-b border-zinc-800">
                      <td className="px-4 py-3">{row.tahun}</td>
                      <td className="px-4 py-3">{row.bulan}</td>
                      <td className="px-4 py-3 text-right">{nf.format(row.budget)}</td>
                      <td className="px-4 py-3 text-right">{nf.format(row.actual)}</td>
                      <td className="px-4 py-3 text-right">{nf.format(row.budgetYtd)}</td>
                      <td className="px-4 py-3 text-right">{nf.format(row.actualYtd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gold-500/20 bg-zinc-950/80">
            <div className="border-b border-zinc-800 p-4">
              <h3 className="text-lg font-semibold">Detail Data Import</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1300px] w-full text-sm">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="px-3 py-3 text-left">Perusahaan</th>
                    <th className="px-3 py-3 text-left">Tahun</th>
                    <th className="px-3 py-3 text-left">Bulan</th>
                    <th className="px-3 py-3 text-left">Department</th>
                    <th className="px-3 py-3 text-left">Cost Center</th>
                    <th className="px-3 py-3 text-left">Kode Akun</th>
                    <th className="px-3 py-3 text-left">Nama Akun</th>
                    <th className="px-3 py-3 text-left">Kategori</th>
                    <th className="px-3 py-3 text-right">Budget</th>
                    <th className="px-3 py-3 text-right">Realisasi</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((row, index) => (
                    <tr key={`${row.bulan}-${row.department}-${row.kode_akun}-${index}`} className="border-b border-zinc-800">
                      <td className="px-3 py-3">{row.perusahaan}</td>
                      <td className="px-3 py-3">{row.tahun}</td>
                      <td className="px-3 py-3">{row.bulan}</td>
                      <td className="px-3 py-3">{row.department}</td>
                      <td className="px-3 py-3">{row.cost_center}</td>
                      <td className="px-3 py-3">{row.kode_akun}</td>
                      <td className="px-3 py-3">{row.nama_akun}</td>
                      <td className="px-3 py-3">{row.kategori}</td>
                      <td className="px-3 py-3 text-right">{nf.format(row.budget)}</td>
                      <td className="px-3 py-3 text-right">{nf.format(row.realisasi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {modalOpen && (
        <UploadModal
          company={company}
          onClose={() => setModalOpen(false)}
          onSaved={() => void loadRows()}
        />
      )}
    </div>,
    mount,
  );
}
