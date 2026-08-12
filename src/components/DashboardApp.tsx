"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  FileBarChart,
  FileSpreadsheet,
  Gauge,
  Home,
  LineChart,
  Settings,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
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
import { REPORTS, ReportType } from "@/lib/reports";
import { detectHeaderRow, downloadTemplate } from "@/lib/import-utils";
import {
  COMPANY_LABELS,
  getLocalHistory,
  removeLocalImport,
  type Company,
} from "@/lib/local-reports";
type Row = Record<string, unknown> & { id?: number };
type Sheet = { name: string; rows: string[][] };
type History = {
  id: string;
  company: Company;
  report_type: ReportType;
  file_name: string;
  sheet_name: string;
  row_count: number;
  created_at: string;
  storageMode: "local" | "database";
};
const routes = [
  ["Dashboard", "/", Home],
  ["Budget Planning", "/budget-planning", WalletCards],
  ["Budget vs Actual", "/budget-vs-actual", BarChart3],
  ["Realisasi Budget", "/realisasi-budget", Gauge],
  ["Monitoring Budget", "/monitoring-budget", ClipboardList],
  ["Pengajuan Budget", "/pengajuan-budget", FileSpreadsheet],
  ["Analisis Variance", "/analisis-variance", LineChart],
  ["Laporan Budget", "/laporan-budget", FileBarChart],
  ["Upload Excel", "/upload-excel", Upload],
  ["Master Data", "/master-data", Building2],
  ["Pengaturan", "/pengaturan", Settings],
] as const;
const routeType: Record<string, ReportType> = {
  "/budget-planning": "budget_planning",
  "/budget-vs-actual": "budget_vs_actual",
  "/realisasi-budget": "realisasi_budget",
  "/monitoring-budget": "monitoring_budget",
  "/pengajuan-budget": "pengajuan_budget",
  "/analisis-variance": "analisis_variance",
  "/laporan-budget": "laporan_budget",
  "/master-data": "master_data",
};
const aliases: Record<string, string> = {
  departemen: "department",
  department: "department",
  dept: "department",
  anggaran: "budget",
  budget_plan: "budget",
  budget: "budget",
  aktual: "actual",
  actual: "actual",
  realisasi: "actual",
  bulan: "month",
  month: "month",
  tahun: "year",
  year: "year",
  kategori: "category",
  category: "category",
  beban_operasional_anggaran: "budget",
  beban_operasional_aktual: "actual",
  keterangan: "description",
  description: "description",
};
const normalize = (s: string) =>
  aliases[
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
  ] ??
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_");
const numberValue = (v: unknown) => {
  if (typeof v === "number") return v;
  let s = String(v ?? "")
    .trim()
    .replace(/^rp\s*/i, "")
    .replace(/\s/g, "");
  if (!s) return v;
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))
    s = s.replaceAll(".", "").replace(",", ".");
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replaceAll(",", "");
  return Number.isFinite(Number(s)) ? Number(s) : v;
};
const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const formatNumber = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});
const formatPercent = (value: number) =>
  `${formatNumber.format(Math.abs(value) <= 1 ? value * 100 : value)}%`;
const formatAxis = (value: number) =>
  Math.abs(value) >= 1_000_000_000
    ? `${formatNumber.format(value / 1_000_000_000)} M`
    : Math.abs(value) >= 1_000_000
      ? `${formatNumber.format(value / 1_000_000)} Jt`
      : formatNumber.format(value);
const percentageField = (name: string) =>
  /^(var|variance_percent|percentage|persentase)$/.test(normalize(name));
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gold-500/20 bg-gradient-to-b from-zinc-950 to-black p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function GenericTable({ rows, limit }: { rows: Row[]; limit?: number }) {
  const headers = [...new Set(rows.flatMap(Object.keys))].filter(
    (x) => !["id", "importId", "rowNumber", "__localImportId"].includes(x),
  );
  if (!rows.length) return <p className="text-zinc-400">Belum ada data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h.replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r, i) => (
            <tr key={String(r.id ?? i)}>
              {headers.map((h) => (
                <td key={h}>
                  {typeof r[h] === "object"
                    ? JSON.stringify(r[h])
                    : typeof r[h] === "number"
                      ? percentageField(h)
                        ? formatPercent(r[h] as number)
                        : formatNumber.format(r[h] as number)
                      : String(r[h] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Importer({
  company,
  fixedType,
  onDone,
  onClose,
}: {
  company: Company;
  fixedType?: ReportType;
  onDone: (message?: string) => void;
  onClose?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<ReportType>(fixedType ?? "budget_planning"),
    [file, setFile] = useState<File>(),
    [sheets, setSheets] = useState<Sheet[]>([]),
    [sheet, setSheet] = useState(0),
    [headerRow, setHeaderRow] = useState(0),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [duplicate, setDuplicate] = useState(false),
    [databaseAvailable, setDatabaseAvailable] = useState<boolean>();
  const selected = sheets[sheet];
  const rawHeaders = useMemo(
    () =>
      (selected?.rows[headerRow] ?? []).map((value) =>
        String(value ?? "").trim(),
      ),
    [selected, headerRow],
  );
  const rows = useMemo(
    () =>
      selected?.rows
        .slice(headerRow + 1)
        .filter((r) => r.some((v) => String(v).trim()))
        .map((r) =>
          Object.fromEntries(
            rawHeaders.map((h, i) => [
              h || `column_${i + 1}`,
              numberValue(r[i] ?? ""),
            ]),
          ),
        ) ?? [],
    [selected, headerRow, rawHeaders],
  );
  useEffect(() => {
    fetch("/api/storage/health")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        setDatabaseAvailable(
          r.ok && d.configured === true && d.connected === true,
        );
      })
      .catch(() => setDatabaseAvailable(false));
  }, []);
  async function choose(f?: File) {
    if (!f) return;
    setFile(f);
    setBusy("Membaca file Excel...");
    setError("");
    setSuccess("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload/preview", {
          method: "POST",
          body: fd,
        }),
        d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSheets(d.sheets);
      setSheet(0);
      setHeaderRow(detectHeaderRow(d.sheets[0]?.rows ?? []));
    } catch (e) {
      setSheets([]);
      setError(e instanceof Error ? e.message : "File Excel gagal dibaca.");
    } finally {
      setBusy("");
    }
  }
  function changeSheet(index: number) {
    setSheet(index);
    setHeaderRow(detectHeaderRow(sheets[index]?.rows ?? []));
  }
  async function save(strategy: "cancel" | "replace" | "new" = "cancel") {
    if (!file || !selected) return;
    setBusy("Menyimpan data...");
    setError("");
    try {
      const res = await fetch("/api/report-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company,
            reportType: type,
            fileName: file.name,
            sheetName: selected.name,
            headers: rawHeaders,
            rows,
            strategy,
          }),
        }),
        d = await res.json();
      if (res.status === 409) {
        setDuplicate(true);
        return;
      }
      if (!res.ok) throw new Error(d.error);
      setDuplicate(false);
      setSuccess(
        `Import berhasil. ${d.total} baris berhasil disimpan ke ${REPORTS[type]}.`,
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Data gagal disimpan.");
    } finally {
      setBusy("");
    }
  }
  const maxHeader = Math.min(30, selected?.rows.length ?? 30);
  return (
    <div className="space-y-5">
      {onClose && (
        <button aria-label="Tutup" className="float-right" onClick={onClose}>
          <X />
        </button>
      )}
      <Panel title="Upload / Import Excel">
        {databaseAvailable === false && (
          <p className="mb-4 text-sm text-gold-300">
            Penyimpanan bersama belum terhubung. Hubungkan Vercel Blob agar
            data dapat dilihat oleh semua user.
          </p>
        )}
        <p className="mb-4 text-sm text-gold-300">
          <b>Perusahaan:</b> {COMPANY_LABELS[company]}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            Tujuan Data / Jenis Laporan
            <select
              disabled={!!fixedType}
              className="input mt-2 w-full"
              value={type}
              onChange={(e) => setType(e.target.value as ReportType)}
            >
              {Object.entries(REPORTS).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span>File Excel</span>
            <div className="mt-2 flex gap-2">
              <button
                className="secondary-button flex-1"
                onClick={() => downloadTemplate(type)}
              >
                Download Template
              </button>
              <button
                className="secondary-button flex-1"
                onClick={() => input.current?.click()}
              >
                Pilih File
              </button>
            </div>
            <input
              ref={input}
              hidden
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </div>
        </div>
        {databaseAvailable === false && (
          <div className="mt-4 text-sm text-gold-300">
            <b>Mode Lokal</b>
            <br />
            Data akan disimpan di browser ini.
          </div>
        )}
      </Panel>
      {busy && <p>{busy}</p>}
      {error && <div className="error">{error}</div>}
      {selected && (
        <Panel title="Preview Data">
          <div className="mb-4 grid gap-3 text-sm md:grid-cols-3">
            <p>
              <b>File:</b> {file?.name}
            </p>
            <p>
              <b>Tujuan:</b> {REPORTS[type]}
            </p>
            <label>
              <b>Sheet:</b>{" "}
              <select
                className="input ml-2"
                value={sheet}
                onChange={(e) => changeSheet(Number(e.target.value))}
              >
                {sheets.map((s, i) => (
                  <option value={i} key={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <b>Pilih Baris Header:</b>{" "}
              <select
                className="input ml-2"
                value={headerRow}
                onChange={(e) => setHeaderRow(Number(e.target.value))}
              >
                {Array.from({ length: maxHeader }, (_, i) => (
                  <option value={i} key={i}>
                    Baris {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <p>
              <b>Header ditemukan:</b> Baris {headerRow + 1}
            </p>
            <p>
              <b>Data:</b> {rows.length} baris ·{" "}
              {rawHeaders.filter(Boolean).length} kolom
            </p>
            <p className="md:col-span-3">
              <b>Header:</b> {rawHeaders.filter(Boolean).join(", ")}
            </p>
          </div>
          <GenericTable rows={rows} limit={15} />
          <button
            disabled={!!busy || !rows.length}
            className="gold-button mt-5 disabled:opacity-40"
            onClick={() => save()}
          >
            {busy === "Menyimpan data..."
              ? "Menyimpan data..."
              : "Import & Simpan"}
          </button>
        </Panel>
      )}
      {duplicate && (
        <div className="error">
          <b>Report ini sudah mempunyai data.</b>
          <div className="mt-3 flex gap-2">
            <button
              className="secondary-button"
              onClick={() => setDuplicate(false)}
            >
              Batalkan
            </button>
            <button className="gold-button" onClick={() => save("replace")}>
              Replace Data Lama
            </button>
            <button className="gold-button" onClick={() => save("new")}>
              Tambahkan Data Baru
            </button>
          </div>
        </div>
      )}
      {success && (
        <div className="success">
          <b>{success}</b>
          {databaseAvailable === false && (
            <p className="mt-1 text-sm">
              Penyimpanan bersama belum terhubung. Hubungkan Vercel Blob agar
              data dapat dilihat oleh semua user.
            </p>
          )}
          <div className="mt-3">
            <Link
              className="gold-button"
              href={
                Object.entries(routeType).find(([, v]) => v === type)?.[0] ??
                "/"
              }
            >
              Lihat {REPORTS[type]}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
function History({
  company,
  reload,
}: {
  company: Company;
  reload: () => void;
}) {
  const [items, setItems] = useState<History[]>([]),
    [databaseAvailable, setDatabaseAvailable] = useState(false);
  const load = useCallback(async () => {
    const local: History[] = getLocalHistory(company).map((x) => ({
      id: x.id,
      company: x.company,
      report_type: x.reportType,
      file_name: x.fileName,
      sheet_name: x.sheetName,
      row_count: x.rowCount,
      created_at: x.createdAt,
      storageMode: "local",
    }));
    try {
      const health = await fetch("/api/storage/health");
      const status = await health.json();
      if (health.ok && status.connected) {
        setDatabaseAvailable(true);
        const r = await fetch(`/api/imports?company=${company}`),
          d = await r.json();
        const database: Array<History> = Array.isArray(d)
          ? d.map((x: Omit<History, "storageMode">) => ({
              ...x,
              company: x.company,
              storageMode: "database",
            }))
          : [];
        setItems(
          [...local, ...database].sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
          ),
        );
        return;
      }
    } catch {}
    setDatabaseAvailable(false);
    setItems(local);
  }, [company]);
  useEffect(() => {
    void load();
    window.addEventListener("budgeting-local-data-changed", load);
    return () =>
      window.removeEventListener("budgeting-local-data-changed", load);
  }, [load]);
  async function remove(item: History) {
    if (!confirm("Hapus batch import dan seluruh barisnya?")) return;
    if (item.storageMode === "local") removeLocalImport(item.id);
    else
      await fetch(`/api/imports/${item.id}?company=${company}`, {
        method: "DELETE",
      });
    void load();
    reload();
  }
  return (
    <Panel title="Riwayat Import">
      {!databaseAvailable && (
        <p className="mb-3 text-sm text-gold-300">
          Penyimpanan bersama belum terhubung. Hubungkan Vercel Blob agar data
          dapat dilihat oleh semua user.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nama File</th>
              <th>Perusahaan</th>
              <th>Report</th>
              <th>Sheet</th>
              <th>Rows</th>
              <th>Tanggal</th>
              <th>Penyimpanan</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={`${x.storageMode}-${x.id}`}>
                <td>{x.file_name}</td>
                <td>{COMPANY_LABELS[x.company]}</td>
                <td>{REPORTS[x.report_type]}</td>
                <td>{x.sheet_name}</td>
                <td>{x.row_count}</td>
                <td>{new Date(x.created_at).toLocaleString("id-ID")}</td>
                <td>{x.storageMode === "local" ? "Lokal" : "Vercel Blob"}</td>
                <td>
                  <Link
                    className="text-gold-300"
                    href={
                      Object.entries(routeType).find(
                        ([, v]) => v === x.report_type,
                      )?.[0] ?? "/upload-excel"
                    }
                  >
                    Lihat
                  </Link>{" "}
                  ·{" "}
                  <button className="text-red-300" onClick={() => remove(x)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
function RequestManual() {
  const [form, setForm] = useState({
      request_date: "",
      department: "",
      category: "",
      amount: "",
      description: "",
      pic: "",
      status: "Draft",
    }),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setMessage(r.ok ? "Pengajuan berhasil disimpan." : d.error);
  }
  return (
    <Panel title="Buat Pengajuan Manual">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <input
          required
          type="date"
          className="input"
          value={form.request_date}
          onChange={(e) => setForm({ ...form, request_date: e.target.value })}
        />
        <input
          required
          className="input"
          placeholder="Departemen"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
        />
        <input
          required
          className="input"
          placeholder="Kategori"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          required
          type="number"
          min="0"
          className="input"
          placeholder="Nominal"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <input
          required
          className="input"
          placeholder="PIC"
          value={form.pic}
          onChange={(e) => setForm({ ...form, pic: e.target.value })}
        />
        <select
          className="input"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          {["Draft", "Submitted", "Approved", "Rejected"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <textarea
          required
          className="input md:col-span-2"
          placeholder="Keterangan"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button className="gold-button md:col-span-2">Simpan Pengajuan</button>
        {message && <p>{message}</p>}
      </form>
    </Panel>
  );
}
const field = (row: Row, name: string) => {
  for (const [key, value] of Object.entries(row))
    if (normalize(key) === name) return value;
  return undefined;
};
function BudgetActualChart({ rows }: { rows: Row[] }) {
  if (!rows.length) return null;
  const chartRows = rows.map((r) => ({
    department: String(field(r, "department") ?? "-"),
    Budget: Number(field(r, "budget") ?? 0),
    Actual: Number(field(r, "actual") ?? 0),
  }));
  return (
    <Panel title="Budget vs Actual">
      <div className="chart">
        <ResponsiveContainer>
          <BarChart data={chartRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="department" />
            <YAxis tickFormatter={formatAxis} />
            <Tooltip
              formatter={(value) => formatNumber.format(Number(value))}
            />
            <Legend />
            <Bar dataKey="Budget" fill="#2563EB" />
            <Bar dataKey="Actual" fill="#EF4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
function Dashboard({ data }: { data: Record<string, Row[]> }) {
  const source = data.budget_vs_actual?.length
    ? data.budget_vs_actual
    : (data.budget_planning ?? []);
  if (!source.length)
    return (
      <div className="rounded-xl border border-dashed border-gold-500/30 p-10 text-center">
        <p>Belum ada data Budget vs Actual.</p>
        <Link
          className="gold-button mt-4 inline-block"
          href="/budget-vs-actual"
        >
          Import Budget vs Actual
        </Link>
      </div>
    );
  const rows = source.map((r) => ({
    name: String(field(r, "department") ?? "-"),
    budget: Number(field(r, "budget") ?? 0),
    actual: Number(field(r, "actual") ?? 0),
  }));
  const b = rows.reduce((n, r) => n + r.budget, 0),
    a = rows.reduce((n, r) => n + r.actual, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Total Budget", rupiah.format(b)],
          ["Total Actual", rupiah.format(a)],
          ["Variance", rupiah.format(b - a)],
        ].map((x) => (
          <section className="kpi" key={x[0]}>
            <p>{x[0]}</p>
            <b>{x[1]}</b>
          </section>
        ))}
      </div>
      <Panel title="Budget vs Actual">
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={rows}>
              <CartesianGrid stroke="#27272a" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={formatAxis} />
              <Tooltip
                formatter={(value) => formatNumber.format(Number(value))}
              />
              <Legend
                formatter={(value) =>
                  value === "budget" ? "Budget" : "Actual"
                }
              />
              <Bar name="Budget" dataKey="budget" fill="#2563EB" />
              <Bar name="Actual" dataKey="actual" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
export default function DashboardApp() {
  const pathname = usePathname(),
    current = routeType[pathname];
  const [company, setCompany] = useState<Company>("1001"),
    [datasets, setDatasets] = useState<Record<string, Row[]>>({}),
    [loading, setLoading] = useState(false),
    [modal, setModal] = useState(false),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem("budgeting_active_company");
    if (saved === "1001" || saved === "maison_y") setCompany(saved);
  }, []);
  const selectCompany = (value: Company) => {
    localStorage.setItem("budgeting_active_company", value);
    setCompany(value);
  };
  const load = useCallback(async () => {
    void version;
    setLoading(true);
    const types =
      pathname === "/"
        ? ["budget_vs_actual", "budget_planning", "realisasi_budget"]
        : current
          ? [current]
          : [];
    const pairs = await Promise.all(
      types.map(async (type) => {
        try {
          const r = await fetch(
              `/api/reports?reportType=${type}&company=${company}`,
              { cache: "no-store" },
            ),
            d = await r.json();
          if (r.ok && Array.isArray(d)) return [type, d] as const;
        } catch {}
        return [type, []] as const;
      }),
    );
    setDatasets((x) => ({ ...x, ...Object.fromEntries(pairs) }));
    setLoading(false);
  }, [pathname, current, version, company]);
  useEffect(() => {
    void load();
  }, [load]);
  const done = (message?: string) => {
    if (message) setNotice(message);
    setVersion((v) => v + 1);
  };
  const title = routes.find((x) => x[1] === pathname)?.[0] ?? "Dashboard";
  let content: React.ReactNode;
  if (pathname === "/upload-excel")
    content = (
      <div className="space-y-6">
        <Importer company={company} onDone={done} />
        <History company={company} reload={done} />
      </div>
    );
  else if (pathname === "/pengaturan")
    content = (
      <Panel title="Pengaturan Aplikasi">
        <p className="text-zinc-400">
          Laporan disimpan pada Vercel Private Blob agar tersedia bagi semua
          user.
        </p>
      </Panel>
    );
  else if (pathname === "/") content = <Dashboard data={datasets} />;
  else if (current)
    content = (
      <div className="space-y-5">
        {notice && (
          <div className="success">
            <b>{notice}</b>
          </div>
        )}
        <div className="flex justify-end">
          <button className="gold-button" onClick={() => setModal(true)}>
            {current === "master_data" ? "Import Master Data" : "Import Excel"}
          </button>
        </div>
        {current === "pengajuan_budget" && <RequestManual />}
        {loading ? (
          <p>Memuat data...</p>
        ) : (
          <>
            {current === "budget_vs_actual" && (
              <BudgetActualChart rows={datasets[current] ?? []} />
            )}
            <Panel title={REPORTS[current]}>
              {(datasets[current] ?? []).length ? (
                <GenericTable rows={datasets[current] ?? []} />
              ) : (
                <div className="text-center text-zinc-400">
                  <p>Belum ada data.</p>
                  <p className="mt-1">
                    Download template, isi data, lalu Import Excel.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button
                      className="secondary-button"
                      onClick={() => downloadTemplate(current)}
                    >
                      Download Template
                    </button>
                    <button
                      className="gold-button"
                      onClick={() => setModal(true)}
                    >
                      Import Excel
                    </button>
                  </div>
                </div>
              )}
            </Panel>
          </>
        )}
        {modal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 md:p-12">
            <div className="mx-auto max-w-6xl rounded-2xl bg-zinc-950 p-5">
              <Importer
                company={company}
                fixedType={current}
                onDone={(message) => {
                  done(message);
                  setModal(false);
                }}
                onClose={() => setModal(false)}
              />
            </div>
          </div>
        )}
      </div>
    );
  else content = null;
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#3a2a08,transparent_35%),#070707] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-gold-500/20 bg-black/95 p-5 lg:block">
        <div className="mb-7 rounded-2xl border border-gold-500/30 bg-gold-500/10 p-4">
          <p className="text-xs uppercase tracking-[.3em] text-gold-300">
            Budgeting
          </p>
          <h1 className="mt-1 text-lg font-bold">1001 &amp; Maison Y</h1>
        </div>
        <div className="mb-4">
          <p className="mb-2 text-xs text-gold-300">Perusahaan</p>
          <div className="grid grid-cols-2 gap-2">
            {(["1001", "maison_y"] as Company[]).map((value) => (
              <button
                key={value}
                onClick={() => selectCompany(value)}
                className={`rounded-lg border border-gold-500/30 px-2 py-2 text-xs ${company === value ? "bg-gold-500 font-semibold text-black" : "bg-zinc-950 text-zinc-300"}`}
              >
                {COMPANY_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
        <nav className="space-y-1">
          {routes.map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm ${pathname === href ? "bg-gold-500 font-semibold text-black" : "text-zinc-300 hover:bg-gold-500/15"}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-gold-500/10 bg-black/80 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gold-300">Dashboard Budgeting</p>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="text-xs text-zinc-400">
                Perusahaan: {COMPANY_LABELS[company]}
              </p>
            </div>
            <Bell className="text-gold-400" />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
            {routes.map(([label, href]) => (
              <Link
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs ${pathname === href ? "bg-gold-500 text-black" : "bg-zinc-900"}`}
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
          </div>
        </header>
        <div className="p-4 md:p-8">{content}</div>
      </main>
    </div>
  );
}
