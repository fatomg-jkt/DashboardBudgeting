export const REPORTS = {
  budget_planning:'Budget Planning', budget_vs_actual:'Budget vs Actual', realisasi_budget:'Realisasi Budget',
  monitoring_budget:'Monitoring Budget', pengajuan_budget:'Pengajuan Budget', analisis_variance:'Analisis Variance',
  laporan_budget:'Laporan Budget', budget_detail_biaya:'Laporan Per Detail Biaya', master_data:'Master Data'
} as const;
export type ReportType=keyof typeof REPORTS;
export const isReportType=(v:unknown):v is ReportType=>typeof v==='string'&&v in REPORTS;
