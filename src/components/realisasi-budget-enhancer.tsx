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
type Mode = "bulanan" | "departemen";
type Sheet = { name: string; rows: string[][] };
type ApiRow = Record<string, unknown>;
type Row = {
  tahun: string;
  bulan: string;
  department: string;
  realisasi: number;
  kategori: string;
  keterangan: string;
};

type PeriodOption = {
  key: string;
  label: string;
  sort: number;
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

function norm(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function num(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  let s = String(v ?? "")
    .trim()
    .replace(/^rp\s*/i, "")
    .replace(/\s/g, "");
  if (!s || s === "-") return 0;
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replaceAll(".", "").replace(",", ".");
  } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replaceAll(",", "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function month(v: unknown) {
  const r = String(v ?? "").trim().toLowerCase();
  const a: Record<string, string> = {
    jan: "Januari",
    januari: "Januari",
    feb: "Februari",
    februari: "Februari",
    mar: "Maret",
    maret: "Maret",
    apr: "April",
    april: "April",
    mei: "Mei",
    jun: "Juni",
    juni: "Juni",
    jul: "Juli",
    juli: "Juli",
    agu: "Agustus",
    agustus: "Agustus",
    sep: "September",
    september: "September",
    okt: "Oktober",
    oktober: "Oktober",
    nov: "November",
    november: "November",
    des: "Desember",
    desember: "Desember",
  };
  if (a[r]) return a[r];
  for (const [k, v2] of Object.entries(a)) {
    if (r.includes(k)) return v2;
  }
  return String(v ?? "").trim();
}

function pick(row: ApiRow, keys: string[]) {
  const wanted = new Set(keys.map(norm));
  for (const [k, v] of Object.entries(row)) {
    if (wanted.has(norm(k))) return v;
  }
  return undefined;
}

function fromApi(row: ApiRow): Row | null {
  const bulan = month(pick(row, ["bulan", "month"]));
  if (!bulan) return null;
  return {
    tahun: String(pick(row, ["tahun", "year"]) ?? "").trim(),
    bulan,
    department: String(pick(row, ["department", "departemen", "dept"]) ?? "")
      .trim()
      .toUpperCase(),
    realisasi: num(
      pick(row, ["total realisasi", "total_realisasi", "realisasi", "actual", "aktual"]),
    ),
    kategori: String(pick(row, ["kategori", "category"]) ?? "").trim(),
    keterangan: String(pick(row, ["keterangan", "description"]) ?? "").trim(),
  };
}

function formatAxis(v: number) {
  return Math.abs(v) >= 1_000_000_000
    ? `${nf.format(v / 1_000_000_000)} M`
    : Math.abs(v) >= 1_000_000
      ? `${nf.format(v / 1_000_000)} Jt`
      : nf.format(v);
}

function periodKey(row: Row) {
  const year = Number(String(row.tahun).replace(/[^0-9]/g, "")) || 0;
  const monthIndex = MONTHS.indexOf(row.bulan);
  return {
    key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    sort: year * 100 + Math.max(monthIndex + 1, 0),
    label: `${row.bulan} ${year || row.tahun}`.trim(),
  };
}

function UploadModal({
  company,
  mode,
  onClose,
  onSaved,
}: {
  company: Company;
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheet, setSheet] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const selected = sheets[sheet];
  const rawHeaders = useMemo(
    () => (selected?.rows[headerRow] ?? []).map((v) => String(v ?? "").trim()),
    [selected, headerRow],
  );
  const previewRows = useMemo(
    () =>
      selected?.rows
        .slice(headerRow + 1)
        .filter((r) => r.some((v) => String(v).trim()))
        .map((r) =>
          Object.fromEntries(rawHeaders.map((h, i) => [h || `column_${i + 1}`, r[i] ?? ""])),
        ) ?? [],
    [selected, headerRow, rawHeaders],
  );

  async function choose(f?: File) {
    if (!f) return;
    setFile(f);
    setBusy("Membaca file Excel...");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload/preview", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "File gagal dibaca");
      setSheets(d.sheets);
      setSheet(0);
      setHeaderRow(detectHeaderRow(d.sheets[0]?.rows ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "File gagal dibaca");
    } finally {
      setBusy("");
    }
  }

  async function save(strategy: "cancel" | "replace" = "cancel") {
    if (!file || !selected || !previewRows.length) return;
    setBusy("Menyimpan data...");
    setError("");
    try {
      const reportType = mode === "bulanan" ? "realisasi_bulanan" : "realisasi_per_departemen";
      const res = await fetch("/api/report-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          reportType,
          fileName: file.name,
          sheetName: selected.name,
          headers: rawHeaders,
          rows: previewRows,
          strategy,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409 && strategy === "cancel") {
        if (window.confirm("Data sudah ada. Ganti data lama?")) await save("replace");
        return;
      }
      if (!res.ok) throw new Error(d.error || "Data gagal disimpan");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Data gagal disimpan");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/80 p-4 md:p-10">
      <div className="mx-auto max-w-6xl rounded-2xl border border-gold-500/20 bg-zinc-950 p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Upload / Import {mode === "bulanan" ? "Laporan Realisasi Bulanan" : "Laporan Realisasi Per Departemen"}
          </h2>
          <button onClick={onClose} aria-label="Tutup"><X /></button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            className="secondary-button"
            onClick={() => downloadTemplate(mode === "bulanan" ? "realisasi_bulanan" : "realisasi_per_departemen")}
          >
            Download Template
          </button>
          <button className="gold-button" onClick={() => input.current?.click()}>Pilih File Excel</button>
          <input
            ref={input}
            hidden
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => choose(e.target.files?.[0])}
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
                  value={sheet}
                  onChange={(e) => {
                    const i = Number(e.target.value);
                    setSheet(i);
                    setHeaderRow(detectHeaderRow(sheets[i]?.rows ?? []));
                  }}
                >
                  {sheets.map((s, i) => <option key={`${s.name}-${i}`} value={i}>{s.name}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Baris Header
                <select className="input mt-1 w-full" value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
                  {Array.from({ length: Math.min(30, selected.rows.length) }, (_, i) => (
                    <option key={i} value={i}>Baris {i + 1}</option>
                  ))}
                </select>
              </label>
              <div className="text-sm">
                <span className="text-zinc-400">Data terbaca</span>
                <p className="mt-2 font-semibold">{previewRows.length} baris</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="min-w-[700px] w-full text-sm">
                <thead className="bg-blue-900 text-white">
                  <tr>{rawHeaders.map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 12).map((r, i) => (
                    <tr key={i} className="border-b border-zinc-800">
                      {rawHeaders.map((h) => <td key={h} className="px-3 py-2">{String((r as ApiRow)[h] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button className="gold-button" disabled={!!busy || !previewRows.length} onClick={() => save()}>
                Import & Simpan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RealisasiBudgetEnhancer() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<Row[]>([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fromPeriod, setFromPeriod] = useState("");
  const [toPeriod, setToPeriod] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  const syncCompany = useCallback(
    () => setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001"),
    [],
  );

  useEffect(() => {
    const apply = () => {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("view");
      const next: Mode | null =
        window.location.pathname === "/realisasi-budget" && v === "bulanan"
          ? "bulanan"
          : window.location.pathname === "/realisasi-budget" && v === "per-departemen"
            ? "departemen"
            : null;
      setMode(next);
      syncCompany();

      document.querySelectorAll<HTMLAnchorElement>('a[href="/realisasi-budget"]').forEach((head) => {
        const p = head.parentElement;
        if (!p) return;
        let monthly = p.querySelector<HTMLAnchorElement>('a[data-realisasi-submenu="bulanan"]');
        if (!monthly) {
          monthly = head.cloneNode(true) as HTMLAnchorElement;
          monthly.href = "/realisasi-budget?view=bulanan";
          monthly.dataset.realisasiSubmenu = "bulanan";
          monthly.classList.add("ml-6");
          monthly.childNodes.forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE) n.textContent = "Laporan Realisasi Bulanan";
          });
          head.insertAdjacentElement("afterend", monthly);
        }
        let department = p.querySelector<HTMLAnchorElement>('a[data-realisasi-submenu="departemen"]');
        if (!department) {
          department = head.cloneNode(true) as HTMLAnchorElement;
          department.href = "/realisasi-budget?view=per-departemen";
          department.dataset.realisasiSubmenu = "departemen";
          department.classList.add("ml-6");
          department.childNodes.forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE) n.textContent = "Laporan Per Departemen";
          });
          monthly.insertAdjacentElement("afterend", department);
        }
        const open = next !== null;
        [monthly, department].forEach((x) => { x.style.display = open ? "" : "none"; });
      });

      if (next) {
        const main = document.querySelector("main");
        const content = main?.children.item(1) as HTMLElement | null;
        if (content) {
          content.classList.add("realisasi-enhancer-host");
          setHost(content);
        }
        const title = main?.querySelector("header h1");
        if (title) title.textContent = next === "bulanan" ? "Laporan Realisasi Bulanan" : "Laporan Realisasi Per Departemen";
      }
    };

    apply();
    const timer = window.setTimeout(apply, 80);
    return () => window.clearTimeout(timer);
  }, [syncCompany]);

  const load = useCallback(async () => {
    if (!mode) return;
    setLoading(true);
    try {
      const reportType = mode === "bulanan" ? "realisasi_bulanan" : "realisasi_per_departemen";
      const res = await fetch(`/api/reports?reportType=${reportType}&company=${company}`, { cache: "no-store" });
      const payload: unknown = await res.json();
      setRows(
        res.ok && Array.isArray(payload)
          ? payload.map((x) => fromApi(x as ApiRow)).filter((x): x is Row => x !== null)
          : [],
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode, company]);

  useEffect(() => { void load(); }, [load]);

  const periodOptions = useMemo<PeriodOption[]>(() => {
    const map = new Map<string, PeriodOption>();
    rows.forEach((row) => {
      const p = periodKey(row);
      if (!map.has(p.key)) map.set(p.key, p);
    });
    return Array.from(map.values()).sort((a, b) => a.sort - b.sort);
  }, [rows]);

  const departments = useMemo(
    () => Array.from(new Set(rows.map((row) => row.department).filter(Boolean))).sort(),
    [rows],
  );

  useEffect(() => {
    if (mode !== "departemen" || !periodOptions.length) return;
    setFromPeriod((current) => current && periodOptions.some((p) => p.key === current) ? current : periodOptions[0].key);
    setToPeriod((current) => current && periodOptions.some((p) => p.key === current) ? current : periodOptions[periodOptions.length - 1].key);
    setDepartmentFilter((current) => current === "ALL" || departments.includes(current) ? current : "ALL");
  }, [mode, periodOptions, departments]);

  const filteredRows = useMemo(() => {
    if (mode !== "departemen") return rows;
    const from = periodOptions.find((p) => p.key === fromPeriod)?.sort ?? -Infinity;
    const to = periodOptions.find((p) => p.key === toPeriod)?.sort ?? Infinity;
    const min = Math.min(from, to);
    const max = Math.max(from, to);

    return rows.filter((row) => {
      const p = periodKey(row).sort;
      const matchesPeriod = p >= min && p <= max;
      const matchesDepartment = departmentFilter === "ALL" || row.department === departmentFilter;
      return matchesPeriod && matchesDepartment;
    });
  }, [rows, mode, periodOptions, fromPeriod, toPeriod, departmentFilter]);

  const chart = useMemo(() => {
    if (mode === "bulanan") {
      const map = new Map<string, number>();
      filteredRows.forEach((r) => map.set(r.bulan, (map.get(r.bulan) ?? 0) + r.realisasi));
      return MONTHS.map((b) => ({ label: b, realisasi: map.get(b) ?? 0 }));
    }
    const map = new Map<string, number>();
    filteredRows.forEach((r) => {
      const d = r.department || "LAINNYA";
      map.set(d, (map.get(d) ?? 0) + r.realisasi);
    });
    return Array.from(map.entries()).map(([label, realisasi]) => ({ label, realisasi }));
  }, [filteredRows, mode]);

  if (!mode || !host) return null;

  return createPortal(
    <div className="realisasi-enhancer-root space-y-6">
      <style>{`.realisasi-enhancer-host > :not(.realisasi-enhancer-root){display:none!important}`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {mode === "bulanan" ? "Laporan Realisasi Bulanan" : "Laporan Realisasi Per Departemen"}
          </h2>
          <p className="text-sm text-zinc-400">
            {mode === "bulanan" ? "Trend realisasi budget per bulan" : "Perbandingan realisasi budget antar departemen"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="secondary-button"
            onClick={() => downloadTemplate(mode === "bulanan" ? "realisasi_bulanan" : "realisasi_per_departemen")}
          >
            Download Template
          </button>
          <button className="gold-button flex items-center gap-2" onClick={() => setModal(true)}>
            <Upload className="h-4 w-4" /> Upload Excel
          </button>
        </div>
      </div>

      {mode === "departemen" && rows.length > 0 && (
        <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm text-zinc-300">
              <span className="mb-2 block">Dari Periode</span>
              <select className="input w-full" value={fromPeriod} onChange={(e) => setFromPeriod(e.target.value)}>
                {periodOptions.map((period) => <option key={period.key} value={period.key}>{period.label}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-300">
              <span className="mb-2 block">Sampai Periode</span>
              <select className="input w-full" value={toPeriod} onChange={(e) => setToPeriod(e.target.value)}>
                {periodOptions.map((period) => <option key={period.key} value={period.key}>{period.label}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-300">
              <span className="mb-2 block">Departemen</span>
              <select className="input w-full" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                <option value="ALL">Semua Departemen</option>
                {departments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </label>
          </div>
        </section>
      )}

      {loading ? (
        <p>Memuat data...</p>
      ) : rows.length ? (
        <>
          <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5">
            <h3 className="mb-4 text-lg font-semibold">
              Grafik {mode === "bulanan" ? "Realisasi Bulanan" : "Realisasi Per Departemen"}
            </h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {mode === "bulanan" ? (
                  <LineChart data={chart}>
                    <CartesianGrid stroke="#27272a" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={formatAxis} />
                    <Tooltip formatter={(v: number | string) => `Rp ${nf.format(Number(v))}`} />
                    <Legend />
                    <Line type="monotone" dataKey="realisasi" name="Realisasi" stroke="#EF4444" strokeWidth={3} />
                  </LineChart>
                ) : (
                  <BarChart data={chart}>
                    <CartesianGrid stroke="#27272a" />
                    <XAxis dataKey="label" interval={0} angle={-15} textAnchor="end" height={70} />
                    <YAxis tickFormatter={formatAxis} />
                    <Tooltip formatter={(v: number | string) => `Rp ${nf.format(Number(v))}`} />
                    <Legend />
                    <Bar dataKey="realisasi" name="Realisasi" fill="#2563EB" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gold-500/20 bg-zinc-950/80">
            <div className="overflow-x-auto">
              <table className="min-w-[850px] w-full text-sm">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Tahun</th>
                    <th className="px-4 py-3 text-left">Bulan</th>
                    {mode === "departemen" && <th className="px-4 py-3 text-left">Departemen</th>}
                    <th className="px-4 py-3 text-right">Realisasi</th>
                    {mode === "departemen" && <th className="px-4 py-3 text-left">Kategori</th>}
                    <th className="px-4 py-3 text-left">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={`${r.tahun}-${r.bulan}-${r.department}-${i}`} className="border-b border-zinc-800">
                      <td className="px-4 py-3">{r.tahun}</td>
                      <td className="px-4 py-3">{r.bulan}</td>
                      {mode === "departemen" && <td className="px-4 py-3">{r.department}</td>}
                      <td className="px-4 py-3 text-right">{nf.format(r.realisasi)}</td>
                      {mode === "departemen" && <td className="px-4 py-3">{r.kategori}</td>}
                      <td className="px-4 py-3">{r.keterangan}</td>
                    </tr>
                  ))}
                  {!filteredRows.length && (
                    <tr>
                      <td colSpan={mode === "departemen" ? 6 : 4} className="px-4 py-8 text-center text-zinc-500">
                        Tidak ada data untuk filter yang dipilih.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-gold-500/30 bg-zinc-950/60 p-12 text-center">
          <h3 className="text-xl font-semibold">Belum ada data Realisasi Budget</h3>
          <p className="mt-2 text-zinc-400">Upload file Excel untuk menampilkan grafik dan tabel realisasi.</p>
        </section>
      )}

      {modal && (
        <UploadModal
          company={company}
          mode={mode}
          onClose={() => setModal(false)}
          onSaved={() => { void load(); }}
        />
      )}
    </div>,
    host,
  );
}
