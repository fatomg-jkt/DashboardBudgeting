import { NextResponse } from 'next/server';
import { db, isDatabaseConfigured } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  if (!isDatabaseConfigured()) {
    console.error('Supabase health check: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
    return NextResponse.json({ configured: false, connected: false }, { status: 503 });
  }

  try {
    await db('report_imports?select=id&limit=1');
    return NextResponse.json({ configured: true, connected: true });
  } catch {
    return NextResponse.json({ configured: true, connected: false }, { status: 503 });
  }
}
