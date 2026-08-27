import { NextRequest, NextResponse } from 'next/server';
import { saveReportImport } from '@/lib/report-import';
import { isImportAuthorized } from '@/lib/import-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isImportAuthorized(request)) {
    return NextResponse.json(
      { error: 'Import terkunci. Masukkan password pengaman terlebih dahulu.' },
      { status: 401 },
    );
  }

  try {
    const result = await saveReportImport(await request.json());
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: 'Data import tidak lengkap atau tidak valid.' }, { status: 400 });
  }
}
