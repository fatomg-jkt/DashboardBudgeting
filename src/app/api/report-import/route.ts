import { NextResponse } from 'next/server';
import { getSupabaseStatus, supabaseAdminRequest } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const reportTypes = new Set([
  'budget_planning', 'budget_vs_actual', 'realisasi_budget',
  'monitoring_budget', 'pengajuan_budget', 'analisis_variance',
  'laporan_budget', 'master_data',
]);

type ImportPayload = {
  reportType?: string;
  fileName?: string;
  sheetName?: string;
  rows?: Record<string, unknown>[];
};
type ImportRecord = { id: string };
type StoredRow = { row_number: number | null; data_json: Record<string, unknown> };

function databaseError(error: unknown) {
  if (error instanceof Error && error.message === 'SUPABASE_NOT_CONFIGURED') {
    return NextResponse.json({ error: 'Database belum dikonfigurasi.' }, { status: 503 });
  }
  return NextResponse.json(
    { error: 'Database tidak dapat dihubungi. Silakan coba kembali.' },
    { status: 502 },
  );
}

export async function GET(request: Request) {
  const reportType = new URL(request.url).searchParams.get('reportType');
  if (!reportType || !reportTypes.has(reportType)) {
    return NextResponse.json({ error: 'Report type tidak valid.' }, { status: 400 });
  }
  if (getSupabaseStatus() === 'unconfigured') return databaseError(new Error('SUPABASE_NOT_CONFIGURED'));

  try {
    const imports = await supabaseAdminRequest<ImportRecord[]>(
      `report_imports?select=id&report_type=eq.${encodeURIComponent(reportType)}&order=created_at.desc&limit=1`,
    );
    if (!imports.length) return NextResponse.json({ rows: [], importId: null });
    const rows = await supabaseAdminRequest<StoredRow[]>(
      `report_rows?select=row_number,data_json&import_id=eq.${encodeURIComponent(imports[0].id)}&order=row_number.asc`,
    );
    return NextResponse.json({ importId: imports[0].id, rows: rows.map((row) => row.data_json) });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  let payload: ImportPayload;
  try {
    payload = await request.json() as ImportPayload;
  } catch {
    return NextResponse.json({ error: 'Payload import tidak valid.' }, { status: 400 });
  }

  if (!payload.reportType || !reportTypes.has(payload.reportType)) {
    return NextResponse.json({ error: 'Report type tidak valid.' }, { status: 400 });
  }
  if (!payload.fileName?.trim() || !Array.isArray(payload.rows) || payload.rows.length === 0 || payload.rows.some((row) => !row || Array.isArray(row) || typeof row !== 'object')) {
    return NextResponse.json({ error: 'File dan data import wajib diisi.' }, { status: 400 });
  }
  if (getSupabaseStatus() === 'unconfigured') return databaseError(new Error('SUPABASE_NOT_CONFIGURED'));

  let importId: string | undefined;
  try {
    const imports = await supabaseAdminRequest<ImportRecord[]>('report_imports', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        report_type: payload.reportType,
        file_name: payload.fileName.trim(),
        sheet_name: payload.sheetName?.trim() || null,
        row_count: payload.rows.length,
      }),
    });
    importId = imports[0]?.id;
    if (!importId) throw new Error('SUPABASE_REQUEST_FAILED');

    await supabaseAdminRequest('report_rows', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(payload.rows.map((data, index) => ({
        import_id: importId,
        report_type: payload.reportType,
        row_number: index + 1,
        data_json: data,
      }))),
    });

    return NextResponse.json({ success: true, importId, rowCount: payload.rows.length }, { status: 201 });
  } catch (error) {
    if (importId) {
      try {
        await supabaseAdminRequest(`report_imports?id=eq.${encodeURIComponent(importId)}`, { method: 'DELETE' });
      } catch {
        console.error('Failed to clean up incomplete report import.');
      }
    }
    if (error instanceof Error && error.message === 'SUPABASE_NOT_CONFIGURED') return databaseError(error);
    return NextResponse.json({ error: 'Data gagal disimpan. Silakan coba kembali.' }, { status: 500 });
  }
}
