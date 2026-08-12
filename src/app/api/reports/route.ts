import { NextResponse } from "next/server";
import {
  BlobStorageConfigurationError,
  readReport,
  type Company,
} from "@/lib/blob-storage";
import { isReportType } from "@/lib/reports";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const company = params.get("company");
  const reportType = params.get("reportType");
  if ((company !== "1001" && company !== "maison_y") || !isReportType(reportType))
    return NextResponse.json({ error: "Jenis laporan atau perusahaan tidak valid." }, { status: 400 });
  try {
    const report = await readReport(company as Company, reportType);
    return NextResponse.json(report.rows, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Report API read failed.", error);
    return NextResponse.json(
      { error: error instanceof BlobStorageConfigurationError ? error.message : "Penyimpanan bersama tidak dapat dihubungi." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
