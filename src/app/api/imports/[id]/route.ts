import { NextResponse } from "next/server";
import { REPORTS } from "@/lib/reports";
import { readReport, updateReport, type Company } from "@/lib/blob-storage";
export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const company = new URL(request.url).searchParams.get("company");
  if (company !== "1001" && company !== "maison_y")
    return NextResponse.json({ error: "Perusahaan tidak valid." }, { status: 400 });
  const { id } = await params;
  try {
    for (const reportType of Object.keys(REPORTS) as Array<keyof typeof REPORTS>) {
      const report = await readReport(company as Company, reportType);
      const index = report.imports.findIndex((item) => item.id === id);
      if (index < 0) continue;
      await updateReport(company as Company, reportType, (current) => {
        const currentIndex = current.imports.findIndex((item) => item.id === id);
        if (currentIndex < 0) return current;
        const start = current.imports
          .slice(0, currentIndex)
          .reduce((total, item) => total + item.rowCount, 0);
        const count = current.imports[currentIndex].rowCount;
        return {
          ...current,
          updatedAt: new Date().toISOString(),
          imports: current.imports.filter((item) => item.id !== id),
          rows: [...current.rows.slice(0, start), ...current.rows.slice(start + count)],
        };
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Riwayat import tidak ditemukan." }, { status: 404 });
  } catch (error) {
    console.error("Import deletion failed.", error);
    return NextResponse.json({ error: "Data gagal disimpan. Silakan coba kembali." }, { status: 500 });
  }
}
