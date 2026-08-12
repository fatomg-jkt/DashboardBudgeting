import { db } from "@/lib/db";
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
    const rows = await db<
      {
        id: number;
        import_id: string;
        row_number: number;
        data_json: Record<string, unknown>;
      }[]
    >(
      `report_import_rows?report_type=eq.${encodeURIComponent(type)}&company=eq.${encodeURIComponent(String(company))}&select=id,import_id,row_number,data_json&order=id.asc`,
    );
    return NextResponse.json(
      rows.map((x) => ({
        ...x.data_json,
        id: x.id,
        importId: x.import_id,
        rowNumber: x.row_number,
      })),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membaca data." },
      { status: 500 },
    );
  }
}
