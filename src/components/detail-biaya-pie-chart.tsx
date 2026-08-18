"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;
type DetailRow = {
  deskripsi_coa: string;
  department: string;
  periode: string;
  anggaran: number;
  aktual: number;
};

type Filters = {
  periode: string;
  department: string;
  coa: string;
  status: string;
};

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function numberValue(value: unknown) {
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

function normalizeDepartment(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizePeriod(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    jan: "Januari", januari: "Januari", january: "Januari",
    feb: "Februari", februari: "Februari", february: "Februari",
    mar: "Maret", maret: "Maret", march: "Maret",
    apr: "April", april: "April",
    mei: "Mei", may: "Mei",
    jun: "Juni", juni: "Juni", june: "Juni",
    jul: "Juli", juli: "Juli", july: "Juli",
    agu: "Agustus", agustus: "Agustus", aug: "Agustus", august: "Agustus",
    sep: "September", september: "September",
    okt: "Oktober", oktober: "Oktober", oct: "Oktober", october: "Oktober",
    nov: "November", november: "November",
    des: "Desember", desember: "Desember", dec: "Desember", december: "Desember",
  };
  if (!raw) return "Semua Periode";
  if (aliases[raw]) return aliases[raw];
  for (const [alias, period] of Object.entries(aliases)) {
    if (raw.includes(alias)) return period;
  }
  return String(value ?? "").trim() || "Semua Periode";
}

function fromApiRow(value: unknown): DetailRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as ApiRow;
  const deskripsi = String(row.deskripsi_coa ?? row.deskripsi ?? row.description ?? "").trim();
  const department = normalizeDepartment(row.department ?? row.departemen ?? "");
  if (!deskripsi || !department) return null;
  return {
    deskripsi_coa: deskripsi,
    department,
    periode: normalizePeriod(row.periode ?? row.bulan ?? row.month ?? ""),
    anggaran: numberValue(row.anggaran ?? row.budget),
    aktual: numberValue(row.aktual ?? row.actual),
  };
}

function isOverBudget(row: DetailRow) {
  return row.aktual > row.anggaran;
}

function rupiahCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `Rp${pf.format(value / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `Rp${pf.format(value / 1_000_000)} jt`;
  if (abs >= 1_000) return `Rp${pf.format(value / 1_000)} rb`;
  return `Rp${nf.format(value)}`;
}

export default function DetailBiayaPieChart() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [filters, setFilters] = useState<Filters>({
    periode: "all",
    department: "all",
    coa: "all",
    status: "all",
  });

  const syncCompany = useCallback(() => {
    setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001");
  }, []);

  const syncFilters = useCallback(() => {
    const root = document.querySelector<HTMLElement>(".detail-biaya-root");
    if (!root) return;
    const selects = root.querySelectorAll<HTMLSelectElement>("section select");
    if (selects.length < 4) return;
    setFilters({
      periode: selects[0]?.value ?? "all",
      department: selects[1]?.value ?? "all",
      coa: selects[2]?.value ?? "all",
      status: selects[3]?.value ?? "all",
    });
  }, []);

  const attachMount = useCallback(() => {
    if (
      window.location.pathname !== "/budget-vs-actual" ||
      new URLSearchParams(window.location.search).get("view") !== "detail-biaya"
    ) {
      setMount(null);
      return;
    }

    const root = document.querySelector<HTMLElement>(".detail-biaya-root");
    if (!root) return;
    const filterSection = root.querySelector<HTMLElement>("section");
    if (!filterSection) return;

    let node = root.querySelector<HTMLElement>("[data-detail-biaya-pie-mount]");
    if (!node) {
      node = document.createElement("div");
      node.dataset.detailBiayaPieMount = "true";
      filterSection.insertAdjacentElement("afterend", node);
    }
    setMount(node);
    syncFilters();
  }, [syncFilters]);

  const loadRows = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/reports?reportType=budget_detail_biaya&company=${company}`,
        { cache: "no-store" },
      );
      const payload: unknown = await response.json();
      if (!response.ok || !Array.isArray(payload)) {
        setRows([]);
        return;
      }
      setRows(payload.map(fromApiRow).filter((row): row is DetailRow => row !== null));
    } catch {
      setRows([]);
    }
  }, [company]);

  useEffect(() => {
    syncCompany();
    attachMount();

    const observer = new MutationObserver(() => attachMount());
    observer.observe(document.body, { childList: true, subtree: true });

    const handleChange = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(".detail-biaya-root")) window.setTimeout(syncFilters, 0);
    };

    const handleClick = () => {
      window.setTimeout(() => {
        syncCompany();
        attachMount();
      }, 0);
    };

    document.addEventListener("change", handleChange, true);
    document.addEventListener("click", handleClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("change", handleChange, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, [attachMount, syncCompany, syncFilters]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (filters.periode !== "all" && row.periode !== filters.periode) return false;
        if (filters.department !== "all" && row.department !== filters.department) return false;
        if (filters.coa !== "all" && row.deskripsi_coa !== filters.coa) return false;
        if (filters.status === "over" && !isOverBudget(row)) return false;
        if (filters.status === "under" && isOverBudget(row)) return false;
        return true;
      }),
    [rows, filters],
  );

  const summary = useMemo(() => {
    const budget = filteredRows.reduce((sum, row) => sum + row.anggaran, 0);
    const actual = filteredRows.reduce((sum, row) => sum + row.aktual, 0);
    const remaining = Math.max(budget - actual, 0);
    const over = Math.max(actual - budget, 0);
    const actualPct = budget > 0 ? (actual / budget) * 100 : actual > 0 ? 100 : 0;
    const remainingPct = budget > 0 ? (remaining / budget) * 100 : 0;
    const overPct = budget > 0 ? (over / budget) * 100 : 0;
    return { budget, actual, remaining, over, actualPct, remainingPct, overPct };
  }, [filteredRows]);

  const chartData = useMemo(() => {
    if (summary.budget <= 0 && summary.actual <= 0) return [];
    if (summary.over > 0) {
      return [
        { name: "Aktual dalam Budget", value: summary.budget },
        { name: "Over Budget", value: summary.over },
      ];
    }
    return [
      { name: "Aktual", value: summary.actual },
      { name: "Sisa", value: summary.remaining },
    ].filter((item) => item.value > 0);
  }, [summary]);

  const title = filters.department === "all" ? "SEMUA DEPARTEMEN" : filters.department;
  const context = [
    filters.periode === "all" ? "Semua Periode" : filters.periode,
    filters.coa === "all" ? "Semua COA" : filters.coa,
    filters.status === "all" ? "Semua Status" : filters.status === "over" ? "Over Budget" : "Under Budget",
  ].join(" · ");

  if (!mount) return null;

  return createPortal(
    <section className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-xs text-zinc-400">Aktual vs Sisa Anggaran · {context}</p>
      </div>

      {filteredRows.length === 0 || chartData.length === 0 ? (
        <div className="flex min-h-56 items-center justify-center text-sm text-zinc-500">
          Belum ada data untuk pilihan filter ini.
        </div>
      ) : (
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(280px,460px)_1fr]">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={105}
                  stroke="none"
                >
                  {chartData.map((item, index) => (
                    <Cell
                      key={item.name}
                      fill={index === 0 ? "#f05a3a" : summary.over > 0 ? "#dc2626" : "#2a9d8f"}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | string) => rupiahCompact(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="h-3 w-3 rounded-sm bg-[#f05a3a]" /> Aktual
              </div>
              <p className="mt-1 text-xl font-semibold">{rupiahCompact(summary.actual)}</p>
              <p className={summary.over > 0 ? "text-sm font-semibold text-red-400" : "text-sm font-semibold text-[#f05a3a]"}>
                {pf.format(summary.actualPct)}%
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <span className={`h-3 w-3 rounded-sm ${summary.over > 0 ? "bg-red-600" : "bg-[#2a9d8f]"}`} />
                {summary.over > 0 ? "Over Budget" : "Sisa"}
              </div>
              <p className="mt-1 text-xl font-semibold">
                {rupiahCompact(summary.over > 0 ? summary.over : summary.remaining)}
              </p>
              <p className={summary.over > 0 ? "text-sm font-semibold text-red-400" : "text-sm font-semibold text-[#2a9d8f]"}>
                {pf.format(summary.over > 0 ? summary.overPct : summary.remainingPct)}%
              </p>
            </div>

            <div className="border-t border-zinc-800 pt-4 sm:col-span-2 lg:col-span-1">
              <p className="text-sm text-zinc-400">Total Budget</p>
              <p className="mt-1 text-lg font-semibold">{rupiahCompact(summary.budget)}</p>
              <p className="mt-1 text-xs text-zinc-500">{filteredRows.length} baris data sesuai filter</p>
            </div>
          </div>
        </div>
      )}
    </section>,
    mount,
  );
}
