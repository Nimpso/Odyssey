// app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import a from 'next/link';
import { AVATARS, COVERS } from '@/lib/odyssey-constants';
// L'import corrigé est ici :
import { AvatarDisplay } from '../profile/[username]/ProfileClient';

export default function SettingsPage() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({ username: '', bio: '', location: '', avatar_id: '', cover_id: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'infos' | 'avatar' | 'cover'>('infos');

  useEffect(() => {
    // On ajoute un try/catch pour éviter que la page ne freeze en cas d'erreur
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { 
          window.location.href = '/'; 
          return; 
        }
        setUser(user);
        
        const { data, error: profileErr } = await supabase
          .from('profiles')
          .select('username,bio,location,avatar_id,cover_id')
          .eq('id', user.id)
          .single();
          
        if (data) {
          setForm({ 
            username: data.username ?? '', 
            bio: data.bio ?? '', 
            location: data.location ?? '', 
            avatar_id: data.avatar_id ?? '', 
            cover_id: data.cover_id ?? '' 
          });
        }
      } catch (err) {
        console.error("Erreur lors du chargement des paramètres:", err);
      } finally {
        // Le finally s'assure que le chargement s'arrête, quoi qu'il arrive
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    if (!user) return;
    setSaving(true); setError('');
    const slug = form.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!slug) { setError('Le nom d\'utilisateur est obligatoire.'); setSaving(false); return; }
    const { error: err } = await supabase.from('profiles').upsert({
      id: user.id, username: slug, bio: form.bio, location: form.location,
      avatar_id: form.avatar_id, cover_id: form.cover_id,
      updated_at: new Date().toISOString(),
    });
    if (err) setError(err.message.includes('unique') ? 'Ce nom d\'utilisateur est déjà pris.' : err.message);
    else { setSaved(true); setForm(f => ({ ...f, username: slug })); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  };

  const iS: React.CSSProperties = { width: '100%', padding: '0.85rem 1rem', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e0e0e0', fontFamily: "'DM Sans',system-ui", fontSize: '0.9rem', outline: 'none', borderRadius: 3, boxSizing: 'border-box' };
  const coverCss = COVERS.find(c => c.id === form.cover_id)?.css ?? 'linear-gradient(135deg,#0f1923,#1e3a2f)';

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #222', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;1,9..144,300&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        input:focus,textarea:focus{border-color:#c9a84c!important;outline:none}
        *{box-sizing:border-box;margin:0;padding:0}
      `}</style>

      <main style={{ minHeight: '100vh', background: '#0d0d0d', color: '#e0e0e0', padding: '3rem 1.5rem' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <a href={form.username ? `/profile/${form.username}` : '/'}
              style={{ color: '#555', fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => ((e.target as HTMLElement).style.color = '#ccc')}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = '#555')}>
              ← Mon profil
            </a>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: '1.75rem', fontWeight: 300, color: 'white' }}>Paramètres du profil</h1>
              <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', color: '#444', marginTop: 3 }}>{user?.email}</p>
            </div>
          </div>

          {/* ── Aperçu profil ── */}
          <div style={{ marginBottom: '2rem', borderRadius: 6, overflow: 'hidden', border: '1px solid #1e1e1e' }}>
            <div style={{ height: 110, background: coverCss, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 40%,#111 100%)' }} />
            </div>
            <div style={{ background: '#111', padding: '0 1.25rem 1rem', display: 'flex', alignItems: 'flex-end', gap: '1rem', marginTop: -38 }}>
              <div style={{ width: 76, height: 76, borderRadius: '50%', border: '3px solid #111', overflow: 'hidden', flexShrink: 0 }}>
                <AvatarDisplay avatarId={form.avatar_id} size={76} />
              </div>
              <div style={{ paddingBottom: 4 }}>
                <p style={{ fontFamily: "'Fraunces',serif", fontSize: '1.1rem', fontWeight: 300, color: 'white' }}>@{form.username || 'votre_pseudo'}</p>
                {form.location && <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#555', marginTop: 2 }}>📍 {form.location}</p>}
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e1e1e', marginBottom: '2rem' }}>
            {([['infos', '✍️ Informations'], ['avatar', '🧑 Avatar'], ['cover', '🌄 Bannière']] as const).map(([t, label]) => (
              <button key={t} type="button" onClick={() => setTab(t as any)}
                style={{ padding: '0.7rem 1.1rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tab === t ? '#c9a84c' : '#444', borderBottom: `2px solid ${tab === t ? '#c9a84c' : 'transparent'}`, marginBottom: -1, transition: 'all 0.2s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Infos ── */}
          {tab === 'infos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontFamily: "'DM Sans',system-ui", fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555', marginBottom: '0.6rem' }}>Nom d'utilisateur *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#555' }}>@</span>
                  <input style={{ ...iS, paddingLeft: '2rem' }} value={form.username} placeholder="votre_pseudo"
                    onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} />
                </div>
                <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.68rem', color: '#444', marginTop: 5 }}>URL : odyssey.com/profile/{form.username || 'votre_pseudo'}</p>
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: "'DM Sans',system-ui", fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555', marginBottom: '0.6rem' }}>Bio</label>
                <textarea rows={3} style={{ ...iS, resize: 'vertical', lineHeight: 1.7 }} value={form.bio} placeholder="Passionné de voyages, globe-trotter…" maxLength={280}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
                <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.68rem', color: form.bio.length > 240 ? '#c9a84c' : '#444', marginTop: 4, textAlign: 'right' }}>{form.bio.length}/280</p>
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: "'DM Sans',system-ui", fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555', marginBottom: '0.6rem' }}>Localisation</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem' }}>📍</span>
                  <input style={{ ...iS, paddingLeft: '2.5rem' }} value={form.location} placeholder="Paris, France"
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* ── Avatar picker ── */}
          {tab === 'avatar' && (
            <div>
              <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', color: '#555', marginBottom: '1.25rem', lineHeight: 1.65 }}>
                Choisissez un avatar. Il apparaîtra sur votre profil et vos récits.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '0.65rem' }}>
                {AVATARS.map(av => (
                  <button key={av.id} type="button" onClick={() => setForm(f => ({ ...f, avatar_id: av.id }))}
                    style={{ padding: '0.6rem 0.4rem', background: form.avatar_id === av.id ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)', border: `2px solid ${form.avatar_id === av.id ? '#c9a84c' : '#1e1e1e'}`, borderRadius: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.18s' }}
                    onMouseEnter={e => { if (form.avatar_id !== av.id) (e.currentTarget as HTMLElement).style.borderColor = '#333'; }}
                    onMouseLeave={e => { if (form.avatar_id !== av.id) (e.currentTarget as HTMLElement).style.borderColor = '#1e1e1e'; }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: av.svg }} />
                    <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', color: form.avatar_id === av.id ? '#c9a84c' : '#555', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{av.label}</span>
                    {form.avatar_id === av.id && <span style={{ color: '#c9a84c', fontSize: 11, lineHeight: 1 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Cover picker ── */}
          {tab === 'cover' && (
            <div>
              <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', color: '#555', marginBottom: '1.25rem', lineHeight: 1.65 }}>
                Choisissez une bannière pour votre page de profil.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.75rem' }}>
                {COVERS.map(cv => (
                  <button key={cv.id} type="button" onClick={() => setForm(f => ({ ...f, cover_id: cv.id }))}
                    style={{ padding: 0, border: `2px solid ${form.cover_id === cv.id ? '#c9a84c' : '#1e1e1e'}`, borderRadius: 6, cursor: 'pointer', overflow: 'hidden', transition: 'border-color 0.18s' }}
                    onMouseEnter={e => { if (form.cover_id !== cv.id) (e.currentTarget as HTMLElement).style.borderColor = '#333'; }}
                    onMouseLeave={e => { if (form.cover_id !== cv.id) (e.currentTarget as HTMLElement).style.borderColor = '#1e1e1e'; }}>
                    <div style={{ height: 72, background: cv.css }} />
                    <div style={{ padding: '0.45rem 0.75rem', background: '#161616', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', fontWeight: 600, color: form.cover_id === cv.id ? '#c9a84c' : '#555' }}>{cv.label}</span>
                      {form.cover_id === cv.id && <span style={{ color: '#c9a84c', fontSize: 13 }}>✓</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Erreur ── */}
          {error && (
            <div style={{ padding: '0.85rem 1rem', background: 'rgba(181,84,53,0.1)', border: '1px solid rgba(181,84,53,0.3)', borderRadius: 3, marginTop: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
              <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', color: '#e87a4a' }}>⚠️ {error}</p>
            </div>
          )}

          {/* ── Sauvegarder ── */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #1e1e1e' }}>
            <button type="button" onClick={save} disabled={saving}
              style={{ padding: '0.85rem 2.5rem', background: saving ? '#1e1e1e' : '#c9a84c', border: 'none', color: saving ? '#444' : '#0d0d0d', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}>
              {saving
                ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#555', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Sauvegarde…</>
                : '✓ Sauvegarder'}
            </button>
            {saved && (
              <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', color: '#4caf7d', animation: 'fadeIn 0.3s ease' }}>
                Profil mis à jour !
              </span>
            )}
          </div>

          {/* ── Déconnexion ── */}
          <div style={{ marginTop: '3rem', padding: '1.25rem', border: '1px solid rgba(181,84,53,0.18)', borderRadius: 4 }}>
            <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.7rem', fontWeight: 700, color: '#b55435', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Zone de danger</p>
            <button type="button"
              onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}
              style={{ padding: '0.5rem 1.25rem', background: 'transparent', border: '1px solid rgba(181,84,53,0.3)', color: '#b55435', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', fontWeight: 600, borderRadius: 3, transition: 'background 0.2s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(181,84,53,0.08)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
              Se déconnecter
            </button>
          </div>

        </div>
      </main>
    </>
  );
}