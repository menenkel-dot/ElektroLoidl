import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Global styles
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VoltTime - Zeiterfassung',
  description: 'Zeiterfassung für Elektro',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="de" className={inter.className} suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
