// components/HomeClient.tsx — CLIENT COMPONENT
'use client';

import { useEffect, useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// ─── Hero slideshow images (Unsplash, free to use) ───────────────────────────
const HERO_SLIDES = [
  { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1800&auto=format&fit=crop', alt: 'Forêt brumeuse',          pos: 'center' },
  { url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1800&auto=format&fit=crop', alt: 'Montagne enneigée',        pos: 'center top' },
  { url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1800&auto=format&fit=crop', alt: 'Lac de montagne',          pos: 'center' },
  { url: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1800&auto=format&fit=crop', alt: 'Route désertique',         pos: 'center' },
  { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1800&auto=format&fit=crop', alt: 'Sommet alpin',             pos: 'center' },
  { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1800&auto=format&fit=crop', alt: 'Plage tropicale',          pos: 'center bottom' },
  { url: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=1800&auto=format&fit=crop', alt: 'Venise canaux',            pos: 'center' },
  { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1800&auto=format&fit=crop', alt: 'Portrait voyageur',        pos: 'center top' },
  { url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1800&auto=format&fit=crop', alt: 'Côte amalfitaine',         pos: 'center' },
  { url: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1800&auto=format&fit=crop', alt: 'Temple japonais',          pos: 'center' },
];

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard({ h }: { h: number }) {
  return (
    <div style={{ flexShrink: 0, width: 320, height: h, background: '#1a1a1a', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
        backgroundSize: '600px 100%',
        animation: 'shimmerDark 1.5s infinite linear',
      }} />
    </div>
  );
}

// ─── Category filter pill ─────────────────────────────────────────────────────
const CATS = [
  { value: '', label: 'Tout' },
  { value: 'aventure', label: 'Aventure' },
  { value: 'plage', label: 'Plage' },
  { value: 'culture', label: 'Culture' },
  { value: 'nature', label: 'Nature' },
  { value: 'citytrip', label: 'City Trip' },
  { value: 'road-trip', label: 'Road Trip' },
  { value: 'luxe', label: 'Luxe' },
];

export default function HomeClient({ initialTrips = [] }: { initialTrips?: any[] }) {
  const supabase = createClientComponentClient();
  const [trips, setTrips] = useState<any[]>(initialTrips);
  const [filtered, setFiltered] = useState<any[]>(initialTrips);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('');
  const [loading, setLoading] = useState(initialTrips.length === 0);
  const [isMounted, setIsMounted] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    setTimeout(() => setHeroLoaded(true), 100);

    const interval = setInterval(() => {
      setHeroSlide(s => (s + 1) % HERO_SLIDES.length);
    }, 6000);

    const fetchData = async () => {
      // Charger l'utilisateur connecté + son profil
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('username, avatar_id').eq('id', user.id).single();
        setUserProfile(prof);
      }

      // Recharger les voyages (avec pays + auteur complets) seulement si pas déjà chargés
      const { data } = await supabase
        .from('trips')
        .select(`*, author:profiles!author_id(username), countries(name, flag_emoji)`)
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      if (data) { setTrips(data); setFiltered(data); }
      setLoading(false);
    };
    fetchData();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let result = trips;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.country?.toLowerCase().includes(q) ||
        t.countries?.name?.toLowerCase().includes(q)
      );
    }
    if (activeCat) {
      result = result.filter(t => t.category === activeCat);
    }
    setFiltered(result);
  }, [search, activeCat, trips]);

  const scrollCards = (dir: number) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 360, behavior: 'smooth' });
  };

  if (!isMounted) return null;

  // Hero trip = first published trip with cover image
  const heroTrip = trips.find(t => t.cover_image);
  const featuredTrips = trips.slice(0, 6);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --cream: #f5f0e8;
          --ink: #0d0d0d;
          --forest: #1e3a2f;
          --gold: #c9a84c;
          --rust: #c4622d;
          --sand: #e8dcc8;
          --font-display: 'Bebas Neue', sans-serif;
          --font-serif: 'Fraunces', Georgia, serif;
          --font-sans: 'DM Sans', system-ui, sans-serif;
        }

        @keyframes shimmerDark {
          0% { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        @keyframes heroReveal {
          from { opacity: 0; transform: scale(1.04); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50%       { transform: scale(1.15); opacity: 1; }
        }

        .hero-img { animation: heroReveal 1.6s cubic-bezier(0.22,1,0.36,1) both; }
        .hero-title { animation: slideUp 1s cubic-bezier(0.22,1,0.36,1) 0.3s both; }
        .hero-sub   { animation: slideUp 1s cubic-bezier(0.22,1,0.36,1) 0.5s both; }
        .hero-cta   { animation: slideUp 1s cubic-bezier(0.22,1,0.36,1) 0.7s both; }
        .hero-scroll{ animation: pulse 2s ease-in-out 1.5s infinite; }

        /* Hero section responsive */
        .hero-section {
          position: relative;
          height: 100vh;
          min-height: 600px;
          overflow: hidden;
          background: #0a0f0a;
        }
        @media (max-width: 768px) {
          .hero-section {
            height: 100vh;
            min-height: 500px;
          }
        }

        /* Contenu hero responsive */
        .hero-content {
          position: absolute;
          inset: 0;
          z-index: 20;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          padding-top: clamp(5rem, 12vh, 9rem); /* espace pour la nav + respiration */
          padding: clamp(2rem, 6vw, 6rem);
          padding-top: 2rem;
        }
        @media (max-width: 768px) {
          .hero-content {

            padding-left: 1.5rem;
            padding-right: 1.5rem;
          }
        }

        /* Bouton profil responsive */
        .hero-profile-btn {
          position: fixed;
          top: calc(64px + 1.25rem);
          right: 1.5rem;
          z-index: 100;
        }
        @media (max-width: 768px) {
          .hero-profile-btn {
            top: calc(56px + 0.75rem);
            right: 1rem;
          }
        }

        .trip-card-cinema {
          position: relative;
          overflow: hidden;
          cursor: pointer;
          background: var(--ink);
          flex-shrink: 0;
        }
        .trip-card-cinema img {
          width: 100%; height: 100%;
          object-fit: cover;
          transition: transform 0.8s cubic-bezier(0.22,1,0.36,1);
          display: block;
        }
        .trip-card-cinema:hover img { transform: scale(1.08); }
        .trip-card-cinema .overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%, transparent 100%);
          transition: opacity 0.4s;
        }
        .trip-card-cinema:hover .overlay { opacity: 0.7; }

        .cat-pill {
          padding: 0.45rem 1.2rem;
          border: 1px solid rgba(255,255,255,0.2);
          background: transparent;
          color: rgba(255,255,255,0.6);
          font-family: var(--font-sans);
          font-size: 0.75rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.25s;
          white-space: nowrap;
          border-radius: 0;
        }
        .cat-pill:hover { border-color: var(--gold); color: var(--gold); }
        .cat-pill.active { background: var(--gold); border-color: var(--gold); color: var(--ink); }

        .search-cinema {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          color: white;
          padding: 0.9rem 1.25rem 0.9rem 3rem;
          font-family: var(--font-sans);
          font-size: 0.9rem;
          outline: none;
          width: 320px;
          transition: border-color 0.3s, background 0.3s;
        }
        .search-cinema:focus { border-color: var(--gold); background: rgba(255,255,255,0.1); }
        .search-cinema::placeholder { color: rgba(255,255,255,0.35); }

        .marquee-track { display: flex; gap: 3rem; animation: marquee 25s linear infinite; width: max-content; }
        .marquee-track:hover { animation-play-state: paused; }

        .grid-card {
          position: relative; overflow: hidden; cursor: pointer;
          background: #111;
        }
        .grid-card img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.7s cubic-bezier(0.22,1,0.36,1); }
        .grid-card:hover img { transform: scale(1.06); }
        .grid-card .ov { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%); }

        .scroll-cards::-webkit-scrollbar { display: none; }
        .scroll-cards { scrollbar-width: none; }
      `}</style>

      <div className="page-fullscreen" style={{ background: '#0d0d0d', minHeight: '100vh' }}>

        {/* ══════════════════════════════════════════════════════
            HERO — Full bleed cinematic
        ══════════════════════════════════════════════════════ */}
        <section className="hero-section">
          {/* Slideshow */}
          {HERO_SLIDES.map((slide, i) => (
            <div key={slide.url} style={{
              position: 'absolute', inset: 0,
              opacity: heroSlide === i ? 1 : 0,
              transition: 'opacity 1.8s cubic-bezier(0.4,0,0.2,1)',
              zIndex: heroSlide === i ? 1 : 0,
            }}>
              <img src={slide.url} alt={slide.alt}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: slide.pos || 'center', display: 'block',
                  transform: heroSlide === i ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 8s ease-out',
                }}/>
            </div>
          ))}
          {/* Slide dots */}
          <div style={{ position: 'absolute', bottom: '5rem', right: 'clamp(1.5rem,4vw,4rem)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {HERO_SLIDES.map((_, i) => (
              <button key={i} onClick={() => setHeroSlide(i)}
                style={{ width: 3, height: heroSlide === i ? 28 : 12, background: heroSlide === i ? '#c9a84c' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 2, transition: 'all 0.4s' }}/>
            ))}
          </div>

          {/* Gradient overlays — toujours au-dessus des slides */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)', pointerEvents: 'none' }} />

          {/* Content — toujours au-dessus */}
          <div className="hero-content">

            {/* ── Bouton profil / connexion — coin supérieur droit ── */}
            <div className="hero-profile-btn" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {currentUser && userProfile?.username ? (
                <a href={`/profile/${userProfile.username}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.85rem 0.4rem 0.45rem', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, textDecoration: 'none', backdropFilter: 'blur(8px)', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#c9a84c')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)')}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#1e3a2f,#c9a84c)' }}>
                    {/* Avatar mini */}
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>
                      {userProfile.username.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                    @{userProfile.username}
                  </span>
                </a>
              ) : currentUser ? (
                <a href="/settings"
                  style={{ padding: '0.4rem 0.85rem', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, textDecoration: 'none', fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', transition: 'all 0.2s' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#c9a84c')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}>
                  Configurer mon profil
                </a>
              ) : (
                <a href="/login"
                  style={{ padding: '0.4rem 0.85rem', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, textDecoration: 'none', fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', transition: 'all 0.2s' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#c9a84c')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}>
                  Se connecter
                </a>
              )}
            </div>
            {/* Eyebrow */}
            <p className="hero-sub" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1.5rem' }}>
              — Récits de voyageurs
            </p>

            {/* Giant title */}
            <h1 className="hero-title" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4rem, 12vw, 10rem)', lineHeight: 0.9, color: 'white', marginBottom: '2rem', maxWidth: '700px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Laissez<br/>
              <span style={{ color: 'var(--gold)' }}>l'aventure</span><br/>
              arriver.
            </h1>

            {/* Sub */}
            <p className="hero-sub" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 300, fontSize: 'clamp(1rem, 2vw, 1.35rem)', color: 'rgba(255,255,255,0.75)', maxWidth: 420, lineHeight: 1.65, marginBottom: '3rem' }}>
              Des milliers d'itinéraires vécus, racontés et photographiés par de vrais voyageurs.
            </p>

            {/* CTAs */}
            <div className="hero-cta" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="#explore" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: '1rem 2.25rem', background: 'var(--gold)', color: 'var(--ink)',
                fontFamily: 'var(--font-sans)', fontSize: '0.8rem', fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none',
                transition: 'filter 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.filter = 'brightness(1)'}
              >
                Explorer les récits
              </a>
              <a href="/create" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: '1rem 2.25rem', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.4)', color: 'white',
                fontFamily: 'var(--font-sans)', fontSize: '0.8rem', fontWeight: 500,
                letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
              >
                + Créer le mien
              </a>
            </div>
          </div>

          {/* Stats bottom right */}
          <div style={{ position: 'absolute', bottom: '3rem', right: 'clamp(1.5rem,4vw,4rem)', zIndex: 20, display: 'flex', gap: '2.5rem', animation: 'fadeIn 1s 1s both' }}>
            {[
              { n: `${trips.length}+`, l: 'Récits' },
              { n: '40+', l: 'Pays' },
              { n: '100%', l: 'Authentique' },
            ].map(({ n, l }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--gold)', lineHeight: 1 }}>{n}</p>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{l}</p>
              </div>
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="hero-scroll" style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, transparent, #c9a84c)' }} />
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            MARQUEE — Destinations
        ══════════════════════════════════════════════════════ */}
        <div style={{ background: 'var(--forest)', padding: '1.1rem 0', overflow: 'hidden', borderTop: '1px solid rgba(201,168,76,0.2)', borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
          <div className="marquee-track">
            {['Japon', 'Islande', 'Maroc', 'Thaïlande', 'Pérou', 'Italie', 'Indonésie', 'Portugal', 'Kenya', 'Mexique', 'Japon', 'Islande', 'Maroc', 'Thaïlande', 'Pérou', 'Italie', 'Indonésie', 'Portugal', 'Kenya', 'Mexique'].map((d, i) => (
              <span key={i} style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: i % 2 === 0 ? 'var(--gold)' : 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3rem' }}>
                {d}
                {i < 19 && <span style={{ color: 'var(--gold)', opacity: 0.4 }}>✦</span>}
              </span>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            EXPLORE — Search + Filters + Grid
        ══════════════════════════════════════════════════════ */}
        <section id="explore" style={{ background: '#111', padding: 'clamp(4rem,8vw,7rem) clamp(1.5rem,4vw,4rem)' }}>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '3rem', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.68rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>
                Explorer
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem,6vw,5rem)', textTransform: 'uppercase', color: 'white', lineHeight: 0.95, letterSpacing: '0.02em' }}>
                Choisissez<br/>votre destination
              </h2>
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"
                style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="search-cinema" placeholder="Pays, ville, type de voyage…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
            {CATS.map(c => (
              <button key={c.value} className={`cat-pill${activeCat === c.value ? ' active' : ''}`}
                onClick={() => setActiveCat(c.value)}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {[380, 440, 400, 360, 420, 380].map((h, i) => <SkeletonCard key={i} h={h} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '6rem 2rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Aucun résultat</p>
              <button onClick={() => { setSearch(''); setActiveCat(''); }}
                style={{ marginTop: '1.5rem', padding: '0.75rem 2rem', background: 'var(--gold)', color: 'var(--ink)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Tout voir
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5px' }}>
              {filtered.map((trip, idx) => {
                // Alternate tall/short for editorial feel
                const isFeature = idx % 5 === 0;
                const h = isFeature ? 520 : 360;
                const gridSpan = isFeature ? 'span 2' : 'span 1';
                return (
                  <a key={trip.id} href={`/trip/${trip.slug}`} style={{ textDecoration: 'none', gridColumn: gridSpan }}>
                    <div className="grid-card" style={{ height: h }}>
                      <img
                        src={trip.cover_image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop'}
                        alt={trip.title}
                        loading="lazy"
                      />
                      <div className="ov" />

                      {/* Top badges */}
                      <div style={{ position: 'absolute', top: '1.25rem', left: '1.25rem', display: 'flex', gap: 8 }}>
                        {trip.category && (
                          <span style={{ background: 'var(--forest)', color: 'var(--gold)', fontFamily: 'var(--font-sans)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.3rem 0.75rem' }}>
                            {trip.category}
                          </span>
                        )}
                        {trip.duration_days && (
                          <span style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', color: 'white', fontFamily: 'var(--font-sans)', fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.1em', padding: '0.3rem 0.75rem' }}>
                            {trip.duration_days}j
                          </span>
                        )}
                      </div>

                      {/* Bottom content */}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.75rem 1.5rem 1.5rem' }}>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.5rem' }}>
                          {trip.country || trip.countries?.name || 'Voyage'}
                          {trip.city ? ` · ${trip.city}` : ''}
                        </p>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: isFeature ? '1.75rem' : '1.2rem', fontWeight: 300, color: 'white', lineHeight: 1.2, marginBottom: '1rem' }}>
                          {trip.title}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #1e3a2f, #c9a84c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'white', textTransform: 'uppercase' }}>
                              {trip.author?.username?.charAt(0) || 'V'}
                            </div>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                              {trip.author?.username || 'Voyageur'}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.7rem', color: 'var(--gold)', letterSpacing: '0.06em' }}>
                            Lire →
                          </span>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════
            PHILOSOPHY STRIP — Aksari-style alternating
        ══════════════════════════════════════════════════════ */}
        <section style={{ background: 'var(--cream)' }}>

          {/* Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 480 }}>
            <div style={{ background: 'var(--forest)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(3rem,6vw,6rem)' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.68rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1.5rem' }}>Notre vision</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 300, fontSize: 'clamp(1.75rem,4vw,3rem)', color: 'white', lineHeight: 1.2, marginBottom: '1.5rem' }}>
                Votre voyage<br/>est notre récit.
              </h2>
              <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, maxWidth: 380 }}>
                Odyssey est une bibliothèque vivante alimentée par des voyageurs passionnés. Chaque récit est une carte, une invitation, une promesse d'ailleurs.
              </p>
              <div style={{ marginTop: '2.5rem', height: 1, width: 60, background: 'var(--gold)' }} />
            </div>
            <div style={{ overflow: 'hidden', background: '#0a0f0a' }}>
              <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&auto=format&fit=crop"
                alt="Montagne" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 8s ease-out', display: 'block' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
            </div>
          </div>

          {/* Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 480 }}>
            <div style={{ overflow: 'hidden', background: '#0a0f0a' }}>
              <img src="https://images.unsplash.com/photo-1499678329028-101435549a4e?w=900&auto=format&fit=crop"
                alt="Plage" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 8s ease-out', display: 'block' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
            </div>
            <div style={{ background: 'var(--cream)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(3rem,6vw,6rem)' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.68rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--rust)', marginBottom: '1.5rem' }}>Comment ça marche</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 'clamp(1.75rem,4vw,3rem)', color: 'var(--ink)', lineHeight: 1.2, marginBottom: '2rem' }}>
                Se ressourcer,<br/>partager, inspirer.
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {[
                  { n: '01', t: 'Vivez le voyage', d: 'Partez, explorez, découvrez.' },
                  { n: '02', t: 'Racontez-le', d: 'Créez votre récit avec photos, hôtels, restos.' },
                  { n: '03', t: 'Inspirez les autres', d: 'Votre récit devient une carte pour le prochain voyageur.' },
                ].map(({ n, t, d }) => (
                  <div key={n} style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--gold)', lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{n}</span>
                    <div>
                      <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)', marginBottom: 3 }}>{t}</p>
                      <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '0.85rem', color: '#777', lineHeight: 1.6 }}>{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            HORIZONTAL SCROLL — Featured trips
        ══════════════════════════════════════════════════════ */}
        {featuredTrips.length > 0 && (
          <section style={{ background: '#0a0a0a', padding: 'clamp(4rem,7vw,6rem) 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 clamp(1.5rem,4vw,4rem)', marginBottom: '2.5rem' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.68rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.6rem' }}>À la une</p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,5vw,4rem)', textTransform: 'uppercase', color: 'white', lineHeight: 1, letterSpacing: '0.02em' }}>Récents & populaires</h2>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ dir: -1, icon: '←' }, { dir: 1, icon: '→' }].map(({ dir, icon }) => (
                  <button key={dir} onClick={() => scrollCards(dir)}
                    style={{ width: 44, height: 44, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'monospace', fontSize: '1.1rem', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                  >{icon}</button>
                ))}
              </div>
            </div>

            <div ref={scrollRef} className="scroll-cards" style={{ display: 'flex', gap: '1.5px', overflowX: 'auto', paddingLeft: 'clamp(1.5rem,4vw,4rem)' }}>
              {featuredTrips.map(trip => (
                <a key={trip.id} href={`/trip/${trip.slug}`} style={{ textDecoration: 'none' }}>
                  <div className="trip-card-cinema" style={{ width: 320, height: 440 }}>
                    <img src={trip.cover_image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop'} alt={trip.title} loading="lazy" />
                    <div className="overlay" />
                    <div style={{ position: 'absolute', top: '1rem', left: '1rem' }}>
                      {trip.category && (
                        <span style={{ background: 'var(--gold)', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.25rem 0.7rem' }}>{trip.category}</span>
                      )}
                    </div>
                    <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.25rem', right: '1.25rem' }}>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.5rem' }}>
                        {trip.country || trip.countries?.name || ''}
                      </p>
                      <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 300, color: 'white', lineHeight: 1.25 }}>{trip.title}</p>
                    </div>
                  </div>
                </a>
              ))}
              <div style={{ flexShrink: 0, width: 'clamp(1.5rem,4vw,4rem)' }} />
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════
            CTA BANNER
        ══════════════════════════════════════════════════════ */}
        <section style={{ position: 'relative', overflow: 'hidden', minHeight: 400, display: 'flex', alignItems: 'center', background: 'var(--forest)' }}>
          <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1400&auto=format&fit=crop"
            alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25 }} />
          <div style={{ position: 'relative', zIndex: 1, width: '100%', textAlign: 'center', padding: 'clamp(3rem,6vw,5rem) 2rem' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1.25rem' }}>
              Votre aventure mérite d'être racontée
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem,7vw,6rem)', textTransform: 'uppercase', color: 'white', lineHeight: 0.95, letterSpacing: '0.02em', marginBottom: '2.5rem' }}>
              Inspirez le prochain<br/>
              <span style={{ color: 'var(--gold)' }}>voyageur.</span>
            </h2>
            <a href="/create" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
              padding: '1.1rem 3rem', background: 'var(--gold)', color: 'var(--ink)',
              fontFamily: 'var(--font-sans)', fontSize: '0.82rem', fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none',
              transition: 'filter 0.2s, transform 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Créer mon récit
            </a>
          </div>
        </section>

      </div>
    </>
  );
}