"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bar,
  BarChart,
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
type ReportMode = "monthly" | "ytd";
type Sheet = { name: string; rows: string[][] };
type ReportRow = { tahun: string; bulan: string; budget: number; actual: number };
type ApiRow = Record<string, unknown>;

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
  return String(value ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value ?? "").trim().replace(/^rp\s*/i, "").replace(/%/g, "").replace(/\s/g, "");
  if (!text || text === "-") return 0;
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replaceAll(".", "").replace(",", ".");
  } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replaceAll(",", "");
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMonth(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    jan: "Januari", januari: "Januari", january: "Januari",
    feb: "Februari", februari: "Februari", february: "Februari",
    mar: "Maret", maret: "Maret", march: "Maret",
    apr: "April", april: "April",
    mei: "Mei", may: "Mei",
    jun: "Juni", juni: "Juni", june: "Juni",
    jul: "Juli", juli: "Juli", july: "Juli",
    agu: "Agustus", agustus: "Agustus", aug: "Agustus", august: "Agustus",
    sep: "September", september: "September",
    okt: "Oktober", oktober: "Oktober", oct: "Oktober", october: "Oktober",
    nov: "November", november: "November",
    des: "Desember", desember: "Desember", dec: "Desember", december: "Desember",
  };
  if (aliases[raw]) return aliases[raw];
  for (const [alias, month] of Object.entries(aliases)) if (raw.includes(alias)) return month;
  return String(value ?? "").trim();
}

function pick(row: ApiRow, keys: string[]) {
  const wanted = new Set(keys.map(normalize));
  for (const [key, value] of Object.entries(row)) if (wanted.has(normalize(key))) return value;
  return undefined;
}

function fromApiRow(row: ApiRow): ReportRow | null {
  const bulan = normalizeMonth(pick(row, ["bulan", "month"]));
  if (!bulan) return null;
  return {
    tahun: String(pick(row, ["tahun", "year"]) ?? "").trim(),
    bulan,
    budget: numberValue(pick(row, ["budget", "anggaran", "total budget", "total_budget"])),
    actual: numberValue(pick(row, ["actual", "aktual", "realisasi", "total actual", "total_aktual"])),
  };
}

function parseSheet(sheet: Sheet, headerRow: number): ReportRow[] {
  const headers = (sheet.rows[headerRow] ?? []).map((value) => String(value ?? "").trim());
  const normalized = headers.map(normalize);
  const yearIndex = normalized.findIndex((value) => ["tahun", "year"].includes(value));
  const monthIndex = normalized.findIndex((value) => ["bulan", "month"].includes(value));
  const budgetIndex = normalized.findIndex((value) => ["budget", "anggaran", "total_budget"].includes(value));
  const actualIndex = normalized.findIndex((value) => ["actual", "aktual", "realisasi", "total_actual", "total_aktual"].includes(value));
  if (monthIndex < 0 || budgetIndex < 0 || actualIndex < 0) return [];

  return sheet.rows.slice(headerRow + 1).map((row) => ({
    tahun: yearIndex >= 0 ? String(row[yearIndex] ?? "").trim() : "",
    bulan: normalizeMonth(row[monthIndex]),
    budget: numberValue(row[budgetIndex]),
    actual: numberValue(row[actualIndex]),
  })).filter((row) => row.bulan.length > 0);
}

function formatAxis(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${pf.format(value / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${pf.format(value / 1_000_000)} Jt`;
  return nf.format(value);
}

function UploadModal({ company, mode, onClose, onSaved }: { company: Company; mode: ReportMode; onClose: () => void; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const selected = sheets[sheetIndex];
  const rows = selected ? parseSheet(selected, headerRow) : [];
  const reportType = mode === "monthly" ? "monthly_budget_actual" : "cumulative_budget_actual_ytd";

  async function choose(next?: File) {
    if (!next) return;
    setFile(next);
    setBusy("Membaca file Excel...");
    setError("");
    try {
      const form = new FormData();
      form.append("file", next);
      const response = await fetch("/api/upload/preview", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload?.sheets)) throw new Error(payload?.error || "File gagal dibaca.");
      setSheets(payload.sheets);
      setSheetIndex(0);
      setHeaderRow(detectHeaderRow(payload.sheets[0]?.rows ?? []));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "File gagal dibaca.");
    } finally {
      setBusy("");
    }
  }

  async function save(strategy: "cancel" | "replace" = "cancel") {
    if (!file || !selected || !rows.length) return;
    setBusy("Menyimpan data...");
    setError("");
    try {
      const response = await fetch("/api/report-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          reportType,
          fileName: file.name,
          sheetName: selected.name,
          headers: ["tahun", "bulan", "budget", "actual"],
          rows,
          strategy,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && strategy === "cancel") {
        if (window.confirm("Data serupa sudah pernah diimport. Ganti data lama?")) await save("replace");
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
      <div className="mx-auto max-w-5xl rounded-2xl border border-gold-500/20 bg-zinc-950 p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Upload / Import Excel</h2>
            <p className="text-sm text-zinc-400">{mode === "monthly" ? "Monthly Budget vs Actual" : "Cumulative Budget vs Actual YTD"}</p>
          </div>
          <button onClick={onClose} aria-label="Tutup"><X /></button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button className="secondary-button" onClick={() => downloadTemplate(reportType)}>Download Template</button>
          <button className="gold-button" onClick={() => inputRef.current?.click()}>Pilih File Excel</button>
          <input ref={inputRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => choose(event.target.files?.[0])} />
        </div>

        {busy && <p className="mt-4 text-gold-300">{busy}</p>}
        {error && <div className="error mt-4">{error}</div>}

        {selected && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">Sheet
                <select className="input mt-1 w-full" value={sheetIndex} onChange={(event) => {
                  const index = Number(event.target.value);
                  setSheetIndex(index);
                  setHeaderRow(detectHeaderRow(sheets[index]?.rows ?? []));
                }}>
                  {sheets.map((sheet, index) => <option value={index} key={`${sheet.name}-${index}`}>{sheet.name}</option>)}
                </select>
              </label>
              <label className="text-sm">Baris Header
                <select className="input mt-1 w-full" value={headerRow} onChange={(event) => setHeaderRow(Number(event.target.value))}>
                  {Array.from({ length: Math.min(25, selected.rows.length) }, (_, index) => <option key={index} value={index}>Baris {index + 1}</option>)}
                </select>
              </label>
              <div className="text-sm"><span className="text-zinc-400">Data terbaca</span><p className="mt-2 font-semibold">{rows.length} bulan</p></div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-blue-900 text-white"><tr><th className="px-3 py-2 text-left">Tahun</th><th className="px-3 py-2 text-left">Bulan</th><th className="px-3 py-2 text-right">Budget</th><th className="px-3 py-2 text-right">Actual</th></tr></thead>
                <tbody>{rows.slice(0, 12).map((row, index) => <tr className="border-b border-zinc-800" key={`${row.bulan}-${index}`}><td className="px-3 py-2">{row.tahun}</td><td className="px-3 py-2">{row.bulan}</td><td className="px-3 py-2 text-right">{nf.format(row.budget)}</td><td className="px-3 py-2 text-right">{nf.format(row.actual)}</td></tr>)}</tbody>
              </table>
            </div>

            <div className="flex justify-end"><button className="gold-button" disabled={!!busy || !rows.length} onClick={() => save()}>Import & Simpan</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MonthlyYtdBudgetReport() {
  const [mode, setMode] = useState<ReportMode | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const syncCompany = useCallback(() => {
    setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const nextMode: ReportMode | null = window.location.pathname === "/budget-vs-actual" && view === "monthly" ? "monthly" : window.location.pathname === "/budget-vs-actual" && view === "ytd" ? "ytd" : null;
    setMode(nextMode);
    if (!nextMode) return;

    syncCompany();
    const main = document.querySelector("main");
    const content = main?.children.item(1) as HTMLElement | null;
    if (content) {
      content.classList.add("monthly-ytd-budget-host");
      setHost(content);
    }
    const title = main?.querySelector("header h1");
    const previous = title?.textContent ?? "";
    if (title) title.textContent = nextMode === "monthly" ? "Monthly Budget vs Actual" : "Cumulative Budget vs Actual YTD";

    const click = () => window.setTimeout(syncCompany, 0);
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("click", click);
      content?.classList.remove("monthly-ytd-budget-host");
      if (title) title.textContent = previous;
    };
  }, [syncCompany]);

  const loadRows = useCallback(async () => {
    if (!mode) return;
    setLoading(true);
    try {
      const reportType = mode === "monthly" ? "monthly_budget_actual" : "cumulative_budget_actual_ytd";
      const response = await fetch(`/api/reports?reportType=${reportType}&company=${company}`, { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok || !Array.isArray(payload)) {
        setRows([]);
        return;
      }
      setRows(payload.map((row) => fromApiRow(row as ApiRow)).filter((row): row is ReportRow => row !== null));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [company, mode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const sorted = useMemo(() => [...rows].sort((a, b) => MONTHS.indexOf(a.bulan) - MONTHS.indexOf(b.bulan)), [rows]);

  const chartData = useMemo(() => {
    if (mode === "monthly") return sorted;
    let budgetYtd = 0;
    let actualYtd = 0;
    return sorted.map((row) => {
      budgetYtd += row.budget;
      actualYtd += row.actual;
      return { ...row, budgetYtd, actualYtd };
    });
  }, [mode, sorted]);

  const summary = useMemo(() => {
    const annualBudget = sorted.reduce((sum, row) => sum + row.budget, 0);
    const budgetYtd = sorted.reduce((sum, row) => sum + row.budget, 0);
    const actualYtd = sorted.reduce((sum, row) => sum + row.actual, 0);
    return { annualBudget, budgetYtd, actualYtd, utilization: budgetYtd ? (actualYtd / budgetYtd) * 100 : 0 };
  }, [sorted]);

  if (!mode || !host) return null;

  return createPortal(
    <div className="monthly-ytd-budget-root space-y-6">
      <style>{`.monthly-ytd-budget-host > :not(.monthly-ytd-budget-root){display:none!important}`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{mode === "monthly" ? "Monthly Budget vs Actual" : "Cumulative Budget vs Actual YTD"}</h2>
          <p className="text-sm text-zinc-400">{mode === "monthly" ? "Perbandingan Budget dan Actual setiap bulan" : "Akumulasi Budget dan Actual dari awal tahun sampai bulan berjalan"}</p>
        </div>
        <div className="flex gap-2">
          <button className="secondary-button" onClick={() => downloadTemplate(mode === "monthly" ? "monthly_budget_actual" : "cumulative_budget_actual_ytd")}>Download Template</button>
          <button className="gold-button flex items-center gap-2" onClick={() => setModalOpen(true)}><Upload className="h-4 w-4" /> Upload Excel</button>
        </div>
      </div>

      {loading ? <p>Memuat data...</p> : sorted.length ? (
        <>
          {mode === "ytd" && (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-4"><p className="text-sm text-zinc-400">Annual Budget</p><p className="mt-2 text-xl font-semibold">Rp {nf.format(summary.annualBudget)}</p></div>
              <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-4"><p className="text-sm text-zinc-400">Budget YTD</p><p className="mt-2 text-xl font-semibold">Rp {nf.format(summary.budgetYtd)}</p></div>
              <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-4"><p className="text-sm text-zinc-400">Actual YTD</p><p className="mt-2 text-xl font-semibold">Rp {nf.format(summary.actualYtd)}</p></div>
              <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-4"><p className="text-sm text-zinc-400">Utilization YTD</p><p className="mt-2 text-xl font-semibold">{pf.format(summary.utilization)}%</p></div>
            </div>
          )}

          <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5">
            <h3 className="mb-4 text-lg font-semibold">Grafik {mode === "monthly" ? "Monthly Budget vs Actual" : "Cumulative Budget vs Actual YTD"}</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {mode === "monthly" ? (
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="#27272a" />
                    <XAxis dataKey="bulan" />
                    <YAxis tickFormatter={formatAxis} />
                    <Tooltip formatter={(value: number | string) => `Rp ${nf.format(Number(value))}`} />
                    <Legend />
                    <Bar dataKey="budget" name="Budget" fill="#2563EB" />
                    <Bar dataKey="actual" name="Actual" fill="#EF4444" />
                  </BarChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#27272a" />
                    <XAxis dataKey="bulan" />
                    <YAxis tickFormatter={formatAxis} />
                    <Tooltip formatter={(value: number | string) => `Rp ${nf.format(Number(value))}`} />
                    <Legend />
                    <Line type="monotone" dataKey="budgetYtd" name="Budget YTD" stroke="#2563EB" strokeWidth={3} />
                    <Line type="monotone" dataKey="actualYtd" name="Actual YTD" stroke="#EF4444" strokeWidth={3} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gold-500/20 bg-zinc-950/80">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-blue-900 text-white"><tr><th className="px-4 py-3 text-left">Tahun</th><th className="px-4 py-3 text-left">Bulan</th><th className="px-4 py-3 text-right">Budget</th><th className="px-4 py-3 text-right">Actual</th>{mode === "ytd" && <><th className="px-4 py-3 text-right">Budget YTD</th><th className="px-4 py-3 text-right">Actual YTD</th></>}</tr></thead>
                <tbody>{chartData.map((row, index) => <tr key={`${row.bulan}-${index}`} className="border-b border-zinc-800"><td className="px-4 py-3">{row.tahun}</td><td className="px-4 py-3">{row.bulan}</td><td className="px-4 py-3 text-right">{nf.format(row.budget)}</td><td className="px-4 py-3 text-right">{nf.format(row.actual)}</td>{mode === "ytd" && <><td className="px-4 py-3 text-right">{nf.format(Number((row as ReportRow & { budgetYtd?: number }).budgetYtd ?? 0))}</td><td className="px-4 py-3 text-right">{nf.format(Number((row as ReportRow & { actualYtd?: number }).actualYtd ?? 0))}</td></>}</tr>)}</tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-gold-500/30 bg-zinc-950/60 p-12 text-center">
          <h3 className="text-xl font-semibold">Belum ada data</h3>
          <p className="mt-2 text-zinc-400">Upload Excel untuk menampilkan tabel dan grafik otomatis.</p>
          <button className="gold-button mt-5" onClick={() => setModalOpen(true)}>Upload Excel</button>
        </section>
      )}

      {modalOpen && <UploadModal company={company} mode={mode} onClose={() => setModalOpen(false)} onSaved={() => void loadRows()} />}
    </div>,
    host,
  );
}
