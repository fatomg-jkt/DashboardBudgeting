import "server-only";

import { randomUUID } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
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
type BlobAuth = { oidcToken: string; storeId?: string } | { token: string };

export class BlobNotConfiguredError extends Error {}

export const blobPath = (company: Company, reportType: ReportType) =>
  `budgeting/v1/${company}/${reportType}.json`;

const versionPrefix = (company: Company, reportType: ReportType) =>
  `budgeting/v2/${company}/${reportType}/`;

export const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN;

async function blobAuthCandidates(): Promise<BlobAuth[]> {
  const candidates: BlobAuth[] = [];
  const storeId =
    process.env.BLOB_STORE_ID ||
    process.env.VERCEL_BLOB_STORE_ID ||
    process.env.BLOB_STORE;

  try {
    const oidcToken = await getVercelOidcToken();
    if (oidcToken) {
      candidates.push({
        oidcToken,
        ...(storeId ? { storeId } : {}),
      });
    }
  } catch (error) {
    console.warn("Unable to get Vercel OIDC token, using Blob token fallback.", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const token = blobToken();
  if (token) candidates.push({ token });

  if (!candidates.length) {
    throw new BlobNotConfiguredError(
      "Vercel Blob belum terhubung ke project ini. Hubungkan Blob Storage ke project Vercel lalu redeploy.",
    );
  }

  return candidates;
}

function validStoredReport(value: unknown): StoredReport | null {
  if (!value || typeof value !== "object") return null;
  const report = value as Partial<StoredReport>;
  return report.version === 1 && Array.isArray(report.imports)
    ? (report as StoredReport)
    : null;
}

async function readJsonBlob(
  path: string,
  authCandidates: BlobAuth[],
): Promise<StoredReport | null> {
  let firstError: unknown;

  for (const auth of authCandidates) {
    for (const access of ["private", "public"] as const satisfies readonly BlobAccess[]) {
      try {
        const result = await get(path, {
          access,
          ...auth,
          useCache: false,
        });
        if (!result) return null;
        const value = await new Response(result.stream).json();
        return validStoredReport(value);
      } catch (error) {
        firstError ??= error;
      }
    }
  }

  throw firstError instanceof Error
    ? firstError
    : new Error("Vercel Blob gagal dibaca.");
}

async function listVersions(
  company: Company,
  reportType: ReportType,
  authCandidates: BlobAuth[],
) {
  let firstError: unknown;

  for (const auth of authCandidates) {
    try {
      return await list({
        prefix: versionPrefix(company, reportType),
        limit: 1000,
        ...auth,
      });
    } catch (error) {
      firstError ??= error;
    }
  }

  throw firstError instanceof Error
    ? firstError
    : new Error("Vercel Blob gagal menampilkan daftar data.");
}

export async function readReport(
  company: Company,
  reportType: ReportType,
): Promise<StoredReport> {
  const authCandidates = await blobAuthCandidates();

  // Saving a new import should not be blocked just because an old Blob object
  // became unreadable (for example after a Blob store/access-mode migration).
  // We still try to preserve existing imports first, but gracefully fall back to
  // an empty report when legacy reads return 403/404/other Blob read errors.
  try {
    const versions = await listVersions(company, reportType, authCandidates);
    const candidates = versions.blobs
      .filter((blob) => blob.pathname.endsWith(".json"))
      .sort((a, b) => b.pathname.localeCompare(a.pathname));

    for (const blob of candidates) {
      try {
        const report = await readJsonBlob(blob.pathname, authCandidates);
        if (report) return report;
      } catch (error) {
        console.warn("Skipping unreadable report Blob version.", {
          pathname: blob.pathname,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    console.warn("Unable to list report Blob versions; continuing with legacy/new save.", {
      company,
      reportType,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const legacy = await readJsonBlob(
      blobPath(company, reportType),
      authCandidates,
    );
    if (legacy) return legacy;
  } catch (error) {
    console.warn("Legacy report Blob is unreadable; starting a fresh report version.", {
      company,
      reportType,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return { version: 1, imports: [] };
}

async function putJsonBlob(
  path: string,
  payload: string,
  authCandidates: BlobAuth[],
) {
  let firstError: unknown;

  for (const auth of authCandidates) {
    for (const access of ["private", "public"] as const satisfies readonly BlobAccess[]) {
      try {
        return await put(path, payload, {
          access,
          addRandomSuffix: false,
          contentType: "application/json",
          ...auth,
        });
      } catch (error) {
        firstError ??= error;
      }
    }
  }

  const detail =
    firstError instanceof Error
      ? firstError.message
      : String(firstError ?? "");
  throw new Error(detail || "Vercel Blob gagal ditulis.");
}

export async function writeReport(
  company: Company,
  reportType: ReportType,
  report: StoredReport,
) {
  const authCandidates = await blobAuthCandidates();
  const timestamp = String(Date.now()).padStart(13, "0");
  const path = `${versionPrefix(company, reportType)}${timestamp}-${randomUUID()}.json`;
  return putJsonBlob(path, JSON.stringify(report), authCandidates);
}
