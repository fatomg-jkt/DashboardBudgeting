import "server-only";

import { get, list, put } from "@vercel/blob";
import type { ReportType } from "@/lib/reports";
import type { Company } from "@/lib/local-reports";

export type StoredImport = {
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
  imports: StoredImport[];
  rows: Record<string, unknown>[];
};

export class BlobConfigurationError extends Error {
  constructor() {
    super("Penyimpanan bersama belum terhubung. Data belum disimpan.");
    this.name = "BlobConfigurationError";
  }
}

export function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new BlobConfigurationError();
  return token;
}

export const isBlobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export function reportPath(company: Company, reportType: ReportType) {
  return `budgeting/v1/${company}/${reportType}.json`;
}

export function emptyReport(
  company: Company,
  reportType: ReportType,
): StoredReport {
  return {
    version: 1,
    company,
    reportType,
    updatedAt: null,
    imports: [],
    rows: [],
  };
}

export async function readReport(
  company: Company,
  reportType: ReportType,
): Promise<StoredReport> {
  const result = await get(reportPath(company, reportType), {
    access: "private",
    useCache: false,
    token: getBlobToken(),
  });

  if (!result || result.statusCode !== 200)
    return emptyReport(company, reportType);

  const parsed = (await new Response(result.stream).json()) as Partial<StoredReport>;
  return {
    version: 1,
    company,
    reportType,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    imports: Array.isArray(parsed.imports) ? parsed.imports : [],
    rows: Array.isArray(parsed.rows) ? parsed.rows : [],
  };
}

export async function writeReport(
  company: Company,
  reportType: ReportType,
  report: StoredReport,
) {
  return put(reportPath(company, reportType), JSON.stringify(report), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    token: getBlobToken(),
  });
}

export async function checkBlobConnection() {
  if (!isBlobConfigured()) return false;
  try {
    await list({
      prefix: "budgeting/v1/",
      limit: 1,
      token: getBlobToken(),
    });
    return true;
  } catch {
    return false;
  }
}
