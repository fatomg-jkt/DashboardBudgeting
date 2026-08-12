import type { ReportType } from './reports';

const aliases: Record<string, string> = {
  no: 'no', nomor: 'no', departemen: 'department', department: 'department', dept: 'department',
  budget: 'budget', anggaran: 'budget', budget_plan: 'budget', rencana: 'budget',
  actual: 'actual', aktual: 'actual', realisasi: 'actual', month: 'month', bulan: 'month',
  year: 'year', tahun: 'year', category: 'category', kategori: 'category', keterangan: 'description',
};
const months = ['jan','feb','mar','apr','mei','may','jun','jul','agu','aug','sep','okt','oct','nov','des','dec'];
const keywords = new Set([...Object.keys(aliases), ...months, 'total', 'status', 'cost_center', 'account', 'pic']);

export function normalizeHeader(value: string, index = 0) {
  const key = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return aliases[key] ?? (key || `kolom_${index + 1}`);
}

export function detectHeaderRow(rows: string[][]) {
  let best = { index: 0, score: -1, confident: false };
  rows.slice(0, 30).forEach((row, index) => {
    const values = row.map(String).map(x => x.trim()).filter(Boolean);
    if (values.length < 2) return;
    const normalized = values.map((x, i) => normalizeHeader(x, i));
    const hits = normalized.filter(x => keywords.has(x)).length;
    const numericOnly = values.filter(x => /^[-+]?[$€£]?\s*[\d.,]+$/.test(x)).length;
    const unique = new Set(normalized).size;
    const score = values.length * 2 + hits * 5 + unique - numericOnly * 2;
    if (score > best.score) best = { index, score, confident: hits >= 1 && values.length >= 3 };
  });
  return best;
}

export function parseNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value ?? '').trim().replace(/^rp\s*/i, '').replace(/\s/g, '');
  if (!text) return null;
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replaceAll('.', '').replace(',', '.');
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replaceAll(',', '');
  else if (!/^[-+]?\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

const numericByReport: Record<ReportType, Set<string>> = {
  budget_planning: new Set(['budget','total',...months]), budget_vs_actual: new Set(['budget','actual','total',...months]),
  realisasi_budget: new Set(['actual','total',...months]), monitoring_budget: new Set(['budget','actual','total',...months]),
  pengajuan_budget: new Set(['amount','nominal','total']), analisis_variance: new Set(['budget','actual','variance','total',...months]),
  laporan_budget: new Set(['budget','actual','total',...months]), master_data: new Set(),
};

export function buildTable(rows: string[][], headerIndex: number, reportType: ReportType) {
  const original = rows[headerIndex] ?? [];
  const seen = new Map<string, number>();
  const headers = original.map((value, index) => {
    const base = normalizeHeader(String(value ?? ''), index); const count = seen.get(base) ?? 0; seen.set(base, count + 1);
    return count ? `${base}_${count + 1}` : base;
  });
  const data = rows.slice(headerIndex + 1).filter(row => row.some(value => String(value ?? '').trim())).map(row =>
    Object.fromEntries(headers.map((header, index) => {
      const raw = row[index] ?? ''; const parsed = parseNumber(raw);
      return [header, numericByReport[reportType].has(header) && parsed !== null ? parsed : raw];
    }))
  );
  return { headers, rows: data };
}
