import type { Metadata } from 'next';
import { Playfair_Display, Public_Sans } from 'next/font/google';
import MenuAdjuster from '@/components/menu-adjuster';
import MonitoringMenuHider from '@/components/monitoring-menu-hider';
import AnalisaBudgetEnhancer from '@/components/analisa-budget-enhancer';
import AnalisaBudgetRouteSync from '@/components/analisa-budget-route-sync';
import DetailBiayaEnhancer from '@/components/detail-biaya-enhancer';
import DetailBiayaPieChart from '@/components/detail-biaya-pie-chart';
import SisaBudgetDetailEnhancer from '@/components/sisa-budget-detail-enhancer';
import SisaBudgetDepartmentChart from '@/components/sisa-budget-department-chart';
import './globals.css';
import './branding-fix.css';

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-title',
  display: 'swap',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dashboard Budgeting',
  description: 'Black & Gold budgeting dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${playfairDisplay.variable} ${publicSans.variable}`}>
      <body style={{ fontFamily: 'var(--font-body), sans-serif' }}>
        <MenuAdjuster />
        <MonitoringMenuHider />
        <AnalisaBudgetEnhancer />
        <AnalisaBudgetRouteSync />
        <DetailBiayaEnhancer />
        <DetailBiayaPieChart />
        <SisaBudgetDetailEnhancer />
        <SisaBudgetDepartmentChart />
        {children}
        <style>{`
          h1, h2, h3 {
            font-family: var(--font-title), serif;
          }
        `}</style>
      </body>
    </html>
  );
}
