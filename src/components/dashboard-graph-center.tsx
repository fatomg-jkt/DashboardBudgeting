"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;
type ReportMap = Record<string, ApiRow[]>;

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

const REPORT_TYPES = [
  "budget_vs_actual",
  "budget_detail_biaya",
  "monthly_budget_actual",
  "cumulative_budget_actual_ytd",
  "laporan_budget",
  "sisa_budget_detail_biaya",
  "realisasi_bulanan",
  "realisasi_per_departemen",
  "analisis_variance",
] as const;

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function norm(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pick(row: ApiRow, keys: string[]) {
  const wanted = new Set(keys.map(norm));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(norm(key))) return value;
  }
  return undefined;
}

function num(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value ?? "")
    .trim()
    .replace(/^rp\s*/i, "")
    .replace(/\s/g, "");
  if (!text || text === "-") return 0;
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replaceAll(".", "").replace(",", ".");
  } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replaceAll(",", "");
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthName(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    jan: "Januari", januari: "Januari",
    feb: "Februari", februari: "Februari",
    mar: "Maret", maret: "Maret",
    apr: "April", april: "April",
    mei: "Mei",
    jun: "Juni", juni: "Juni",
    jul: "Juli", juli: "Juli",
    agu: "Agustus", agustus: "Agustus",
    sep: "September", september: "September",
    okt: "Oktober", oktober: "Oktober",
    nov: "November", november: "November",
    des: "Desember", desember: "Desember",
  };
  if (aliases[raw]) return aliases[raw];
  for (const [key, label] of Object.entries(aliases)) {
    if (raw.includes(key)) return label;
  }
  return String(value ?? "").trim();
}

function budgetOf(row: ApiRow) {
  return num(pick(row, [
    "budget",
    "anggaran",
    "total_budget",
    "beban_operasional_anggaran",
    "budget_bulanan",
  ]));
}

function actualOf(row: ApiRow) {
  return num(pick(row, [
    "actual",
    "aktual",
    "realisasi",
    "total_actual",
    "total_aktual",
    "total_realisasi",
    "beban_operasional_aktual",
    "realisasi_bulanan",
  ]));
}

function departmentOf(row: ApiRow) {
  return String(pick(row, ["department", "departemen", "dept"]) ?? "")
    .trim()
    .toUpperCase();
}

function monthOf(row: ApiRow) {
  return monthName(pick(row, ["bulan", "month", "periode"]));
}

function axis(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${nf.format(value / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${nf.format(value / 1_000_000)} Jt`;
  return nf.format(value);
}

function aggregateByDepartment(rows: ApiRow[]) {
  const map = new Map<string, { department: string; budget: number; actual: number }>();
  rows.forEach((row) => {
    const department = departmentOf(row);
    if (!department) return;
    const current = map.get(department) ?? { department, budget: 0, actual: 0 };
    current.budget += budgetOf(row);
    current.actual += actualOf(row);
    map.set(department, current);
  });
  return Array.from(map.values()).map((row) => ({
    ...row,
    sisa: row.budget - row.actual,
    variance: row.actual - row.budget,
  }));
}

function aggregateMonthly(rows: ApiRow[]) {
  const map = new Map<string, { month: string; budget: number; actual: number }>();
  rows.forEach((row) => {
    const month = monthOf(row);
    if (!MONTHS.includes(month)) return;
    const current = map.get(month) ?? { month, budget: 0, actual: 0 };
    current.budget += budgetOf(row);
    current.actual += actualOf(row);
    map.set(month, current);
  });
  return MONTHS.map((month) => map.get(month) ?? { month, budget: 0, actual: 0 });
}

function cumulativeMonthly(rows: ApiRow[]) {
  let budgetYtd = 0;
  let actualYtd = 0;
  return aggregateMonthly(rows).map((row) => {
    budgetYtd += row.budget;
    actualYtd += row.actual;
    return { month: row.month, budgetYtd, actualYtd };
  });
}

function statusSummary(rows: ApiRow[]) {
  let over = 0;
  let under = 0;
  rows.forEach((row) => {
    const status = String(pick(row, ["status_budget", "status"]) ?? "").toLowerCase();
    const budget = budgetOf(row);
    const actual = actualOf(row);
    if (status.includes("over") || actual > budget) over += 1;
    else under += 1;
  });
  return [
    { name: "Over Budget", value: over },
    { name: "Under Budget", value: under },
  ].filter((item) => item.value > 0);
}

function ChartCard({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gold-500/20 bg-gradient-to-b from-zinc-950 to-black p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
        </div>
        <a className="secondary-button text-xs" href={href}>Buka Laporan</a>
      </div>
      {children}
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-zinc-500">
      Belum ada data untuk grafik ini.
    </div>
  );
}

export default function DashboardGraphCenter() {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [reports, setReports] = useState<ReportMap>({});
  const [loading, setLoading] = useState(false);

  const active = pathname === "/" || pathname === "/dashboard";

  const syncCompany = useCallback(() => {
    const next: Company = localStorage.getItem("budgeting_active_company") === "maison_y"
      ? "maison_y"
      : "1001";
    setCompany((current) => current === next ? current : next);
  }, []);

  useEffect(() => {
    if (!active) {
      document.querySelector("main")?.children.item(1)?.classList.remove("dashboard-graph-center-host");
      setHost(null);
      return;
    }

    const main = document.querySelector("main");
    const content = main?.children.item(1) as HTMLElement | null;
    if (!content) return;

    content.classList.add("dashboard-graph-center-host");
    let mount = content.querySelector<HTMLElement>("[data-dashboard-graph-center-mount]");
    if (!mount) {
      mount = document.createElement("div");
      mount.dataset.dashboardGraphCenterMount = "true";
      content.appendChild(mount);
    }
    setHost(mount);
    syncCompany();

    const click = () => window.setTimeout(syncCompany, 0);
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("click", click, true);
      content.classList.remove("dashboard-graph-center-host");
    };
  }, [active, pathname, syncCompany]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);

    Promise.all(
      REPORT_TYPES.map(async (reportType) => {
        try {
          const response = await fetch(
            `/api/reports?reportType=${reportType}&company=${company}`,
            { cache: "no-store" },
          );
          const payload: unknown = await response.json();
          return [reportType, response.ok && Array.isArray(payload) ? payload as ApiRow[] : []] as const;
        } catch {
          return [reportType, []] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) {
        setReports(Object.fromEntries(entries));
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [active, company]);

  const budgetDepartment = useMemo(
    () => aggregateByDepartment(reports.budget_vs_actual ?? []),
    [reports],
  );
  const monthly = useMemo(
    () => aggregateMonthly(reports.monthly_budget_actual ?? []),
    [reports],
  );
  const ytd = useMemo(
    () => cumulativeMonthly(reports.cumulative_budget_actual_ytd ?? []),
    [reports],
  );
  const sisaDepartment = useMemo(() => {
    const rows = aggregateByDepartment(reports.laporan_budget ?? []);
    return rows.length ? rows : budgetDepartment;
  }, [reports, budgetDepartment]);
  const realisasiMonthly = useMemo(() => {
    const source = reports.realisasi_bulanan ?? [];
    const map = new Map<string, number>();
    source.forEach((row) => {
      const month = monthOf(row);
      if (!MONTHS.includes(month)) return;
      map.set(month, (map.get(month) ?? 0) + actualOf(row));
    });
    return MONTHS.map((month) => ({ month, actual: map.get(month) ?? 0 }));
  }, [reports]);
  const realisasiDepartment = useMemo(
    () => aggregateByDepartment(reports.realisasi_per_departemen ?? []).map((row) => ({
      department: row.department,
      actual: row.actual,
    })),
    [reports],
  );
  const analysisDepartment = useMemo(() => {
    const rows = aggregateByDepartment(reports.analisis_variance ?? []);
    return rows.length ? rows : budgetDepartment;
  }, [reports, budgetDepartment]);
  const detailStatus = useMemo(
    () => statusSummary(reports.budget_detail_biaya ?? []),
    [reports],
  );
  const sisaDetailStatus = useMemo(
    () => statusSummary(reports.sisa_budget_detail_biaya ?? []),
    [reports],
  );

  const totals = useMemo(() => {
    const budget = budgetDepartment.reduce((sum, row) => sum + row.budget, 0);
    const actual = budgetDepartment.reduce((sum, row) => sum + row.actual, 0);
    return { budget, actual, variance: actual - budget, sisa: budget - actual };
  }, [budgetDepartment]);

  if (!active || !host) return null;

  const tooltip = (value: number | string) => rupiah.format(Number(value));

  return createPortal(
    <div className="dashboard-graph-center space-y-6">
      <style>{`.dashboard-graph-center-host > :not([data-dashboard-graph-center-mount]){display:none!important}`}</style>

      <div>
        <h2 className="text-2xl font-semibold">Pusat Grafik Budgeting</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Ringkasan grafik seluruh laporan dan submenu untuk perusahaan {company === "1001" ? "1001" : "Maison Y"}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total Budget", totals.budget],
          ["Total Actual", totals.actual],
          ["Variance", totals.variance],
          ["Sisa Budget", totals.sisa],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5">
            <p className="text-sm text-zinc-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{rupiah.format(Number(value))}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gold-500/20 p-10 text-center text-zinc-400">Memuat seluruh grafik...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard title="Budget vs Actual - Per Departemen" subtitle="Perbandingan budget dan actual setiap departemen" href="/budget-vs-actual?view=per-departemen">
            {budgetDepartment.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={budgetDepartment}><CartesianGrid stroke="#27272a"/><XAxis dataKey="department" interval={0} angle={-15} textAnchor="end" height={70}/><YAxis tickFormatter={axis}/><Tooltip formatter={tooltip}/><Legend/><Bar dataKey="budget" name="Budget" fill="#2563EB"/><Bar dataKey="actual" name="Actual" fill="#EF4444"/></BarChart></ResponsiveContainer></div> : <EmptyChart/>}
          </ChartCard>

          <ChartCard title="Monthly Budget vs Actual" subtitle="Budget dan actual per bulan" href="/budget-vs-actual?view=monthly">
            {monthly.some((row) => row.budget || row.actual) ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid stroke="#27272a"/><XAxis dataKey="month"/><YAxis tickFormatter={axis}/><Tooltip formatter={tooltip}/><Legend/><Bar dataKey="budget" name="Budget" fill="#2563EB"/><Bar dataKey="actual" name="Actual" fill="#EF4444"/></BarChart></ResponsiveContainer></div> : <EmptyChart/>}
          </ChartCard>

          <ChartCard title="Cumulative Budget vs Actual YTD" subtitle="Akumulasi budget dan actual dari awal tahun" href="/budget-vs-actual?view=ytd">
            {ytd.some((row) => row.budgetYtd || row.actualYtd) ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={ytd}><CartesianGrid stroke="#27272a"/><XAxis dataKey="month"/><YAxis tickFormatter={axis}/><Tooltip formatter={tooltip}/><Legend/><Line type="monotone" dataKey="budgetYtd" name="Budget YTD" stroke="#2563EB" strokeWidth={3}/><Line type="monotone" dataKey="actualYtd" name="Actual YTD" stroke="#EF4444" strokeWidth={3}/></LineChart></ResponsiveContainer></div> : <EmptyChart/>}
          </ChartCard>

          <ChartCard title="Sisa Budget - Per Departemen" subtitle="Sisa budget setiap departemen" href="/laporan-budget?view=sisa-budget-per-departemen">
            {sisaDepartment.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={sisaDepartment}><CartesianGrid stroke="#27272a"/><XAxis dataKey="department" interval={0} angle={-15} textAnchor="end" height={70}/><YAxis tickFormatter={axis}/><Tooltip formatter={tooltip}/><Legend/><Bar dataKey="sisa" name="Sisa Budget" fill="#2A9D8F"/></BarChart></ResponsiveContainer></div> : <EmptyChart/>}
          </ChartCard>

          <ChartCard title="Realisasi Bulanan" subtitle="Trend realisasi budget per bulan" href="/realisasi-budget?view=bulanan">
            {realisasiMonthly.some((row) => row.actual) ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={realisasiMonthly}><CartesianGrid stroke="#27272a"/><XAxis dataKey="month"/><YAxis tickFormatter={axis}/><Tooltip formatter={tooltip}/><Legend/><Line type="monotone" dataKey="actual" name="Realisasi" stroke="#EF4444" strokeWidth={3}/></LineChart></ResponsiveContainer></div> : <EmptyChart/>}
          </ChartCard>

          <ChartCard title="Realisasi - Per Departemen" subtitle="Realisasi budget antar departemen" href="/realisasi-budget?view=per-departemen">
            {realisasiDepartment.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={realisasiDepartment}><CartesianGrid stroke="#27272a"/><XAxis dataKey="department" interval={0} angle={-15} textAnchor="end" height={70}/><YAxis tickFormatter={axis}/><Tooltip formatter={tooltip}/><Legend/><Bar dataKey="actual" name="Realisasi" fill="#2563EB"/></BarChart></ResponsiveContainer></div> : <EmptyChart/>}
          </ChartCard>

          <ChartCard title="Analisa Budget - Variance Departemen" subtitle="Nilai over/under budget setiap departemen" href="/analisis-variance">
            {analysisDepartment.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={analysisDepartment}><CartesianGrid stroke="#27272a"/><XAxis dataKey="department" interval={0} angle={-15} textAnchor="end" height={70}/><YAxis tickFormatter={axis}/><Tooltip formatter={tooltip}/><Legend/><Bar dataKey="variance" name="Variance (Actual - Budget)" fill="#E9C46A"/></BarChart></ResponsiveContainer></div> : <EmptyChart/>}
          </ChartCard>

          <ChartCard title="Budget vs Actual - Status Detail Biaya" subtitle="Komposisi detail biaya Over Budget dan Under Budget" href="/budget-vs-actual?view=detail-biaya">
            {detailStatus.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={detailStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={105} label>{detailStatus.map((_, index) => <Cell key={index} fill={index === 0 ? "#EF4444" : "#2A9D8F"}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div> : <EmptyChart/>}
          </ChartCard>

          <ChartCard title="Sisa Budget - Status Detail Biaya" subtitle="Komposisi status detail biaya pada laporan sisa budget" href="/laporan-budget?view=sisa-budget-detail-biaya">
            {sisaDetailStatus.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sisaDetailStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={105} label>{sisaDetailStatus.map((_, index) => <Cell key={index} fill={index === 0 ? "#EF4444" : "#2A9D8F"}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div> : <EmptyChart/>}
          </ChartCard>
        </div>
      )}
    </div>,
    host,
  );
}
