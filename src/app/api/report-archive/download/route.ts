import { NextResponse } from "next/server";
import { SupabaseNotConfiguredError, type Company } from "@/lib/supabase-reports";
import { getBudgetArchive } from "@/lib/report-archive";

export const runtime = "nodejs";

function validCompany(value: unknown): value is Company {
  return value === "1001" || value === "maison_y";
}

function safeDownloadName(value: string) {
  return value.replace(/[\r\n"]/g, "_");
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const company = params.get("company");
    const id = params.get("id");

    if (!validCompany(company) || !id) {
      return NextResponse.json({ error: "Parameter arsip tidak valid." }, { status: 400 });
    }

    const archive = await getBudgetArchive(company, id);
    if (!archive || !archive.stream) {
      return NextResponse.json({ error: "File arsip tidak ditemukan." }, { status: 404 });
    }

    return new Response(archive.stream, {
      headers: {
        "Content-Type": archive.item.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeDownloadName(archive.item.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Download report archive failed.", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "File arsip gagal diunduh." },
      { status: 500 },
    );
  }
}
