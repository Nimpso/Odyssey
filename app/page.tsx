// app/page.tsx — SERVER COMPONENT
// Fournit les métadonnées + les voyages initiaux au composant client

import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import HomeClient from '@/components/HomeClient';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Métadonnées homepage ───────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Odyssey — Récits de voyageurs authentiques',
  description: 'Découvrez des milliers d\'itinéraires vécus, racontés et photographiés par de vrais voyageurs. Road trips, randonnées, city guides, carnets de voyage.',
  openGraph: {
    type: 'website',
    title: 'Odyssey — Récits de voyageurs authentiques',
    description: 'Des milliers d\'itinéraires vécus, racontés et photographiés par de vrais voyageurs.',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: 'Odyssey' }],
  },
};

// ── JSON-LD Organisation ───────────────────────────────────────────────────────
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Odyssey',
  description: 'Plateforme de récits de voyage authentiques',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://odyssey.app',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://odyssey.app'}/?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

// ── Fetch des voyages côté serveur (pour l'indexation) ────────────────────────
async function getInitialTrips() {
  const { data } = await supabase
    .from('trips')
    .select('id, title, slug, cover_image, category, city, country, duration, created_at, author:profiles!author_id(username)')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(50);
  return data ?? [];
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const initialTrips = await getInitialTrips();

  return (
    <>
      {/* JSON-LD rendu côté serveur — Google l'indexe */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/*
        On injecte aussi les titres des voyages dans une section cachée
        pour que Google puisse les crawler même sans JS
      */}
      <noscript>
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
          <h1>Odyssey — Récits de voyageurs authentiques</h1>
          <p>Découvrez des milliers d&apos;itinéraires de voyage authentiques.</p>
          <ul>
            {initialTrips.map(trip => (
              <li key={trip.id}>
                <a href={`/trip/${trip.slug}`}>{trip.title} — {trip.country}</a>
              </li>
            ))}
          </ul>
        </div>
      </noscript>

      {/* Composant client — toute l'interactivité préservée */}
      <HomeClient initialTrips={initialTrips} />
    </>
  );
}