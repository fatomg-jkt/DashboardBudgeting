import { NextResponse } from "next/server";
import { readReport, type Company } from "@/lib/blob-storage";
import { REPORTS } from "@/lib/reports";
import { saveReportImport, type ImportBody } from "@/lib/report-import";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const company = new URL(request.url).searchParams.get("company");
  if (company !== "1001" && company !== "maison_y")
    return NextResponse.json({ error: "Perusahaan tidak valid." }, { status: 400 });
  try {
    const reports = await Promise.all(
      Object.keys(REPORTS).map((type) => readReport(company as Company, type as keyof typeof REPORTS)),
    );
    return NextResponse.json(
      reports.flatMap((report) => report.imports.map((item) => ({
        id: item.id, company, report_type: report.reportType, file_name: item.fileName,
        sheet_name: item.sheetName, row_count: item.rowCount, created_at: item.importedAt,
      }))).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Import history read failed.", error);
    return NextResponse.json({ error: "Penyimpanan bersama tidak dapat dihubungi." }, { status: 503 });
  }
}
export async function POST(request: Request) {
  const result = await saveReportImport((await request.json()) as ImportBody);
  return NextResponse.json(result.body, { status: result.status });
}
