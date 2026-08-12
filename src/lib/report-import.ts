import "server-only";

import { createHash } from "node:crypto";
import {
  db,
  DatabaseConfigurationError,
  DatabaseConnectionError,
} from "@/lib/db";
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
    Array.isArray(headers) &&
    headers.every((value) => typeof value === "string")
      ? headers
      : Object.keys(rows[0] as Record<string, unknown>);
  const hash = createHash("sha256")
    .update(JSON.stringify([fileName, sheetName, rows]))
    .digest("hex");

  try {
    const old = await db<{ id: string }[]>(
      `report_imports?report_type=eq.${encodeURIComponent(reportType)}&company=eq.${encodeURIComponent(String(company))}&file_hash=eq.${hash}&select=id`,
    );
    if (old.length && strategy === "cancel") {
      return {
        status: 409,
        body: { duplicate: true, error: "Data serupa sudah pernah diimport." },
      };
    }
    if (old.length && strategy === "replace") {
      await db(`report_imports?id=eq.${encodeURIComponent(old[0].id)}`, {
        method: "DELETE",
      });
    }

    const effectiveHash = strategy === "new" ? `${hash}-${Date.now()}` : hash;
    const imports = await db<{ id: string }[]>("report_imports", {
      method: "POST",
      body: JSON.stringify({
        report_type: reportType,
        company,
        file_name: fileName,
        file_hash: effectiveHash,
        sheet_name: sheetName,
        row_count: rows.length,
        headers: normalizedHeaders,
      }),
    });
    const importId = imports[0]?.id;
    if (!importId) throw new DatabaseConnectionError();

    try {
      await db("report_import_rows", {
        method: "POST",
        body: JSON.stringify(
          rows.map((data_json, index) => ({
            import_id: importId,
            report_type: reportType,
            company,
            row_number: index + 2,
            data_json,
          })),
        ),
      });
    } catch (error) {
      await db(`report_imports?id=eq.${encodeURIComponent(importId)}`, {
        method: "DELETE",
      }).catch(() => undefined);
      throw error;
    }

    return {
      status: 200,
      body: { success: true, id: importId, total: rows.length },
    };
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return { status: 503, body: { error: "Database belum dikonfigurasi." } };
    }
    console.error("Report import failed.", error);
    return {
      status: 500,
      body: { error: "Data gagal disimpan. Silakan coba kembali." },
    };
  }
}
