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
// READER RENDERER — le lecteur voit exactement la composition éditoriale
// utilisée dans l'aperçu de la phase « Construire ».
// ─────────────────────────────────────────────────────────────────────────────
function ReaderStoryRenderer({ blocks }: { blocks: CanvasBlock[] }) {
  const sorted = [...blocks].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  const blockStyle = (block: CanvasBlock): React.CSSProperties => ({
    background: block.bg || '#fff',
    color: block.textColor || '#25302b',
    fontFamily: FONT_MAP[block.font] || FONT_MAP.sans,
  });

  const renderBlock = (block: CanvasBlock, index: number) => {
    const d = block.data || {};
    const font = FONT_MAP[block.font] || FONT_MAP.sans;
    const color = block.textColor || '#25302b';
    const base = blockStyle(block);

    switch (block.type) {
      case 'text':
        return (
          <section className="od-reader-block od-reader-text" style={base} key={block.id || index}>
            <div className="od-reader-text-inner" style={{ fontFamily: font, fontSize: `${block.fontSize || 1}rem`, color }} dangerouslySetInnerHTML={{ __html: d.html || '' }} />
          </section>
        );
      case 'photo':
        return d.url ? (
          <section className="od-reader-block od-reader-photo" style={base} key={block.id || index}>
            <figure>
              <Img src={d.url} alt={d.caption || ''} />
              {d.caption && <figcaption>{d.caption}</figcaption>}
            </figure>
          </section>
        ) : null;
      case 'gallery': {
        const images: string[] = d.images || [];
        if (!images.length) return null;
        return (
          <section className="od-reader-block od-reader-gallery" style={base} key={block.id || index}>
            {d.layout === 'mosaic' && images.length >= 2 ? (
              <div className="od-reader-mosaic">
                <Img src={images[0]} alt="" />
                <div>{images.slice(1, 4).map((img, i) => <Img key={i} src={img} alt="" />)}</div>
              </div>
            ) : (
              <div className="od-reader-gallery-grid">{images.map((img, i) => <Img key={i} src={img} alt="" />)}</div>
            )}
          </section>
        );
      }
      case 'quote':
        return (
          <section className="od-reader-block od-reader-quote" style={base} key={block.id || index}>
            <span className="od-reader-quote-mark">“</span>
            <p style={{ fontFamily: font, fontSize: `${block.fontSize || 1.2}rem`, color }}>{d.text}</p>
            {d.author && <cite style={{ color: '#c9a84c' }}>— {d.author}</cite>}
          </section>
        );
      case 'hotel':
        return (
          <section className="od-reader-block od-reader-place" style={base} key={block.id || index}>
            <div className="od-reader-place-icon">🏨</div>
            <div className="od-reader-place-main">
              <span className="od-reader-label" style={{ color: '#c9a84c' }}>Hébergement</span>
              <h3 style={{ fontFamily: font }}>{d.name || 'Hébergement'}</h3>
              <div className="od-reader-place-meta">{d.price && <span>{d.price} / nuit</span>}{d.rating && <span className="od-stars">{'★'.repeat(Number(d.rating))}{'☆'.repeat(5 - Number(d.rating))}</span>}</div>
              {d.review && <p>{d.review}</p>}
              {d.link && <a href={d.link} target="_blank" rel="noopener noreferrer">Réserver <span>↗</span></a>}
            </div>
          </section>
        );
      case 'restaurant':
        return (
          <section className="od-reader-block od-reader-place od-reader-restaurant" style={base} key={block.id || index}>
            <div className="od-reader-place-icon">🍽️</div>
            <div className="od-reader-place-main">
              <span className="od-reader-label">Restaurant</span>
              <h3 style={{ fontFamily: font }}>{d.name || 'Restaurant'}</h3>
              {(d.cuisine || d.price) && <div className="od-reader-place-meta">{[d.cuisine, d.price].filter(Boolean).join(' · ')}</div>}
              {d.rating && <div className="od-stars restaurant-stars">{'★'.repeat(Number(d.rating))}{'☆'.repeat(5 - Number(d.rating))}</div>}
              {d.review && <p>{d.review}</p>}
              {d.link && <a href={d.link} target="_blank" rel="noopener noreferrer">Voir sur Maps <span>↗</span></a>}
            </div>
          </section>
        );
      case 'pros_cons':
        return (
          <section className="od-reader-block od-reader-proscons" style={base} key={block.id || index}>
            <div><span className="od-reader-label od-good">Pour</span>{(d.pros || []).filter(Boolean).map((v: string, i: number) => <p key={i}><b>✓</b>{v}</p>)}</div>
            <div><span className="od-reader-label od-bad">Contre</span>{(d.cons || []).filter(Boolean).map((v: string, i: number) => <p key={i}><b>×</b>{v}</p>)}</div>
          </section>
        );
      case 'divider':
        return (
          <div className="od-reader-divider" key={block.id || index}>
            {d.style === 'dots' ? <span>· · · · ·</span> : d.style === 'wave' ? <svg viewBox="0 0 100 10" aria-hidden="true"><path d="M0,5 Q25,0 50,5 T100,5" fill="none" stroke="#c9a84c" strokeWidth="0.7" /></svg> : <i />}
          </div>
        );
      case 'spacer':
        return <div className="od-reader-spacer" key={block.id || index} style={{ height: Math.max(24, Math.min(180, block.h || 60)) }} />;
      default:
        return null;
    }
  };

  return (
    <article className="od-reader-story">
      {sorted.map(renderBlock)}
    </article>
  );
}

// Ancien format : conservé pour les récits historiques déjà enregistrés.
function LegacyRenderer({ blocks }: { blocks: LegacyBlock[] }) {
  const converted = blocks.map((b, i) => ({
    id: b.id || `legacy-${i}`,
    type: b.type,
    data: b.data || {},
    x: 0, y: 0, w: 100, h: 180,
    font: b.font || 'sans',
    bg: b.bg?.type === 'color' ? b.bg.color : b.bg?.gradient || '#fff',
    textColor: '#25302b', fontSize: 1, zIndex: i,
  } as CanvasBlock));
  return <ReaderStoryRenderer blocks={converted} />;
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
  const [exportMenu, setExportMenu] = useState(false);
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

  // ── Export premium ──
  const printStory = () => {
    window.print();
  };

  const exportImage = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const target = contentRef.current;
      const canvas = await html2canvas(target, {
        scale: Math.min(2.5, window.devicePixelRatio || 2), useCORS: true, allowTaint: true,
        backgroundColor: '#f4f1eb', logging: false,
        width: target.scrollWidth, height: target.scrollHeight,
        windowWidth: target.scrollWidth,
      });
      const link = document.createElement('a');
      link.download = `${(trip?.title || 'odyssey').toString().toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'odyssey'}-odyssey.png`;
      link.href = canvas.toDataURL('image/png', 1);
      link.click();
    } catch (e) {
      console.error('Export image error:', e);
      alert('Impossible de générer l’image HD. Vous pouvez utiliser l’export PDF à la place.');
    } finally {
      setExporting(false);
    }
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
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#18352b', gap: 16 }}>
        <p style={{ fontFamily: "'Fraunces',serif", fontSize: '2rem', color: '#555', fontWeight: 300 }}>Récit introuvable</p>
        <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', color: '#444' }}>Ce lien est invalide ou le récit a été supprimé.</p>
        <a href="/" style={{ marginTop: 8, padding: '0.6rem 1.5rem', background: '#c9a84c', color: '#18352b', fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          ← Retour à l'accueil
        </a>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!trip) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#18352b', gap: 16 }}>
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
        .od-reader-export{background:#f4f1eb;padding:clamp(28px,5vw,70px) 18px 90px}
        .od-reader-cover{width:min(900px,calc(100% - 0px));margin:0 auto;background:#fff;border:1px solid #e2ddd5;border-radius:24px;padding:clamp(28px,5vw,54px) clamp(22px,6vw,54px) 30px;box-shadow:0 22px 60px rgba(43,43,38,.10);text-align:center;box-sizing:border-box}
        .od-reader-cover-eyebrow{font:800 10px 'DM Sans',system-ui;letter-spacing:.24em;text-transform:uppercase;color:#a18c57}.od-reader-cover h1{font:400 clamp(2.1rem,5vw,3.4rem)/1.08 'Fraunces',Georgia,serif;letter-spacing:-.025em;color:#17231e;margin:10px auto 8px;max-width:760px}.od-reader-cover-subtitle{margin:0;color:#7d847f;font:14px/1.6 'DM Sans',system-ui}.od-reader-cover>img{display:block;width:100%;height:min(52vw,420px);object-fit:cover;border-radius:16px;margin:26px auto 0}.od-reader-cover-footer{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:22px;padding-top:18px;border-top:1px solid #e7e2d9;text-align:left}.od-reader-author{display:flex;align-items:center;gap:10px;text-decoration:none;min-width:0}.od-reader-avatar{width:40px;height:40px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#18352b;color:white;font:800 12px 'DM Sans',system-ui;flex:none}.od-reader-avatar img{width:100%;height:100%;object-fit:cover}.od-reader-author small,.od-reader-facts small{display:block;color:#949b96;font:10px 'DM Sans',system-ui;letter-spacing:.05em;margin-bottom:2px}.od-reader-author b,.od-reader-facts b{display:block;color:#34403a;font:700 11px 'DM Sans',system-ui}.od-reader-facts{display:flex;align-items:center;gap:20px}.od-reader-facts span{padding-left:20px;border-left:1px solid #e7e2d9}.od-reader-facts span:first-child{padding-left:0;border-left:0}

        .od-reader-story{width:min(900px,100%);margin:0 auto;background:#fff;border:1px solid #e6dfd3;border-radius:24px;padding:clamp(18px,4vw,54px);box-shadow:0 24px 70px rgba(43,43,38,.10)}
        .od-reader-block{border:1px solid #e5e0d7;border-radius:18px;overflow:hidden;margin:16px 0;box-shadow:0 7px 22px rgba(43,43,38,.035);box-sizing:border-box}
        .od-reader-text{padding:clamp(22px,4vw,42px);min-height:100px}.od-reader-text-inner{line-height:1.8;word-break:break-word}.od-reader-text-inner p{margin:0 0 1em}.od-reader-text-inner p:last-child{margin-bottom:0}
        .od-reader-photo{padding:6px}.od-reader-photo figure{margin:0}.od-reader-photo img{display:block;width:100%;max-height:720px;object-fit:cover;border-radius:14px}.od-reader-photo figcaption{padding:10px 12px 8px;color:#7d847f;font:italic 12px 'DM Sans',system-ui;text-align:center}
        .od-reader-gallery{padding:6px}.od-reader-gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.od-reader-gallery-grid img{width:100%;height:250px;object-fit:cover;display:block;border-radius:11px}.od-reader-mosaic{display:grid;grid-template-columns:2fr 1fr;gap:5px}.od-reader-mosaic>img,.od-reader-mosaic>div img{width:100%;height:420px;object-fit:cover;display:block;border-radius:11px}.od-reader-mosaic>div{display:grid;grid-template-rows:repeat(3,1fr);gap:5px}.od-reader-mosaic>div img{height:100%}
        .od-reader-quote{padding:clamp(28px,5vw,52px);position:relative;min-height:150px;display:flex;flex-direction:column;justify-content:center}.od-reader-quote-mark{position:absolute;left:20px;top:-3px;font:100px/1 'Fraunces',Georgia,serif;color:rgba(201,168,76,.20)}.od-reader-quote p{position:relative;margin:0;line-height:1.55;font-style:italic;max-width:720px}.od-reader-quote cite{position:relative;margin-top:14px;font:600 11px 'DM Sans',system-ui;letter-spacing:.1em}
        .od-reader-place{padding:clamp(20px,4vw,30px);display:flex;gap:18px;align-items:flex-start}.od-reader-place-icon{width:48px;height:48px;border-radius:14px;background:#f4efe2;display:grid;place-items:center;font-size:22px;flex:none}.od-reader-place-main{min-width:0;flex:1}.od-reader-label{display:block;font:800 10px 'DM Sans',system-ui;letter-spacing:.16em;text-transform:uppercase;margin-bottom:7px}.od-reader-place h3{margin:0 0 8px;font-size:clamp(1.25rem,3vw,1.8rem);font-weight:400;line-height:1.15}.od-reader-place-meta{color:#7d847f;font:12px 'DM Sans',system-ui;display:flex;gap:14px;flex-wrap:wrap}.od-stars{color:#c9a84c;letter-spacing:2px}.restaurant-stars{margin-top:8px}.od-reader-place p{color:#626b65;font:13px/1.7 'DM Sans',system-ui;margin:12px 0 0;max-width:700px}.od-reader-place a{display:inline-flex;margin-top:14px;color:#9b7a24;font:700 11px 'DM Sans',system-ui;text-decoration:none;letter-spacing:.05em}.od-reader-place a span{margin-left:5px}.od-reader-restaurant{border-left:3px solid #e88c4a}
        .od-reader-proscons{padding:clamp(22px,4vw,34px);display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,5vw,55px)}.od-reader-proscons>div+div{border-left:1px solid #e7e2d9;padding-left:clamp(20px,4vw,40px)}.od-reader-proscons p{font:13px/1.65 'DM Sans',system-ui;margin:8px 0;display:flex;gap:9px;color:#36413b}.od-reader-proscons p b{flex:none;color:#5b9b78}.od-reader-proscons>div+div p b{color:#c86b6b}.od-good{color:#4d956f}.od-bad{color:#b85d5d}.od-reader-divider{padding:20px 10%;height:24px;display:flex;align-items:center;justify-content:center}.od-reader-divider span{color:#c9a84c;letter-spacing:.45em;font-size:14px}.od-reader-divider svg{width:100%;height:22px}.od-reader-divider i{width:100%;height:1px;background:linear-gradient(90deg,transparent,#c9a84c,transparent)}.od-reader-spacer{border:0!important;box-shadow:none!important;margin:0!important}
        .od-reader-empty{text-align:center;padding:100px 20px;background:#f4f1eb;color:#737a75}.od-reader-empty p{font:400 30px 'Fraunces',Georgia,serif;color:#4f5b54;margin:0 0 8px}.od-reader-empty span{font:12px 'DM Sans',system-ui}
        .od-export-wrap{position:relative}.od-export-fab{background:#c9a84c!important;color:#0d0d0d!important;border-color:#c9a84c!important}.od-export-menu{position:absolute;right:58px;top:0;width:340px;background:#fff;border:1px solid #e4dfd6;border-radius:18px;box-shadow:0 22px 65px rgba(28,37,32,.22);overflow:hidden;padding:8px}.od-export-menu-head{padding:13px 14px 11px;border-bottom:1px solid #eee9e1}.od-export-menu-head b{display:block;font:400 18px 'Fraunces',Georgia,serif;color:#18221e}.od-export-menu-head span{display:block;margin-top:3px;font:10px 'DM Sans',system-ui;color:#858c87}.od-export-menu>button{width:100%;border:0;background:#fff;border-radius:12px;padding:12px 9px;display:flex;align-items:center;gap:11px;text-align:left;cursor:pointer}.od-export-menu>button:hover{background:#f7f4ed}.od-export-menu>button>span{width:34px;height:34px;border-radius:10px;background:#f4efe2;color:#9b7a24;display:grid;place-items:center;font-weight:800}.od-export-menu>button div{flex:1}.od-export-menu>button b{display:block;font:700 12px 'DM Sans',system-ui;color:#34403a}.od-export-menu>button small{display:block;font:10px/1.35 'DM Sans',system-ui;color:#8a918c;margin-top:2px}.od-export-menu>button em{font-style:normal;color:#c9a84c}.od-export-menu>button:disabled{opacity:.5}
        @media(max-width:700px){.od-reader-cover{padding:25px 18px 20px}.od-reader-cover>img{height:260px}.od-reader-cover-footer{align-items:flex-start;flex-direction:column}.od-reader-facts{width:100%;justify-content:space-between;gap:10px}.od-reader-facts span{padding-left:10px}.od-reader-gallery-grid{grid-template-columns:repeat(2,1fr)}.od-reader-gallery-grid img{height:180px}.od-reader-mosaic{grid-template-columns:1fr}.od-reader-mosaic>img,.od-reader-mosaic>div img{height:260px}.od-reader-proscons{grid-template-columns:1fr}.od-reader-proscons>div+div{border-left:0;border-top:1px solid #e7e2d9;padding-left:0;padding-top:22px}.od-export-menu{right:0;top:58px;width:min(340px,calc(100vw - 32px))}}
        @media print{body{background:#fff!important}.od-export-wrap,.od-top-actions,.fab,.od-toast,.od-export-menu,.od-reader-empty{display:none!important}.od-reader-cover{break-after:page;box-shadow:none!important}.od-reader-export{padding:0!important;background:#fff!important}.od-reader-story{width:100%!important;border:0!important;box-shadow:none!important;border-radius:0!important;padding:18mm 15mm!important}.od-reader-block{break-inside:avoid;box-shadow:none!important}.od-reader-photo img{max-height:220mm}.od-reader-gallery-grid img{height:70mm}.od-reader-mosaic>img,.od-reader-mosaic>div img{height:110mm}.od-reader-proscons{break-inside:avoid}}
        .fab:hover{transform:translateY(-2px) scale(1.05)!important;box-shadow:0 8px 24px rgba(0,0,0,0.35)!important}
        .fab{transition:all 0.2s!important}
      `}</style>

      <main className="odyssey-page" style={{ background: '#f7f8f5', minHeight: '100vh' }}>

        {/* ── Floating action buttons ── */}
        <div style={{ position: 'fixed', top: 80, right: '1.5rem', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Like button — principal CTA */}
          <button className="fab" onClick={toggleLike} disabled={likeLoading}
            title={currentUser ? (liked ? 'Retirer des favoris' : 'Ajouter aux favoris') : 'Connectez-vous pour liker'}
            style={{ width: 48, height: 48, background: liked ? '#c9a84c' : '#18352b', color: liked ? '#18352b' : 'white', border: `1px solid ${liked ? '#c9a84c' : '#2a2a2a'}`, cursor: likeLoading ? 'wait' : 'pointer', display: 'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center', gap:1, boxShadow: liked ? '0 4px 20px rgba(201,168,76,0.4)' : '0 4px 20px rgba(0,0,0,0.25)', borderRadius: 2, transition:'all 0.2s' }}>
            <span style={{ fontSize: 18, lineHeight:1, transition:'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)', transform: liked ? 'scale(1.2)' : 'scale(1)', display:'block' }}>{liked ? '♥' : '♡'}</span>
            {likesCount > 0 && <span style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.55rem', fontWeight:700, lineHeight:1 }}>{likesCount}</span>}
          </button>
          <button className="fab" onClick={shareTrip}
            style={{ width: 48, height: 48, background: '#18352b', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', borderRadius: 2 }}
            title="Partager">🔗</button>
          <div className="od-export-wrap">
            <button className="fab od-export-fab" onClick={() => setExportMenu(v => !v)} title="Exporter le récit">↗</button>
            {exportMenu && (
              <div className="od-export-menu">
                <div className="od-export-menu-head"><b>Exporter votre récit</b><span>Une version pensée pour être gardée, imprimée ou partagée.</span></div>
                <button type="button" onClick={() => { setExportMenu(false); printStory(); }}><span>▣</span><div><b>PDF souvenir</b><small>Ouvre la version imprimable, prête à enregistrer en PDF.</small></div><em>→</em></button>
                <button type="button" onClick={() => { setExportMenu(false); exportImage(); }} disabled={exporting}><span>▧</span><div><b>Image HD</b><small>Exporte la composition du récit en haute définition.</small></div><em>→</em></button>
              </div>
            )}
          </div>
          <a href="/" className="fab"
            style={{ width: 48, height: 48, background: 'white', border: '1px solid #e6dfd3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, textDecoration: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', borderRadius: 2 }}
            title="Retour">←</a>
        </div>

        {/* ── Toast ── */}
        {shareToast && (
          <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: '#18352b', color: 'white', padding: '0.75rem 1.75rem', fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', letterSpacing: '0.06em', zIndex: 200, animation: 'toastIn 0.3s ease', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', borderRadius: 2 }}>
            ✓ Lien copié dans le presse-papier
          </div>
        )}

        {/* ══ EXPORTABLE ZONE ══ */}
        <div ref={contentRef}>

          {/* ── Cover — même langage visuel que l'aperçu « Construire » ── */}
          <section className="od-reader-cover">
            <div className="od-reader-cover-eyebrow">{trip.city || trip.country || 'Odyssey'} · {CATS[trip.category] || trip.category || 'Récit de voyage'}</div>
            <h1>{trip.title}</h1>
            <p className="od-reader-cover-subtitle">{trip.subtitle || 'Un voyage à raconter.'}</p>
            {trip.cover_image && <img src={optimizeImageUrl(trip.cover_image)} alt={trip.title} />}
            <div className="od-reader-cover-footer">
              <a href={trip.profiles?.username ? `/profile/${trip.profiles.username}` : '#'} className="od-reader-author">
                <span className="od-reader-avatar">
                  {trip.profiles?.avatar_url ? <img src={trip.profiles.avatar_url} alt="" /> : (trip.profiles?.username?.charAt(0) || 'V')}
                </span>
                <span><small>Récit de</small><b>@{trip.profiles?.username || 'voyageur'}</b></span>
              </a>
              <div className="od-reader-facts">
                {trip.duration_days && <span><small>Durée</small><b>{trip.duration_days} jours</b></span>}
                {trip.budget && <span><small>Budget</small><b>{trip.budget}</b></span>}
                {trip.travelers > 1 && <span><small>Voyageurs</small><b>{trip.travelers}</b></span>}
                <span><small>Favoris</small><b>{likesCount}</b></span>
              </div>
            </div>
          </section>

          {/* ── Content ── */}
          {blocks.length === 0 ? (
            <div className="od-reader-empty">
              <p>Récit en cours de rédaction</p>
              <span>Le voyageur n'a pas encore ajouté de contenu.</span>
            </div>
          ) : (
            <div className="od-reader-export">
              {isCanvas ? <ReaderStoryRenderer blocks={blocks as CanvasBlock[]} /> : <LegacyRenderer blocks={blocks as LegacyBlock[]} />}
            </div>
          )}

          {/* ── Footer signature ── */}
          <div style={{ background: '#18352b', padding: '3rem clamp(1.5rem,5vw,4rem)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
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
              <button onClick={() => setExportMenu(true)}
                style={{ padding: '0.7rem 1.75rem', background: '#c9a84c', border: 'none', color: '#0d0d0d', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10 }}>
                ↗ Exporter mon récit
              </button>
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ padding: '3.5rem 2rem', textAlign: 'center', background: 'white', borderTop: '1px solid #e6dfd3' }}>
          <p style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontSize: '0.9rem', color: '#c9a84c', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Inspiré par ce voyage ?</p>
          <p style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(1.5rem,4vw,2.25rem)', fontWeight: 300, color: '#18352b', marginBottom: '1.75rem', lineHeight: 1.2 }}>
            Racontez le vôtre.
          </p>
          <a href="/create"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '0.9rem 2.5rem', background: '#18352b', color: 'white', fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2, transition: 'background 0.25s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#c9a84c')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#18352b')}>
            <span style={{ fontSize: 18 }}>✍️</span> Créer mon récit
          </a>
        </div>
      </main>
    </>
  );
}