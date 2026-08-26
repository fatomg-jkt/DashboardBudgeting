import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();

  if (!url || !key || !bucket) {
    return NextResponse.json({
      configured: false,
      connected: false,
      storage: "supabase",
    });
  }

  try {
    const params = new URLSearchParams({
      select: "dashboard_key",
      limit: "1",
    });
    const response = await fetch(`${url}/rest/v1/dashboard_reports?${params}`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Supabase ${response.status}`);

    return NextResponse.json({
      configured: true,
      connected: true,
      storage: "supabase",
      bucket,
    });
  } catch (error) {
    console.error("Supabase health check failed.", error);
    return NextResponse.json(
      { configured: true, connected: false, storage: "supabase" },
      { status: 503 },
    );
  }
}
