'use client';
// components/NavBar.tsx — client component (gère auth + scroll)

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import a from 'next/link';

export default function NavBar() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
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
    });

    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => { subscription.unsubscribe(); window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="10" cy="10" r="9" stroke="var(--gold)" strokeWidth="1.25"/>
          <polygon points="10,3 12.5,10 10,8.5 7.5,10" fill="var(--ink)"/>
          <polygon points="10,17 7.5,10 10,11.5 12.5,10" fill="var(--gold)"/>
        </svg>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', fontWeight: 400, letterSpacing: '0.01em', color: 'var(--ink)', lineHeight: 1 }}>
          Odyssey
        </span>
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <a href="/create" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink)', textDecoration: 'none', opacity: 0.55, transition: 'opacity 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.55')}>
          + Créer
        </a>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {username && (
              <a href={`/profile/${username}`} style={{ fontFamily: 'var(--font-sans)', fontSize: '0.78rem', color: '#999', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#999')}>
                @{username}
              </a>
            )}
            <button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
              style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--rust)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8, padding: 0, transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
              Déconnexion
            </button>
          </div>
        ) : (
          <a href="/login" className="btn-ink"><span>Connexion</span></a>
        )}
      </div>
    </nav>
  );
}