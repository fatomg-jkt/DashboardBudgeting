import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  BlobStorageConfigurationError,
  BlobStorageConnectionError,
  updateReport,
  type Company,
} from "@/lib/blob-storage";
import { isReportType } from "@/lib/reports";

export type ImportBody = {
  company?: unknown;
  reportType?: unknown;
  fileName?: unknown;
  sheetName?: unknown;
  headers?: unknown;
  rows?: unknown;
  strategy?: unknown;
};
export type ImportResult = {
  status: 200 | 400 | 409 | 500 | 503;
  body: { success?: true; id?: string; total?: number; error?: string; duplicate?: true };
};

export async function saveReportImport(body: ImportBody): Promise<ImportResult> {
  const { company, reportType, fileName, sheetName, rows, strategy = "cancel" } = body;
  if (
    (company !== "1001" && company !== "maison_y") ||
    !isReportType(reportType) ||
    typeof fileName !== "string" || !fileName.trim() ||
    typeof sheetName !== "string" ||
    !Array.isArray(rows) || !rows.length ||
    !rows.every((row) => row !== null && typeof row === "object" && !Array.isArray(row)) ||
    !["cancel", "replace", "new"].includes(String(strategy))
  ) return { status: 400, body: { error: "Data import tidak valid." } };

  const hash = createHash("sha256")
    .update(JSON.stringify([fileName, sheetName, rows]))
    .digest("hex");
  const id = randomUUID();
  const importedAt = new Date().toISOString();
  let duplicate = false;
  try {
    const saved = await updateReport(company as Company, reportType, (current) => {
      duplicate = current.imports.some((item) => item.hash === hash);
      if (strategy === "cancel" && duplicate) return null;
      const item = { id, fileName, sheetName, rowCount: rows.length, importedAt, hash };
      return {
        version: 1,
        company: company as Company,
        reportType,
        updatedAt: importedAt,
        imports: strategy === "replace" ? [item] : [...current.imports, item],
        rows: strategy === "replace"
          ? (rows as Record<string, unknown>[])
          : [...current.rows, ...(rows as Record<string, unknown>[])],
      };
    });
    if (!saved)
      return { status: 409, body: { duplicate: true, error: "Data serupa sudah pernah diimport." } };
    return { status: 200, body: { success: true, id, total: rows.length } };
  } catch (error) {
    if (error instanceof BlobStorageConfigurationError)
      return { status: 503, body: { error: error.message } };
    console.error("Report import failed.", error);
    return {
      status: error instanceof BlobStorageConnectionError ? 503 : 500,
      body: { error: "Data gagal disimpan. Silakan coba kembali." },
    };
  }
}
