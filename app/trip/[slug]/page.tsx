// app/trip/[slug]/page.tsx
// Architecture hybride : metadata + JSON-LD côté SERVEUR, interactions côté client

import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import TripDetail from './TripDetail'; // composant client existant

// ── Client Supabase côté serveur (sans cookies — lecture publique uniquement) ─
const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Fetch du voyage côté serveur ───────────────────────────────────────────────
async function getTrip(slug: string) {
  const { data } = await supabaseServer
    .from('trips')
    .select('id, title, subtitle, slug, cover_image, category, city, country, duration, created_at, profiles!author_id(username, avatar_id)')
    .eq('slug', slug)
    .single();
  return data;
}

// ── 1. generateMetadata — titre + description + og:image par voyage ───────────
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const trip = await getTrip(params.slug);
  if (!trip) return { title: 'Voyage introuvable' };

  const title = trip.title;
  const location = [trip.city, trip.country].filter(Boolean).join(', ');
  const description = trip.subtitle
    || `${trip.category ? trip.category + ' — ' : ''}${location ? location + '. ' : ''}Découvrez ce récit de voyage sur Odyssey.`;
  const image = trip.cover_image || '/og-default.jpg';
  // @ts-ignore
  const author = trip.profiles?.username;

  return {
    title,
    description,
    authors: author ? [{ name: `@${author}` }] : undefined,
    openGraph: {
      type: 'article',
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      publishedTime: trip.created_at,
      tags: [trip.category, trip.country].filter(Boolean) as string[],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

// ── 2. generateStaticParams — pre-génère les routes connues ──────────────────
export async function generateStaticParams() {
  const { data } = await supabaseServer
    .from('trips')
    .select('slug')
    .eq('is_published', true);
  return (data ?? []).map(t => ({ slug: t.slug }));
}

// ── 3. Page principale — rendu serveur + JSON-LD ─────────────────────────────
export default async function TripPage({ params }: { params: { slug: string } }) {
  const trip = await getTrip(params.slug);

  // JSON-LD — données structurées pour Google
  const jsonLd = trip ? {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: trip.title,
    description: trip.subtitle || '',
    image: trip.cover_image || '',
    datePublished: trip.created_at,
    // @ts-ignore
    author: { '@type': 'Person', name: trip.profiles?.username ? `@${trip.profiles.username}` : 'Voyageur Odyssey' },
    publisher: { '@type': 'Organization', name: 'Odyssey' },
    keywords: [trip.category, trip.city, trip.country].filter(Boolean).join(', '),
    locationCreated: trip.country ? { '@type': 'Place', name: [trip.city, trip.country].filter(Boolean).join(', ') } : undefined,
  } : null;

  return (
    <>
      {/* JSON-LD injecté dans le <head> côté serveur */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Composant client existant — toutes les interactions préservées */}
      <TripDetail />
    </>
  );
}