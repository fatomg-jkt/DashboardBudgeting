"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;
type Point = { department: string; budget: number; actual: number; remaining: number };

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
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

function num(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value ?? "")
    .trim()
    .replace(/^rp\s*/i, "")
    .replace(/%/g, "")
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

function key(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function value(row: ApiRow, keys: string[]) {
  const wanted = new Set(keys.map(key));
  for (const [name, cell] of Object.entries(row)) {
    if (wanted.has(key(name))) return cell;
  }
  return undefined;
}

function monthName(input: unknown) {
  const raw = String(input ?? "").trim().toLowerCase();
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
  for (const [alias, label] of Object.entries(aliases)) {
    if (raw.includes(alias)) return label;
  }
  return String(input ?? "").trim();
}

function rowMonth(row: ApiRow) {
  return monthName(value(row, ["bulan", "month", "periode"]));
}

function axis(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${nf.format(value / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${nf.format(value / 1_000_000)} Jt`;
  return nf.format(value);
}

function periodStorageKey(company: Company) {
  return `budgeting_sisa_budget_period_${company}`;
}

export default function SisaBudgetDepartmentChart() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");

  const active =
    typeof window !== "undefined" &&
    window.location.pathname === "/laporan-budget" &&
    new URLSearchParams(window.location.search).get("view") === "sisa-budget-per-departemen";

  const syncCompany = useCallback(() => {
    setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001");
  }, []);

  const loadRows = useCallback(async () => {
    if (!active) return;
    try {
      const res = await fetch(`/api/reports?reportType=laporan_budget&company=${company}`, {
        cache: "no-store",
      });
      const data: unknown = await res.json();
      setRows(res.ok && Array.isArray(data) ? (data as ApiRow[]) : []);
    } catch {
      setRows([]);
    }
  }, [active, company]);

  useEffect(() => {
    if (!active) return;

    syncCompany();
    const main = document.querySelector("main");
    const content = main?.children.item(1) as HTMLElement | null;
    if (!content) return;

    let mount = content.querySelector<HTMLElement>("[data-sisa-department-chart]");
    if (!mount) {
      mount = document.createElement("div");
      mount.dataset.sisaDepartmentChart = "true";
      content.insertBefore(mount, content.firstChild);
    }
    setHost(mount);

    const pageTitle = main?.querySelector("header h1");
    const previousPageTitle = pageTitle?.textContent ?? "";
    if (pageTitle) pageTitle.textContent = "Laporan Sisa Budget";

    const panelTitles = Array.from(content.querySelectorAll<HTMLHeadingElement>("h2"));
    const changedPanelTitles = panelTitles.filter((title) => title.textContent?.trim() === "Laporan Budget");
    changedPanelTitles.forEach((title) => {
      title.textContent = "Laporan Sisa Budget";
    });

    const click = () => window.setTimeout(syncCompany, 0);
    document.addEventListener("click", click);

    return () => {
      document.removeEventListener("click", click);
      if (pageTitle && previousPageTitle) pageTitle.textContent = previousPageTitle;
      changedPanelTitles.forEach((title) => {
        title.textContent = "Laporan Budget";
      });
    };
  }, [active, syncCompany]);

  useEffect(() => {
    if (!active) return;

    void loadRows();
    const interval = window.setInterval(() => {
      void loadRows();
    }, 2500);
    const refresh = () => void loadRows();
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [active, loadRows]);

  const periods = useMemo(() => {
    const found = new Set(rows.map(rowMonth).filter((month) => MONTHS.includes(month)));
    return MONTHS.filter((month) => found.has(month));
  }, [rows]);

  useEffect(() => {
    if (!active || !periods.length) return;
    const stored = localStorage.getItem(periodStorageKey(company)) ?? "";
    const next = periods.includes(stored) ? stored : periods[periods.length - 1];
    setSelectedPeriod(next);
    if (!stored || !periods.includes(stored)) {
      localStorage.setItem(periodStorageKey(company), next);
    }
  }, [active, company, periods]);

  const filteredRows = useMemo(
    () => selectedPeriod ? rows.filter((row) => rowMonth(row) === selectedPeriod) : rows,
    [rows, selectedPeriod],
  );

  const data = useMemo(() => {
    const grouped = new Map<string, Point>();

    filteredRows.forEach((row) => {
      const department = String(value(row, ["department", "departemen", "dept"]) ?? "")
        .trim()
        .toUpperCase();
      if (!department) return;

      const budget = num(value(row, ["total budget", "total_budget", "budget", "anggaran"]));
      const actual = num(
        value(row, ["total aktual", "total_aktual", "total actual", "actual", "aktual", "realisasi"]),
      );
      const uploadedRemaining = value(row, [
        "sisa budget",
        "sisa_budget",
        "remaining",
        "remaining_budget",
      ]);
      const remaining = uploadedRemaining === undefined ? budget - actual : num(uploadedRemaining);

      const current = grouped.get(department) ?? {
        department,
        budget: 0,
        actual: 0,
        remaining: 0,
      };
      current.budget += budget;
      current.actual += actual;
      current.remaining += remaining;
      grouped.set(department, current);
    });

    return Array.from(grouped.values());
  }, [filteredRows]);

  if (!active || !host) return null;

  return createPortal(
    <section className="mb-6 rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mb-1 text-lg font-semibold">Grafik Sisa Budget Per Departemen</h2>
          <p className="text-sm text-zinc-400">Sisa Budget sesuai data Excel dan periode yang dipilih.</p>
        </div>
        {periods.length ? (
          <label className="text-sm text-zinc-300">
            Periode
            <select
              className="input ml-2"
              value={selectedPeriod}
              onChange={(event) => {
                const next = event.target.value;
                setSelectedPeriod(next);
                localStorage.setItem(periodStorageKey(company), next);
              }}
            >
              {periods.map((period) => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {data.length ? (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="#27272a" />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={70}
              />
              <YAxis tickFormatter={axis} />
              <Tooltip formatter={(v: number | string) => `Rp ${nf.format(Number(v))}`} />
              <Bar dataKey="remaining" name="Sisa Budget" fill="#2a9d8f" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="py-12 text-center text-zinc-500">
          Belum ada data Laporan Sisa Budget per Departemen untuk periode ini.
        </div>
      )}
    </section>,
    host,
  );
}
