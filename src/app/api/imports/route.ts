import { readReport } from "@/lib/blob-storage";
import type { Company } from "@/lib/local-reports";
import { REPORTS } from "@/lib/reports";
import { NextResponse } from "next/server";
import { saveReportImport, type ImportBody } from "@/lib/report-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const company = new URL(req.url).searchParams.get("company");
    if (company !== "1001" && company !== "maison_y") {
      return NextResponse.json(
        { error: "Perusahaan tidak valid." },
        { status: 400 },
      );
    }
    const reports = await Promise.all(
      Object.keys(REPORTS).map(async (reportType) => ({
        reportType: reportType as keyof typeof REPORTS,
        report: await readReport(
          company as Company,
          reportType as keyof typeof REPORTS,
        ),
      })),
    );
    const history = reports
      .flatMap(({ reportType, report }) =>
        report.imports.map((item) => ({
          id: item.id,
          company,
          report_type: reportType,
          file_name: item.fileName,
          sheet_name: item.sheetName,
          row_count: item.rowCount,
          created_at: item.importedAt,
        })),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return NextResponse.json(history, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membaca riwayat." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(req: Request) {
  try {
    const result = await saveReportImport((await req.json()) as ImportBody);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json(
      { error: "Data import tidak lengkap atau tidak valid." },
      { status: 400 },
    );
  }
}
