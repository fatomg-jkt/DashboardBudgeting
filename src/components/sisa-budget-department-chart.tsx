"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;
type Point = { department: string; budget: number; actual: number; remaining: number };

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

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

function axis(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${nf.format(value / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${nf.format(value / 1_000_000)} Jt`;
  return nf.format(value);
}

export default function SisaBudgetDepartmentChart() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<ApiRow[]>([]);

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

    // Halaman ini adalah submenu Laporan Sisa Budget, bukan Laporan Budget umum.
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

    // Import Excel terjadi di modal DashboardApp. Parent table dapat langsung berubah,
    // tetapi komponen grafik berdiri sendiri. Refresh ringan ini membuat grafik
    // otomatis ikut membaca data terbaru tanpa user perlu reload halaman.
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

  const data = useMemo(() => {
    const grouped = new Map<string, Point>();

    rows.forEach((row) => {
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
  }, [rows]);

  if (!active || !host) return null;

  return createPortal(
    <section className="mb-6 rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5">
      <h2 className="mb-1 text-lg font-semibold">Grafik Sisa Budget Per Departemen</h2>
      <p className="mb-4 text-sm text-zinc-400">Sisa Budget sesuai data Excel</p>

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
          Belum ada data Laporan Sisa Budget per Departemen.
        </div>
      )}
    </section>,
    host,
  );
}
