// app/profile/[username]/ProfileClient.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AVATARS, COVERS } from '@/lib/odyssey-constants';
import LikeButton from '@/components/LikeButton'; // Import du composant externe

// ─── Avatar SVG ───────────────────────────────────────────────────────────────
export function AvatarDisplay({ avatarId, size = 40 }: { avatarId?: string; size?: number }) {
  const av = AVATARS.find(a => a.id === avatarId);
  if (!av) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#1e3a2f,#c9a84c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, color: 'white', fontWeight: 700, fontFamily: "'DM Sans',system-ui" }}>
        ✈
      </div>
    );
  }
  return (
    <div
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: av.svg }}
    />
  );
}

// ─── Carte voyage ─────────────────────────────────────────────────────────────
function TripCard({ trip }: { trip: any }) {
  const supabase = createClientComponentClient();
  const [likesCount, setLikesCount] = useState(0);

  // Récupération du nombre de likes pour conserver l'affichage exact
  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('trip_id', trip.id);
      setLikesCount(count ?? 0);
    })();
  }, [trip.id, supabase]);

  const bgCss = COVERS.find(c => c.id === trip.cover_gradient)?.css ?? 'linear-gradient(135deg,#1a1a2e,#1e3a2f)';
  
  return (
    <a href={`/trip/${trip.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 6, overflow: 'hidden', transition: 'all 0.25s', cursor: 'pointer' }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 20px 50px rgba(0,0,0,0.55)'; el.style.borderColor = '#2a2a2a'; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = ''; el.style.borderColor = '#1e1e1e'; }}
      >
        <div style={{ height: 190, position: 'relative', overflow: 'hidden', background: bgCss }}>
          {trip.cover_image && (
            <img src={trip.cover_image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.8) 0%,transparent 55%)' }} />

          {trip.category && (
            <div style={{ position: 'absolute', top: 10, left: 10, padding: '3px 10px', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, backdropFilter: 'blur(6px)' }}>
              <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#c9a84c' }}>{trip.category}</span>
            </div>
          )}

          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <LikeButton tripId={trip.id} initialCount={likesCount} size="sm" />
          </div>

          <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
            <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: '1.05rem', fontWeight: 300, color: 'white', lineHeight: 1.3, textShadow: '0 1px 10px rgba(0,0,0,0.6)' }}>
              {trip.title}
            </h3>
          </div>
        </div>

        <div style={{ padding: '0.7rem 1rem', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(trip.city || trip.country) && (
            <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#555' }}>
              📍 {[trip.city, trip.country].filter(Boolean).join(', ')}
            </span>
          )}
          {trip.duration && (
            <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#555' }}>
              ⏱ {trip.duration}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Page profil ──────────────────────────────────────────────────────────────
export default function ProfileClient({ initialProfile, username }: { initialProfile: any; username: string }) {
  const supabase = createClientComponentClient();

  const [profile] = useState<any>(initialProfile);
  const [trips, setTrips] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [totalLikes, setTotalLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(!initialProfile);
  const [isMounted, setIsMounted] = useState(false);

  // ── Anti-hydration : on ne rend rien côté client avant le montage ──
  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!initialProfile) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    (async () => {
      // Utilisateur connecté
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      // Voyages de ce profil
      const { data: rows, error: tripsErr } = await supabase
        .from('trips')
        .select('id, title, slug, is_published, created_at, cover_image, cover_gradient, category, city, country, duration')
        .eq('author_id', initialProfile.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (tripsErr) {
        console.error('[profile] trips error:', tripsErr.message);
        setLoading(false);
        return;
      }

      const published = rows ?? [];
      setTrips(published);

      // Total likes réel
      if (published.length > 0) {
        const { count: lk } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .in('trip_id', published.map((t: any) => t.id));
        setTotalLikes(lk ?? 0);
      }

      setLoading(false);
    })();
  }, [initialProfile, supabase]);

  const coverCss = COVERS.find(c => c.id === profile?.cover_id)?.css ?? 'linear-gradient(135deg,#0f1923,#1e3a2f)';
  const isOwn = !!(currentUserId && profile?.id === currentUserId);

  // Pas de rendu avant hydratation — évite le mismatch serveur/client
  if (!isMounted) return null;

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #222', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ── 404 ── */
  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300&family=DM+Sans:wght@400;700&display=swap');@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ fontFamily: "'Fraunces',serif", fontSize: '2rem', fontWeight: 300, color: '#444' }}>Profil introuvable</p>
      <a href="/" style={{ padding: '0.65rem 1.5rem', background: '#c9a84c', color: '#0d0d0d', fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 3 }}>← Accueil</a>
    </div>
  );

  /* ── Page ── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;1,9..144,300&family=DM+Sans:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
      `}</style>

      <main className="page-fullscreen" style={{ minHeight: '100vh', background: '#0d0d0d' }}>

        {/* ── Bannière ── */}
        <div style={{ position: 'relative', height: 260, background: coverCss }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 50%,#0d0d0d 100%)' }} />
          <nav style={{ position: 'absolute', top: 20, left: 24, right: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
            <a href="/"
              style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => ((e.target as HTMLElement).style.color = 'white')}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = 'rgba(255,255,255,0.55)')}>
              ← Odyssey
            </a>
            {isOwn && (
              <a href="/settings"
                style={{ display: 'inline-block', padding: '0.4rem 1rem', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', borderRadius: 3, backdropFilter: 'blur(8px)', transition: 'border-color 0.2s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#c9a84c')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)')}>
                ✏️ Modifier mon profil
              </a>
            )}
          </nav>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>

          {/* ── En-tête profil ── */}
          <header style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', marginTop: -58, marginBottom: '2.5rem', position: 'relative', zIndex: 10, animation: 'up 0.5s ease', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{ width: 114, height: 114, borderRadius: '50%', border: '4px solid #0d0d0d', overflow: 'hidden', flexShrink: 0 }}>
              <AvatarDisplay avatarId={profile.avatar_id} size={114} />
            </div>

            {/* Nom + bio */}
            <div style={{ flex: 1, minWidth: 200, paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
                <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: '1.8rem', fontWeight: 300, color: 'white', lineHeight: 1 }}>
                  @{profile.username}
                </h1>
                {isOwn && (
                  <span style={{ padding: '2px 9px', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, fontFamily: "'DM Sans',system-ui", fontSize: '0.58rem', fontWeight: 700, color: '#c9a84c', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Mon profil
                  </span>
                )}
              </div>
              {profile.location && (
                <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', color: '#555', marginBottom: 7 }}>📍 {profile.location}</p>
              )}
              {profile.bio && (
                <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.88rem', color: '#888', lineHeight: 1.7, maxWidth: 520 }}>{profile.bio}</p>
              )}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '2.5rem', paddingBottom: 8 }}>
              {[{ label: 'Voyages', val: trips.length }, { label: 'Likes reçus', val: totalLikes }].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: "'Fraunces',serif", fontSize: '2.2rem', fontWeight: 300, color: 'white', lineHeight: 1 }}>{s.val}</p>
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#555', marginTop: 5 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </header>

          {/* ── Séparateur ── */}
          <div style={{ height: 1, background: 'linear-gradient(90deg,#c9a84c,rgba(201,168,76,0.08),transparent)', marginBottom: '2rem', opacity: 0.5 }} />

          {/* ── Section voyages ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>Récits publiés</p>
              <p style={{ fontFamily: "'Fraunces',serif", fontSize: '1.25rem', fontWeight: 300, color: 'white' }}>
                {trips.length} voyage{trips.length !== 1 ? 's' : ''}
              </p>
            </div>
            {isOwn && (
              <a href="/create"
                style={{ display: 'inline-block', padding: '0.55rem 1.25rem', background: '#c9a84c', color: '#0d0d0d', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 3 }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.85')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}>
                + Nouveau récit
              </a>
            )}
          </div>

          {trips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 1rem', border: '1px dashed #1e1e1e', borderRadius: 6 }}>
              <p style={{ fontFamily: "'Fraunces',serif", fontSize: '1.5rem', fontWeight: 300, color: '#2a2a2a', marginBottom: 12 }}>
                Aucun récit publié pour l'instant
              </p>
              {isOwn && (
                <a href="/create" style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', color: '#c9a84c', textDecoration: 'none' }}>
                  Créer mon premier voyage →
                </a>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem', paddingBottom: '5rem', animation: 'up 0.5s ease 0.12s both' }}>
              {trips.map(trip => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}