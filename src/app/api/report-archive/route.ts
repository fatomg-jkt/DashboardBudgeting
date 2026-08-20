import { NextResponse } from "next/server";
import { BlobNotConfiguredError, type Company } from "@/lib/blob-reports";
import { deleteBudgetArchive, listBudgetArchives, saveBudgetArchive } from "@/lib/report-archive";

export const runtime = "nodejs";

function validCompany(value: unknown): value is Company {
  return value === "1001" || value === "maison_y";
}

export async function GET(request: Request) {
  try {
    const company = new URL(request.url).searchParams.get("company");
    if (!validCompany(company)) {
      return NextResponse.json({ error: "Perusahaan tidak valid." }, { status: 400 });
    }

    const items = await listBudgetArchives(company);
    return NextResponse.json(items, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BlobNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("List report archive failed.", error);
    return NextResponse.json({ error: "Gagal membaca arsip laporan." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const company = form.get("company");
    const periode = String(form.get("periode") ?? "").trim();
    const keterangan = String(form.get("keterangan") ?? "").trim();
    const file = form.get("file");

    if (!validCompany(company)) {
      return NextResponse.json({ error: "Perusahaan tidak valid." }, { status: 400 });
    }
    if (!periode) {
      return NextResponse.json({ error: "Periode wajib dipilih." }, { status: 400 });
    }
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: "File Excel wajib dipilih." }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      return NextResponse.json({ error: "Gunakan file .xlsx, .xls, atau .csv." }, { status: 400 });
    }

    const item = await saveBudgetArchive({
      company,
      periode,
      keterangan: keterangan || file.name.replace(/\.(xlsx|xls|csv)$/i, ""),
      file,
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    if (error instanceof BlobNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Save report archive failed.", error);
    return NextResponse.json({ error: "File Excel gagal disimpan." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const company = params.get("company");
    const id = String(params.get("id") ?? "").trim();

    if (!validCompany(company)) {
      return NextResponse.json({ error: "Perusahaan tidak valid." }, { status: 400 });
    }
    if (!id) {
      return NextResponse.json({ error: "ID arsip wajib diisi." }, { status: 400 });
    }

    const deleted = await deleteBudgetArchive(company, id);
    if (!deleted) {
      return NextResponse.json({ error: "Arsip tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BlobNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Delete report archive failed.", error);
    return NextResponse.json({ error: "Arsip gagal dihapus." }, { status: 500 });
  }
}
