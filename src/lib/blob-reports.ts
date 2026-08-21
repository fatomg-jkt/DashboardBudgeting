import "server-only";

import { del, get, put } from "@vercel/blob";
import type { ReportType } from "@/lib/reports";

export type Company = "1001" | "maison_y";
export type StoredImport = {
  id: string;
  fileHash: string;
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  createdAt: string;
  metadata?: {
    periode?: string;
    keterangan?: string;
    storagePath?: string;
    originalFileName?: string;
    contentType?: string;
    size?: number;
  };
};
export type StoredReport = { version: 1; imports: StoredImport[] };

export class BlobNotConfiguredError extends Error {}

export const blobPath = (company: Company, reportType: ReportType) =>
  `budgeting/v1/${company}/${reportType}.json`;

export const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN;

export async function readReport(
  company: Company,
  reportType: ReportType,
): Promise<StoredReport> {
  const token = blobToken();
  if (!token) throw new BlobNotConfiguredError("Vercel Blob belum dikonfigurasi.");
  const result = await get(blobPath(company, reportType), {
    access: "private",
    token,
    useCache: false,
  });
  if (!result) return { version: 1, imports: [] };
  const value = (await new Response(result.stream).json()) as StoredReport;
  return value?.version === 1 && Array.isArray(value.imports)
    ? value
    : { version: 1, imports: [] };
}

function isOverwriteConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already exists") ||
    normalized.includes("allowoverwrite") ||
    normalized.includes("overwrite") ||
    normalized.includes("conflict") ||
    normalized.includes("precondition") ||
    normalized.includes("409") ||
    normalized.includes("412")
  );
}

async function putReport(path: string, payload: string, token: string) {
  return put(path, payload, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token,
  });
}

export async function writeReport(
  company: Company,
  reportType: ReportType,
  report: StoredReport,
) {
  const token = blobToken();
  if (!token) throw new BlobNotConfiguredError("Vercel Blob belum dikonfigurasi.");

  const path = blobPath(company, reportType);
  const payload = JSON.stringify(report);

  try {
    return await putReport(path, payload, token);
  } catch (error) {
    // Some Blob stores can still return an overwrite/conflict response even when
    // allowOverwrite=true. Retry by removing the stale object and recreating it.
    // The complete report is already held in memory, so the replacement keeps all
    // existing imports plus the new import being saved.
    if (!isOverwriteConflict(error)) throw error;

    console.warn("Vercel Blob overwrite conflict. Retrying with delete + recreate.", {
      path,
      message: error instanceof Error ? error.message : String(error),
    });

    await del(path, { token });
    return putReport(path, payload, token);
  }
}
