import { readReport, type Company } from "@/lib/blob-reports";
import { isReportType } from "@/lib/reports";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function keyPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function detailBiayaKey(row: Record<string, unknown>) {
  const periode = row.periode ?? row.bulan ?? row.month ?? "";
  const department = row.department ?? row.departemen ?? row.dept ?? "";
  const coa = row.deskripsi_coa ?? row.deskripsi ?? row.description ?? row.coa ?? "";
  return `${keyPart(periode)}|${keyPart(department)}|${keyPart(coa)}`;
}

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const type = params.get("reportType");
    const company = params.get("company");

    if (!isReportType(type) || !["1001", "maison_y"].includes(String(company))) {
      return NextResponse.json(
        { error: "Jenis laporan atau perusahaan tidak valid." },
        { status: 400 },
      );
    }

    const report = await readReport(company as Company, type);
    const rows = report.imports.flatMap((item) =>
      item.rows.map((row, index) => ({
        ...row,
        importId: item.id,
        rowNumber: index + 2,
      })),
    );

    if (type === "budget_detail_biaya" || type === "sisa_budget_detail_biaya") {
      const latest = new Map<string, Record<string, unknown>>();
      rows.forEach((row) => {
        const key = detailBiayaKey(row);
        if (key.replaceAll("|", "").length > 0) latest.set(key, row);
      });
      return NextResponse.json(Array.from(latest.values()), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membaca data." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
