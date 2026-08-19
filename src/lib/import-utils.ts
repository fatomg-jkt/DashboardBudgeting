import type { ReportType } from '@/lib/reports';

const headerKeywords = new Set(['no','department','departemen','dept','budget','anggaran','actual','aktual','realisasi','variance','var','kategori','category','bulan','month','tahun','year','nominal','pic','status','deskripsi','coa','description','periode']);
export const headerToken = (value: unknown) => String(value ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function detectHeaderRow(rows: string[][]) {
  let best = { index: 0, score: -1 };
  rows.slice(0, 30).forEach((row, index) => {
    const cells = row.map(headerToken).filter(Boolean);
    if (cells.length < 3) return;
    const matches = cells.reduce((total, cell) => total + (headerKeywords.has(cell) || [...headerKeywords].some(keyword => cell.split('_').includes(keyword)) ? 1 : 0), 0);
    const score = matches * 10 + Math.min(cells.length, 10);
    if (matches > 0 && score > best.score) best = { index, score };
  });
  return best.index;
}

const detailHeader = 'Periode,Deskripsi (COA),DEVELOPMENT - Anggaran,DEVELOPMENT - Aktual,FAT - Anggaran,FAT - Aktual,HRD - Anggaran,HRD - Aktual,MANAGEMENT KIKI - Anggaran,MANAGEMENT KIKI - Aktual,MANAGEMENT UMA - Anggaran,MANAGEMENT UMA - Aktual,MARKETING - Anggaran,MARKETING - Aktual,MERCHANDISE - Anggaran,MERCHANDISE - Aktual,OPERASIONAL - Anggaran,OPERASIONAL - Aktual,PURCHASING - Anggaran,PURCHASING - Aktual,WAREHOUSE - Anggaran,WAREHOUSE - Aktual';
const detailExample = 'Januari,Beban Amortisasi Asuransi,4200000,8344373,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0';

export const templates: Record<ReportType, { header: string; example: string; filename: string }> = {
  budget_planning:{header:'tahun,bulan,department,category,budget,keterangan',example:'2026,Januari,WAREHOUSE,Operasional,55200000,Rencana tahunan',filename:'template-budget-planning.csv'},
  budget_vs_actual:{header:'tahun,bulan,department,category,budget,actual',example:'2026,Januari,WAREHOUSE,Operasional,55200000,18183659',filename:'template-budget-vs-actual.csv'},
  realisasi_budget:{header:'tahun,bulan,department,category,actual,keterangan',example:'2026,Januari,WAREHOUSE,Operasional,18183659,Realisasi Januari',filename:'template-realisasi-budget.csv'},
  monitoring_budget:{header:'tahun,bulan,department,budget,actual,status',example:'2026,Januari,WAREHOUSE,55200000,18183659,Aman',filename:'template-monitoring-budget.csv'},
  pengajuan_budget:{header:'tanggal,department,category,nominal,keterangan,pic,status',example:'2026-01-15,WAREHOUSE,Operasional,10000000,Pembelian perlengkapan,Budi,Draft',filename:'template-pengajuan-budget.csv'},
  analisis_variance:{header:'tahun,bulan,department,category,budget,actual',example:'2026,Januari,WAREHOUSE,Operasional,55200000,18183659',filename:'template-analisis-variance.csv'},
  laporan_budget:{header:'tahun,bulan,department,category,budget,actual,variance,variance_percent',example:'2026,Januari,WAREHOUSE,Operasional,55200000,18183659,37016341,67.06',filename:'template-laporan-budget.csv'},
  budget_detail_biaya:{header:detailHeader,example:detailExample,filename:'template-laporan-detail-biaya-semua-departemen.csv'},
  sisa_budget_detail_biaya:{header:detailHeader,example:detailExample,filename:'template-laporan-sisa-budget-detail-biaya-semua-departemen.csv'},
  master_data:{header:'type,code,name,active',example:'department,WH,WAREHOUSE,true',filename:'template-master-data.csv'},
};

export function downloadTemplate(reportType: ReportType) {
  const template = templates[reportType];
  const blob = new Blob([`\uFEFF${template.header}\r\n${template.example}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = template.filename; anchor.click();
  URL.revokeObjectURL(url);
}
