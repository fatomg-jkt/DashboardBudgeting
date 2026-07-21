import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Dashboard Budgeting', description: 'Black & Gold budgeting dashboard' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
