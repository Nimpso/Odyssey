// app/profile/[username]/page.tsx
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import ProfileClient from './ProfileClient';

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getProfile(username: string) {
  const { data } = await supabaseServer
    .from('profiles')
    .select('id, username, bio, location, avatar_id, cover_id') // Ajout de 'id' ici (très important pour le client !)
    .eq('username', username)
    .single();
  return data;
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const profile = await getProfile(params.username);
  if (!profile) return { title: 'Profil introuvable' };

  const title = `@${profile.username} — Voyageur Odyssey`;
  const description = profile.bio || `Découvrez les récits de voyage de @${profile.username} sur Odyssey.`;

  return {
    title,
    description,
    openGraph: {
      type: 'profile',
      title,
      description,
      username: profile.username,
      images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary', title, description },
  };
}

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const profile = await getProfile(params.username);

  const jsonLd = profile ? {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `@${profile.username} sur Odyssey`,
    description: profile.bio || '',
    mainEntity: {
      '@type': 'Person',
      name: profile.username,
      description: profile.bio || '',
      ...(profile.location && { homeLocation: { '@type': 'Place', name: profile.location } }),
    },
  } : null;

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      {/* On passe le profil initial en prop */}
      <ProfileClient initialProfile={profile} username={params.username} />
    </>
  );
}