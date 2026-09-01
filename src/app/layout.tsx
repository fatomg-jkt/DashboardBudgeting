import type { Metadata } from 'next';
import { Archivo, DM_Mono } from 'next/font/google';
import MenuAdjuster from '@/components/menu-adjuster';
import MonitoringMenuHider from '@/components/monitoring-menu-hider';
import AnalisaBudgetEnhancer from '@/components/analisa-budget-enhancer';
import AnalisaBudgetRouteSync from '@/components/analisa-budget-route-sync';
import AnalisaBudgetSubmenuReports from '@/components/analisa-budget-submenu-reports';
import AnalisaBudgetSubmenuFormat from '@/components/analisa-budget-submenu-format';
import DetailBiayaEnhancer from '@/components/detail-biaya-enhancer';
import DetailBiayaPieChart from '@/components/detail-biaya-pie-chart';
import SisaBudgetDetailEnhancer from '@/components/sisa-budget-detail-enhancer';
import SisaBudgetDepartmentChart from '@/components/sisa-budget-department-chart';
import SisaBudgetDepartmentTable from '@/components/sisa-budget-department-table';
import BudgetVsActualExtraMenu from '@/components/budget-vs-actual-extra-menu';
import BudgetVsActualDepartmentTable from '@/components/budget-vs-actual-department-table';
import MonthlyYtdBudgetReport from '@/components/monthly-ytd-budget-report';
import YtdDetailReportEnhancer from '@/components/ytd-detail-report-enhancer';
import YtdManagementSummary from '@/components/ytd-management-summary';
import RealisasiBudgetEnhancer from '@/components/realisasi-budget-enhancer';
import RealisasiMenuActiveFix from '@/components/realisasi-menu-active-fix';
import RealisasiDepartmentFilterPanel from '@/components/realisasi-department-filter-panel';
import LaporanBudgetHub from '@/components/laporan-budget-hub';
import LaporanBudgetArchiveActions from '@/components/laporan-budget-archive-actions';
import DashboardGraphCenter from '@/components/dashboard-graph-center';
import DashboardBudgetPercentKpis from '@/components/dashboard-budget-percent-kpis';
import DashboardSisaBudgetPies from '@/components/dashboard-sisa-budget-pies';
import DashboardSisaBudgetDetailPies from '@/components/dashboard-sisa-budget-detail-pies';
import DepartmentBudgetKpis from '@/components/department-budget-kpis';
import ImportPasswordGate from '@/components/import-password-gate';
import './globals.css';
import './branding-fix.css';
import './company-logo-switch.css';

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-primary',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dashboard Budgeting',
  description: 'Budgeting dashboard for 1001 & Maison Y',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${archivo.variable} ${dmMono.variable}`}>
      <body>
        <MenuAdjuster />
        <BudgetVsActualExtraMenu />
        <BudgetVsActualDepartmentTable />
        <MonitoringMenuHider />
        <AnalisaBudgetEnhancer />
        <AnalisaBudgetRouteSync />
        <AnalisaBudgetSubmenuReports />
        <AnalisaBudgetSubmenuFormat />
        <DetailBiayaEnhancer />
        <DetailBiayaPieChart />
        <SisaBudgetDetailEnhancer />
        <SisaBudgetDepartmentChart />
        <SisaBudgetDepartmentTable />
        <MonthlyYtdBudgetReport />
        <YtdDetailReportEnhancer />
        <YtdManagementSummary />
        <RealisasiBudgetEnhancer />
        <RealisasiMenuActiveFix />
        <RealisasiDepartmentFilterPanel />
        <LaporanBudgetHub />
        <LaporanBudgetArchiveActions />
        <DashboardGraphCenter />
        <DashboardBudgetPercentKpis />
        <DashboardSisaBudgetPies />
        <DashboardSisaBudgetDetailPies />
        <DepartmentBudgetKpis />
        <ImportPasswordGate />
        {children}
      </body>
    </html>
  );
}
