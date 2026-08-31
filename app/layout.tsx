import type {Metadata, Viewport} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';
import { PWARegister } from '@/components/pwa-register';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VoltTime - Elektro Loidl',
  description: 'Zeiterfassung und Projektmanagement für Elektro Loidl',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VoltTime',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2563eb',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="de" className={inter.className} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-right" />
        <PWARegister />
      </body>
    </html>
  );
}
