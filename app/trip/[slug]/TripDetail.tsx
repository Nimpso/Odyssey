// app/trip/[slug]/TripDetail.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useParams } from 'next/navigation';

// ─── Optimise les URLs pour la meilleure qualité ──────────────────────────────
function optimizeImageUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname === 'images.unsplash.com') {
      u.searchParams.set('w', '2400'); u.searchParams.set('q', '95'); u.searchParams.set('fm', 'jpg');
      u.searchParams.delete('fit'); u.searchParams.delete('crop');
      return u.toString();
    }
    if (u.hostname.includes('pexels.com')) {
      u.searchParams.set('auto', 'compress'); u.searchParams.set('cs', 'tinysrgb'); u.searchParams.set('w', '2400');
      return u.toString();
    }
    if (u.hostname.includes('pixabay.com')) return url.replace(/_\d+\./, '_1920.');
    if (u.hostname.includes('wikimedia.org') || u.hostname.includes('wikipedia.org'))
      return url.replace(/\/thumb\//, '/').replace(/\/\d+px-[^/]+$/, '');
    if (u.hostname.includes('googleusercontent.com') || u.hostname.includes('ggpht.com'))
      return url.replace(/=w\d+-h\d+(-[a-z]+)?/, '=d').replace(/=s\d+/, '=d');
  } catch {}
  return url;
}

// Raccourci pour les balises img avec optimisation qualité
const Img = ({ src, alt, style }: { src: string; alt?: string; style?: React.CSSProperties }) => (
  <img src={optimizeImageUrl(src)} alt={alt || ''} style={style} loading="lazy" decoding="async" />
);

// ─── Types ────────────────────────────────────────────────────────────────────
type FontStyle = 'serif' | 'display' | 'sans';

interface CanvasBlock {
  id?: string;
  type: string;
  data: any;
  x: number; y: number; w: number; h: number;
  font: FontStyle;
  bg: string;
  textColor: string;
  fontSize: number;
  zIndex: number;
}

interface LegacyBlock {
  id?: string;
  type: string;
  data: any;
  width?: 'full' | 'half' | 'third';
  bg?: { type: string; color: string; gradient: string };
  font?: FontStyle;
  padding?: 'sm' | 'md' | 'lg';
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FONT_MAP: Record<FontStyle, string> = {
  serif:   "'Fraunces', Georgia, serif",
  display: "'Bebas Neue', sans-serif",
  sans:    "'DM Sans', system-ui, sans-serif",
};
const PAD_MAP = { sm: '1.5rem', md: '3rem', lg: '5rem' };
const CATS: Record<string, string> = {
  aventure:'🏔️ Aventure', plage:'🏖️ Plage', culture:'🏛️ Culture',
  gastronomie:'🍷 Gastronomie', nature:'🌿 Nature', 'road-trip':'🚗 Road Trip',
  citytrip:'🌆 City Trip', backpack:'🎒 Backpack', luxe:'✨ Luxe', famille:'👨‍👩‍👧 Famille',
};

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS RENDERER — blocs positionnés librement
// ─────────────────────────────────────────────────────────────────────────────
function CanvasRenderer({ blocks, height }: { blocks: CanvasBlock[]; height: number }) {
  const sorted = [...blocks].sort((a, b) => a.zIndex - b.zIndex);

  const renderContent = (block: CanvasBlock) => {
    const d = block.data;
    const font = FONT_MAP[block.font] || FONT_MAP.sans;
    const color = block.textColor || '#0d0d0d';

    switch (block.type) {
      case 'text':
        return (
          <div style={{ width: '100%', height: '100%', padding: '0.5rem', overflow: 'hidden' }}>
            <div style={{ fontFamily: font, fontSize: `${block.fontSize || 1}rem`, color, lineHeight: 1.7, wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ __html: d.html || '' }} />
          </div>
        );

      case 'quote':
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1.5rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: '1rem', fontFamily: "'Fraunces',serif", fontSize: '5rem', color: 'rgba(201,168,76,0.2)', lineHeight: 1, pointerEvents: 'none' }}>"</div>
            <p style={{ fontFamily: font, fontSize: `${block.fontSize || 1.2}rem`, fontStyle: 'italic', color, lineHeight: 1.6, zIndex: 1, position: 'relative', marginBottom: d.author ? '0.75rem' : 0 }}>
              {d.text}
            </p>
            {d.author && <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.8rem', color: '#c9a84c', letterSpacing: '0.1em' }}>— {d.author}</p>}
          </div>
        );

      case 'photo':
        return d.url ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Img src={d.url} alt={d.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {d.caption && (
              <p style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.4rem 0.75rem', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '0.72rem', fontStyle: 'italic', fontFamily: FONT_MAP.sans }}>
                {d.caption}
              </p>
            )}
          </div>
        ) : null;

      case 'gallery': {
        const images: string[] = d.images || [];
        if (images.length === 0) return null;
        if (d.layout === 'mosaic' && images.length >= 2) {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 3, width: '100%', height: '100%' }}>
              <Img src={images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ display: 'grid', gap: 3 }}>
                {images.slice(1, 4).map((img, i) => (
                  <Img key={i} src={img} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ))}
              </div>
            </div>
          );
        }
        const cols = Math.min(images.length, 3);
        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 3, width: '100%', height: '100%' }}>
            {images.map((img, i) => <Img key={i} src={img} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />)}
          </div>
        );
      }

      case 'hotel':
        return (
          <div style={{ padding: '1.25rem', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c9a84c' }}>🏨 Hébergement</p>
            <p style={{ fontFamily: FONT_MAP.serif, fontSize: `${block.fontSize || 1.4}rem`, color, lineHeight: 1.2 }}>{d.name}</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {d.price && <span style={{ fontFamily: FONT_MAP.sans, fontSize: '0.82rem', color: '#888' }}>{d.price} / nuit</span>}
              {d.rating && <span style={{ color: '#c9a84c', fontSize: 13 }}>{'★'.repeat(Number(d.rating))}{'☆'.repeat(5 - Number(d.rating))}</span>}
            </div>
            {d.review && <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.86rem', color, lineHeight: 1.65, opacity: 0.8 }}>{d.review}</p>}
            {d.link && (
              <a href={d.link} target="_blank" rel="noopener noreferrer"
                style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.4rem 1rem', background: '#c9a84c', color: '#0d0d0d', fontFamily: FONT_MAP.sans, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', alignSelf: 'flex-start' }}>
                Réserver →
              </a>
            )}
          </div>
        );

      case 'restaurant':
        return (
          <div style={{ padding: '1.25rem', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '4px solid #e88c4a' }}>
            <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#e88c4a' }}>🍽️ Restaurant</p>
            <p style={{ fontFamily: FONT_MAP.serif, fontSize: `${block.fontSize || 1.4}rem`, color, lineHeight: 1.2 }}>{d.name}</p>
            {(d.cuisine || d.price) && <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.82rem', color: '#888' }}>{[d.cuisine, d.price].filter(Boolean).join(' · ')}</p>}
            {d.rating && <span style={{ color: '#e88c4a', fontSize: 13 }}>{'★'.repeat(Number(d.rating))}{'☆'.repeat(5 - Number(d.rating))}</span>}
            {d.review && <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.86rem', color, lineHeight: 1.65, opacity: 0.8 }}>{d.review}</p>}
            {d.link && <a href={d.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FONT_MAP.sans, fontSize: '0.75rem', color: '#e88c4a', marginTop: 'auto' }}>Voir sur Maps →</a>}
          </div>
        );

      case 'pros_cons':
        return (
          <div style={{ padding: '1.25rem', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', overflow: 'hidden' }}>
            <div>
              <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4caf7d', marginBottom: 10 }}>✅ Pour</p>
              {(d.pros || []).filter(Boolean).map((p: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: '#4caf7d', flexShrink: 0, marginTop: 2 }}>✓</span>
                  <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.88rem', color, lineHeight: 1.55 }}>{p}</p>
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e05555', marginBottom: 10 }}>❌ Contre</p>
              {(d.cons || []).filter(Boolean).map((c: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: '#e05555', flexShrink: 0, marginTop: 2 }}>✗</span>
                  <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.88rem', color, lineHeight: 1.55 }}>{c}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'divider':
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
            {d.style === 'dots' ? (
              <div style={{ width: '100%', textAlign: 'center', letterSpacing: '0.5em', color: '#c9a84c', fontSize: '1rem' }}>· · · · ·</div>
            ) : d.style === 'wave' ? (
              <svg viewBox="0 0 100 10" style={{ width: '100%', height: 20 }}>
                <path d="M0,5 Q25,0 50,5 T100,5" fill="none" stroke="#c9a84c" strokeWidth="0.6" />
              </svg>
            ) : (
              <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg,transparent,#c9a84c,transparent)' }} />
            )}
          </div>
        );

      case 'spacer':
        return null;

      default:
        return null;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 1200, margin: '0 auto', height, background: '#faf8f4' }}>
      {sorted.map((block, i) => (
        <div key={block.id || i} style={{
          position: 'absolute',
          left: block.x, top: block.y,
          width: block.w, height: block.h,
          zIndex: block.zIndex,
          background: block.bg || 'transparent',
          color: block.textColor || '#0d0d0d',
          overflow: 'hidden',
        }}>
          {renderContent(block)}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY RENDERER — ancien format de blocs
// ─────────────────────────────────────────────────────────────────────────────
function LegacyRenderer({ blocks }: { blocks: LegacyBlock[] }) {
  const renderBlock = (block: LegacyBlock, index: number) => {
    const font = block.font || 'sans';
    const padding = block.padding || 'md';
    const width = block.width || 'full';
    const bg = block.bg;
    const d = block.data;

    const bgStyle = !bg ? {} :
      bg.type === 'color' ? { background: bg.color } :
      bg.type === 'gradient' ? { background: bg.gradient } : {};

    const isDark = bg?.color === '#0d0d0d' || bg?.color === '#1e3a2f' || bg?.color === '#1a1a2e' ||
      bg?.gradient?.includes('#0d0d0d') || bg?.gradient?.includes('#1e3a2f');
    const textColor = isDark ? 'white' : '#1a1a1a';

    const wMap = { full: '100%', half: '50%', third: '33.333%' };

    const containerStyle: React.CSSProperties = {
      width: wMap[width] || '100%',
      display: 'inline-block', verticalAlign: 'top',
      boxSizing: 'border-box',
      ...bgStyle,
    };

    const renderContent = () => {
      switch (block.type) {
        case 'text':
          return (
            <div style={{ padding: PAD_MAP[padding] }}>
              <div style={{ fontFamily: FONT_MAP[font], fontSize: '1.05rem', lineHeight: 1.8, color: textColor }}
                dangerouslySetInnerHTML={{ __html: d.html || '' }} />
            </div>
          );
        case 'photo':
          return d.url ? (
            <div style={{ position: 'relative' }}>
              <Img src={d.url} alt={d.caption || ''} style={{ width: '100%', height: width === 'full' ? 560 : 380, objectFit: 'cover', display: 'block' }} />
              {d.caption && <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.78rem', color: '#999', textAlign: 'center', padding: '0.75rem', fontStyle: 'italic' }}>{d.caption}</p>}
            </div>
          ) : null;
        case 'gallery': {
          const images: string[] = d.images || [];
          if (!images.length) return null;
          const cols = Math.min(images.length, 3);
          return (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 3 }}>
              {images.map((img, i) => <Img key={i} src={img} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />)}
            </div>
          );
        }
        case 'quote':
          return (
            <div style={{ padding: PAD_MAP[padding], position: 'relative' }}>
              <div style={{ position: 'absolute', top: PAD_MAP[padding], left: '2.5rem', fontFamily: "'Fraunces',serif", fontSize: '6rem', color: 'rgba(201,168,76,0.2)', lineHeight: 1 }}>"</div>
              <blockquote style={{ margin: 0, position: 'relative', zIndex: 1 }}>
                <p style={{ fontFamily: FONT_MAP[font], fontSize: 'clamp(1.25rem,3vw,1.75rem)', fontStyle: 'italic', fontWeight: 300, lineHeight: 1.5, color: textColor, marginBottom: d.author ? '1rem' : 0 }}>{d.text}</p>
                {d.author && <cite style={{ fontFamily: FONT_MAP.sans, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c9a84c', fontStyle: 'normal' }}>— {d.author}</cite>}
              </blockquote>
            </div>
          );
        case 'hotel':
          return (
            <div style={{ padding: PAD_MAP[padding] }}>
              <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c9a84c', marginBottom: '0.5rem' }}>🏨 Hébergement</p>
              <p style={{ fontFamily: FONT_MAP.serif, fontSize: '1.5rem', color: textColor, marginBottom: '0.5rem' }}>{d.name}</p>
              <div style={{ display: 'flex', gap: 12, marginBottom: '0.75rem' }}>
                {d.price && <span style={{ fontFamily: FONT_MAP.sans, fontSize: '0.82rem', color: '#888' }}>{d.price} / nuit</span>}
                {d.rating && <span style={{ color: '#c9a84c', fontSize: 13 }}>{'★'.repeat(Number(d.rating))}{'☆'.repeat(5 - Number(d.rating))}</span>}
              </div>
              {d.review && <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.88rem', color: isDark ? 'rgba(255,255,255,0.75)' : '#666', lineHeight: 1.7 }}>{d.review}</p>}
              {d.link && <a href={d.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', marginTop: '1rem', padding: '0.45rem 1rem', background: '#c9a84c', color: '#0d0d0d', fontFamily: FONT_MAP.sans, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>Réserver →</a>}
            </div>
          );
        case 'restaurant':
          return (
            <div style={{ padding: PAD_MAP[padding], borderLeft: '4px solid #e88c4a' }}>
              <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#e88c4a', marginBottom: '0.5rem' }}>🍽️ Restaurant</p>
              <p style={{ fontFamily: FONT_MAP.serif, fontSize: '1.4rem', color: textColor, marginBottom: '0.4rem' }}>{d.name}</p>
              {(d.cuisine || d.price) && <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.82rem', color: '#888', marginBottom: '0.35rem' }}>{[d.cuisine, d.price].filter(Boolean).join(' · ')}</p>}
              {d.rating && <p style={{ color: '#e88c4a', fontSize: 13, marginBottom: '0.75rem' }}>{'★'.repeat(Number(d.rating))}{'☆'.repeat(5 - Number(d.rating))}</p>}
              {d.review && <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.88rem', color: isDark ? 'rgba(255,255,255,0.75)' : '#666', lineHeight: 1.7 }}>{d.review}</p>}
              {d.link && <a href={d.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FONT_MAP.sans, fontSize: '0.75rem', color: '#e88c4a', display: 'inline-block', marginTop: 8 }}>Voir sur Maps →</a>}
            </div>
          );
        case 'pros_cons':
          return (
            <div style={{ padding: PAD_MAP[padding] }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2d7a72', marginBottom: '1rem' }}>✅ Points forts</p>
                  {(d.pros || []).filter(Boolean).map((p: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span style={{ color: '#2d7a72', flexShrink: 0 }}>✓</span>
                      <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.92rem', color: textColor, lineHeight: 1.6 }}>{p}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#b55435', marginBottom: '1rem' }}>❌ Points faibles</p>
                  {(d.cons || []).filter(Boolean).map((c: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span style={{ color: '#b55435', flexShrink: 0 }}>✗</span>
                      <p style={{ fontFamily: FONT_MAP.sans, fontSize: '0.92rem', color: textColor, lineHeight: 1.6 }}>{c}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        case 'divider':
          return (
            <div style={{ padding: `${PAD_MAP[padding]} 3rem` }}>
              {d.style === 'dots' ? (
                <div style={{ textAlign: 'center', letterSpacing: '0.5em', color: '#c9a84c' }}>· · · · ·</div>
              ) : d.style === 'wave' ? (
                <svg viewBox="0 0 100 10" style={{ width: '100%', height: 20 }}>
                  <path d="M0,5 Q25,0 50,5 T100,5" fill="none" stroke="#c9a84c" strokeWidth="0.6" />
                </svg>
              ) : (
                <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#c9a84c,transparent)' }} />
              )}
            </div>
          );
        default: return null;
      }
    };

    return <div key={block.id || index} style={containerStyle}>{renderContent()}</div>;
  };

  return (
    <article style={{ background: '#faf8f4' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {blocks.map((block, i) => renderBlock(block, i))}
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function TripDetail() {
  const supabase = createClientComponentClient();
  const params = useParams();
  const slug = params?.slug as string;
  const [trip, setTrip] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!slug) return;
    const fetchTrip = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data, error } = await supabase
        .from('trips')
        .select('*, profiles!author_id(username, avatar_url, avatar_id)')
        .eq('slug', slug)
        .single();
      if (data) {
        setTrip(data);
        // ⚠️ Lire le vrai COUNT depuis la table likes — pas la colonne dénormalisée
        // qui peut être désynchronisée si le trigger n'a pas tourné
        const { count: realCount } = await supabase
          .from('likes').select('*', { count: 'exact', head: true }).eq('trip_id', data.id);
        setLikesCount(realCount || 0);
        // Check si l'utilisateur courant a liké
        if (user) {
          const { data: likeData } = await supabase
            .from('likes').select('id').eq('user_id', user.id).eq('trip_id', data.id).maybeSingle();
          setLiked(!!likeData);
        }
      } else {
        console.error('Erreur chargement récit:', error?.message);
        setNotFound(true);
      }
    };
    fetchTrip();
  }, [slug]);

  const toggleLike = async () => {
    if (!currentUser || !trip || likeLoading) return;
    setLikeLoading(true);
    if (liked) {
      await supabase.from('likes').delete().eq('user_id', currentUser.id).eq('trip_id', trip.id);
      setLiked(false); setLikesCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('likes').insert({ user_id: currentUser.id, trip_id: trip.id });
      setLiked(true); setLikesCount(c => c + 1);
    }
    setLikeLoading(false);
  };

  // ── Export image ──
  const exportImage = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(contentRef.current, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: '#faf8f4', logging: false,
        width: contentRef.current.scrollWidth,
        height: contentRef.current.scrollHeight,
      });
      const link = document.createElement('a');
      link.download = `odyssey-${trip?.slug || 'voyage'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Export error:', e);
      alert("Erreur lors de l'export. Vérifiez que les images sont en CORS.");
    }
    setExporting(false);
  };

  // ── Share ──
  const shareTrip = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: trip?.title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  // ── Guard anti-hydratation ──
  if (!isMounted) return null;

  // ── Loading ──
  if (notFound) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', gap: 16 }}>
        <p style={{ fontFamily: "'Fraunces',serif", fontSize: '2rem', color: '#555', fontWeight: 300 }}>Récit introuvable</p>
        <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', color: '#444' }}>Ce lien est invalide ou le récit a été supprimé.</p>
        <a href="/" style={{ marginTop: 8, padding: '0.6rem 1.5rem', background: '#c9a84c', color: '#0d0d0d', fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          ← Retour à l'accueil
        </a>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!trip) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', gap: 16 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #1e1e1e', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', color: '#555', letterSpacing: '0.1em' }}>Chargement du récit…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const isCanvas = trip.canvas === true;
  const blocks = Array.isArray(trip.content) ? trip.content : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        .fab:hover{transform:translateY(-2px) scale(1.05)!important;box-shadow:0 8px 24px rgba(0,0,0,0.35)!important}
        .fab{transition:all 0.2s!important}
      `}</style>

      <main style={{ background: '#faf8f4', minHeight: '100vh' }}>

        {/* ── Floating action buttons ── */}
        <div style={{ position: 'fixed', top: 80, right: '1.5rem', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Like button — principal CTA */}
          <button className="fab" onClick={toggleLike} disabled={likeLoading}
            title={currentUser ? (liked ? 'Retirer des favoris' : 'Ajouter aux favoris') : 'Connectez-vous pour liker'}
            style={{ width: 48, height: 48, background: liked ? '#c9a84c' : '#0d0d0d', color: liked ? '#0d0d0d' : 'white', border: `1px solid ${liked ? '#c9a84c' : '#2a2a2a'}`, cursor: likeLoading ? 'wait' : 'pointer', display: 'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center', gap:1, boxShadow: liked ? '0 4px 20px rgba(201,168,76,0.4)' : '0 4px 20px rgba(0,0,0,0.25)', borderRadius: 2, transition:'all 0.2s' }}>
            <span style={{ fontSize: 18, lineHeight:1, transition:'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)', transform: liked ? 'scale(1.2)' : 'scale(1)', display:'block' }}>{liked ? '♥' : '♡'}</span>
            {likesCount > 0 && <span style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.55rem', fontWeight:700, lineHeight:1 }}>{likesCount}</span>}
          </button>
          <button className="fab" onClick={shareTrip}
            style={{ width: 48, height: 48, background: '#0d0d0d', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', borderRadius: 2 }}
            title="Partager">🔗</button>
          <button className="fab" onClick={exportImage} disabled={exporting}
            style={{ width: 48, height: 48, background: '#c9a84c', color: '#0d0d0d', border: 'none', cursor: exporting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 20px rgba(201,168,76,0.35)', borderRadius: 2 }}
            title="Exporter en image">
            {exporting ? (
              <div style={{ width: 20, height: 20, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0d0d0d', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : '⬇️'}
          </button>
          <a href="/" className="fab"
            style={{ width: 48, height: 48, background: 'white', border: '1px solid #e6dfd3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, textDecoration: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', borderRadius: 2 }}
            title="Retour">←</a>
        </div>

        {/* ── Toast ── */}
        {shareToast && (
          <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: '#0d0d0d', color: 'white', padding: '0.75rem 1.75rem', fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', letterSpacing: '0.06em', zIndex: 200, animation: 'toastIn 0.3s ease', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', borderRadius: 2 }}>
            ✓ Lien copié dans le presse-papier
          </div>
        )}

        {/* ══ EXPORTABLE ZONE ══ */}
        <div ref={contentRef}>

          {/* ── Hero cover ── */}
          <header style={{ position: 'relative', height: '88vh', minHeight: 500, overflow: 'hidden', background: '#0a0a0a' }}>
            <img
              src={optimizeImageUrl(trip.cover_image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=2400')}
              alt={trip.title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Gradient layers */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(5,5,8,0.95) 0%, rgba(5,5,8,0.3) 55%, rgba(5,5,8,0.1) 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(5,5,8,0.55) 0%, transparent 65%)' }} />

            {/* Content */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 'clamp(2rem,5vw,5rem)', maxWidth: 960 }}>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap', animation: 'fadeInUp 0.8s 0.2s both' }}>
                {trip.category && (
                  <span style={{ background: '#c9a84c', color: '#0d0d0d', fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '0.3rem 0.85rem' }}>
                    {CATS[trip.category] || trip.category}
                  </span>
                )}
                {(trip.city || trip.country) && (
                  <span style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', color: 'white', fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.1em', padding: '0.3rem 0.85rem' }}>
                    📍 {[trip.city, trip.country].filter(Boolean).join(', ')}
                  </span>
                )}
                {trip.duration_days && (
                  <span style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', color: 'white', fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.1em', padding: '0.3rem 0.85rem' }}>
                    🗓 {trip.duration_days} jours
                  </span>
                )}
                {trip.season && (
                  <span style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', color: 'white', fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.1em', padding: '0.3rem 0.85rem' }}>
                    {trip.season}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 'clamp(2.5rem,7vw,5.5rem)', fontWeight: 300, color: 'white', lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '1.25rem', textShadow: '0 2px 30px rgba(0,0,0,0.4)', animation: 'fadeInUp 0.8s 0.4s both' }}>
                {trip.title}
              </h1>

              {trip.subtitle && (
                <p style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 300, fontSize: 'clamp(1rem,2.5vw,1.4rem)', color: 'rgba(255,255,255,0.7)', maxWidth: 560, lineHeight: 1.6, marginBottom: '2rem', animation: 'fadeInUp 0.8s 0.5s both' }}>
                  {trip.subtitle}
                </p>
              )}

              {/* Author strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeInUp 0.8s 0.6s both', flexWrap:'wrap' }}>
                <a href={trip.profiles?.username ? `/profile/${trip.profiles.username}` : '#'}
                  style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', overflow:'hidden', background: 'linear-gradient(135deg,#1e3a2f,#c9a84c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, color: 'white', textTransform: 'uppercase', flexShrink: 0, border: '2px solid rgba(255,255,255,0.2)', transition:'transform 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.transform='scale(1.05)')} onMouseLeave={e => (e.currentTarget.style.transform='scale(1)')}>
                    {trip.profiles?.avatar_url
                      ? <img src={trip.profiles.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : (trip.profiles?.username?.charAt(0) || 'V')
                    }
                  </div>
                  <div>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', marginBottom: 2 }}>Récit de</p>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.9rem', fontWeight: 500, color: 'white' }}>@{trip.profiles?.username || 'voyageur'}</p>
                  </div>
                </a>
                {trip.budget && (
                  <>
                    <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.12)', margin: '0 0.35rem' }} />
                    <div>
                      <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Budget</p>
                      <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.88rem', fontWeight: 500, color: 'white' }}>{trip.budget}</p>
                    </div>
                  </>
                )}
                {trip.travelers > 1 && (
                  <>
                    <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.12)', margin: '0 0.35rem' }} />
                    <div>
                      <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Voyageurs</p>
                      <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.88rem', fontWeight: 500, color: 'white' }}>{trip.travelers} personnes</p>
                    </div>
                  </>
                )}
                {/* Likes count inline */}
                {likesCount > 0 && (
                  <>
                    <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.12)', margin: '0 0.35rem' }} />
                    <div>
                      <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Favoris</p>
                      <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.88rem', fontWeight: 500, color: liked ? '#c9a84c' : 'white' }}>♥ {likesCount}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Watermark */}
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontFamily: "'Fraunces',serif", fontSize: '1rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Odyssey
            </div>
          </header>

          {/* ── Content ── */}
          {blocks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#bbb' }}>
              <p style={{ fontFamily: "'Fraunces',serif", fontSize: '1.5rem', color: '#ccc', marginBottom: '0.5rem' }}>Récit en cours de rédaction</p>
              <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem' }}>Le voyageur n'a pas encore ajouté de contenu.</p>
            </div>
          ) : isCanvas ? (
            <CanvasRenderer blocks={blocks as CanvasBlock[]} height={trip.canvas_height || 1600} />
          ) : (
            <LegacyRenderer blocks={blocks as LegacyBlock[]} />
          )}

          {/* ── Footer signature ── */}
          <div style={{ background: '#0d0d0d', padding: '3rem clamp(1.5rem,5vw,4rem)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <p style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontSize: '0.95rem', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Partagé sur</p>
              <p style={{ fontFamily: "'Fraunces',serif", fontSize: '2rem', fontWeight: 300, color: 'white', letterSpacing: '0.05em' }}>Odyssey</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={shareTrip}
                style={{ padding: '0.7rem 1.5rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 2, transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#c9a84c')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}>
                🔗 Partager
              </button>
              <button onClick={exportImage} disabled={exporting}
                style={{ padding: '0.7rem 1.75rem', background: '#c9a84c', border: 'none', color: '#0d0d0d', cursor: exporting ? 'wait' : 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 2 }}>
                ⬇️ Exporter en image
              </button>
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ padding: '3.5rem 2rem', textAlign: 'center', background: 'white', borderTop: '1px solid #e6dfd3' }}>
          <p style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontSize: '0.9rem', color: '#c9a84c', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Inspiré par ce voyage ?</p>
          <p style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(1.5rem,4vw,2.25rem)', fontWeight: 300, color: '#0d0d0d', marginBottom: '1.75rem', lineHeight: 1.2 }}>
            Racontez le vôtre.
          </p>
          <a href="/create"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '0.9rem 2.5rem', background: '#0d0d0d', color: 'white', fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2, transition: 'background 0.25s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#c9a84c')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}>
            <span style={{ fontSize: 18 }}>✍️</span> Créer mon récit
          </a>
        </div>
      </main>
    </>
  );
}