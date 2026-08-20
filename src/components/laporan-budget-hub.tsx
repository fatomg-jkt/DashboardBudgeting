"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Download, ExternalLink, FileSpreadsheet, Upload } from "lucide-react";

type Company = "1001" | "maison_y";
type Row = Record<string, unknown>;
type Dataset = {
  type: string;
  label: string;
  group: string;
  href: string;
  rows: Row[];
  loading: boolean;
};
type ArchiveItem = {
  id: string;
  periode: string;
  keterangan: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
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
] as const;

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function ArchiveUploader({ company, onSaved }: { company: Company; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [periode, setPeriode] = useState("Januari");
  const [keterangan, setKeterangan] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function choose(next?: File) {
    if (!next) return;
    setFile(next);
    setMessage("");
    setError("");
    if (!keterangan.trim()) {
      setKeterangan(next.name.replace(/\.(xlsx|xls|csv)$/i, ""));
    }
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const form = new FormData();
      form.append("company", company);
      form.append("periode", periode);
      form.append("keterangan", keterangan.trim() || file.name.replace(/\.(xlsx|xls|csv)$/i, ""));
      form.append("file", file);

      const response = await fetch("/api/report-archive", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "File Excel gagal disimpan.");

      setMessage(`${file.name} berhasil disimpan sebagai file Excel asli.`);
      setFile(null);
      setKeterangan("");
      if (inputRef.current) inputRef.current.value = "";
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "File Excel gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Penyimpanan Kertas Kerja Excel</h3>
          <p className="mt-1 text-sm text-zinc-400">
            File disimpan apa adanya sebagai arsip. Isi Excel tidak ditampilkan di halaman ini dan upload baru tidak mengganti file sebelumnya.
          </p>
        </div>
        <button className="gold-button flex items-center gap-2" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> Pilih Excel
        </button>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </div>

      {message && <div className="success mt-4">{message}</div>}
      {error && <div className="error mt-4">{error}</div>}

      {file && (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-black/30 p-4">
          <div className="grid gap-4 md:grid-cols-[180px_1fr_1fr]">
            <label className="text-sm">
              Periode
              <select className="input mt-1 w-full" value={periode} onChange={(event) => setPeriode(event.target.value)}>
                {MONTHS.map((month) => <option key={month}>{month}</option>)}
              </select>
            </label>
            <label className="text-sm">
              Keterangan
              <input
                className="input mt-1 w-full"
                value={keterangan}
                onChange={(event) => setKeterangan(event.target.value)}
                placeholder="Contoh: Kertas kerja budget Juni"
              />
            </label>
            <div className="text-sm">
              <p className="text-zinc-500">File yang akan disimpan</p>
              <div className="mt-2 flex items-center gap-2 font-medium">
                <FileSpreadsheet className="h-5 w-5 text-gold-300" />
                <span>{file.name}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{formatSize(file.size)}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button className="gold-button" disabled={busy} onClick={save}>
              {busy ? "Menyimpan..." : "Simpan File Excel"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ArchiveTable({ company, items }: { company: Company; items: ArchiveItem[] }) {
  if (!items.length) {
    return <p className="py-6 text-sm text-zinc-500">Belum ada file Excel yang tersimpan.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-blue-900 text-white">
            <tr>
              <th className="px-4 py-3 text-left">No</th>
              <th className="px-4 py-3 text-left">Periode</th>
              <th className="px-4 py-3 text-left">Keterangan</th>
              <th className="px-4 py-3 text-left">Data yang disimpan</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr className="border-b border-zinc-800" key={item.id}>
                <td className="px-4 py-3">{index + 1}</td>
                <td className="px-4 py-3 font-semibold">{item.periode}</td>
                <td className="px-4 py-3">
                  <div>{item.keterangan}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Disimpan {new Date(item.createdAt).toLocaleDateString("id-ID")}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-400" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.fileName}</p>
                        <p className="text-xs text-zinc-500">{formatSize(item.size)}</p>
                      </div>
                    </div>
                    <a
                      className="secondary-button flex items-center gap-2"
                      href={`/api/report-archive/download?company=${company}&id=${encodeURIComponent(item.id)}`}
                    >
                      <Download className="h-4 w-4" /> Unduh Excel
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LaporanBudgetHub() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [datasets, setDatasets] = useState<Dataset[]>(() =>
    REPORTS.map((report) => ({ ...report, rows: [], loading: true })),
  );
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
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

  const loadReports = useCallback(async () => {
    if (!active) return;
    const loaded = await Promise.all(
      REPORTS.map(async (report): Promise<Dataset> => {
        try {
          const response = await fetch(`/api/reports?reportType=${report.type}&company=${company}`, { cache: "no-store" });
          const payload: unknown = await response.json();
          return {
            ...report,
            rows: response.ok && Array.isArray(payload) ? (payload as Row[]) : [],
            loading: false,
          };
        } catch {
          return { ...report, rows: [], loading: false };
        }
      }),
    );
    setDatasets(loaded);
  }, [active, company]);

  const loadArchive = useCallback(async () => {
    if (!active) return;
    setArchiveLoading(true);
    try {
      const response = await fetch(`/api/report-archive?company=${company}`, { cache: "no-store" });
      const payload: unknown = await response.json();
      setArchive(response.ok && Array.isArray(payload) ? (payload as ArchiveItem[]) : []);
    } catch {
      setArchive([]);
    } finally {
      setArchiveLoading(false);
    }
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

  useEffect(() => { void loadReports(); }, [loadReports]);
  useEffect(() => { void loadArchive(); }, [loadArchive]);

  const groups = useMemo(() => [...new Set(datasets.map((dataset) => dataset.group))], [datasets]);

  if (!active || !host) return null;

  return createPortal(
    <div className="laporan-budget-hub space-y-6">
      <style>{`.laporan-budget-hub-host > :not([data-laporan-budget-hub-mount]){display:none!important}`}</style>

      <div>
        <h2 className="text-2xl font-semibold">Pusat Laporan Budget</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Kumpulan laporan dan penyimpanan file Excel budgeting untuk perusahaan {company === "1001" ? "1001" : "Maison Y"}.
        </p>
      </div>

      <ArchiveUploader company={company} onSaved={() => setVersion((value) => value + 1)} />

      <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/70 p-5">
        <div className="mb-4">
          <h3 className="text-xl font-semibold">Daftar Kertas Kerja Tersimpan</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Yang ditampilkan hanya file Excel yang kamu simpan. Isi baris Excel tidak dibuka di halaman ini.
          </p>
        </div>
        {archiveLoading ? <p className="py-6 text-sm text-zinc-500">Memuat arsip...</p> : <ArchiveTable company={company} items={archive} />}
      </section>

      {groups.map((group) => (
        <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/70 p-5" key={group}>
          <h3 className="mb-4 text-xl font-semibold">{group}</h3>
          <div className="space-y-3">
            {datasets.filter((dataset) => dataset.group === group).map((dataset) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/40 p-4" key={dataset.type}>
                <div>
                  <p className="font-semibold">{dataset.label}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {dataset.loading ? "Memuat..." : `${nf.format(dataset.rows.length)} baris data pada laporan`}
                  </p>
                </div>
                <a className="secondary-button flex items-center gap-2" href={dataset.href}>
                  Buka Halaman <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>,
    host,
  );
}
