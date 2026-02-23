'use client';
import { useEffect, useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function NavBar() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const lastY = useRef(0);

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

    // Hide on scroll down, show on scroll up
    const onScroll = () => {
      const y = window.scrollY;
      if (y <= 10) {
        setVisible(true); // toujours visible tout en haut
      } else if (y > lastY.current + 8) {
        setVisible(false); // scroll vers le bas → cache
      } else if (y < lastY.current - 8) {
        setVisible(true);  // scroll vers le haut → montre
      }
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { subscription.unsubscribe(); window.removeEventListener('scroll', onScroll); };
  }, []);

  if (!isMounted) return null;

  return (
    <nav style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 56,
      background: 'rgba(250,248,244,0.92)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(230,223,211,0.6)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.75rem',
      // Animation slide up/down
      transform: visible ? 'translateY(0)' : 'translateY(-100%)',
      transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
    }}>
      {/* Logo */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke="var(--gold)" strokeWidth="1.25"/>
          <polygon points="10,3 12.5,10 10,8.5 7.5,10" fill="var(--ink)"/>
          <polygon points="10,17 7.5,10 10,11.5 12.5,10" fill="var(--gold)"/>
        </svg>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', fontWeight: 400, color: 'var(--ink)', lineHeight: 1 }}>
          Odyssey
        </span>
      </a>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <a href="/create"
          style={{ fontFamily: 'var(--font-sans)', fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink)', textDecoration: 'none', opacity: 0.5, transition: 'opacity 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
          + Créer
        </a>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {username ? (
              <a href={`/profile/${username}`}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.65rem 0.3rem 0.35rem', background: 'rgba(196,151,58,0.1)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 20, textDecoration: 'none', transition: 'border-color 0.2s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(196,151,58,0.2)')}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#1e3a2f,#c9a84c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {username.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--ink)' }}>
                  @{username}
                </span>
              </a>
            ) : (
              <a href="/settings" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.72rem', color: '#999', textDecoration: 'none' }}>
                Mon profil
              </a>
            )}
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
              style={{ fontFamily: 'var(--font-sans)', fontSize: '0.68rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--rust)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7, padding: 0, transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}>
              Déco
            </button>
          </div>
        ) : (
          <a href="/login" className="btn-ink" style={{ padding: '0.45rem 1rem', fontSize: '0.7rem' }}>
            Connexion
          </a>
        )}
      </div>
    </nav>
  );
}