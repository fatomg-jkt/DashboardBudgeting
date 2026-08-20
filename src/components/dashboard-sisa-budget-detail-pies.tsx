"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;

type DepartmentSummary = {
  department: string;
  budget: number;
  actual: number;
  remaining: number;
  utilization: number;
};

const DEPARTMENT_ORDER = [
  "DEVELOPMENT",
  "FAT",
  "HRD",
  "MANAGEMENT KIKI",
  "MANAGEMENT UMA",
  "MARKETING",
  "MERCHANDISE",
  "OPERASIONAL",
  "PURCHASING",
  "WAREHOUSE",
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

function numberValue(value: unknown) {
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

function departmentOf(row: ApiRow) {
  return String(
    pick(row, [
      "department",
      "departemen",
      "dept",
      "nama_department",
      "nama_departemen",
    ]) ?? "",
  )
    .trim()
    .toUpperCase();
}

function departmentAmount(row: ApiRow, department: string, kind: "budget" | "actual") {
  const generic =
    kind === "budget"
      ? pick(row, [
          "budget",
          "anggaran",
          "total_budget",
          "total budget",
          "beban_operasional_anggaran",
          "budget_bulanan",
        ])
      : pick(row, [
          "actual",
          "aktual",
          "realisasi",
          "total_actual",
          "total actual",
          "total_aktual",
          "total aktual",
          "beban_operasional_aktual",
          "realisasi_bulanan",
        ]);

  if (generic !== undefined) return numberValue(generic);

  const deptKey = normalize(department);
  const suffixes =
    kind === "budget"
      ? ["anggaran", "budget"]
      : ["aktual", "actual", "realisasi"];

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalize(key);
    const matchesDepartment =
      normalizedKey.includes(deptKey) || deptKey.includes(normalizedKey.split("_")[0] ?? "");
    const matchesKind = suffixes.some((suffix) => normalizedKey.includes(suffix));
    if (matchesDepartment && matchesKind) return numberValue(value);
  }

  return 0;
}

function hasDepartmentRows(rows: ApiRow[]) {
  return rows.some((row) => Boolean(departmentOf(row)));
}

function shortMoney(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    return `${sign}Rp${(abs / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp${(abs / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }
  return `${sign}Rp${nf.format(abs)}`;
}

function findOriginalSisaDetailSection() {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>(
      'a[href*="sisa-budget-detail-biaya"]',
    ),
  );

  for (const link of links) {
    const section = link.closest<HTMLElement>("section");
    if (!section) continue;
    if (section.dataset.dashboardSisaDetailReplacement === "true") continue;

    const title = section.querySelector("h2")?.textContent?.trim() ?? "";
    if (
      title.includes("Sisa Budget") &&
      (title.includes("Status Detail Biaya") || title.includes("Per Detail Biaya"))
    ) {
      return section;
    }
  }

  const sections = Array.from(document.querySelectorAll<HTMLElement>("section"));
  return sections.find((section) => {
    if (section.dataset.dashboardSisaDetailReplacement === "true") return false;
    const title = section.querySelector("h2")?.textContent?.trim() ?? "";
    return title === "Sisa Budget - Status Detail Biaya";
  });
}

export default function DashboardSisaBudgetDetailPies() {
  const pathname = usePathname();
  const active = pathname === "/" || pathname === "/dashboard";
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<ApiRow[]>([]);

  const syncCompany = useCallback(() => {
    const next: Company =
      localStorage.getItem("budgeting_active_company") === "maison_y"
        ? "maison_y"
        : "1001";
    setCompany((current) => (current === next ? current : next));
  }, []);

  useEffect(() => {
    if (!active) {
      setHost(null);
      return;
    }

    syncCompany();

    const locate = () => {
      const original = findOriginalSisaDetailSection();
      if (!original) return;

      original.style.setProperty("display", "none", "important");
      original.setAttribute("aria-hidden", "true");

      const parent = original.parentElement;
      if (!parent) return;

      let mount = parent.querySelector<HTMLElement>(
        "[data-dashboard-sisa-detail-pies]",
      );
      if (!mount) {
        mount = document.createElement("div");
        mount.dataset.dashboardSisaDetailPies = "true";
        mount.className = "xl:col-span-2";
        parent.insertBefore(mount, original);
      }
      setHost((current) => (current === mount ? current : mount));
    };

    locate();
    const observer = new MutationObserver(() => locate());
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(locate, 500);

    const handleClick = () => {
      window.setTimeout(() => {
        syncCompany();
        locate();
      }, 0);
    };
    document.addEventListener("click", handleClick, true);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener("click", handleClick, true);
      const original = findOriginalSisaDetailSection();
      if (original) {
        original.style.removeProperty("display");
        original.removeAttribute("aria-hidden");
      }
    };
  }, [active, syncCompany]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    async function load() {
      try {
        const primaryResponse = await fetch(
          `/api/reports?reportType=sisa_budget_detail_biaya&company=${company}`,
          { cache: "no-store" },
        );
        const primaryPayload: unknown = await primaryResponse.json();
        const primaryRows =
          primaryResponse.ok && Array.isArray(primaryPayload)
            ? (primaryPayload as ApiRow[])
            : [];

        if (hasDepartmentRows(primaryRows)) {
          if (!cancelled) setRows(primaryRows);
          return;
        }

        const fallbackResponse = await fetch(
          `/api/reports?reportType=budget_detail_biaya&company=${company}`,
          { cache: "no-store" },
        );
        const fallbackPayload: unknown = await fallbackResponse.json();
        const fallbackRows =
          fallbackResponse.ok && Array.isArray(fallbackPayload)
            ? (fallbackPayload as ApiRow[])
            : [];

        if (!cancelled) {
          setRows(hasDepartmentRows(fallbackRows) ? fallbackRows : primaryRows);
        }
      } catch {
        if (!cancelled) setRows([]);
      }
    }

    void load();
    const refresh = window.setInterval(() => void load(), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [active, company]);

  const departments = useMemo(() => {
    const grouped = new Map<
      string,
      { department: string; budget: number; actual: number }
    >();

    rows.forEach((row) => {
      const department = departmentOf(row);
      if (!department) return;

      const current = grouped.get(department) ?? {
        department,
        budget: 0,
        actual: 0,
      };

      current.budget += departmentAmount(row, department, "budget");
      current.actual += departmentAmount(row, department, "actual");
      grouped.set(department, current);
    });

    return Array.from(grouped.values())
      .map<DepartmentSummary>((item) => {
        const remaining = item.budget - item.actual;
        const utilization = item.budget > 0 ? (item.actual / item.budget) * 100 : 0;
        return {
          ...item,
          remaining,
          utilization,
        };
      })
      .sort((a, b) => {
        const aIndex = DEPARTMENT_ORDER.indexOf(a.department);
        const bIndex = DEPARTMENT_ORDER.indexOf(b.department);
        if (aIndex === -1 && bIndex === -1) {
          return a.department.localeCompare(b.department);
        }
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
  }, [rows]);

  if (!active || !host) return null;

  return createPortal(
    <section
      data-dashboard-sisa-detail-replacement="true"
      className="rounded-2xl border border-gold-500/20 bg-gradient-to-b from-zinc-950 to-black p-4"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sisa Budget - Per Detail Biaya</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Ringkasan Budget, Actual, Sisa Budget, dan persentase terpakai untuk semua departemen.
          </p>
        </div>
        <Link
          className="secondary-button text-xs"
          href="/laporan-budget?view=sisa-budget-detail-biaya"
        >
          Buka Laporan
        </Link>
      </div>

      {departments.length ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10">
            {departments.map((item) => {
              const chartData = [
                { name: "Actual", value: Math.max(item.actual, 0) },
                { name: "Sisa", value: Math.max(item.remaining, 0) },
              ].filter((entry) => entry.value > 0);
              const safeChartData = chartData.length
                ? chartData
                : [{ name: "Sisa", value: 1 }];

              return (
                <div
                  key={item.department}
                  className="rounded-lg border border-zinc-800 bg-black/30 p-2 text-center"
                >
                  <p className="min-h-8 text-[10px] font-semibold leading-tight text-zinc-200">
                    {item.department}
                  </p>

                  <div className="mx-auto h-16 w-16">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={safeChartData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={13}
                          outerRadius={28}
                          stroke="none"
                        >
                          {safeChartData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={entry.name === "Actual" ? "#EF4444" : "#2A9D8F"}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number | string, name: string) => [
                            `Rp ${nf.format(Number(value))}`,
                            name,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-1 space-y-0.5 text-[10px] leading-tight">
                    <p className="text-zinc-300">
                      Budget <span className="block font-semibold text-white">{shortMoney(item.budget)}</span>
                    </p>
                    <p className="text-red-400">
                      Actual <span className="block font-semibold">{shortMoney(item.actual)}</span>
                    </p>
                    <p className={item.remaining < 0 ? "text-red-400" : "text-emerald-400"}>
                      Sisa <span className="block font-semibold">{shortMoney(item.remaining)}</span>
                    </p>
                    <p className="pt-0.5 text-[9px] text-zinc-500">
                      {item.utilization.toLocaleString("id-ID", {
                        maximumFractionDigits: 1,
                      })}% terpakai
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1 text-red-400">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              Actual
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2A9D8F]" />
              Sisa Budget
            </span>
          </div>
        </>
      ) : (
        <div className="py-10 text-center text-sm text-zinc-500">
          Belum ada data Per Detail Biaya yang memiliki informasi departemen.
        </div>
      )}
    </section>,
    host,
  );
}
