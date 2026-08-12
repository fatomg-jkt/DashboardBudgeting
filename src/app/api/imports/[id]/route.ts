import { readReport, writeReport } from "@/lib/blob-storage";
import { REPORTS } from "@/lib/reports";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    for (const company of ["1001", "maison_y"] as const) {
      for (const reportType of Object.keys(REPORTS) as Array<keyof typeof REPORTS>) {
        const report = await readReport(company, reportType);
        if (!report.imports.some((item) => item.id === id)) continue;
        await writeReport(company, reportType, {
          ...report,
          updatedAt: new Date().toISOString(),
          imports: report.imports.filter((item) => item.id !== id),
          rows: report.rows.filter((row) => row.importId !== id),
        });
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ error: "Import tidak ditemukan." }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hapus gagal." },
      { status: 500 },
    );
  }
}
