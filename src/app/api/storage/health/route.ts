import { NextResponse } from "next/server";
import { checkBlobConnection, isBlobConfigured } from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isBlobConfigured();
  const connected = configured ? await checkBlobConnection() : false;
  return NextResponse.json(
    { configured, connected, storage: "vercel-blob" },
    {
      status: connected ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
