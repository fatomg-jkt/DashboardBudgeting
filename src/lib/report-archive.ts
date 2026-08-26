import "server-only";

import {
  readReport,
  writeReport,
  SupabaseNotConfiguredError,
  type Company,
  type StoredImport,
} from "@/lib/supabase-reports";

export type BudgetArchiveItem = {
  id: string;
  periode: string;
  keterangan: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  size: number;
  createdAt: string;
};

const REPORT_TYPE = "laporan_budget_upload" as const;

function getConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  if (!url || !key || !bucket) {
    throw new SupabaseNotConfiguredError(
      "Supabase Storage belum dikonfigurasi. Pastikan SUPABASE_URL, SUPABASE_SECRET_KEY, dan SUPABASE_STORAGE_BUCKET tersedia di Vercel.",
    );
  }
  return { url, key, bucket };
}

function authHeaders(key: string, extra?: Record<string, string>) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function safeName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "laporan.xlsx";
}

function toArchiveItem(item: StoredImport): BudgetArchiveItem | null {
  const storagePath = item.metadata?.storagePath?.trim();
  if (!storagePath) return null;
  return {
    id: item.id,
    periode: item.metadata?.periode?.trim() || "-",
    keterangan: item.metadata?.keterangan?.trim() || item.fileName,
    fileName: item.metadata?.originalFileName?.trim() || item.fileName,
    storagePath,
    contentType: item.metadata?.contentType?.trim() || "application/octet-stream",
    size: Number(item.metadata?.size ?? 0),
    createdAt: item.createdAt,
  };
}

async function storageRequest(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase Storage ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`,
    );
  }
  return response;
}

export async function listBudgetArchives(company: Company) {
  const report = await readReport(company, REPORT_TYPE);
  return report.imports
    .map(toArchiveItem)
    .filter((item): item is BudgetArchiveItem => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveBudgetArchive(args: {
  company: Company;
  periode: string;
  keterangan: string;
  file: File;
}) {
  const { url, key, bucket } = getConfig();
  const id = crypto.randomUUID();
  const fileName = args.file.name || "laporan.xlsx";
  const storagePath = `budgeting/${args.company}/archives/${id}-${safeName(fileName)}`;
  const bytes = await args.file.arrayBuffer();
  const contentType = args.file.type || "application/octet-stream";

  await storageRequest(
    `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(storagePath)}`,
    {
      method: "POST",
      headers: authHeaders(key, {
        "Content-Type": contentType,
        "x-upsert": "false",
        "cache-control": "3600",
      }),
      body: bytes,
    },
  );

  const report = await readReport(args.company, REPORT_TYPE);
  const stored: StoredImport = {
    id,
    fileHash: `archive-${id}`,
    fileName,
    sheetName: "FILE",
    headers: [],
    rows: [],
    createdAt: new Date().toISOString(),
    metadata: {
      periode: args.periode,
      keterangan: args.keterangan,
      storagePath,
      originalFileName: fileName,
      contentType,
      size: args.file.size,
    },
  };
  report.imports.push(stored);
  await writeReport(args.company, REPORT_TYPE, report);

  return toArchiveItem(stored)!;
}

export async function getBudgetArchive(company: Company, id: string) {
  const { url, key, bucket } = getConfig();
  const report = await readReport(company, REPORT_TYPE);
  const stored = report.imports.find((entry) => entry.id === id);
  const item = stored ? toArchiveItem(stored) : null;
  if (!item) return null;

  const response = await storageRequest(
    `${url}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodeStoragePath(item.storagePath)}`,
    {
      method: "GET",
      headers: authHeaders(key),
    },
  );

  return { item, stream: response.body };
}

export async function deleteBudgetArchive(company: Company, id: string) {
  const { url, key, bucket } = getConfig();
  const report = await readReport(company, REPORT_TYPE);
  const stored = report.imports.find((entry) => entry.id === id);
  const item = stored ? toArchiveItem(stored) : null;
  if (!item) return false;

  await storageRequest(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    headers: authHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [item.storagePath] }),
  });

  report.imports = report.imports.filter((entry) => entry.id !== id);
  await writeReport(company, REPORT_TYPE, report);
  return true;
}
