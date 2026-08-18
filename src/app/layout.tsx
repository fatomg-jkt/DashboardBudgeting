import type { Metadata } from 'next';
import { Playfair_Display, Public_Sans } from 'next/font/google';
import './globals.css';

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
