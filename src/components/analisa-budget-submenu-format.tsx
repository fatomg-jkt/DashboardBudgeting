"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Company = "1001" | "maison_y";
type Row = Record<string, unknown>;
type View = "current-month" | "through-december";
type ReportType = "analisis_variance_current_month" | "analisis_variance_through_december";

type AnalysisRow = {
  department: string;
  actual: number;
  budget: number;
  variance: number;
  variancePct: number;
  utilization: number;
  status: string;
  analysis: string;
  recommendation: string;
  priority: string;
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

function pick(row: Row, names: string[]) {
  const wanted = new Set(names.map(norm));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(norm(key))) return value;
  }
  return undefined;
}

function num(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value ?? "").trim();
  if (!text || text === "-") return 0;
  const negative = /^\(.*\)$/.test(text);
  text = text
    .replace(/^\(|\)$/g, "")
    .replace(/^rp\s*/i, "")
    .replace(/%/g, "")
    .replace(/\s/g, "");
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replaceAll(".", "").replace(",", ".");
  } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replaceAll(",", "");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function toRow(row: Row): AnalysisRow | null {
  const department = String(pick(row, ["department", "departemen", "dept", "fungsi"]) ?? "").trim();
  if (!department || /^total$/i.test(department)) return null;

  const actual = num(pick(row, ["actual", "aktual", "realisasi"]));
  const budget = num(pick(row, ["budget", "anggaran"]));
  if (!actual && !budget) return null;

  const explicitVariance = pick(row, ["variance_rp", "variance_nominal", "selisih_rp", "selisih"]);
  const variance = explicitVariance === undefined ? actual - budget : num(explicitVariance);

  const explicitVariancePct = pick(row, [
    "variance_percent",
    "variance_percentage",
    "variance_pct",
    "var_percent",
    "var_pct",
    "gap_percent",
    "gap_pct",
  ]);
  const variancePct = explicitVariancePct === undefined
    ? (budget ? (variance / budget) * 100 : 0)
    : num(explicitVariancePct);

  const explicitUtilization = pick(row, [
    "utilization",
    "utilization_percent",
    "utilization_pct",
    "pemakaian",
    "pemakaian_percent",
  ]);
  const utilization = explicitUtilization === undefined
    ? (budget ? (actual / budget) * 100 : 0)
    : num(explicitUtilization);

  const status = String(pick(row, ["status"]) ?? (actual > budget ? "Over Budget" : "Under Budget"));
  const analysis = String(pick(row, ["analysis", "analisis"]) ?? "").trim();
  const recommendation = String(pick(row, ["recommendation", "rekomendasi"]) ?? "").trim();
  const priority = String(pick(row, ["priority", "prioritas"]) ?? "").trim();

  return { department, actual, budget, variance, variancePct, utilization, status, analysis, recommendation, priority };
}

function rupiah(value: number) {
  return `Rp ${nf.format(value)}`;
}

function varianceText(value: number) {
  return value < 0 ? `(Rp ${nf.format(Math.abs(value))})` : `Rp ${nf.format(value)}`;
}

function statusClass(row: AnalysisRow) {
  return row.actual > row.budget ? "text-red-400" : "text-emerald-400";
}

function MainTable({ rows }: { rows: AnalysisRow[] }) {
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
  const totalVariance = totalActual - totalBudget;
  const totalVariancePct = totalBudget ? (totalVariance / totalBudget) * 100 : 0;
  const totalUtilization = totalBudget ? (totalActual / totalBudget) * 100 : 0;

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950/80">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-blue-800 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Departemen</th>
              <th className="px-3 py-2 text-right">Aktual</th>
              <th className="px-3 py-2 text-right">Anggaran</th>
              <th className="px-3 py-2 text-right">Variance (Rp)</th>
              <th className="px-3 py-2 text-right">Variance (%)</th>
              <th className="px-3 py-2 text-right">Utilization</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.department} className="border-b border-zinc-800">
                <td className="px-3 py-2 font-medium">{row.department}</td>
                <td className="px-3 py-2 text-right">{rupiah(row.actual)}</td>
                <td className="px-3 py-2 text-right">{rupiah(row.budget)}</td>
                <td className={`px-3 py-2 text-right ${row.variance < 0 ? "text-red-300" : ""}`}>{varianceText(row.variance)}</td>
                <td className="px-3 py-2 text-right">{pf.format(row.variancePct)}%</td>
                <td className="px-3 py-2 text-right">{pf.format(row.utilization)}%</td>
                <td className={`px-3 py-2 ${statusClass(row)}`}>{row.status}</td>
              </tr>
            ))}
            <tr className="bg-blue-100 font-semibold text-slate-950">
              <td className="px-3 py-2">TOTAL</td>
              <td className="px-3 py-2 text-right">{rupiah(totalActual)}</td>
              <td className="px-3 py-2 text-right">{rupiah(totalBudget)}</td>
              <td className="px-3 py-2 text-right">{varianceText(totalVariance)}</td>
              <td className="px-3 py-2 text-right">{pf.format(totalVariancePct)}%</td>
              <td className="px-3 py-2 text-right">{pf.format(totalUtilization)}%</td>
              <td className="px-3 py-2" />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Narrative({ rows }: { rows: AnalysisRow[] }) {
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
  const utilization = totalBudget ? (totalActual / totalBudget) * 100 : 0;
  const difference = totalBudget - totalActual;
  const over = rows.filter((row) => row.actual > row.budget).length;
  const under = rows.length - over;
  const biggest = [...rows].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))[0];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm italic text-zinc-200">
      Realisasi biaya operasional mencapai {rupiah(totalActual)} atau {pf.format(utilization)}% dari anggaran. {difference >= 0 ? `Terdapat penghematan sebesar ${rupiah(difference)}.` : `Terdapat kelebihan realisasi sebesar ${rupiah(Math.abs(difference))}.`} {over} departemen over budget dan {under} departemen under budget. {biggest ? `Prioritaskan penelaahan pada ${biggest.department} sebagai departemen dengan variance terbesar.` : ""}
    </div>
  );
}

function RankingTable({ rows, mode }: { rows: AnalysisRow[]; mode: "over" | "under" }) {
  const ranked = useMemo(() => {
    const source = mode === "over"
      ? rows.filter((row) => row.actual > row.budget).sort((a, b) => b.variance - a.variance)
      : rows.filter((row) => row.actual <= row.budget).sort((a, b) => (b.budget - b.actual) - (a.budget - a.actual));
    return source.slice(0, 5);
  }, [rows, mode]);

  const title = mode === "over" ? "TOP 5 DEPARTEMEN OVER BUDGET" : "TOP 5 DEPARTEMEN UNDER BUDGET";
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950/80">
      <div className={mode === "over" ? "bg-red-700 px-4 py-2 text-center font-semibold text-white" : "bg-emerald-700 px-4 py-2 text-center font-semibold text-white"}>{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-blue-800 text-white">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2 text-left">Departemen</th>
              <th className="px-3 py-2 text-right">{mode === "over" ? "Variance" : "Saving"}</th>
              <th className="px-3 py-2 text-right">{mode === "over" ? "Variance %" : "Saving %"}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }, (_, index) => {
              const row = ranked[index];
              const amount = row ? (mode === "over" ? row.actual - row.budget : row.budget - row.actual) : 0;
              const pct = row?.budget ? (amount / row.budget) * 100 : 0;
              return (
                <tr key={index} className="border-b border-zinc-800">
                  <td className="px-3 py-2 text-center">{index + 1}</td>
                  <td className="px-3 py-2">{row?.department ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{rupiah(amount)}</td>
                  <td className="px-3 py-2 text-right">{pf.format(pct)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BenchmarkTable({ rows }: { rows: AnalysisRow[] }) {
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950/80">
      <div className="bg-sky-900 px-4 py-2 text-center font-semibold text-white">BENCHMARK ALOKASI BUDGET PER FUNGSI DEPARTEMEN</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1250px] text-sm">
          <thead className="bg-blue-800 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Fungsi</th>
              <th className="px-3 py-2 text-right">Aktual</th>
              <th className="px-3 py-2 text-right">Aktual %</th>
              <th className="px-3 py-2 text-right">Anggaran</th>
              <th className="px-3 py-2 text-right">Anggaran %</th>
              <th className="px-3 py-2 text-right">Gap %</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Analisis</th>
              <th className="px-3 py-2 text-left">Rekomendasi</th>
              <th className="px-3 py-2 text-left">Prioritas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const actualPct = totalActual ? (row.actual / totalActual) * 100 : 0;
              const budgetPct = totalBudget ? (row.budget / totalBudget) * 100 : 0;
              const gapPct = actualPct - budgetPct;
              const allocationStatus = Math.abs(gapPct) <= 1 ? "Seimbang" : gapPct > 0 ? "Over-allocated" : "Under-allocated";
              const analysis = row.analysis || (Math.abs(gapPct) <= 1 ? "Alokasi sesuai" : gapPct > 0 ? "Porsi aktual di atas budget" : "Porsi aktual di bawah budget");
              const recommendation = row.recommendation || (gapPct > 1 ? "Review pengendalian biaya" : gapPct < -1 ? "Validasi kebutuhan anggaran" : "Pertahankan");
              const priority = row.priority || (Math.abs(gapPct) >= 5 ? "Tinggi" : Math.abs(gapPct) >= 2 ? "Sedang" : "Rendah");
              return (
                <tr key={row.department} className="border-b border-zinc-800">
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2 text-right">{rupiah(row.actual)}</td>
                  <td className="px-3 py-2 text-right">{pf.format(actualPct)}%</td>
                  <td className="px-3 py-2 text-right">{rupiah(row.budget)}</td>
                  <td className="px-3 py-2 text-right">{pf.format(budgetPct)}%</td>
                  <td className="px-3 py-2 text-right">{pf.format(gapPct)}%</td>
                  <td className="px-3 py-2">{allocationStatus}</td>
                  <td className="px-3 py-2">{analysis}</td>
                  <td className="px-3 py-2">{recommendation}</td>
                  <td className="px-3 py-2">{priority}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AnalisaBudgetSubmenuFormat() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(false);
  const lastSuccess = useRef("");

  const sync = useCallback(() => {
    if (window.location.pathname !== "/analisis-variance") {
      setView(null);
      setHost(null);
      return;
    }
    const nextView = new URLSearchParams(window.location.search).get("view");
    if (nextView !== "current-month" && nextView !== "through-december") {
      setView(null);
      setHost(null);
      return;
    }
    setView(nextView);
    setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001");

    const root = document.querySelector<HTMLElement>(".analisa-submenu-report-root");
    if (!root) return;
    let formatHost = root.querySelector<HTMLElement>("[data-analisa-submenu-format-host]");
    if (!formatHost) {
      formatHost = document.createElement("div");
      formatHost.dataset.analisaSubmenuFormatHost = "true";
      formatHost.className = "space-y-6";
      const toolbar = root.querySelector(":scope > div");
      if (toolbar) toolbar.insertAdjacentElement("afterend", formatHost);
      else root.append(formatHost);
    }
    setHost(formatHost);
  }, []);

  useEffect(() => {
    sync();
    const timers = [80, 250, 600].map((delay) => window.setTimeout(sync, delay));
    const click = () => window.setTimeout(sync, 0);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      timers.forEach(window.clearTimeout);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", sync);
      observer.disconnect();
    };
  }, [sync]);

  const load = useCallback(async () => {
    if (!view) return;
    setLoading(true);
    const reportType: ReportType = view === "current-month"
      ? "analisis_variance_current_month"
      : "analisis_variance_through_december";
    try {
      const response = await fetch(`/api/reports?reportType=${reportType}&company=${company}`, { cache: "no-store" });
      const payload = await response.json();
      const parsed = response.ok && Array.isArray(payload)
        ? payload.map((item) => toRow(item as Row)).filter((item): item is AnalysisRow => item !== null)
        : [];
      setRows(parsed);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [company, view]);

  useEffect(() => {
    if (view && host) void load();
  }, [view, host, load]);

  useEffect(() => {
    if (!host) return;
    const root = host.parentElement;
    if (!root) return;
    const observer = new MutationObserver(() => {
      const success = root.querySelector<HTMLElement>(":scope > .success")?.textContent?.trim() ?? "";
      if (success && success !== lastSuccess.current) {
        lastSuccess.current = success;
        void load();
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [host, load]);

  if (!view || !host) return null;

  return createPortal(
    <>
      <style>{`
        .analisa-submenu-report-root > section { display: none !important; }
        .analisa-submenu-report-root > p { display: none !important; }
        .analisa-submenu-report-root > [data-analisa-submenu-format-host] { display: block !important; }
      `}</style>
      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-8 text-center text-zinc-400">Memuat data laporan...</div>
      ) : rows.length ? (
        <div className="space-y-6">
          <MainTable rows={rows} />
          <Narrative rows={rows} />
          <div className="grid gap-6 xl:grid-cols-2">
            <RankingTable rows={rows} mode="over" />
            <RankingTable rows={rows} mode="under" />
          </div>
          <BenchmarkTable rows={rows} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gold-500/30 bg-zinc-950/60 p-10 text-center text-zinc-400">
          Belum ada data pada submenu ini. Gunakan tombol Upload Excel di atas dengan template yang sama.
        </div>
      )}
    </>,
    host,
  );
}
