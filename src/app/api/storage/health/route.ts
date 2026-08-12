import { NextResponse } from "next/server";
import { storageHealth } from "@/lib/blob-storage";
export const runtime = "nodejs";
export async function GET() {
  const status = await storageHealth();
  return NextResponse.json(status, { status: status.connected || !status.configured ? 200 : 503 });
}
