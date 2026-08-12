import { readReport } from "@/lib/blob-storage";
import type { Company } from "@/lib/local-reports";
import { isReportType } from "@/lib/reports";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const reportType = params.get("reportType");
    const company = params.get("company");
    if (
      !isReportType(reportType) ||
      (company !== "1001" && company !== "maison_y")
    ) {
      return NextResponse.json(
        { error: "Jenis laporan atau perusahaan tidak valid." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const report = await readReport(company as Company, reportType);
    return NextResponse.json(report.rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Gagal membaca data.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
