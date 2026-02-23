'use client';
import { useState } from 'react';
import { supabase } from '@/utils/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--parchment)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
    }}>
      <div className="fade-up" style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo mark */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <svg width="36" height="36" viewBox="0 0 20 20" fill="none" style={{ margin: '0 auto 1rem', display: 'block' }}>
            <circle cx="10" cy="10" r="9" stroke="var(--gold)" strokeWidth="1.25"/>
            <polygon points="10,3 12.5,10 10,8.5 7.5,10" fill="var(--ink)"/>
            <polygon points="10,17 7.5,10 10,11.5 12.5,10" fill="var(--gold)"/>
          </svg>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.25rem',
            fontWeight: 400,
            color: 'var(--ink)',
            marginBottom: '0.5rem',
          }}>
            Bon retour
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#aaa', fontWeight: 300 }}>
            Connexion à Odyssey par lien magique
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'white',
          border: '1px solid var(--sand)',
          padding: '2.5rem',
        }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: 56, height: 56,
                background: 'rgba(196,151,58,0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.35rem',
                fontWeight: 400,
                color: 'var(--ink)',
                marginBottom: '0.5rem',
              }}>
                Lien envoyé !
              </p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.88rem', color: '#aaa', lineHeight: 1.6 }}>
                Vérifiez votre boîte mail et cliquez sur le lien pour accéder à votre compte.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#aaa',
                  marginBottom: '0.5rem',
                }}>
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  placeholder="vous@exemple.com"
                  className="field"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.82rem',
                  color: 'var(--rust)',
                  padding: '0.75rem 1rem',
                  background: 'rgba(181,84,53,0.06)',
                  borderLeft: '3px solid var(--rust)',
                }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'var(--ink)',
                  color: 'var(--parchment)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  borderRadius: '2px',
                }}
              >
                {loading ? (
                  <>
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    Envoi…
                  </>
                ) : (
                  'Recevoir le lien'
                )}
              </button>
            </form>
          )}
        </div>

        <p style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.78rem',
          color: '#ccc',
        }}>
          Pas de mot de passe · Connexion sécurisée par email
        </p>
      </div>
    </div>
  );
}