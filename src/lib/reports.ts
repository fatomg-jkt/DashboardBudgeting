export const REPORTS = {
  budget_planning: 'Budget Planning',
  budget_vs_actual: 'Budget vs Actual',
  realisasi_budget: 'Realisasi Budget',
  realisasi_bulanan: 'Laporan Realisasi Bulanan',
  realisasi_per_departemen: 'Laporan Realisasi Per Departemen',
  monitoring_budget: 'Monitoring Budget',
  pengajuan_budget: 'Pengajuan Budget',
  analisis_variance: 'Analisis Variance',
  laporan_budget: 'Laporan Budget',
  laporan_budget_upload: 'Laporan Excel Tersimpan',
  budget_detail_biaya: 'Laporan Per Detail Biaya',
  monthly_budget_actual: 'Monthly Budget vs Actual',
  cumulative_budget_actual_ytd: 'Cumulative Budget vs Actual YTD',
  sisa_budget_detail_biaya: 'Laporan Sisa Budget Per Detail Biaya',
  master_data: 'Master Data',
} as const;

export type ReportType = keyof typeof REPORTS;

export const isReportType = (value: unknown): value is ReportType =>
  typeof value === 'string' && value in REPORTS;
