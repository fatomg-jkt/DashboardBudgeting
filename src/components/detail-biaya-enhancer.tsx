"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, X } from "lucide-react";
import { detectHeaderRow, downloadTemplate } from "@/lib/import-utils";

type Company = "1001" | "maison_y";
type Sheet = { name: string; rows: string[][] };
type DetailRow = { deskripsi_coa: string; department: string; anggaran: number; aktual: number };

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const norm = (v: unknown) => String(v ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value ?? "").trim().replace(/^rp\s*/i, "").replace(/\s/g, "");
  if (!text || text === "-") return 0;
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/^\(|\)$/g, "");
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replaceAll(".", "").replace(",", ".");
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replaceAll(",", "");
  const n = Number(text);
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : 0;
}

function inferDepartment(header: string) {
  return header
    .replace(/\s*[-–—:]?\s*(aktual|actual|anggaran|budget)\s*$/i, "")
    .trim()
    .toUpperCase();
}

function normalizeSheetRows(sheet: Sheet, headerRow: number): DetailRow[] {
  const headers = (sheet.rows[headerRow] ?? []).map((h) => String(h ?? "").trim());
  const normalized = headers.map(norm);
  const descIndex = normalized.findIndex((h) => h.includes("deskripsi") || h.includes("coa") || h === "description");
  const deptIndex = normalized.findIndex((h) => ["department", "departemen", "dept"].includes(h));
  const budgetIndex = normalized.findIndex((h) => h === "anggaran" || h === "budget" || h.endsWith("_anggaran") || h.endsWith("_budget"));
  const actualIndex = normalized.findIndex((h) => h === "aktual" || h === "actual" || h.endsWith("_aktual") || h.endsWith("_actual"));
  if (descIndex < 0 || budgetIndex < 0 || actualIndex < 0) return [];

  const inferredDept = inferDepartment(headers[actualIndex] || headers[budgetIndex]);
  return sheet.rows
    .slice(headerRow + 1)
    .map((row) => ({
      deskripsi_coa: String(row[descIndex] ?? "").trim(),
      department: String(deptIndex >= 0 ? row[deptIndex] ?? "" : inferredDept).trim().toUpperCase(),
      anggaran: numberValue(row[budgetIndex]),
      aktual: numberValue(row[actualIndex]),
    }))
    .filter((row) => row.deskripsi_coa && row.department);
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
            <th className="px-4 py-3 text-right">%</th>
            <th className="px-4 py-3 text-left">Status Budget</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const variancePct = row.anggaran ? ((row.aktual - row.anggaran) / row.anggaran) * 100 : row.aktual > 0 ? 100 : 0;
            const over = row.aktual > row.anggaran;
            return (
              <tr key={`${row.department}-${row.deskripsi_coa}-${index}`} className="border-b border-zinc-800">
                <td className="px-4 py-3">{row.deskripsi_coa}</td>
                <td className="px-4 py-3 text-right">{nf.format(row.anggaran)}</td>
                <td className="px-4 py-3 text-right">{nf.format(row.aktual)}</td>
                <td className={over ? "px-4 py-3 text-right font-semibold text-red-400" : "px-4 py-3 text-right font-semibold text-emerald-400"}>{pf.format(variancePct)}%</td>
                <td className={over ? "px-4 py-3 font-semibold text-red-400" : "px-4 py-3 font-semibold text-emerald-400"}>{over ? "Over Budget" : "Under Budget"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailTables({ rows, preview = false }: { rows: DetailRow[]; preview?: boolean }) {
  const grouped = useMemo(() => {
    const map = new Map<string, DetailRow[]>();
    rows.forEach((row) => {
      const list = map.get(row.department) ?? [];
      list.push(row);
      map.set(row.department, list);
    });
    return [...map.entries()];
  }, [rows]);

  return (
    <div className="space-y-6">
      {grouped.map(([department, deptRows]) => (
        <div key={department} className="space-y-2">
          {grouped.length > 1 && <h3 className="font-semibold text-gold-300">{department}</h3>}
          <DepartmentTable department={department} rows={preview ? deptRows.slice(0, 15) : deptRows} />
        </div>
      ))}
    </div>
  );
}

function UploadModal({ company, onClose, onSaved }: { company: Company; onClose: () => void; onSaved: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const selected = sheets[sheetIndex];
  const rows = useMemo(() => selected ? normalizeSheetRows(selected, headerRow) : [], [selected, headerRow]);

  async function choose(next?: File) {
    if (!next) return;
    setFile(next);
    setBusy("Membaca file Excel...");
    setError("");
    try {
      const form = new FormData();
      form.append("file", next);
      const res = await fetch("/api/upload/preview", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "File gagal dibaca.");
      setSheets(data.sheets ?? []);
      setSheetIndex(0);
      setHeaderRow(detectHeaderRow(data.sheets?.[0]?.rows ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "File gagal dibaca.");
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
      const res = await fetch("/api/report-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          reportType: "budget_detail_biaya",
          fileName: file.name,
          sheetName: selected.name,
          headers: ["deskripsi_coa", "department", "anggaran", "aktual"],
          rows,
          strategy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && strategy === "cancel") {
        if (window.confirm("Data Laporan Per Detail Biaya sudah ada. Ganti data lama?")) await save("replace");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Data gagal disimpan.");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Data gagal disimpan.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-4 md:p-10">
      <div className="mx-auto max-w-6xl rounded-2xl border border-gold-500/20 bg-zinc-950 p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Upload Laporan Per Detail Biaya</h2>
            <p className="text-sm text-zinc-400">Perusahaan: {company === "1001" ? "1001" : "Maison Y"}</p>
          </div>
          <button onClick={onClose} aria-label="Tutup"><X /></button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <button className="secondary-button" onClick={() => downloadTemplate("budget_detail_biaya")}>Download Template</button>
          <button className="gold-button" onClick={() => input.current?.click()}>Pilih File Excel</button>
          <input ref={input} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => choose(e.target.files?.[0])} />
        </div>
        {busy && <p className="mt-4 text-gold-300">{busy}</p>}
        {error && <div className="error mt-4">{error}</div>}
        {selected && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">Sheet
                <select className="input mt-1 w-full" value={sheetIndex} onChange={(e) => { const i = Number(e.target.value); setSheetIndex(i); setHeaderRow(detectHeaderRow(sheets[i]?.rows ?? [])); }}>
                  {sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
                </select>
              </label>
              <label className="text-sm">Baris Header
                <select className="input mt-1 w-full" value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
                  {Array.from({ length: Math.min(30, selected.rows.length) }, (_, i) => <option key={i} value={i}>Baris {i + 1}</option>)}
                </select>
              </label>
              <div className="text-sm"><span className="text-zinc-400">Data terbaca</span><p className="mt-2 font-semibold">{rows.length} baris</p></div>
            </div>
            {rows.length ? <DetailTables rows={rows} preview /> : <div className="error">Header wajib: Deskripsi COA, Anggaran, Aktual. Nama departemen boleh di kolom Department atau di header seperti “DEVELOPMENT - Aktual/Anggaran”.</div>}
            <div className="flex justify-end"><button disabled={!!busy || !rows.length} className="gold-button disabled:opacity-40" onClick={() => save()}>{busy === "Menyimpan data..." ? "Menyimpan..." : "Import & Simpan"}</button></div>
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
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const syncCompany = useCallback(() => setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001"), []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?reportType=budget_detail_biaya&company=${company}`, { cache: "no-store" });
      const data = await res.json();
      setRows(res.ok && Array.isArray(data) ? data.map((r: any) => ({
        deskripsi_coa: String(r.deskripsi_coa ?? r.deskripsi ?? r.description ?? ""),
        department: String(r.department ?? r.departemen ?? "").toUpperCase(),
        anggaran: numberValue(r.anggaran ?? r.budget),
        aktual: numberValue(r.aktual ?? r.actual),
      })).filter((r: DetailRow) => r.deskripsi_coa && r.department) : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    const enabled = window.location.pathname === "/budget-vs-actual" && new URLSearchParams(window.location.search).get("view") === "detail-biaya";
    setActive(enabled);
    if (!enabled) return;
    syncCompany();
    const main = document.querySelector("main");
    const content = main?.children?.[1] as HTMLElement | undefined;
    if (content) {
      content.classList.add("detail-biaya-host");
      setHost(content);
    }
    const title = main?.querySelector("header h1");
    const old = title?.textContent ?? "";
    if (title) title.textContent = "Laporan Per Detail Biaya";
    const click = () => window.setTimeout(syncCompany, 0);
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("click", click);
      content?.classList.remove("detail-biaya-host");
      if (title) title.textContent = old;
    };
  }, [syncCompany]);

  useEffect(() => { if (active) void load(); }, [active, load]);
  if (!active || !host) return null;

  return createPortal(
    <div className="detail-biaya-root space-y-6">
      <style>{`.detail-biaya-host > :not(.detail-biaya-root){display:none!important}`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Laporan Per Detail Biaya</h2>
          <p className="text-sm text-zinc-400">Deskripsi COA · [Departemen] Anggaran · [Departemen] Aktual · % Analisis Variance · Status Budget</p>
        </div>
        <div className="flex gap-2">
          <button className="secondary-button" onClick={() => downloadTemplate("budget_detail_biaya")}>Download Template</button>
          <button className="gold-button flex items-center gap-2" onClick={() => setModal(true)}><Upload className="h-4 w-4" /> Upload Excel</button>
        </div>
      </div>
      {loading ? <p>Memuat data...</p> : rows.length ? <DetailTables rows={rows} /> : (
        <section className="rounded-2xl border border-dashed border-gold-500/30 bg-zinc-950/60 p-12 text-center">
          <h2 className="text-xl font-semibold">Belum ada data Laporan Per Detail Biaya</h2>
          <p className="mt-2 text-zinc-400">Upload Excel dengan format Deskripsi COA, [Nama Departemen] - Anggaran, [Nama Departemen] - Aktual, dan %.</p>
          <button className="gold-button mt-5" onClick={() => setModal(true)}>Upload Excel</button>
        </section>
      )}
      {modal && <UploadModal company={company} onClose={() => setModal(false)} onSaved={() => void load()} />}
    </div>,
    host,
  );
}
