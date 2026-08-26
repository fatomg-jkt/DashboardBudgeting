"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;
type DetailRow = { department: string; budget: number; actual: number };

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function pick(row: ApiRow, keys: string[]) {
  const wanted = new Set(keys.map(normalize));
  for (const [name, value] of Object.entries(row)) if (wanted.has(normalize(name))) return value;
  return undefined;
}

function num(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value ?? "").trim().replace(/^rp\s*/i, "").replace(/\s/g, "");
  if (!text || text === "-") return 0;
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replaceAll(".", "").replace(",", ".");
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replaceAll(",", "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function YtdManagementSummary() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<DetailRow[]>([]);

  const active =
    typeof window !== "undefined" &&
    window.location.pathname === "/budget-vs-actual" &&
    new URLSearchParams(window.location.search).get("view") === "ytd";

  const syncCompany = useCallback(() => {
    setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001");
  }, []);

  const attach = useCallback(() => {
    if (!active) return;
    const root = document.querySelector<HTMLElement>(".ytd-detail-v2-root");
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));
    const detailSection = sections.find((section) => section.textContent?.includes("Detail Data Import"));
    if (!detailSection) return;

    detailSection.style.display = "none";
    let node = root.querySelector<HTMLElement>("[data-ytd-management-summary]");
    if (!node) {
      node = document.createElement("div");
      node.dataset.ytdManagementSummary = "true";
      detailSection.insertAdjacentElement("beforebegin", node);
    }
    setMount(node);
  }, [active]);

  const loadRows = useCallback(async function loadRows(attempt = 0) {
    if (!active) return;
    try {
      const response = await fetch(`/api/reports?reportType=cumulative_budget_actual_ytd&company=${company}`, { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok || !Array.isArray(payload)) throw new Error("Data YTD belum siap dibaca.");

      const parsed = payload.map((raw) => {
        const row = raw as ApiRow;
        return {
          department: String(pick(row, ["department", "departemen", "dept"]) ?? "LAINNYA").trim().toUpperCase() || "LAINNYA",
          budget: num(pick(row, ["budget", "anggaran"])),
          actual: num(pick(row, ["realisasi", "actual", "aktual"])),
        };
      });

      setRows(parsed);

      // The detailed YTD report can finish loading a moment after this summary mounts.
      // Retry a couple of times only when no rows are available, avoiding continuous polling.
      if (parsed.length === 0 && attempt < 2) {
        window.setTimeout(() => void loadRows(attempt + 1), 600 * (attempt + 1));
      }
    } catch {
      if (attempt < 2) {
        window.setTimeout(() => void loadRows(attempt + 1), 600 * (attempt + 1));
      } else {
        setRows([]);
      }
    }
  }, [active, company]);

  useEffect(() => {
    if (!active) return;
    syncCompany();
    attach();

    const observer = new MutationObserver(() => attach());
    observer.observe(document.body, { childList: true, subtree: true });

    const click = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      const label = button?.textContent?.toLowerCase().trim() ?? "";

      window.setTimeout(() => {
        syncCompany();
        attach();
      }, 0);

      // Refresh the management summary after a YTD import is saved on this page.
      if (label.includes("import") && label.includes("simpan")) {
        [700, 1600, 3200].forEach((delay) => {
          window.setTimeout(() => void loadRows(), delay);
        });
      }
    };

    const refresh = () => void loadRows();
    const visibility = () => {
      if (document.visibilityState === "visible") void loadRows();
    };

    document.addEventListener("click", click, true);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", click, true);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active, attach, loadRows, syncCompany]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  const data = useMemo(() => {
    const map = new Map<string, { department: string; budget: number; actual: number }>();
    rows.forEach((row) => {
      const current = map.get(row.department) ?? { department: row.department, budget: 0, actual: 0 };
      current.budget += row.budget;
      current.actual += row.actual;
      map.set(row.department, current);
    });
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        remaining: row.budget - row.actual,
        utilization: row.budget ? (row.actual / row.budget) * 100 : row.actual > 0 ? 100 : 0,
      }))
      .sort((a, b) => b.actual - a.actual);
  }, [rows]);

  const total = useMemo(() => data.reduce((acc, row) => ({
    budget: acc.budget + row.budget,
    actual: acc.actual + row.actual,
    remaining: acc.remaining + row.remaining,
  }), { budget: 0, actual: 0, remaining: 0 }), [data]);

  if (!active || !mount) return null;

  return createPortal(
    <section className="overflow-hidden rounded-2xl border border-gold-500/20 bg-zinc-950/80">
      <div className="border-b border-zinc-800 p-4">
        <h3 className="text-lg font-semibold">Ringkasan Management per Departemen</h3>
        <p className="mt-1 text-sm text-zinc-400">Tampilan sederhana untuk melihat budget, realisasi, sisa dan status tiap departemen.</p>
      </div>

      <div className="grid gap-3 border-b border-zinc-800 p-4 md:grid-cols-3">
        <div><p className="text-xs text-zinc-400">Total Budget</p><p className="mt-1 text-lg font-semibold">Rp {nf.format(total.budget)}</p></div>
        <div><p className="text-xs text-zinc-400">Total Realisasi</p><p className="mt-1 text-lg font-semibold">Rp {nf.format(total.actual)}</p></div>
        <div><p className="text-xs text-zinc-400">Sisa Budget</p><p className={`mt-1 text-lg font-semibold ${total.remaining < 0 ? "text-red-400" : "text-emerald-400"}`}>Rp {nf.format(total.remaining)}</p></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-blue-900 text-white">
            <tr>
              <th className="px-4 py-3 text-left">Departemen</th>
              <th className="px-4 py-3 text-right">Budget</th>
              <th className="px-4 py-3 text-right">Realisasi</th>
              <th className="px-4 py-3 text-right">Sisa</th>
              <th className="px-4 py-3 text-right">Utilization</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const over = row.remaining < 0;
              return (
                <tr key={row.department} className="border-b border-zinc-800">
                  <td className="px-4 py-3 font-semibold">{row.department}</td>
                  <td className="px-4 py-3 text-right">{nf.format(row.budget)}</td>
                  <td className="px-4 py-3 text-right">{nf.format(row.actual)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${over ? "text-red-400" : "text-emerald-400"}`}>{nf.format(row.remaining)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${over ? "text-red-400" : ""}`}>{pf.format(row.utilization)}%</td>
                  <td className={`px-4 py-3 font-semibold ${over ? "text-red-400" : "text-emerald-400"}`}>{over ? "Over Budget" : "Under Budget"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>,
    mount,
  );
}
