"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;
type Mode = "sisa" | "budget-actual";

type Summary = {
  budget: number;
  actual: number;
  variance: number;
  remaining: number;
  usagePct: number;
  remainingPct: number;
};

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function norm(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function pick(row: ApiRow, names: string[]) {
  const wanted = new Set(names.map(norm));
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
    .replace(/%/g, "")
    .replace(/\s/g, "");
  if (!text || text === "-") return 0;
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/^\(|\)$/g, "");
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replaceAll(".", "").replace(",", ".");
  } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replaceAll(",", "");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

const MONTH_ALIASES: Record<string, string> = {
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

function monthName(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (MONTH_ALIASES[raw]) return MONTH_ALIASES[raw];
  for (const [alias, label] of Object.entries(MONTH_ALIASES)) {
    if (raw.includes(alias)) return label;
  }
  return String(value ?? "").trim();
}

function currency(value: number) {
  const prefix = value < 0 ? "-Rp " : "Rp ";
  return `${prefix}${nf.format(Math.abs(value))}`;
}

function currentRoute(): Mode | null {
  const path = window.location.pathname;
  const view = new URLSearchParams(window.location.search).get("view");
  if (path === "/laporan-budget" && view === "sisa-budget-per-departemen") return "sisa";
  if (path === "/budget-vs-actual" && view === "per-departemen") return "budget-actual";
  return null;
}

function reportType(mode: Mode) {
  return mode === "sisa" ? "laporan_budget" : "budget_vs_actual";
}

function sisaPeriodKey(company: Company) {
  return `budgeting_sisa_budget_period_${company}`;
}

function computeSummary(rows: ApiRow[], mode: Mode, company: Company): Summary {
  const selectedPeriod = mode === "sisa"
    ? localStorage.getItem(sisaPeriodKey(company)) ?? ""
    : "";

  const filtered = selectedPeriod
    ? rows.filter((row) => monthName(pick(row, ["bulan", "month", "periode"])) === selectedPeriod)
    : rows;

  let budget = 0;
  let actual = 0;

  filtered.forEach((row) => {
    const department = String(pick(row, ["department", "departemen", "dept"]) ?? "").trim();
    if (!department || /^total$/i.test(department)) return;
    budget += num(pick(row, ["total budget", "total_budget", "budget", "anggaran"]));
    actual += num(pick(row, ["total actual", "total_actual", "total aktual", "total_aktual", "actual", "aktual", "realisasi"]));
  });

  const variance = actual - budget;
  const remaining = budget - actual;
  return {
    budget,
    actual,
    variance,
    remaining,
    usagePct: budget ? (actual / budget) * 100 : 0,
    remainingPct: budget ? (remaining / budget) * 100 : 0,
  };
}

export default function DepartmentBudgetKpis() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [, setPeriodVersion] = useState(0);

  const syncRouteAndHost = useCallback(() => {
    const nextMode = currentRoute();
    setMode(nextMode);
    if (!nextMode) {
      setHost(null);
      return;
    }

    const nextCompany: Company =
      localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001";
    setCompany(nextCompany);

    const main = document.querySelector("main");
    const content = main?.children.item(1) as HTMLElement | null;
    if (!content) return;

    let target: HTMLElement | null = null;
    if (nextMode === "sisa") {
      target = content.querySelector<HTMLElement>("[data-sisa-department-chart]");
    } else {
      const heading = Array.from(content.querySelectorAll<HTMLElement>("h2,h3"))
        .find((item) => item.textContent?.trim() === "Budget vs Actual");
      target = heading?.closest<HTMLElement>("section") ?? heading?.closest<HTMLElement>("div.rounded-2xl") ?? null;
    }
    if (!target) return;

    let mount = content.querySelector<HTMLElement>("[data-department-budget-kpis]");
    if (!mount) {
      mount = document.createElement("div");
      mount.dataset.departmentBudgetKpis = "true";
      target.insertAdjacentElement("beforebegin", mount);
    } else if (mount.nextElementSibling !== target) {
      target.insertAdjacentElement("beforebegin", mount);
    }
    setHost(mount);
  }, []);

  const load = useCallback(async () => {
    if (!mode) return;
    try {
      const response = await fetch(`/api/reports?reportType=${reportType(mode)}&company=${company}`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      setRows(response.ok && Array.isArray(payload) ? payload as ApiRow[] : []);
    } catch {
      setRows([]);
    }
  }, [mode, company]);

  useEffect(() => {
    syncRouteAndHost();
    const timers = [80, 250, 700].map((delay) => window.setTimeout(syncRouteAndHost, delay));
    const click = () => window.setTimeout(syncRouteAndHost, 0);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", syncRouteAndHost);
    const observer = new MutationObserver(syncRouteAndHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      timers.forEach(window.clearTimeout);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", syncRouteAndHost);
      observer.disconnect();
    };
  }, [syncRouteAndHost]);

  useEffect(() => {
    if (mode && host) void load();
  }, [mode, host, load]);

  useEffect(() => {
    if (mode !== "sisa") return;
    const onChange = () => window.setTimeout(() => setPeriodVersion((value) => value + 1), 0);
    document.addEventListener("change", onChange, true);
    const interval = window.setInterval(() => setPeriodVersion((value) => value + 1), 1000);
    return () => {
      document.removeEventListener("change", onChange, true);
      window.clearInterval(interval);
    };
  }, [mode]);

  const summary = useMemo(
    () => mode ? computeSummary(rows, mode, company) : null,
    [rows, mode, company],
  );

  if (!mode || !host || !summary) return null;

  const cards = [
    ["Total Budget", currency(summary.budget)],
    ["Total Actual", currency(summary.actual)],
    ["Variance", currency(summary.variance)],
    ["Sisa Budget", currency(summary.remaining)],
    ["% Penggunaan Budget", `${pf.format(summary.usagePct)}%`],
    ["% Sisa Budget", `${pf.format(summary.remainingPct)}%`],
  ];

  return createPortal(
    <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-2xl border border-gold-500/20 bg-zinc-950/80 px-4 py-4">
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="mt-2 whitespace-nowrap text-xl font-semibold tracking-tight text-white">{value}</p>
        </div>
      ))}
    </section>,
    host,
  );
}
