"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;
type Row = {
  tahun: string;
  bulan: string;
  department: string;
  realisasi: number;
};
type Period = { key: string; label: string; sort: number };

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

const FIXED_DEPARTMENTS = [
  "WAREHOUSE",
  "PURCHASING",
  "OPERASIONAL",
  "MERCHANDISE",
  "MARKETING",
  "MANAGEMENT UMA",
  "MANAGEMENT KIKI",
  "HRD",
  "FAT",
  "DEVELOPMENT",
];

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function norm(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function pick(row: ApiRow, keys: string[]) {
  const wanted = new Set(keys.map(norm));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(norm(key))) return value;
  }
  return undefined;
}

function numberValue(value: unknown) {
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
  if (aliases[raw]) return aliases[raw];
  for (const [key, label] of Object.entries(aliases)) {
    if (raw.includes(key)) return label;
  }
  return String(value ?? "").trim();
}

function parseRow(row: ApiRow): Row | null {
  const bulan = monthName(pick(row, ["bulan", "month"]));
  const tahun = String(pick(row, ["tahun", "year"]) ?? "").trim();
  if (!bulan || !tahun) return null;
  return {
    tahun,
    bulan,
    department: String(pick(row, ["department", "departemen", "dept"]) ?? "")
      .trim()
      .toUpperCase(),
    realisasi: numberValue(
      pick(row, ["total realisasi", "total_realisasi", "realisasi", "actual", "aktual"]),
    ),
  };
}

function yearNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function periodFor(row: Row): Period {
  const year = yearNumber(row.tahun);
  const monthIndex = MONTHS.indexOf(row.bulan);
  const monthNo = Math.max(monthIndex + 1, 1);
  return {
    key: `${year}-${String(monthNo).padStart(2, "0")}`,
    label: `${row.bulan} ${year}`,
    sort: year * 100 + monthNo,
  };
}

function periodSortFromCells(yearText: string, monthText: string) {
  const year = yearNumber(yearText);
  const monthIndex = MONTHS.findIndex(
    (item) => item.toLowerCase() === monthName(monthText).toLowerCase(),
  );
  return year * 100 + Math.max(monthIndex + 1, 1);
}

function formatAxis(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `${nf.format(value / 1_000_000_000)} M`;
  if (Math.abs(value) >= 1_000_000) return `${nf.format(value / 1_000_000)} Jt`;
  return nf.format(value);
}

export default function RealisasiDepartmentFilterPanel() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [originalChart, setOriginalChart] = useState<HTMLElement | null>(null);
  const [table, setTable] = useState<HTMLTableElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<Row[]>([]);
  const [fromPeriod, setFromPeriod] = useState("");
  const [toPeriod, setToPeriod] = useState("");
  const [department, setDepartment] = useState("ALL");

  const isActive = useCallback(() => {
    if (window.location.pathname !== "/realisasi-budget") return false;
    return new URLSearchParams(window.location.search).get("view") === "per-departemen";
  }, []);

  const syncCompany = useCallback(() => {
    const next: Company =
      localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001";
    setCompany((current) => (current === next ? current : next));
  }, []);

  const attach = useCallback(() => {
    if (!isActive()) {
      setMount(null);
      return;
    }

    const root = document.querySelector<HTMLElement>(".realisasi-enhancer-root");
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>(":scope > section"));
    const chartSection = sections.find((section) =>
      (section.querySelector("h3")?.textContent ?? "").includes("Grafik Realisasi Per Departemen"),
    );
    const tableElement = root.querySelector<HTMLTableElement>("table");
    if (!chartSection || !tableElement) return;

    let host = root.querySelector<HTMLElement>("[data-realisasi-department-filter-host]");
    if (!host) {
      host = document.createElement("div");
      host.dataset.realisasiDepartmentFilterHost = "true";
      chartSection.insertAdjacentElement("beforebegin", host);
    }

    chartSection.style.display = "none";
    setOriginalChart(chartSection);
    setTable(tableElement);
    setMount(host);
    syncCompany();
  }, [isActive, syncCompany]);

  useEffect(() => {
    attach();
    const timers = [80, 250, 600].map((delay) => window.setTimeout(attach, delay));
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    const navigation = () => window.setTimeout(attach, 0);
    document.addEventListener("click", navigation, true);
    window.addEventListener("popstate", navigation);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      document.removeEventListener("click", navigation, true);
      window.removeEventListener("popstate", navigation);
      if (originalChart) originalChart.style.display = "";
      if (table) {
        table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
          row.style.display = "";
        });
      }
    };
  }, [attach, originalChart, table]);

  useEffect(() => {
    if (!mount) return;
    let cancelled = false;
    fetch(`/api/reports?reportType=realisasi_per_departemen&company=${company}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (cancelled) return;
        setRows(
          response.ok && Array.isArray(payload)
            ? payload.map((item) => parseRow(item as ApiRow)).filter((item): item is Row => item !== null)
            : [],
        );
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mount, company]);

  const activeYear = useMemo(() => {
    const years = rows.map((row) => yearNumber(row.tahun)).filter((year) => year > 0);
    return years.length ? Math.max(...years) : 2026;
  }, [rows]);

  const periods = useMemo<Period[]>(
    () =>
      MONTHS.map((label, index) => {
        const monthNo = index + 1;
        return {
          key: `${activeYear}-${String(monthNo).padStart(2, "0")}`,
          label: `${label} ${activeYear}`,
          sort: activeYear * 100 + monthNo,
        };
      }),
    [activeYear],
  );

  useEffect(() => {
    setFromPeriod((current) =>
      current && periods.some((period) => period.key === current) ? current : periods[0].key,
    );
    setToPeriod((current) =>
      current && periods.some((period) => period.key === current)
        ? current
        : periods[periods.length - 1].key,
    );
    setDepartment((current) =>
      current === "ALL" || FIXED_DEPARTMENTS.includes(current) ? current : "ALL",
    );
  }, [periods]);

  const filteredRows = useMemo(() => {
    const from = periods.find((period) => period.key === fromPeriod)?.sort ?? -Infinity;
    const to = periods.find((period) => period.key === toPeriod)?.sort ?? Infinity;
    const min = Math.min(from, to);
    const max = Math.max(from, to);
    return rows.filter((row) => {
      const sort = periodFor(row).sort;
      return (
        sort >= min &&
        sort <= max &&
        (department === "ALL" || row.department === department)
      );
    });
  }, [rows, periods, fromPeriod, toPeriod, department]);

  const chartData = useMemo(() => {
    const totals = new Map<string, number>();
    filteredRows.forEach((row) => {
      const key = row.department || "LAINNYA";
      totals.set(key, (totals.get(key) ?? 0) + row.realisasi);
    });
    return Array.from(totals.entries()).map(([label, realisasi]) => ({ label, realisasi }));
  }, [filteredRows]);

  useEffect(() => {
    if (!table) return;
    const from = periods.find((period) => period.key === fromPeriod)?.sort ?? -Infinity;
    const to = periods.find((period) => period.key === toPeriod)?.sort ?? Infinity;
    const min = Math.min(from, to);
    const max = Math.max(from, to);

    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
      const cells = row.querySelectorAll<HTMLTableCellElement>("td");
      if (cells.length < 3) return;
      const sort = periodSortFromCells(cells[0].textContent ?? "", cells[1].textContent ?? "");
      const rowDepartment = (cells[2].textContent ?? "").trim().toUpperCase();
      const visible =
        sort >= min && sort <= max && (department === "ALL" || rowDepartment === department);
      row.style.display = visible ? "" : "none";
    });
  }, [table, periods, fromPeriod, toPeriod, department]);

  if (!mount) return null;

  return createPortal(
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm text-zinc-300">
            <span className="mb-2 block">Dari Periode</span>
            <select
              className="input w-full cursor-pointer"
              value={fromPeriod}
              onChange={(event) => setFromPeriod(event.target.value)}
            >
              {periods.map((period) => (
                <option key={period.key} value={period.key}>{period.label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-zinc-300">
            <span className="mb-2 block">Sampai Periode</span>
            <select
              className="input w-full cursor-pointer"
              value={toPeriod}
              onChange={(event) => setToPeriod(event.target.value)}
            >
              {periods.map((period) => (
                <option key={period.key} value={period.key}>{period.label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-zinc-300">
            <span className="mb-2 block">Departemen</span>
            <select
              className="input w-full cursor-pointer"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            >
              <option value="ALL">Semua Departemen</option>
              {FIXED_DEPARTMENTS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5">
        <h3 className="mb-4 text-lg font-semibold">Grafik Realisasi Per Departemen</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="#27272a" />
              <XAxis dataKey="label" interval={0} angle={-15} textAnchor="end" height={70} />
              <YAxis tickFormatter={formatAxis} />
              <Tooltip formatter={(value: number | string) => `Rp ${nf.format(Number(value))}`} />
              <Legend />
              <Bar dataKey="realisasi" name="Realisasi" fill="#2563EB" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>,
    mount,
  );
}
