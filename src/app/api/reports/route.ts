import { readReport, type Company } from "@/lib/blob-reports";
import { isReportType } from "@/lib/reports";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams,
      type = params.get("reportType"),
      company = params.get("company");
    if (!isReportType(type) || !["1001", "maison_y"].includes(String(company)))
      return NextResponse.json(
        { error: "Jenis laporan atau perusahaan tidak valid." },
        { status: 400 },
      );
    const report = await readReport(company as Company, type);
    const rows = report.imports.flatMap((item) =>
      item.rows.map((row, index) => ({ ...row, importId: item.id, rowNumber: index + 2 })),
    );
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membaca data." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
