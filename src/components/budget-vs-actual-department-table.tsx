"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type DesiredColumn = {
  label: string;
  aliases: string[];
};

const desiredColumns: DesiredColumn[] = [
  { label: "tahun", aliases: ["tahun", "year"] },
  { label: "bulan", aliases: ["bulan", "month"] },
  { label: "departemen", aliases: ["departemen", "department", "dept"] },
  { label: "Status Data", aliases: ["status data", "status_data", "status"] },
  { label: "budget", aliases: ["budget", "anggaran"] },
  { label: "actual", aliases: ["actual", "aktual", "realisasi"] },
  { label: "variance", aliases: ["variance", "selisih", "variance rp", "variance (rp)"] },
  { label: "%", aliases: ["%", "variance %", "variance (%)", "variance_percent", "percentage", "persentase"] },
];

function token(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fixTable(table: HTMLTableElement) {
  const headerRow = table.querySelector<HTMLTableRowElement>("thead tr");
  const bodyRows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  if (!headerRow || !bodyRows.length) return;

  const headers = Array.from(headerRow.querySelectorAll<HTMLTableCellElement>("th"));
  const headerTokens = headers.map((header) => token(header.textContent ?? ""));

  const matches = desiredColumns.map((column) => {
    const aliases = column.aliases.map(token);
    return headerTokens.findIndex((header) => aliases.includes(header));
  });

  const requiredMatches = matches.filter((index) => index >= 0).length;
  const hasBudget = matches[4] >= 0;
  const hasActual = matches[5] >= 0;
  const hasDepartment = matches[2] >= 0;
  if (requiredMatches < 5 || !hasBudget || !hasActual || !hasDepartment) return;

  const orderedHeaderCells = matches
    .map((index, desiredIndex) => {
      if (index < 0) return null;
      const cell = headers[index];
      cell.textContent = desiredColumns[desiredIndex].label;
      return cell;
    })
    .filter((cell): cell is HTMLTableCellElement => Boolean(cell));

  const originalRows = bodyRows.map((row) => Array.from(row.querySelectorAll<HTMLTableCellElement>("td")));

  headerRow.replaceChildren(...orderedHeaderCells);
  bodyRows.forEach((row, rowIndex) => {
    const cells = originalRows[rowIndex];
    const orderedCells = matches
      .map((index) => (index >= 0 ? cells[index] : null))
      .filter((cell): cell is HTMLTableCellElement => Boolean(cell));
    row.replaceChildren(...orderedCells);
  });

  table.dataset.budgetDepartmentTable = "formatted";
}

export default function BudgetVsActualDepartmentTable() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  useEffect(() => {
    if (pathname !== "/budget-vs-actual" || view !== "per-departemen") return;

    const apply = () => {
      document.querySelectorAll<HTMLTableElement>("table.data-table").forEach(fixTable);
    };

    apply();
    const timer = window.setTimeout(apply, 100);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname, view]);

  return null;
}
