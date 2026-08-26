import { NextResponse } from "next/server";
import { saveReportImport, type ImportBody } from "@/lib/report-import";
import { readReport, type Company } from "@/lib/supabase-reports";
import { REPORTS } from "@/lib/reports";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const company = new URL(req.url).searchParams.get("company");
    if (!["1001", "maison_y"].includes(String(company))) {
      return NextResponse.json({ error: "Perusahaan tidak valid." }, { status: 400 });
    }

    const reports = await Promise.all(
      Object.keys(REPORTS).map(async (reportType) => ({
        reportType,
        report: await readReport(company as Company, reportType as keyof typeof REPORTS),
      })),
    );

    const items = reports.flatMap(({ reportType, report }) =>
      report.imports.map((item) => ({
        id: item.id,
        company,
        report_type: reportType,
        file_name: item.fileName,
        sheet_name: item.sheetName,
        row_count: item.rows.length,
        created_at: item.createdAt,
      })),
    );

    return NextResponse.json(items, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membaca riwayat." },
      { status: 500 },
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
