import "server-only";

import { randomUUID } from "node:crypto";
import { get, list, put } from "@vercel/blob";
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

type BlobAccess = "private" | "public";

export class BlobNotConfiguredError extends Error {}

// Legacy path kept for backwards compatibility with data that is already stored.
export const blobPath = (company: Company, reportType: ReportType) =>
  `budgeting/v1/${company}/${reportType}.json`;

const versionPrefix = (company: Company, reportType: ReportType) =>
  `budgeting/v2/${company}/${reportType}/`;

export const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN;

function validStoredReport(value: unknown): StoredReport | null {
  if (!value || typeof value !== "object") return null;
  const report = value as Partial<StoredReport>;
  return report.version === 1 && Array.isArray(report.imports)
    ? (report as StoredReport)
    : null;
}

async function readJsonBlob(path: string, token: string): Promise<StoredReport | null> {
  let firstError: unknown;

  for (const access of ["private", "public"] as const satisfies readonly BlobAccess[]) {
    try {
      const result = await get(path, {
        access,
        token,
        useCache: false,
      });
      if (!result) return null;
      const value = await new Response(result.stream).json();
      return validStoredReport(value);
    } catch (error) {
      firstError ??= error;
    }
  }

  throw firstError instanceof Error
    ? firstError
    : new Error("Vercel Blob gagal dibaca.");
}

export async function readReport(
  company: Company,
  reportType: ReportType,
): Promise<StoredReport> {
  const token = blobToken();
  if (!token) throw new BlobNotConfiguredError("Vercel Blob belum dikonfigurasi.");

  // New storage format: every save creates a new immutable version. This avoids
  // overwrite/precondition conflicts on Vercel Blob and makes saving reliable.
  const versions = await list({
    prefix: versionPrefix(company, reportType),
    limit: 1000,
    token,
  });

  const latest = versions.blobs
    .filter((blob) => blob.pathname.endsWith(".json"))
    .sort((a, b) => b.pathname.localeCompare(a.pathname))[0];

  if (latest) {
    const report = await readJsonBlob(latest.pathname, token);
    if (report) return report;
  }

  // Fallback to the old deterministic v1 file so existing dashboard data is
  // preserved automatically after this change.
  const legacy = await readJsonBlob(blobPath(company, reportType), token);
  return legacy ?? { version: 1, imports: [] };
}

async function putJsonBlob(path: string, payload: string, token: string) {
  let firstError: unknown;

  // The connected Blob store may be private or public. Try the intended private
  // mode first, then public as a compatibility fallback for older stores.
  for (const access of ["private", "public"] as const satisfies readonly BlobAccess[]) {
    try {
      return await put(path, payload, {
        access,
        addRandomSuffix: false,
        contentType: "application/json",
        token,
      });
    } catch (error) {
      firstError ??= error;
    }
  }

  const detail = firstError instanceof Error ? firstError.message : String(firstError ?? "");
  throw new Error(detail || "Vercel Blob gagal ditulis.");
}

export async function writeReport(
  company: Company,
  reportType: ReportType,
  report: StoredReport,
) {
  const token = blobToken();
  if (!token) throw new BlobNotConfiguredError("Vercel Blob belum dikonfigurasi.");

  const timestamp = String(Date.now()).padStart(13, "0");
  const path = `${versionPrefix(company, reportType)}${timestamp}-${randomUUID()}.json`;
  return putJsonBlob(path, JSON.stringify(report), token);
}
