import "server-only";

import { get, put } from "@vercel/blob";
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

export async function writeReport(
  company: Company,
  reportType: ReportType,
  report: StoredReport,
) {
  const token = blobToken();
  if (!token) throw new BlobNotConfiguredError("Vercel Blob belum dikonfigurasi.");
  return put(blobPath(company, reportType), JSON.stringify(report), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token,
  });
}
