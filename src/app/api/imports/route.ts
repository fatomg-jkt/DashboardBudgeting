import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { saveReportImport, type ImportBody } from "@/lib/report-import";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const company = new URL(req.url).searchParams.get("company");
    if (!["1001", "maison_y"].includes(String(company)))
      return NextResponse.json(
        { error: "Perusahaan tidak valid." },
        { status: 400 },
      );
    return NextResponse.json(
      await db(
        `report_imports?company=eq.${encodeURIComponent(String(company))}&select=*&order=created_at.desc`,
      ),
    );
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
