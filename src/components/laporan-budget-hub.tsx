"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, ExternalLink, Upload } from "lucide-react";
import { detectHeaderRow } from "@/lib/import-utils";

type Company = "1001" | "maison_y";
type Row = Record<string, unknown>;
type Sheet = { name: string; rows: string[][] };
type Dataset = {
  type: string;
  label: string;
  group: string;
  href: string;
  rows: Row[];
  loading: boolean;
};

const REPORTS = [
  { type: "pengajuan_budget", label: "Pengajuan Budget", group: "Pengajuan & Analisa", href: "/pengajuan-budget" },
  { type: "budget_vs_actual", label: "Budget vs Actual - Laporan Per Departemen", group: "Budget vs Actual", href: "/budget-vs-actual?view=per-departemen" },
  { type: "budget_detail_biaya", label: "Budget vs Actual - Laporan Per Detail Biaya", group: "Budget vs Actual", href: "/budget-vs-actual?view=detail-biaya" },
  { type: "monthly_budget_actual", label: "Monthly Budget vs Actual", group: "Budget vs Actual", href: "/budget-vs-actual?view=monthly" },
  { type: "cumulative_budget_actual_ytd", label: "Cumulative Budget vs Actual YTD", group: "Budget vs Actual", href: "/budget-vs-actual?view=ytd" },
  { type: "laporan_budget", label: "Laporan Sisa Budget - Per Departemen", group: "Laporan Sisa Budget", href: "/laporan-budget?view=sisa-budget-per-departemen" },
  { type: "sisa_budget_detail_biaya", label: "Laporan Sisa Budget - Per Detail Biaya", group: "Laporan Sisa Budget", href: "/laporan-budget?view=sisa-budget-detail-biaya" },
  { type: "realisasi_budget", label: "Realisasi Budget", group: "Realisasi Budget", href: "/realisasi-budget" },
  { type: "realisasi_bulanan", label: "Laporan Realisasi Bulanan", group: "Realisasi Budget", href: "/realisasi-budget?view=bulanan" },
  { type: "realisasi_per_departemen", label: "Laporan Realisasi Per Departemen", group: "Realisasi Budget", href: "/realisasi-budget?view=per-departemen" },
  { type: "analisis_variance", label: "Analisa Budget", group: "Pengajuan & Analisa", href: "/analisis-variance" },
  { type: "laporan_budget_upload", label: "Laporan Excel Tersimpan", group: "Laporan Upload Manual", href: "/laporan-budget" },
] as const;

const hiddenColumns = new Set(["id", "importId", "rowNumber", "__localImportId"]);
const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

function displayValue(value: unknown) {
  if (typeof value === "number") return nf.format(value);
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function PreviewTable({ rows, limit = 10 }: { rows: Row[]; limit?: number }) {
  const headers = useMemo(
    () => [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => !hiddenColumns.has(key)),
    [rows],
  );

  if (!rows.length) return <p className="py-5 text-sm text-zinc-500">Belum ada data pada laporan ini.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-[900px] w-full text-sm">
        <thead className="bg-blue-900 text-white">
          <tr>
            {headers.map((header) => (
              <th className="px-3 py-2 text-left" key={header}>{header.replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((row, index) => (
            <tr className="border-b border-zinc-800" key={String(row.id ?? row.importId ?? index)}>
              {headers.map((header) => <td className="px-3 py-2" key={header}>{displayValue(row[header])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && <p className="px-3 py-2 text-xs text-zinc-500">Preview {limit} dari {nf.format(rows.length)} baris.</p>}
    </div>
  );
}

function UploadLaporan({ company, onSaved }: { company: Company; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = sheets[sheetIndex];
  const headers = useMemo(() => (selected?.rows[headerRow] ?? []).map((v) => String(v ?? "").trim()), [selected, headerRow]);
  const rows = useMemo(() => {
    if (!selected) return [];
    return selected.rows
      .slice(headerRow + 1)
      .filter((row) => row.some((cell) => String(cell ?? "").trim()))
      .map((row) => Object.fromEntries(headers.map((header, index) => [header || `Kolom ${index + 1}`, row[index] ?? ""])));
  }, [selected, headerRow, headers]);

  async function choose(next?: File) {
    if (!next) return;
    setFile(next);
    setBusy("Membaca Excel...");
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      form.append("file", next);
      const response = await fetch("/api/upload/preview", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.sheets)) throw new Error(payload.error || "File Excel gagal dibaca.");
      setSheets(payload.sheets);
      setSheetIndex(0);
      setHeaderRow(detectHeaderRow(payload.sheets[0]?.rows ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "File Excel gagal dibaca.");
      setSheets([]);
    } finally {
      setBusy("");
    }
  }

  async function save(strategy: "cancel" | "replace" | "new" = "cancel") {
    if (!file || !selected || !rows.length) return;
    setBusy("Menyimpan laporan...");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/report-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          reportType: "laporan_budget_upload",
          fileName: file.name,
          sheetName: selected.name,
          headers,
          rows,
          strategy,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 409 && strategy === "cancel") {
        const replace = window.confirm("File laporan serupa sudah pernah disimpan. Klik OK untuk mengganti data lama, atau Cancel untuk menyimpan sebagai laporan baru.");
        await save(replace ? "replace" : "new");
        return;
      }
      if (!response.ok) throw new Error(payload.error || "Laporan gagal disimpan.");
      setMessage(`Berhasil disimpan: ${payload.total ?? rows.length} baris.`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laporan gagal disimpan.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Upload Laporan Excel</h3>
          <p className="mt-1 text-sm text-zinc-400">Upload file Excel, preview datanya, lalu simpan ke Laporan Budget agar bisa dilihat kembali.</p>
        </div>
        <button className="gold-button flex items-center gap-2" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> Pilih Excel
        </button>
        <input ref={inputRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => choose(e.target.files?.[0])} />
      </div>

      {busy && <p className="mt-4 text-sm text-gold-300">{busy}</p>}
      {error && <div className="error mt-4">{error}</div>}
      {message && <div className="success mt-4">{message}</div>}

      {selected && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div><p className="text-xs text-zinc-500">File</p><p className="font-medium">{file?.name}</p></div>
            <label className="text-sm">Sheet
              <select className="input mt-1 w-full" value={sheetIndex} onChange={(e) => { const i = Number(e.target.value); setSheetIndex(i); setHeaderRow(detectHeaderRow(sheets[i]?.rows ?? [])); }}>
                {sheets.map((sheet, i) => <option value={i} key={`${sheet.name}-${i}`}>{sheet.name}</option>)}
              </select>
            </label>
            <label className="text-sm">Baris Header
              <select className="input mt-1 w-full" value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
                {Array.from({ length: Math.min(30, selected.rows.length) }, (_, i) => <option key={i} value={i}>Baris {i + 1}</option>)}
              </select>
            </label>
          </div>
          <PreviewTable rows={rows} limit={8} />
          <div className="flex justify-end">
            <button className="gold-button" disabled={!!busy || !rows.length} onClick={() => save()}>Simpan Laporan</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function LaporanBudgetHub() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [datasets, setDatasets] = useState<Dataset[]>(() => REPORTS.map((report) => ({ ...report, rows: [], loading: true })));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const syncState = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const isActive = window.location.pathname === "/laporan-budget" && !params.get("view");
    setActive(isActive);
    setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001");
    const main = document.querySelector("main");
    const content = main?.children.item(1) as HTMLElement | null;
    if (!content) return;
    if (!isActive) {
      content.classList.remove("laporan-budget-hub-host");
      setHost(null);
      return;
    }
    content.classList.add("laporan-budget-hub-host");
    let mount = content.querySelector<HTMLElement>("[data-laporan-budget-hub-mount]");
    if (!mount) {
      mount = document.createElement("div");
      mount.dataset.laporanBudgetHubMount = "true";
      content.appendChild(mount);
    }
    setHost(mount);
  }, []);

  const loadAll = useCallback(async () => {
    if (!active) return;
    setDatasets(REPORTS.map((report) => ({ ...report, rows: [], loading: true })));
    const loaded = await Promise.all(REPORTS.map(async (report): Promise<Dataset> => {
      try {
        const response = await fetch(`/api/reports?reportType=${report.type}&company=${company}`, { cache: "no-store" });
        const payload: unknown = await response.json();
        return { ...report, rows: response.ok && Array.isArray(payload) ? (payload as Row[]) : [], loading: false };
      } catch {
        return { ...report, rows: [], loading: false };
      }
    }));
    setDatasets(loaded);
  }, [active, company, version]);

  useEffect(() => {
    syncState();
    const click = () => window.setTimeout(syncState, 0);
    const pop = () => syncState();
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", pop);
      document.querySelector("main")?.children.item(1)?.classList.remove("laporan-budget-hub-host");
    };
  }, [pathname, syncState]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const totalRows = datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);
  const filledReports = datasets.filter((dataset) => dataset.rows.length > 0).length;
  const groups = [...new Set(datasets.map((dataset) => dataset.group))];

  if (!active || !host) return null;

  return createPortal(
    <div className="laporan-budget-hub space-y-6">
      <style>{`.laporan-budget-hub-host > :not([data-laporan-budget-hub-mount]){display:none!important}`}</style>
      <div>
        <h2 className="text-2xl font-semibold">Pusat Laporan Budget</h2>
        <p className="mt-1 text-sm text-zinc-400">Kumpulan data dari seluruh menu dan submenu budgeting untuk perusahaan {company === "1001" ? "1001" : "Maison Y"}.</p>
      </div>

      <UploadLaporan company={company} onSaved={() => setVersion((v) => v + 1)} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5"><p className="text-sm text-zinc-400">Jenis Laporan</p><p className="mt-2 text-3xl font-semibold">{datasets.length}</p></div>
        <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5"><p className="text-sm text-zinc-400">Laporan Berisi Data</p><p className="mt-2 text-3xl font-semibold">{filledReports}</p></div>
        <div className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5"><p className="text-sm text-zinc-400">Total Baris Data</p><p className="mt-2 text-3xl font-semibold">{nf.format(totalRows)}</p></div>
      </div>

      {groups.map((group) => (
        <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/70 p-5" key={group}>
          <h3 className="mb-4 text-xl font-semibold">{group}</h3>
          <div className="space-y-3">
            {datasets.filter((dataset) => dataset.group === group).map((dataset) => {
              const isOpen = expanded === dataset.type;
              return (
                <div className="rounded-xl border border-zinc-800 bg-black/40" key={dataset.type}>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold">{dataset.label}</p>
                      <p className="mt-1 text-sm text-zinc-400">{dataset.loading ? "Memuat data..." : `${nf.format(dataset.rows.length)} baris data`}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dataset.type !== "laporan_budget_upload" && <a className="secondary-button flex items-center gap-2" href={dataset.href}>Buka Halaman <ExternalLink className="h-4 w-4" /></a>}
                      <button className="secondary-button flex items-center gap-2" onClick={() => setExpanded(isOpen ? null : dataset.type)}>
                        {isOpen ? "Tutup Data" : "Lihat Data"}{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {isOpen && <div className="border-t border-zinc-800 p-4"><PreviewTable rows={dataset.rows} limit={dataset.type === "laporan_budget_upload" ? 50 : 10} /></div>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>,
    host,
  );
}
