import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  SupabaseNotConfiguredError,
  readReport,
  writeReport,
  type Company,
} from "@/lib/supabase-reports";
import { isReportType } from "@/lib/reports";

export type ImportBody = {
  company?: unknown;
  reportType?: unknown;
  fileName?: unknown;
  sheetName?: unknown;
  headers?: unknown;
  rows?: unknown;
  strategy?: unknown;
  metadata?: unknown;
};

export type ImportResult =
  | { status: 200; body: { success: true; id: string; total: number } }
  | {
      status: 400 | 409 | 500 | 503;
      body: { error: string; duplicate?: true };
    };

const ANALYSIS_DEPARTMENTS = [
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

const ANALYSIS_REPORT_TYPES = new Set([
  "analisis_variance",
  "analisis_variance_current_month",
  "analisis_variance_through_december",
]);

function keyToken(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function findKey(row: Record<string, unknown>, names: string[]) {
  const wanted = new Set(names.map(keyToken));
  return Object.keys(row).find((key) => wanted.has(keyToken(key)));
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/%/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function missingText(value: unknown) {
  const text = String(value ?? "").trim();
  return !text || text === "0";
}

function normalizeAnalysisRows(rows: Record<string, unknown>[]) {
  return rows.map((source, index) => {
    const row = { ...source };

    const departmentKey = findKey(row, ["department", "departemen", "dept", "fungsi"]);
    const actualKey = findKey(row, ["actual", "aktual", "realisasi"]);
    const budgetKey = findKey(row, ["budget", "anggaran"]);
    const variancePctKey = findKey(row, [
      "variance_percent",
      "variance_percentage",
      "variance_pct",
      "var_percent",
      "var_pct",
      "gap_percent",
      "gap_pct",
    ]);
    const statusKey = findKey(row, ["status"]);
    const analysisKey = findKey(row, ["analysis", "analisis"]);
    const recommendationKey = findKey(row, ["recommendation", "rekomendasi"]);
    const priorityKey = findKey(row, ["priority", "prioritas"]);

    const actual = actualKey ? asNumber(row[actualKey]) : 0;
    const budget = budgetKey ? asNumber(row[budgetKey]) : 0;
    const variancePct = variancePctKey
      ? asNumber(row[variancePctKey])
      : budget
        ? ((actual - budget) / budget) * 100
        : 0;
    const gap = Math.abs(variancePct);

    if (departmentKey && missingText(row[departmentKey])) {
      row[departmentKey] = ANALYSIS_DEPARTMENTS[index] ?? `DEPARTEMEN ${index + 1}`;
    }
    if (statusKey && missingText(row[statusKey])) {
      row[statusKey] = actual > budget ? "Over Budget" : "Under Budget";
    }
    if (analysisKey && missingText(row[analysisKey])) {
      row[analysisKey] =
        gap <= 2
          ? "Sesuai alokasi"
          : actual > budget
            ? "Budget share meningkat"
            : "Efisiensi biaya";
    }
    if (recommendationKey && missingText(row[recommendationKey])) {
      row[recommendationKey] =
        actual > budget ? "Review driver biaya" : "Pertahankan efisiensi";
    }
    if (priorityKey && missingText(row[priorityKey])) {
      row[priorityKey] = gap >= 10 ? "High" : gap >= 5 ? "Medium" : "Low";
    }

    return row;
  });
}

function isBrokenAnalysisImport(item: { rows?: Record<string, unknown>[] }) {
  if (!Array.isArray(item.rows) || !item.rows.length) return false;
  return item.rows.every((row) => {
    const departmentKey = findKey(row, ["department", "departemen", "dept", "fungsi"]);
    return !departmentKey || missingText(row[departmentKey]);
  });
}

export async function saveReportImport(
  body: ImportBody,
): Promise<ImportResult> {
  const {
    company,
    reportType,
    fileName,
    sheetName,
    headers,
    rows,
    strategy = "cancel",
    metadata,
  } = body;

  if (
    !["1001", "maison_y"].includes(String(company)) ||
    !isReportType(reportType) ||
    typeof fileName !== "string" ||
    !fileName.trim() ||
    typeof sheetName !== "string" ||
    !Array.isArray(rows) ||
    !rows.length ||
    !rows.every(
      (row) => row !== null && typeof row === "object" && !Array.isArray(row),
    ) ||
    !["cancel", "replace", "new"].includes(String(strategy))
  ) {
    return {
      status: 400,
      body: { error: "Data import tidak lengkap atau tidak valid." },
    };
  }

  const normalizedHeaders =
    Array.isArray(headers) && headers.every((value) => typeof value === "string")
      ? headers
      : Object.keys(rows[0] as Record<string, unknown>);

  const normalizedMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? {
          periode: String((metadata as Record<string, unknown>).periode ?? "").trim(),
          keterangan: String((metadata as Record<string, unknown>).keterangan ?? "").trim(),
        }
      : undefined;

  const rawRows = rows as Record<string, unknown>[];
  const isAnalysisReport = ANALYSIS_REPORT_TYPES.has(String(reportType));
  const rowsForStorage = isAnalysisReport ? normalizeAnalysisRows(rawRows) : rawRows;

  const hash = createHash("sha256")
    .update(JSON.stringify([fileName, sheetName, rowsForStorage]))
    .digest("hex");

  try {
    const report = await readReport(company as Company, reportType);

    if (isAnalysisReport) {
      report.imports = report.imports.filter(
        (item) => !isBrokenAnalysisImport(item as { rows?: Record<string, unknown>[] }),
      );

      // Each Analisa Budget submenu is an independent management snapshot.
      // Re-uploading replaces only that submenu's own data, never the other submenu.
      if (strategy !== "new") {
        report.imports = [];
      }
    }

    const old = report.imports.find((item) => item.fileHash === hash);

    if (old && strategy === "cancel") {
      return {
        status: 409,
        body: { duplicate: true, error: "Data serupa sudah pernah diimport." },
      };
    }

    if (old && strategy === "replace") {
      report.imports = report.imports.filter((item) => item.id !== old.id);
    }

    const importId = randomUUID();
    report.imports.push({
      id: importId,
      fileHash: strategy === "new" ? `${hash}-${Date.now()}` : hash,
      fileName,
      sheetName,
      headers: normalizedHeaders,
      rows: rowsForStorage,
      createdAt: new Date().toISOString(),
      ...(normalizedMetadata ? { metadata: normalizedMetadata } : {}),
    });

    await writeReport(company as Company, reportType, report);

    return {
      status: 200,
      body: { success: true, id: importId, total: rowsForStorage.length },
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return {
        status: 503,
        body: { error: "Supabase belum terhubung. Data belum disimpan." },
      };
    }

    const detail = error instanceof Error ? error.message : String(error ?? "");
    console.error("Report import failed.", { company, reportType, detail, error });

    return {
      status: 500,
      body: {
        error: detail
          ? `Data gagal disimpan: ${detail}`
          : "Data gagal disimpan. Silakan coba kembali.",
      },
    };
  }
}
