import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AppProviders } from './providers';
import { HydrationMarker } from '@/components/common/hydration';

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
});

const fraunces = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Debate Web',
  description: 'Debate social voice platform web client',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={`${plusJakarta.variable} ${fraunces.variable}`}>
        <AppProviders>
          <HydrationMarker />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
