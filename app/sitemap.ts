// app/sitemap.ts — Next.js génère automatiquement /sitemap.xml
import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://odyssey.app';

  // ── Pages statiques ────────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  // ── Voyages publiés ────────────────────────────────────────────────────────
  const { data: trips } = await supabase
    .from('trips')
    .select('slug, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  const tripPages: MetadataRoute.Sitemap = (trips ?? []).map(trip => ({
    url: `${baseUrl}/trip/${trip.slug}`,
    lastModified: new Date(trip.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // ── Profils publics ────────────────────────────────────────────────────────
  const { data: profiles } = await supabase
    .from('profiles')
    .select('username, updated_at')
    .not('username', 'is', null);

  const profilePages: MetadataRoute.Sitemap = (profiles ?? []).map(p => ({
    url: `${baseUrl}/profile/${p.username}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...tripPages, ...profilePages];
}