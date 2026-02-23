// app/layout.tsx — SERVER COMPONENT (pas de 'use client')
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/NavBar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// ── Métadonnées globales du site ──────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: 'Odyssey — Récits de voyageurs authentiques',
    template: '%s — Odyssey',
  },
  description: 'Découvrez des milliers d\'itinéraires vécus, racontés et photographiés par de vrais voyageurs. Road trips, randonnées, city guides, carnets de voyage.',
  keywords: ['voyage', 'récits de voyage', 'itinéraire', 'road trip', 'randonnée', 'city guide', 'blog voyage', 'carnet de voyage'],
  authors: [{ name: 'Odyssey' }],
  creator: 'Odyssey',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Odyssey',
    title: 'Odyssey — Récits de voyageurs authentiques',
    description: 'Des milliers d\'itinéraires vécus, racontés et photographiés par de vrais voyageurs.',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: 'Odyssey — Récits de voyage' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Odyssey — Récits de voyageurs authentiques',
    description: 'Des milliers d\'itinéraires vécus, racontés et photographiés par de vrais voyageurs.',
    images: ['/og-default.jpg'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.variable} suppressHydrationWarning>
        <NavBar />
        <main>{children}</main>
        <footer style={{
          borderTop: '1px solid var(--sand)',
          padding: '2rem 2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--parchment)',
          marginTop: '4rem',
        }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--ink)', opacity: 0.35 }}>Odyssey</span>
          <span style={{ fontSize: '0.72rem', color: '#bbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            © 2025 — Récits authentiques
          </span>
        </footer>
      </body>
    </html>
  );
}