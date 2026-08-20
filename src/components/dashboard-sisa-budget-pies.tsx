"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;

type DepartmentPoint = {
  department: string;
  budget: number;
  actual: number;
  remaining: number;
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

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pick(row: ApiRow, keys: string[]) {
  const wanted = new Set(keys.map(normalize));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalize(key))) return value;
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
  for (const [alias, label] of Object.entries(aliases)) {
    if (raw.includes(alias)) return label;
  }
  return String(value ?? "").trim();
}

function rowMonth(row: ApiRow) {
  return monthName(pick(row, ["bulan", "month", "periode"]));
}

function periodStorageKey(company: Company) {
  return `budgeting_sisa_budget_period_${company}`;
}

function shortMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000_000) return `Rp${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return `Rp${nf.format(value)}`;
}

export default function DashboardSisaBudgetPies() {
  const pathname = usePathname();
  const active = pathname === "/" || pathname === "/dashboard";
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [period, setPeriod] = useState("");

  const syncCompany = useCallback(() => {
    const next: Company = localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001";
    setCompany(next);
  }, []);

  useEffect(() => {
    if (!active) {
      setHost(null);
      return;
    }

    syncCompany();
    const locate = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>("section"));
      const original = sections.find((section) =>
        section.querySelector("h2")?.textContent?.trim() === "Sisa Budget - Per Departemen",
      );
      if (!original) return;

      // Keep the original green Sisa Budget bar chart visible on the Dashboard.
      original.style.removeProperty("display");

      const parent = original.parentElement;
      if (!parent) return;

      let mount = parent.querySelector<HTMLElement>("[data-dashboard-sisa-pie-mount]");
      if (!mount) {
        mount = document.createElement("div");
        mount.dataset.dashboardSisaPieMount = "true";
        parent.insertBefore(mount, original);
      }
      setHost(mount);
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });

    const click = () => window.setTimeout(syncCompany, 0);
    document.addEventListener("click", click, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", click, true);
      const sections = Array.from(document.querySelectorAll<HTMLElement>("section"));
      sections.find((section) => section.querySelector("h2")?.textContent?.trim() === "Sisa Budget - Per Departemen")?.style.removeProperty("display");
    };
  }, [active, syncCompany]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch(`/api/reports?reportType=laporan_budget&company=${company}`, { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!cancelled) setRows(response.ok && Array.isArray(payload) ? (payload as ApiRow[]) : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => { cancelled = true; };
  }, [active, company]);

  const periods = useMemo(() => {
    const found = new Set(rows.map(rowMonth).filter((month) => MONTHS.includes(month)));
    return MONTHS.filter((month) => found.has(month));
  }, [rows]);

  useEffect(() => {
    if (!active || !periods.length) return;
    const stored = localStorage.getItem(periodStorageKey(company)) ?? "";
    const selected = periods.includes(stored) ? stored : periods[periods.length - 1];
    setPeriod(selected);
  }, [active, company, periods]);

  const departments = useMemo(() => {
    const filtered = period ? rows.filter((row) => rowMonth(row) === period) : rows;
    const grouped = new Map<string, DepartmentPoint>();

    filtered.forEach((row) => {
      const department = String(pick(row, ["department", "departemen", "dept"]) ?? "").trim().toUpperCase();
      if (!department) return;

      const budget = num(pick(row, ["total budget", "total_budget", "budget", "anggaran"]));
      const actual = num(pick(row, ["total aktual", "total_aktual", "total actual", "actual", "aktual", "realisasi"]));
      const remainingRaw = pick(row, ["sisa budget", "sisa_budget", "remaining", "remaining_budget"]);
      const remaining = remainingRaw === undefined ? budget - actual : num(remainingRaw);

      const current = grouped.get(department) ?? { department, budget: 0, actual: 0, remaining: 0 };
      current.budget += budget;
      current.actual += actual;
      current.remaining += remaining;
      grouped.set(department, current);
    });

    return Array.from(grouped.values()).sort((a, b) => a.department.localeCompare(b.department));
  }, [rows, period]);

  if (!active || !host) return null;

  return createPortal(
    <section className="rounded-2xl border border-gold-500/20 bg-gradient-to-b from-zinc-950 to-black p-4 xl:col-span-2">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sisa Budget - Per Departemen</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Semua departemen · Periode: <span className="font-semibold text-gold-300">{period || "-"}</span>
          </p>
        </div>
        <Link className="secondary-button text-xs" href="/laporan-budget?view=sisa-budget-per-departemen">Buka Laporan</Link>
      </div>

      {departments.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10">
          {departments.map((item) => {
            const safeRemaining = Math.max(item.remaining, 0);
            const safeActual = Math.max(item.actual, 0);
            const pieData = [
              { name: "Actual", value: safeActual },
              { name: "Sisa", value: safeRemaining },
            ].filter((entry) => entry.value > 0);
            const utilization = item.budget > 0 ? (item.actual / item.budget) * 100 : 0;

            return (
              <div key={item.department} className="rounded-lg border border-zinc-800 bg-black/30 p-2 text-center">
                <p className="min-h-8 text-[10px] font-semibold leading-tight text-zinc-200">{item.department}</p>
                <div className="mx-auto h-20 w-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData.length ? pieData : [{ name: "Sisa", value: 1 }]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={16}
                        outerRadius={34}
                        stroke="none"
                      >
                        {(pieData.length ? pieData : [{ name: "Sisa", value: 1 }]).map((entry) => (
                          <Cell key={entry.name} fill={entry.name === "Actual" ? "#EF4444" : "#2A9D8F"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number | string) => `Rp ${nf.format(Number(value))}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] leading-tight text-zinc-400">Budget {shortMoney(item.budget)}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-red-400">Actual {shortMoney(item.actual)}</p>
                <p className="text-[10px] leading-tight text-emerald-400">Sisa {shortMoney(item.remaining)}</p>
                <p className="mt-0.5 text-[9px] text-zinc-500">{utilization.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% terpakai</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-zinc-500">Belum ada data Sisa Budget per Departemen untuk periode ini.</div>
      )}
    </section>,
    host,
  );
}
