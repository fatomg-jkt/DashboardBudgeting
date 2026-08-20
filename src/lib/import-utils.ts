import type { ReportType } from '@/lib/reports';

const headerKeywords = new Set(['no','department','departemen','dept','budget','anggaran','actual','aktual','realisasi','variance','var','kategori','category','bulan','month','tahun','year','nominal','pic','status','deskripsi','coa','description','periode','total','sisa','selisih','perusahaan','company','cost','center','kode','akun','nama']);
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
  monthly_budget_actual:{header:'Tahun,Bulan,Budget,Actual,Selisih %,Status',example:'2026,April,1267433332,1651087912,30.27%,Over Budget',filename:'template-monthly-budget-vs-actual.csv'},
  cumulative_budget_actual_ytd:{header:'Perusahaan,Tahun,Bulan,Department,Cost Center,Kode Akun,Nama Akun,Kategori,Budget,Realisasi',example:'1001,2026,Januari,Marketing,MKT-01,6201,Iklan Digital,OPEX,600000000,500000000',filename:'template-cumulative-budget-vs-actual-ytd.csv'},
  realisasi_budget:{header:'tahun,bulan,department,category,actual,keterangan',example:'2026,Januari,WAREHOUSE,Operasional,18183659,Realisasi Januari',filename:'template-realisasi-budget.csv'},
  realisasi_bulanan:{header:'Tahun,Bulan,Total Realisasi,Keterangan',example:'2026,Januari,18183659,Realisasi Januari',filename:'template-laporan-realisasi-bulanan.csv'},
  realisasi_per_departemen:{header:'Tahun,Bulan,Departemen,Realisasi,Kategori,Keterangan',example:'2026,Januari,WAREHOUSE,18183659,Operasional,Realisasi Januari',filename:'template-laporan-realisasi-per-departemen.csv'},
  monitoring_budget:{header:'tahun,bulan,department,budget,actual,status',example:'2026,Januari,WAREHOUSE,55200000,18183659,Aman',filename:'template-monitoring-budget.csv'},
  pengajuan_budget:{header:'tanggal,department,category,nominal,keterangan,pic,status',example:'2026-01-15,WAREHOUSE,Operasional,10000000,Pembelian perlengkapan,Budi,Draft',filename:'template-pengajuan-budget.csv'},
  analisis_variance:{header:'tahun,bulan,department,category,budget,actual',example:'2026,Januari,WAREHOUSE,Operasional,55200000,18183659',filename:'template-analisis-variance.csv'},
  laporan_budget:{header:'Tahun,Bulan,Departemen,Total Budget,Total Aktual,Sisa Budget,Variance %',example:'2026,Juni,WAREHOUSE,55200000,18183659,37016341,67%',filename:'template-laporan-sisa-budget-per-departemen.csv'},
  laporan_budget_upload:{header:'Judul Laporan,Periode,Keterangan,Nilai',example:'Laporan Management,Juni 2026,Contoh data,1000000',filename:'template-laporan-budget-umum.csv'},
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
