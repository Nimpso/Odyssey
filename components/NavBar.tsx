'use client';
// components/NavBar.tsx

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function NavBar() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        setUsername(data?.username ?? null);
      }
    };
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setUsername(null);
      else loadUser();
    });

    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => { subscription.unsubscribe(); window.removeEventListener('scroll', onScroll); };
  }, []);

  // Pas de rendu avant hydratation
  if (!isMounted) return null;

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      {/* Logo */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke="var(--gold)" strokeWidth="1.25"/>
          <polygon points="10,3 12.5,10 10,8.5 7.5,10" fill="var(--ink)"/>
          <polygon points="10,17 7.5,10 10,11.5 12.5,10" fill="var(--gold)"/>
        </svg>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', fontWeight: 400, letterSpacing: '0.01em', color: 'var(--ink)', lineHeight: 1 }}>
          Odyssey
        </span>
      </a>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Créer — masqué sur très petit écran */}
        <a href="/create"
          style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink)', textDecoration: 'none', opacity: 0.55, transition: 'opacity 0.2s', whiteSpace: 'nowrap' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.55')}>
          + Créer
        </a>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Profil */}
            {username ? (
              <a href={`/profile/${username}`}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0.35rem 0.7rem 0.35rem 0.4rem', background: 'rgba(196,151,58,0.1)', border: '1px solid rgba(196,151,58,0.25)', borderRadius: 20, textDecoration: 'none', transition: 'border-color 0.2s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(196,151,58,0.25)')}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#1e3a2f,#c9a84c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {username.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink)' }}>
                  @{username}
                </span>
              </a>
            ) : (
              <a href="/settings"
                style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: '#999', textDecoration: 'none' }}>
                Mon profil
              </a>
            )}
            {/* Déconnexion */}
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
              style={{ fontFamily: 'var(--font-sans)', fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--rust)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8, padding: 0, transition: 'opacity 0.2s', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
              Déco
            </button>
          </div>
        ) : (
          <a href="/login" className="btn-ink" style={{ padding: '0.5rem 1.1rem', fontSize: '0.72rem' }}>
            Connexion
          </a>
        )}
      </div>
    </nav>
  );
}