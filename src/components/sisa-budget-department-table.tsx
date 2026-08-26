"use client";

import { useEffect } from "react";

type Column = {
  label: string;
  aliases: string[];
};

const columns: Column[] = [
  { label: "Tahun", aliases: ["tahun", "year"] },
  { label: "Bulan", aliases: ["bulan", "month", "periode"] },
  { label: "Departemen", aliases: ["departemen", "department", "dept"] },
  { label: "Total Budget", aliases: ["total budget", "total_budget", "budget", "anggaran"] },
  { label: "Total Actual", aliases: ["total actual", "total_actual", "total aktual", "total_aktual", "actual", "aktual", "realisasi"] },
  { label: "Sisa Budget", aliases: ["sisa budget", "sisa_budget", "remaining", "remaining_budget"] },
  { label: "Variance %", aliases: ["variance %", "variance (%)", "variance_percent", "variance_pct", "%", "persentase"] },
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

function normalizeYear(text: string) {
  const cleaned = text.trim().replace(/[.,\s]/g, "");
  return /^20\d{2}$/.test(cleaned) ? cleaned : text;
}

function formatTable(table: HTMLTableElement) {
  if (table.dataset.sisaBudgetDepartmentFormatted === "true") return;

  const headerRow = table.querySelector<HTMLTableRowElement>("thead tr");
  const bodyRows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  if (!headerRow || !bodyRows.length) return;

  const headers = Array.from(headerRow.querySelectorAll<HTMLTableCellElement>("th"));
  const headerTokens = headers.map((header) => token(header.textContent ?? ""));

  const indexes = columns.map((column) => {
    const aliases = column.aliases.map(token);
    return headerTokens.findIndex((header) => aliases.includes(header));
  });

  const matches = indexes.filter((index) => index >= 0).length;
  const hasDepartment = indexes[2] >= 0;
  const hasBudget = indexes[3] >= 0;
  const hasActual = indexes[4] >= 0;
  const hasRemaining = indexes[5] >= 0;

  if (matches < 6 || !hasDepartment || !hasBudget || !hasActual || !hasRemaining) return;

  const sourceRows = bodyRows.map((row) =>
    Array.from(row.querySelectorAll<HTMLTableCellElement>("td")),
  );

  const newHeaders = indexes
    .map((sourceIndex, targetIndex) => {
      if (sourceIndex < 0) return null;
      const cell = headers[sourceIndex];
      cell.textContent = columns[targetIndex].label;
      return cell;
    })
    .filter((cell): cell is HTMLTableCellElement => Boolean(cell));

  headerRow.replaceChildren(...newHeaders);

  bodyRows.forEach((row, rowIndex) => {
    const sourceCells = sourceRows[rowIndex];
    const newCells = indexes
      .map((sourceIndex, targetIndex) => {
        if (sourceIndex < 0) return null;
        const cell = sourceCells[sourceIndex];
        if (targetIndex === 0) {
          cell.textContent = normalizeYear(cell.textContent ?? "");
        }
        return cell;
      })
      .filter((cell): cell is HTMLTableCellElement => Boolean(cell));

    row.replaceChildren(...newCells);
  });

  table.dataset.sisaBudgetDepartmentFormatted = "true";
}

export default function SisaBudgetDepartmentTable() {
  useEffect(() => {
    const isActive = () =>
      window.location.pathname === "/laporan-budget" &&
      new URLSearchParams(window.location.search).get("view") === "sisa-budget-per-departemen";

    if (!isActive()) return;

    const apply = () => {
      if (!isActive()) return;
      document.querySelectorAll<HTMLTableElement>("main table").forEach(formatTable);
    };

    apply();
    const timer = window.setTimeout(apply, 120);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
