import { readReport, writeReport, type Company } from "@/lib/blob-reports";
import { isReportType } from "@/lib/reports";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const query = new URL(req.url).searchParams;
    const company = query.get("company");
    const reportType = query.get("reportType");
    if (!['1001', 'maison_y'].includes(String(company)) || !isReportType(reportType))
      return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
    const report = await readReport(company as Company, reportType);
    report.imports = report.imports.filter((item) => item.id !== id);
    await writeReport(company as Company, reportType, report);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Hapus gagal." }, { status: 500 });
  }
}
