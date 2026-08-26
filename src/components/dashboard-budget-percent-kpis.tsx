"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;

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

function budgetOf(row: ApiRow) {
  return num(
    pick(row, [
      "budget",
      "anggaran",
      "total_budget",
      "total budget",
      "beban_operasional_anggaran",
      "budget_bulanan",
    ]),
  );
}

function actualOf(row: ApiRow) {
  return num(
    pick(row, [
      "actual",
      "aktual",
      "realisasi",
      "total_actual",
      "total actual",
      "total_aktual",
      "total aktual",
      "total_realisasi",
      "beban_operasional_aktual",
      "realisasi_bulanan",
    ]),
  );
}

const percentFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export default function DashboardBudgetPercentKpis() {
  const pathname = usePathname();
  const active = pathname === "/" || pathname === "/dashboard";
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  const syncCompany = useCallback(() => {
    const next: Company =
      localStorage.getItem("budgeting_active_company") === "maison_y"
        ? "maison_y"
        : "1001";
    setCompany((current) => (current === next ? current : next));
  }, []);

  const attach = useCallback(() => {
    if (!active) return;
    const root = document.querySelector<HTMLElement>(".dashboard-graph-center");
    if (!root) return;

    const grids = Array.from(root.querySelectorAll<HTMLElement>("div.grid"));
    const kpiGrid = grids.find((grid) => {
      const text = grid.textContent ?? "";
      return text.includes("Total Budget") && text.includes("Total Actual") && text.includes("Sisa Budget");
    });
    if (!kpiGrid) return;

    kpiGrid.classList.add("dashboard-kpi-six-columns");
    let node = kpiGrid.querySelector<HTMLElement>("[data-dashboard-budget-percent-kpis]");
    if (!node) {
      node = document.createElement("div");
      node.dataset.dashboardBudgetPercentKpis = "true";
      node.style.display = "contents";
      kpiGrid.appendChild(node);
    }
    setMount(node);
  }, [active]);

  useEffect(() => {
    if (!active) {
      setMount(null);
      return;
    }

    syncCompany();
    attach();

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    const click = () => window.setTimeout(syncCompany, 0);
    document.addEventListener("click", click, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", click, true);
    };
  }, [active, attach, syncCompany]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch(`/api/reports?reportType=budget_vs_actual&company=${company}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!cancelled) {
          setRows(response.ok && Array.isArray(payload) ? (payload as ApiRow[]) : []);
        }
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active, company]);

  const percentages = useMemo(() => {
    const budget = rows.reduce((sum, row) => sum + budgetOf(row), 0);
    const actual = rows.reduce((sum, row) => sum + actualOf(row), 0);
    const used = budget ? (actual / budget) * 100 : 0;
    const remaining = budget ? ((budget - actual) / budget) * 100 : 0;
    return { used, remaining };
  }, [rows]);

  if (!active || !mount) return null;

  const cards = [
    ["% Penggunaan Budget", percentages.used],
    ["% Sisa Budget", percentages.remaining],
  ] as const;

  return createPortal(
    <>
      <style>{`
        @media (min-width: 1280px) {
          .dashboard-kpi-six-columns {
            grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          }
        }

        /* Keep all KPI values compact enough to stay on one line, especially Variance. */
        .dashboard-kpi-six-columns > div > p.mt-2 {
          font-size: 1.35rem !important;
          line-height: 1.65rem !important;
          white-space: nowrap;
        }
      `}</style>
      {cards.map(([label, value]) => (
        <div
          key={label}
          className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5"
        >
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold">
            {percentFormatter.format(value)}%
          </p>
        </div>
      ))}
    </>,
    mount,
  );
}
