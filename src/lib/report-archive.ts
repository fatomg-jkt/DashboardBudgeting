import "server-only";

import { get, put } from "@vercel/blob";
import { BlobNotConfiguredError, blobToken, type Company } from "@/lib/blob-reports";

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

type BudgetArchiveIndex = {
  version: 1;
  items: BudgetArchiveItem[];
};

const indexPath = (company: Company) => `budgeting/v1/${company}/laporan-budget-archive.json`;

function safeName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "laporan.xlsx";
}

async function readIndex(company: Company): Promise<BudgetArchiveIndex> {
  const token = blobToken();
  if (!token) throw new BlobNotConfiguredError("Vercel Blob belum dikonfigurasi.");

  const result = await get(indexPath(company), {
    access: "private",
    token,
    useCache: false,
  });

  if (!result) return { version: 1, items: [] };
  const value = (await new Response(result.stream).json()) as BudgetArchiveIndex;
  return value?.version === 1 && Array.isArray(value.items)
    ? value
    : { version: 1, items: [] };
}

async function writeIndex(company: Company, index: BudgetArchiveIndex) {
  const token = blobToken();
  if (!token) throw new BlobNotConfiguredError("Vercel Blob belum dikonfigurasi.");

  await put(indexPath(company), JSON.stringify(index), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token,
  });
}

export async function listBudgetArchives(company: Company) {
  const index = await readIndex(company);
  return [...index.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveBudgetArchive(args: {
  company: Company;
  periode: string;
  keterangan: string;
  file: File;
}) {
  const token = blobToken();
  if (!token) throw new BlobNotConfiguredError("Vercel Blob belum dikonfigurasi.");

  const id = crypto.randomUUID();
  const fileName = args.file.name || "laporan.xlsx";
  const storagePath = `budgeting/v1/${args.company}/archives/${id}-${safeName(fileName)}`;
  const bytes = await args.file.arrayBuffer();

  await put(storagePath, bytes, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: args.file.type || "application/octet-stream",
    token,
  });

  const item: BudgetArchiveItem = {
    id,
    periode: args.periode,
    keterangan: args.keterangan,
    fileName,
    storagePath,
    contentType: args.file.type || "application/octet-stream",
    size: args.file.size,
    createdAt: new Date().toISOString(),
  };

  const index = await readIndex(args.company);
  index.items.push(item);
  await writeIndex(args.company, index);
  return item;
}

export async function getBudgetArchive(company: Company, id: string) {
  const token = blobToken();
  if (!token) throw new BlobNotConfiguredError("Vercel Blob belum dikonfigurasi.");

  const index = await readIndex(company);
  const item = index.items.find((entry) => entry.id === id);
  if (!item) return null;

  const result = await get(item.storagePath, {
    access: "private",
    token,
    useCache: false,
  });
  if (!result) return null;

  return { item, stream: result.stream };
}
