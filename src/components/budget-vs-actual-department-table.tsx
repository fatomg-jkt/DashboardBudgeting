"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

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
  if (table.dataset.budgetDepartmentTable === "formatted") return;

  const headerRow = table.querySelector<HTMLTableRowElement>("thead tr");
  const bodyRows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  if (!headerRow || !bodyRows.length) return;

  const headers = Array.from(headerRow.querySelectorAll<HTMLTableCellElement>("th"));
  const headerTokens = headers.map((header) => token(header.textContent ?? ""));

  const matches = desiredColumns.map((column) => {
    const aliases = column.aliases.map(token);
    return headerTokens.findIndex((header) => aliases.includes(header));
  });

  const hasYear = matches[0] >= 0;
  const hasMonth = matches[1] >= 0;
  const hasDepartment = matches[2] >= 0;
  const hasBudget = matches[4] >= 0;
  const hasActual = matches[5] >= 0;
  if (!hasYear || !hasMonth || !hasDepartment || !hasBudget || !hasActual) return;

  const originalRows = bodyRows.map((row) =>
    Array.from(row.querySelectorAll<HTMLTableCellElement>("td")),
  );

  const orderedHeaderCells = matches
    .map((index, desiredIndex) => {
      if (index < 0) return null;
      const cell = headers[index];
      cell.textContent = desiredColumns[desiredIndex].label;
      return cell;
    })
    .filter((cell): cell is HTMLTableCellElement => Boolean(cell));

  headerRow.replaceChildren(...orderedHeaderCells);

  bodyRows.forEach((row, rowIndex) => {
    const cells = originalRows[rowIndex];
    const orderedCells = matches
      .map((index) => (index >= 0 ? cells[index] : null))
      .filter((cell): cell is HTMLTableCellElement => Boolean(cell));

    // The generic number formatter can render 2026 as 2.026. Restore a plain year.
    const yearCell = orderedCells[0];
    if (yearCell) {
      const digits = (yearCell.textContent ?? "").replace(/\D/g, "");
      if (digits.length === 4) yearCell.textContent = digits;
    }

    row.replaceChildren(...orderedCells);
  });

  table.dataset.budgetDepartmentTable = "formatted";
}

export default function BudgetVsActualDepartmentTable() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/budget-vs-actual") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("view") !== "per-departemen") return;

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
  }, [pathname]);

  return null;
}
