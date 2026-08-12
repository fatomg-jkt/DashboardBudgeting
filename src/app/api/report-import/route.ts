import { NextResponse } from 'next/server';
import { saveReportImport } from '@/lib/report-import';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 4_000_000)
    return NextResponse.json(
      { error: 'Data terlalu besar untuk satu kali import. Pecah file menjadi beberapa bagian.' },
      { status: 413 },
    );
  try {
    const result = await saveReportImport(await request.json());
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Invalid report import request.', error);
    return NextResponse.json({ error: 'Data import tidak valid.' }, { status: 400 });
  }
}
