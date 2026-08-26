import "server-only";

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

export class SupabaseNotConfiguredError extends Error {}

const DASHBOARD_KEY = "budgeting";

function getConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) {
    throw new SupabaseNotConfiguredError(
      "Supabase belum dikonfigurasi. Pastikan SUPABASE_URL dan SUPABASE_SECRET_KEY tersedia di Vercel.",
    );
  }
  return { url, key };
}

function validStoredReport(value: unknown): StoredReport | null {
  if (!value || typeof value !== "object") return null;
  const report = value as Partial<StoredReport>;
  return report.version === 1 && Array.isArray(report.imports)
    ? (report as StoredReport)
    : null;
}

function authHeaders(key: string, extra?: Record<string, string>) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...extra,
  };
}

async function request(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`,
    );
  }
  return response;
}

export async function readReport(
  company: Company,
  reportType: ReportType,
): Promise<StoredReport> {
  const { url, key } = getConfig();
  const params = new URLSearchParams({
    dashboard_key: `eq.${DASHBOARD_KEY}`,
    company: `eq.${company}`,
    report_type: `eq.${reportType}`,
    select: "report_data",
    limit: "1",
  });
  const response = await request(`${url}/rest/v1/dashboard_reports?${params}`, {
    method: "GET",
    headers: authHeaders(key),
  });
  const rows = (await response.json()) as Array<{ report_data?: unknown }>;
  return validStoredReport(rows[0]?.report_data) ?? { version: 1, imports: [] };
}

export async function writeReport(
  company: Company,
  reportType: ReportType,
  report: StoredReport,
) {
  const { url, key } = getConfig();
  const params = new URLSearchParams({
    on_conflict: "dashboard_key,company,report_type",
  });
  await request(`${url}/rest/v1/dashboard_reports?${params}`, {
    method: "POST",
    headers: authHeaders(key, {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify([
      {
        dashboard_key: DASHBOARD_KEY,
        company,
        report_type: reportType,
        report_data: report,
        updated_at: new Date().toISOString(),
      },
    ]),
  });
}
