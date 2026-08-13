import { list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { blobToken } from "@/lib/blob-reports";

export const runtime = "nodejs";

export async function GET() {
  const token = blobToken();
  if (!token)
    return NextResponse.json({ configured: false, connected: false, storage: "vercel-blob" });
  try {
    await list({ prefix: "budgeting/v1/", limit: 1, token });
    return NextResponse.json({ configured: true, connected: true, storage: "vercel-blob" });
  } catch (error) {
    console.error("Vercel Blob health check failed.", error);
    return NextResponse.json(
      { configured: true, connected: false, storage: "vercel-blob" },
      { status: 503 },
    );
  }
}
