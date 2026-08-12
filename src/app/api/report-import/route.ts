import { NextResponse } from 'next/server';
import { saveReportImport } from '@/lib/report-import';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const result = await saveReportImport(await request.json());
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: 'Data import tidak lengkap atau tidak valid.' }, { status: 400 });
  }
}
