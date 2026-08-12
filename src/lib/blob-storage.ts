import "server-only";

import {
  BlobPreconditionFailedError,
  get,
  head,
  put,
} from "@vercel/blob";
import type { ReportType } from "@/lib/reports";

export type Company = "1001" | "maison_y";
export type ReportRow = Record<string, unknown>;
export type ReportImport = {
  id: string;
  fileName: string;
  sheetName: string;
  rowCount: number;
  importedAt: string;
  hash?: string;
};
export type StoredReport = {
  version: 1;
  company: Company;
  reportType: ReportType;
  updatedAt: string | null;
  imports: ReportImport[];
  rows: ReportRow[];
};

export class BlobStorageConfigurationError extends Error {
  constructor() {
    super("Penyimpanan Vercel Blob belum dikonfigurasi.");
    this.name = "BlobStorageConfigurationError";
  }
}
export class BlobStorageConnectionError extends Error {
  constructor(message = "Penyimpanan bersama tidak dapat dihubungi.") {
    super(message);
    this.name = "BlobStorageConnectionError";
  }
}

const pathname = (company: Company, reportType: ReportType) =>
  `budgeting/v1/${company}/${reportType}.json`;
const token = () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new BlobStorageConfigurationError();
  return process.env.BLOB_READ_WRITE_TOKEN;
};
export const emptyReport = (
  company: Company,
  reportType: ReportType,
): StoredReport => ({
  version: 1,
  company,
  reportType,
  updatedAt: null,
  imports: [],
  rows: [],
});

async function readCurrent(company: Company, reportType: ReportType) {
  const path = pathname(company, reportType);
  try {
    const blob = await get(path, {
      access: "private",
      useCache: false,
      token: token(),
    });
    if (!blob) return { report: emptyReport(company, reportType) };
    const report = (await new Response(blob.stream).json()) as StoredReport;
    return { report, etag: blob.etag };
  } catch (error) {
    if (error instanceof BlobStorageConfigurationError) throw error;
    console.error("Vercel Blob report read failed.", error);
    throw new BlobStorageConnectionError();
  }
}

export async function readReport(company: Company, reportType: ReportType) {
  return (await readCurrent(company, reportType)).report;
}

export async function writeReport(
  company: Company,
  reportType: ReportType,
  report: StoredReport,
  ifMatch?: string,
) {
  try {
    await put(pathname(company, reportType), JSON.stringify(report), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      ifMatch,
      token: token(),
    });
  } catch (error) {
    if (
      error instanceof BlobPreconditionFailedError ||
      error instanceof BlobStorageConfigurationError
    )
      throw error;
    console.error("Vercel Blob report write failed.", error);
    throw new BlobStorageConnectionError(
      "Data gagal disimpan. Silakan coba kembali.",
    );
  }
}

export async function updateReport(
  company: Company,
  reportType: ReportType,
  update: (current: StoredReport) => StoredReport | null,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await readCurrent(company, reportType);
    const next = update(current.report);
    if (!next) return null;
    try {
      // head is deliberately used to verify the ETag immediately before the
      // conditional overwrite. A missing object is handled by get as empty.
      const metadata = current.etag
        ? await head(pathname(company, reportType), { token: token() })
        : null;
      await writeReport(company, reportType, next, metadata?.etag);
      return next;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError && attempt < 2) continue;
      throw error;
    }
  }
  throw new BlobStorageConnectionError("Data gagal disimpan. Silakan coba kembali.");
}

export async function storageHealth() {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return { configured: false, connected: false, storage: "vercel-blob" as const };
  try {
    await head("budgeting/v1/health.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }).catch((error: unknown) => {
      // A missing probe object still proves that the store answered.
      if (error && typeof error === "object") {
        const candidate = error as { name?: string; status?: number; statusCode?: number };
        if (
          candidate.status === 404 ||
          candidate.statusCode === 404 ||
          candidate.name === "BlobNotFoundError"
        ) return null;
      }
      throw error;
    });
    return { configured: true, connected: true, storage: "vercel-blob" as const };
  } catch (error) {
    console.error("Vercel Blob health check failed.", error);
    return { configured: true, connected: false, storage: "vercel-blob" as const };
  }
}
