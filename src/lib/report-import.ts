import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { BlobNotConfiguredError, readReport, writeReport, type Company } from "@/lib/blob-reports";
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

  const hash = createHash("sha256")
    .update(JSON.stringify([fileName, sheetName, rows]))
    .digest("hex");

  try {
    const report = await readReport(company as Company, reportType);
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
      rows: rows as Record<string, unknown>[],
      createdAt: new Date().toISOString(),
      ...(normalizedMetadata ? { metadata: normalizedMetadata } : {}),
    });

    await writeReport(company as Company, reportType, report);

    return {
      status: 200,
      body: { success: true, id: importId, total: rows.length },
    };
  } catch (error) {
    if (error instanceof BlobNotConfiguredError) {
      return {
        status: 503,
        body: { error: "Penyimpanan bersama belum terhubung. Data belum disimpan." },
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
