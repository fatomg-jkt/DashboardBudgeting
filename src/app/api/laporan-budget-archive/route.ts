import { NextResponse } from "next/server";
import { readReport, type Company } from "@/lib/blob-reports";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const company = new URL(request.url).searchParams.get("company");
    if (!["1001", "maison_y"].includes(String(company))) {
      return NextResponse.json({ error: "Perusahaan tidak valid." }, { status: 400 });
    }

    const report = await readReport(company as Company, "laporan_budget_upload");
    const items = report.imports
      .map((item) => ({
        id: item.id,
        fileName: item.fileName,
        sheetName: item.sheetName,
        headers: item.headers,
        rows: item.rows,
        createdAt: item.createdAt,
        periode: item.metadata?.periode || "-",
        keterangan: item.metadata?.keterangan || item.fileName,
        rowCount: item.rows.length,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json(items, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membaca arsip laporan." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
