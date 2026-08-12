import { NextResponse } from 'next/server';
import { getSupabaseStatus, supabaseAdminRequest } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET() {
  if (getSupabaseStatus() === 'unconfigured') {
    return NextResponse.json({ configured: false, connected: false }, { status: 503 });
  }
  try {
    await supabaseAdminRequest('report_imports?select=id&limit=1');
    return NextResponse.json({ configured: true, connected: true });
  } catch {
    return NextResponse.json({ configured: true, connected: false }, { status: 502 });
  }
}
