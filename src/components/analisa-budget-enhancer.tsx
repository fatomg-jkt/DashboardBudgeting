"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { detectHeaderRow, downloadTemplate } from "@/lib/import-utils";

type Company = "1001" | "maison_y";
type Row = Record<string, unknown> & { id?: number };
type Sheet = { name: string; rows: string[][] };

type AnalysisRow = {
  department: string;
  actual: number;
  budget: number;
  variance: number;
  variancePct: number;
  utilization: number;
  status: string;
  analysis: string;
  recommendation: string;
  priority: string;
};

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

const normalize = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value ?? "").trim();
  if (!text) return 0;
  const negative = /^\(.*\)$/.test(text);
  text = text
    .replace(/^\(|\)$/g, "")
    .replace(/^rp\s*/i, "")
    .replace(/%/g, "")
    .replace(/\s/g, "");
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replaceAll(".", "").replace(",", ".");
  } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replaceAll(",", "");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function pick(row: Row, names: string[]) {
  for (const [key, value] of Object.entries(row)) {
    if (names.includes(normalize(key))) return value;
  }
  return undefined;
}

function toAnalysisRow(row: Row): AnalysisRow | null {
  const department = String(
    pick(row, ["department", "departemen", "dept", "fungsi"]) ?? "",
  ).trim();
  if (!department || /^rank$/i.test(department)) return null;

  const actual = numberValue(pick(row, ["actual", "aktual", "realisasi"]));
  const budget = numberValue(pick(row, ["budget", "anggaran"]));
  if (!actual && !budget) return null;

  const explicitVariance = pick(row, [
    "variance_rp",
    "variance_nominal",
    "selisih_rp",
    "selisih",
  ]);
  const variance =
    explicitVariance === undefined ? actual - budget : numberValue(explicitVariance);

  const explicitVariancePct = pick(row, [
    "variance_percent",
    "variance_percentage",
    "variance_pct",
    "var_percent",
    "var_pct",
    "gap_percent",
    "gap_pct",
  ]);
  const variancePct =
    explicitVariancePct === undefined
      ? budget
        ? (variance / budget) * 100
        : 0
      : numberValue(explicitVariancePct);

  const explicitUtilization = pick(row, [
    "utilization",
    "utilization_percent",
    "utilization_pct",
    "pemakaian",
    "pemakaian_percent",
  ]);
  const utilization =
    explicitUtilization === undefined
      ? budget
        ? (actual / budget) * 100
        : 0
      : numberValue(explicitUtilization);

  const status = String(
    pick(row, ["status"]) ?? (actual > budget ? "Over Budget" : "Under Budget"),
  );
  const gap = Math.abs(variancePct);
  const analysis = String(
    pick(row, ["analysis", "analisis"]) ??
      (gap <= 2 ? "Sesuai alokasi" : actual > budget ? "Budget share meningkat" : "Efisiensi biaya"),
  );
  const recommendation = String(
    pick(row, ["recommendation", "rekomendasi"]) ??
      (actual > budget ? "Review driver biaya" : "Pertahankan efisiensi"),
  );
  const priority = String(
    pick(row, ["priority", "prioritas"]) ??
      (gap >= 10 ? "High" : gap >= 5 ? "Medium" : "Low"),
  );

  return {
    department,
    actual,
    budget,
    variance,
    variancePct,
    utilization,
    status,
    analysis,
    recommendation,
    priority,
  };
}

function formatAxis(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${pf.format(value / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${pf.format(value / 1_000_000)} Jt`;
  return nf.format(value);
}

function AnalysisTable({ rows }: { rows: AnalysisRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gold-500/20 bg-zinc-950/80">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-blue-900 text-white">
            <tr>
              <th className="px-3 py-3">Departemen</th>
              <th className="px-3 py-3 text-right">Aktual</th>
              <th className="px-3 py-3 text-right">Anggaran</th>
              <th className="px-3 py-3 text-right">Variance (Rp)</th>
              <th className="px-3 py-3 text-right">Variance (%)</th>
              <th className="px-3 py-3 text-right">Utilization</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.department} className="border-b border-zinc-800">
                <td className="px-3 py-2.5 font-medium">{row.department}</td>
                <td className="px-3 py-2.5 text-right">{nf.format(row.actual)}</td>
                <td className="px-3 py-2.5 text-right">{nf.format(row.budget)}</td>
                <td className={`px-3 py-2.5 text-right ${row.variance < 0 ? "text-red-300" : ""}`}>
                  {row.variance < 0 ? `(${nf.format(Math.abs(row.variance))})` : nf.format(row.variance)}
                </td>
                <td className="px-3 py-2.5 text-right">{pf.format(row.variancePct)}%</td>
                <td className="px-3 py-2.5 text-right">{pf.format(row.utilization)}%</td>
                <td className={row.actual > row.budget ? "px-3 py-2.5 text-red-400" : "px-3 py-2.5 text-emerald-400"}>
                  {row.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RankingTable({
  title,
  rows,
  mode,
}: {
  title: string;
  rows: AnalysisRow[];
  mode: "over" | "under";
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gold-500/20 bg-zinc-950/80">
      <div className={mode === "over" ? "bg-red-700 px-4 py-2 text-center font-semibold text-white" : "bg-emerald-700 px-4 py-2 text-center font-semibold text-white"}>
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-blue-900 text-white">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2 text-left">Departemen</th>
              <th className="px-3 py-2 text-right">{mode === "over" ? "Variance" : "Saving"}</th>
              <th className="px-3 py-2 text-right">{mode === "over" ? "Variance %" : "Saving %"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, index) => {
              const amount = mode === "over" ? row.actual - row.budget : row.budget - row.actual;
              const pct = row.budget ? (amount / row.budget) * 100 : 0;
              return (
                <tr key={row.department} className="border-b border-zinc-800">
                  <td className="px-3 py-2 text-center">{index + 1}</td>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2 text-right">{nf.format(amount)}</td>
                  <td className="px-3 py-2 text-right">{pf.format(pct)}%</td>
                </tr>
              );
            }) : (
              <tr><td className="px-3 py-4 text-center text-zinc-500" colSpan={4}>Belum ada data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BenchmarkTable({ rows }: { rows: AnalysisRow[] }) {
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
  return (
    <section className="overflow-hidden rounded-2xl border border-gold-500/20 bg-zinc-950/80">
      <div className="bg-sky-900 px-4 py-2 text-center font-semibold text-white">
        BENCHMARK ALOKASI BUDGET PER FUNGSI DEPARTEMEN
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-blue-900 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Fungsi</th>
              <th className="px-3 py-2 text-right">Aktual</th>
              <th className="px-3 py-2 text-right">Aktual %</th>
              <th className="px-3 py-2 text-right">Anggaran</th>
              <th className="px-3 py-2 text-right">Anggaran %</th>
              <th className="px-3 py-2 text-right">Gap %</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Analisis</th>
              <th className="px-3 py-2 text-left">Rekomendasi</th>
              <th className="px-3 py-2 text-left">Prioritas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const actualPct = totalActual ? (row.actual / totalActual) * 100 : 0;
              const budgetPct = totalBudget ? (row.budget / totalBudget) * 100 : 0;
              const gapPct = actualPct - budgetPct;
              return (
                <tr key={row.department} className="border-b border-zinc-800">
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2 text-right">{nf.format(row.actual)}</td>
                  <td className="px-3 py-2 text-right">{pf.format(actualPct)}%</td>
                  <td className="px-3 py-2 text-right">{nf.format(row.budget)}</td>
                  <td className="px-3 py-2 text-right">{pf.format(budgetPct)}%</td>
                  <td className="px-3 py-2 text-right">{pf.format(gapPct)}%</td>
                  <td className={row.actual > row.budget ? "px-3 py-2 text-red-400" : "px-3 py-2 text-emerald-400"}>{row.status}</td>
                  <td className="px-3 py-2">{row.analysis}</td>
                  <td className="px-3 py-2">{row.recommendation}</td>
                  <td className="px-3 py-2">{row.priority}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
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
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const selected = sheets[sheetIndex];
  const headers = useMemo(
    () => (selected?.rows[headerRow] ?? []).map((value) => String(value ?? "").trim()),
    [selected, headerRow],
  );
  const rows = useMemo(
    () =>
      selected?.rows
        .slice(headerRow + 1)
        .filter((row) => row.some((value) => String(value ?? "").trim()))
        .map((row) =>
          Object.fromEntries(
            headers.map((header, index) => [
              header || `column_${index + 1}`,
              row[index] ?? "",
            ]),
          ),
        ) ?? [],
    [selected, headerRow, headers],
  );

  async function choose(next?: File) {
    if (!next) return;
    setFile(next);
    setBusy("Membaca file Excel...");
    setError("");
    try {
      const form = new FormData();
      form.append("file", next);
      const response = await fetch("/api/upload/preview", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "File gagal dibaca.");
      setSheets(data.sheets ?? []);
      setSheetIndex(0);
      setHeaderRow(detectHeaderRow(data.sheets?.[0]?.rows ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "File gagal dibaca.");
      setSheets([]);
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
          reportType: "analisis_variance",
          fileName: file.name,
          sheetName: selected.name,
          headers,
          rows,
          strategy,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && strategy === "cancel") {
        if (window.confirm("Data Analisa Budget sudah ada. Ganti dengan data yang baru?")) {
          await save("replace");
        }
        return;
      }
      if (!response.ok) throw new Error(data.error || "Data gagal disimpan.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Data gagal disimpan.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-4 md:p-10">
      <div className="mx-auto max-w-6xl rounded-2xl border border-gold-500/20 bg-zinc-950 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Upload / Import Analisa Budget</h2>
            <p className="text-sm text-zinc-400">Perusahaan: {company === "1001" ? "1001" : "Maison Y"}</p>
          </div>
          <button aria-label="Tutup" onClick={onClose}><X /></button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button className="secondary-button" onClick={() => downloadTemplate("analisis_variance")}>Download Template</button>
          <button className="gold-button" onClick={() => input.current?.click()}>Pilih File Excel</button>
          <input ref={input} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => choose(event.target.files?.[0])} />
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
                  {sheets.map((sheet, index) => <option value={index} key={sheet.name}>{sheet.name}</option>)}
                </select>
              </label>
              <label className="text-sm">Baris Header
                <select className="input mt-1 w-full" value={headerRow} onChange={(event) => setHeaderRow(Number(event.target.value))}>
                  {Array.from({ length: Math.min(30, selected.rows.length) }, (_, index) => <option value={index} key={index}>Baris {index + 1}</option>)}
                </select>
              </label>
              <div className="text-sm"><span className="text-zinc-400">Data terbaca</span><p className="mt-2 font-semibold">{rows.length} baris · {headers.filter(Boolean).length} kolom</p></div>
            </div>
            <div className="max-h-80 overflow-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-blue-900 text-white"><tr>{headers.filter(Boolean).map((header) => <th className="px-3 py-2 text-left" key={header}>{header}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 10).map((row, index) => <tr className="border-b border-zinc-800" key={index}>{headers.filter(Boolean).map((header) => <td className="px-3 py-2" key={header}>{String(row[header] ?? "")}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="flex justify-end"><button disabled={!!busy || !rows.length} className="gold-button disabled:opacity-40" onClick={() => save()}>{busy === "Menyimpan data..." ? "Menyimpan..." : "Import & Simpan"}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalisaBudgetEnhancer() {
  const [active, setActive] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rawRows, setRawRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState("");

  const syncCompany = useCallback(() => {
    const value = localStorage.getItem("budgeting_active_company");
    setCompany(value === "maison_y" ? "maison_y" : "1001");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports?reportType=analisis_variance&company=${company}`, { cache: "no-store" });
      const data = await response.json();
      setRawRows(response.ok && Array.isArray(data) ? data : []);
    } catch {
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    const enabled = window.location.pathname === "/analisis-variance";
    setActive(enabled);
    if (!enabled) return;

    syncCompany();
    const main = document.querySelector("main");
    const content = main?.children?.[1] as HTMLElement | undefined;
    if (content) {
      content.classList.add("analisa-budget-host");
      setHost(content);
    }

    const headerTitle = main?.querySelector("header h1");
    const previousTitle = headerTitle?.textContent ?? "";
    if (headerTitle) headerTitle.textContent = "Analisa Budget";

    const clickHandler = () => window.setTimeout(syncCompany, 0);
    document.addEventListener("click", clickHandler);
    return () => {
      document.removeEventListener("click", clickHandler);
      content?.classList.remove("analisa-budget-host");
      if (headerTitle) headerTitle.textContent = previousTitle;
    };
  }, [syncCompany]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  const rows = useMemo(
    () => rawRows.map(toAnalysisRow).filter((row): row is AnalysisRow => row !== null),
    [rawRows],
  );
  const over = useMemo(
    () => rows.filter((row) => row.actual > row.budget).sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget)).slice(0, 5),
    [rows],
  );
  const under = useMemo(
    () => rows.filter((row) => row.actual <= row.budget).sort((a, b) => (b.budget - b.actual) - (a.budget - a.actual)).slice(0, 5),
    [rows],
  );

  if (!active || !host) return null;

  return createPortal(
    <div className="analisa-budget-root space-y-6">
      <style>{`.analisa-budget-host > :not(.analisa-budget-root){display:none!important}`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400">Analisa performa budget per departemen</p>
          <p className="mt-1 text-xs text-gold-300">Data: {company === "1001" ? "1001" : "Maison Y"}</p>
        </div>
        <div className="flex gap-2">
          <button className="secondary-button" onClick={() => downloadTemplate("analisis_variance")}>Download Template</button>
          <button className="gold-button flex items-center gap-2" onClick={() => setModal(true)}><Upload className="h-4 w-4" /> Upload Excel</button>
        </div>
      </div>

      {notice && <div className="success"><b>{notice}</b></div>}
      {loading ? <p>Memuat data Analisa Budget...</p> : rows.length ? (
        <>
          <section className="rounded-2xl border border-gold-500/20 bg-gradient-to-b from-zinc-950 to-black p-5">
            <h2 className="mb-4 text-lg font-semibold">Grafik Aktual vs Anggaran per Departemen</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows}>
                  <CartesianGrid stroke="#27272a" />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={70} />
                  <YAxis tickFormatter={formatAxis} />
                  <Tooltip formatter={(value) => nf.format(Number(value))} />
                  <Legend />
                  <Bar dataKey="budget" name="Anggaran" fill="#2563EB" />
                  <Bar dataKey="actual" name="Aktual" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <AnalysisTable rows={rows} />

          <div className="grid gap-6 xl:grid-cols-2">
            <RankingTable title="TOP 5 DEPARTEMEN OVER BUDGET" rows={over} mode="over" />
            <RankingTable title="TOP 5 DEPARTEMEN UNDER BUDGET" rows={under} mode="under" />
          </div>

          <BenchmarkTable rows={rows} />
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-gold-500/30 bg-zinc-950/60 p-12 text-center">
          <h2 className="text-xl font-semibold">Belum ada data Analisa Budget</h2>
          <p className="mt-2 text-zinc-400">Download template atau upload file Excel untuk menampilkan tabel analisa, Top 5, benchmark, dan grafik.</p>
          <div className="mt-5 flex justify-center gap-2"><button className="secondary-button" onClick={() => downloadTemplate("analisis_variance")}>Download Template</button><button className="gold-button" onClick={() => setModal(true)}>Upload Excel</button></div>
        </section>
      )}

      {modal && <UploadModal company={company} onClose={() => setModal(false)} onSaved={() => { setNotice("Import berhasil. Data Analisa Budget sudah diperbarui."); void load(); }} />}
    </div>,
    host,
  );
}
