import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  BlobConfigurationError,
  readReport,
  writeReport,
  type StoredImport,
} from "@/lib/blob-storage";
import type { Company } from "@/lib/local-reports";
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

export type ImportResult =
  | { status: 200; body: { success: true; id: string; total: number } }
  | {
      status: 400 | 409 | 500 | 503;
      body: { error: string; duplicate?: true };
    };

export async function saveReportImport(body: ImportBody): Promise<ImportResult> {
  const {
    company,
    reportType,
    fileName,
    sheetName,
    headers,
    rows,
    strategy = "cancel",
  } = body;
  if (
    (company !== "1001" && company !== "maison_y") ||
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

  // Validate optional headers without changing the existing parser or row values.
  if (
    headers !== undefined &&
    (!Array.isArray(headers) ||
      !headers.every((value) => typeof value === "string"))
  ) {
    return {
      status: 400,
      body: { error: "Data import tidak lengkap atau tidak valid." },
    };
  }

  const hash = createHash("sha256")
    .update(JSON.stringify([fileName, sheetName, rows]))
    .digest("hex");

  try {
    const report = await readReport(company as Company, reportType);
    if (
      strategy === "cancel" &&
      report.imports.some((item) => item.hash === hash)
    ) {
      return {
        status: 409,
        body: { duplicate: true, error: "Data serupa sudah pernah diimport." },
      };
    }

    const id = randomUUID();
    const importedAt = new Date().toISOString();
    const metadata: StoredImport = {
      id,
      fileName,
      sheetName,
      rowCount: rows.length,
      importedAt,
      hash,
    };
    const taggedRows = (rows as Record<string, unknown>[]).map((row) => ({
      ...row,
      importId: id,
    }));
    const replace = strategy === "replace";
    await writeReport(company as Company, reportType, {
      ...report,
      updatedAt: importedAt,
      imports: replace ? [metadata] : [...report.imports, metadata],
      rows: replace ? taggedRows : [...report.rows, ...taggedRows],
    });

    return { status: 200, body: { success: true, id, total: rows.length } };
  } catch (error) {
    if (error instanceof BlobConfigurationError) {
      return { status: 503, body: { error: error.message } };
    }
    console.error("Report import failed.", error);
    return {
      status: 500,
      body: { error: "Data gagal disimpan. Silakan coba kembali." },
    };
  }
}
