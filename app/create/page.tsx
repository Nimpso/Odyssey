'use client';
import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// ─── Types ────────────────────────────────────────────────────────────────────
type BlockType = 'text' | 'photo' | 'gallery' | 'hotel' | 'restaurant' | 'pros_cons' | 'quote' | 'divider' | 'spacer';
type FontStyle = 'serif' | 'display' | 'sans';

interface CanvasBlock {
  id: string;
  type: BlockType;
  data: any;
  x: number;
  y: number;
  w: number;
  h: number;
  font: FontStyle;
  bg: string;        // css background value
  textColor: string;
  fontSize: number;  // rem multiplier
  zIndex: number;
}

interface Metadata {
  country: string; city: string; travelers: string;
  duration: string; budget: string; category: string; season: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 1200;

const COUNTRIES = ['Afghanistan','Afrique du Sud','Albanie','Algérie','Allemagne','Argentine','Arménie','Australie','Autriche','Azerbaïdjan','Belgique','Bolivie','Brésil','Bulgarie','Cambodge','Cameroun','Canada','Chili','Chine','Colombie','Corée du Sud','Costa Rica','Croatie','Cuba','Danemark','Égypte','Émirats Arabes Unis','Espagne','États-Unis','Éthiopie','Finlande','France','Géorgie','Ghana','Grèce','Guatemala','Hongrie','Inde','Indonésie','Irlande','Islande','Israël','Italie','Jamaïque','Japon','Jordanie','Kazakhstan','Kenya','Laos','Liban','Luxembourg','Madagascar','Malaisie','Maldives','Maroc','Maurice','Mexique','Mongolie','Myanmar','Namibie','Népal','Nicaragua','Nigéria','Norvège','Nouvelle-Zélande','Oman','Ouganda','Pakistan','Panama','Pays-Bas','Pérou','Philippines','Pologne','Portugal','Qatar','Roumanie','Royaume-Uni','Russie','Rwanda','Sénégal','Serbie','Singapour','Slovénie','Sri Lanka','Suède','Suisse','Tanzanie','Thaïlande','Tunisie','Turquie','Ukraine','Uruguay','Venezuela','Vietnam'];
const CATEGORIES = [{value:'aventure',label:'🏔️ Aventure'},{value:'plage',label:'🏖️ Plage'},{value:'culture',label:'🏛️ Culture'},{value:'gastronomie',label:'🍷 Gastronomie'},{value:'nature',label:'🌿 Nature'},{value:'road-trip',label:'🚗 Road Trip'},{value:'citytrip',label:'🌆 City Trip'},{value:'backpack',label:'🎒 Backpack'},{value:'luxe',label:'✨ Luxe'},{value:'famille',label:'👨‍👩‍👧 Famille'}];
const SEASONS = ['Printemps','Été','Automne','Hiver'];
const BUDGETS = ['< 500€','500€ – 1 000€','1 000€ – 2 000€','2 000€ – 5 000€','> 5 000€'];

const FONT_MAP: Record<FontStyle, string> = {
  serif:   "'Fraunces', Georgia, serif",
  display: "'Bebas Neue', sans-serif",
  sans:    "'DM Sans', system-ui, sans-serif",
};

// ─── Type pour les items de la sidebar ───────────────────────────────────────
interface SidebarItem {
  type: BlockType;
  icon: string;
  label: string;
  w: number;
  h: number;
  data: Record<string, any>;
}

const SIDEBAR_CATS: { id: string; label: string; icon: string; items: SidebarItem[] }[] = [
  { id: 'texte', label: 'Texte', icon: '✍️', items: [
      { type: 'text',    icon: '¶',  label: 'Paragraphe',  w: 500, h: 200, data: { html: '' } },
      { type: 'quote',   icon: '❝', label: 'Citation',    w: 600, h: 180, data: { text: '', author: '' } },
      { type: 'divider', icon: '—', label: 'Séparateur',  w: 500, h: 40,  data: { style: 'line' } },
      { type: 'spacer',  icon: '↕', label: 'Espace',      w: 400, h: 80,  data: {} },
  ]},
  { id: 'medias', label: 'Médias', icon: '🖼️', items: [
      { type: 'photo',   icon: '🖼️', label: 'Photo',   w: 600, h: 400, data: { url: '', caption: '' } },
      { type: 'gallery', icon: '🗂️', label: 'Galerie', w: 800, h: 400, data: { images: [], layout: 'mosaic' } },
  ]},
  { id: 'voyage', label: 'Voyage', icon: '✈️', items: [
      { type: 'hotel',      icon: '🏨', label: 'Hôtel',         w: 560, h: 300, data: { name:'',link:'',price:'',rating:'',review:'',photo:'' } },
      { type: 'restaurant', icon: '🍽️', label: 'Restaurant',    w: 560, h: 280, data: { name:'',link:'',price:'',rating:'',review:'',cuisine:'' } },
      { type: 'pros_cons',  icon: '⚖️', label: 'Pour / Contre', w: 700, h: 320, data: { pros:[''],cons:[''] } },
  ]},
];

const BG_PRESETS = [
  { label: 'Blanc',         value: '#ffffff' },
  { label: 'Parchemin',     value: '#faf8f4' },
  { label: 'Encre',         value: '#0d0d0d' },
  { label: 'Forêt',         value: '#1e3a2f' },
  { label: 'Or pâle',       value: 'rgba(201,168,76,0.12)' },
  { label: 'Brume',         value: '#f0ede8' },
  { label: 'Nuit',          value: '#0f1923' },
  { label: 'Dégradé forêt', value: 'linear-gradient(135deg,#1e3a2f,#2d7a72)' },
  { label: 'Dégradé encre', value: 'linear-gradient(135deg,#0d0d0d,#1a1a2e)' },
  { label: 'Dégradé or',    value: 'linear-gradient(135deg,#c9a84c,#b55435)' },
  { label: 'Transparent',   value: 'transparent' },
];

const uid = () => Math.random().toString(36).slice(2, 9);

// ─── Image URL optimizer ──────────────────────────────────────────────────────
function optimizeImageUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname === 'images.unsplash.com') {
      u.searchParams.set('w', '2400'); u.searchParams.set('q', '95'); u.searchParams.set('fm', 'jpg');
      u.searchParams.delete('fit'); u.searchParams.delete('crop');
      return u.toString();
    }
    if (u.hostname.includes('pexels.com')) { u.searchParams.set('auto','compress'); u.searchParams.set('cs','tinysrgb'); u.searchParams.set('w','2400'); return u.toString(); }
    if (u.hostname.includes('pixabay.com')) return url.replace(/_\d+\./,'_1920.');
    if (u.hostname.includes('wikimedia.org')||u.hostname.includes('wikipedia.org')) return url.replace(/\/thumb\//,'/').replace(/\/\d+px-[^/]+$/,'');
    if (u.hostname.includes('googleusercontent.com')||u.hostname.includes('ggpht.com')) return url.replace(/=w\d+-h\d+(-[a-z]+)?/,'=d').replace(/=s\d+/,'=d');
  } catch {}
  return url;
}

// ─── MODULE SYSTEM ─────────────────────────────────────────────────────────────
type Module = { id: string; label: string; icon: string; generate: (offsetY: number, index: number) => Omit<CanvasBlock,'id'>[]; };

const blk = (type: BlockType, x: number, y: number, w: number, h: number, data: any, s: Partial<CanvasBlock> = {}): Omit<CanvasBlock,'id'> => ({
  type, data, x, y, w, h,
  font: s.font || 'sans', bg: s.bg || 'transparent',
  textColor: s.textColor || '#0d0d0d', fontSize: s.fontSize || 1, zIndex: s.zIndex || 5,
});

// ─── ROAD TRIP modules ────────────────────────────────────────────────────────
const ROADTRIP_MODULES: Module[] = [
  { id:'rt_day', icon:'🗓️', label:'+ Ajouter un jour',
    generate:(y,i)=>[
      blk('text',0,y,1200,72,{html:`<div style="font-family:'Bebas Neue',sans-serif;font-size:3.5rem;line-height:1;display:flex;align-items:center;gap:24px;padding:0 60px;height:100%"><span style="font-family:'DM Sans',system-ui;font-size:0.9rem;font-weight:700;letter-spacing:0.22em;color:#e8a020">JOUR</span><span style="color:#fff">${i+1}</span><span style="flex:1;height:2px;background:linear-gradient(90deg,#e8a020,transparent);display:inline-block"></span></div>`},{bg:'#1a1a1a',textColor:'#fff',font:'display'}),
      blk('photo',0,y+72,720,420,{url:'',caption:''},{bg:'#111'}),
      blk('text',730,y+72,470,420,{html:`<div style="padding:28px 32px;height:100%;box-sizing:border-box"><p style="font-family:'DM Sans',system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#e8a020;margin-bottom:12px">Récit du jour</p><p style="font-family:'Fraunces',serif;font-size:1.5rem;font-weight:300;line-height:1.2;color:#fff;margin-bottom:16px">Titre de l'étape</p><p style="font-family:'DM Sans',system-ui;font-size:0.88rem;line-height:1.8;color:rgba(255,255,255,0.6)">Décrivez cette journée — les routes empruntées, les paysages traversés, les arrêts imprévus…</p></div>`},{bg:'#161616',textColor:'#fff'}),
      blk('gallery',0,y+492,1200,180,{images:[],layout:'grid'},{bg:'#0d0d0d'}),
      blk('text',0,y+672,1200,80,{html:`<div style="padding:0 60px;display:flex;gap:40px;align-items:center;height:100%"><span style="font-family:'DM Sans',system-ui;font-size:0.78rem;color:#e8a020">📍 Départ : —</span><span style="font-family:'DM Sans',system-ui;font-size:0.78rem;color:#e8a020">🏁 Arrivée : —</span><span style="font-family:'DM Sans',system-ui;font-size:0.78rem;color:#e8a020">🛣️ Distance : — km</span><span style="font-family:'DM Sans',system-ui;font-size:0.78rem;color:#e8a020">⏱ Durée : — h</span></div>`},{bg:'#111',textColor:'#fff'}),
    ]},
  { id:'rt_stop', icon:'📍', label:'+ Ajouter un arrêt',
    generate:(y)=>[
      blk('text',60,y,500,40,{html:`<p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#e8a020">📍 Arrêt incontournable</p>`},{textColor:'#e8a020'}),
      blk('photo',60,y+46,460,300,{url:'',caption:''},{bg:'#111'}),
      blk('text',540,y+46,600,300,{html:`<div style="padding:20px 28px"><p style="font-family:'Fraunces',serif;font-size:1.6rem;font-weight:300;color:#fff;margin-bottom:12px">Nom du lieu</p><p style="font-family:'DM Sans',system-ui;font-size:0.88rem;line-height:1.75;color:rgba(255,255,255,0.6)">Ce qui m'a marqué ici…</p><p style="font-family:'DM Sans',system-ui;font-size:0.72rem;color:#e8a020;margin-top:16px">⏱ Durée conseillée : —</p></div>`},{bg:'#1a1a1a',textColor:'#fff'}),
    ]},
  { id:'rt_conseil', icon:'💡', label:'+ Ajouter un conseil',
    generate:(y)=>[
      blk('text',60,y,1080,120,{html:`<div style="padding:20px 28px;display:grid;grid-template-columns:48px 1fr;gap:16px;align-items:center"><span style="font-size:2rem">💡</span><div><p style="font-family:'DM Sans',system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#e8a020;margin-bottom:6px">Conseil pratique</p><p style="font-family:'DM Sans',system-ui;font-size:0.9rem;line-height:1.7;color:rgba(255,255,255,0.8)">Votre astuce ou recommandation…</p></div></div>`},{bg:'rgba(232,160,32,0.08)',textColor:'#fff'}),
    ]},
  { id:'rt_nuit', icon:'🌙', label:'+ Ajouter une nuit',
    generate:(y)=>[
      blk('text',60,y,500,40,{html:`<p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#e8a020">🌙 Nuitée</p>`},{textColor:'#e8a020'}),
      blk('hotel',60,y+46,1080,260,{name:'',link:'',price:'',rating:'',review:''},{bg:'#1a1a1a',textColor:'#fff'}),
    ]},
];

// ─── GUIDE PRATIQUE modules ───────────────────────────────────────────────────
const GUIDE_MODULES: Module[] = [
  { id:'gp_section', icon:'📋', label:'+ Ajouter une section',
    generate:(y,i)=>[
      blk('text',0,y,1200,56,{html:`<div style="padding:0 60px;display:flex;align-items:center;gap:20px;height:100%"><span style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.22em;color:#2d7a72">0${i+1}</span><span style="flex:1;height:1px;background:#e6dfd3;display:block"></span></div>`},{bg:'#faf8f4',textColor:'#0d0d0d'}),
      blk('text',60,y+56,500,320,{html:`<div style="padding:28px 0"><p style="font-family:'Fraunces',serif;font-size:2rem;font-weight:300;line-height:1.2;color:#0d0d0d;margin-bottom:16px">Titre de la section</p><p style="font-family:'DM Sans',system-ui;font-size:0.9rem;line-height:1.8;color:#666">Contenu de votre guide — infos pratiques, horaires, tarifs, conseils…</p></div>`},{bg:'transparent',textColor:'#0d0d0d'}),
      blk('photo',580,y+56,560,320,{url:'',caption:''},{bg:'#ddd'}),
    ]},
  { id:'gp_budget', icon:'💰', label:'+ Ajouter un budget',
    generate:(y)=>[
      blk('text',60,y,1080,260,{html:`<div style="padding:28px 32px"><p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#2d7a72;margin-bottom:20px">💰 Budget estimé</p><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px"><div style="border-top:3px solid #2d7a72;padding-top:12px"><p style="font-family:'DM Sans',system-ui;font-size:0.7rem;color:#888;margin-bottom:4px">Transport</p><p style="font-family:'Fraunces',serif;font-size:1.5rem;color:#0d0d0d">0 €</p></div><div style="border-top:3px solid #c9a84c;padding-top:12px"><p style="font-family:'DM Sans',system-ui;font-size:0.7rem;color:#888;margin-bottom:4px">Hébergement</p><p style="font-family:'Fraunces',serif;font-size:1.5rem;color:#0d0d0d">0 €</p></div><div style="border-top:3px solid #b55435;padding-top:12px"><p style="font-family:'DM Sans',system-ui;font-size:0.7rem;color:#888;margin-bottom:4px">Repas</p><p style="font-family:'Fraunces',serif;font-size:1.5rem;color:#0d0d0d">0 €</p></div><div style="border-top:3px solid #555;padding-top:12px"><p style="font-family:'DM Sans',system-ui;font-size:0.7rem;color:#888;margin-bottom:4px">Activités</p><p style="font-family:'Fraunces',serif;font-size:1.5rem;color:#0d0d0d">0 €</p></div></div></div>`},{bg:'#fff',textColor:'#0d0d0d'}),
    ]},
  { id:'gp_transport', icon:'🚌', label:'+ Ajouter transport',
    generate:(y)=>[
      blk('text',60,y,1080,140,{html:`<div style="padding:20px 28px"><p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#2d7a72;margin-bottom:12px">🚌 Comment s'y rendre</p><div style="display:flex;gap:10px;flex-wrap:wrap"><span style="background:#f0ede8;padding:6px 14px;font-family:'DM Sans',system-ui;font-size:0.82rem;color:#555">✈️ Vol direct</span><span style="background:#f0ede8;padding:6px 14px;font-family:'DM Sans',system-ui;font-size:0.82rem;color:#555">🚂 Train</span><span style="background:#f0ede8;padding:6px 14px;font-family:'DM Sans',system-ui;font-size:0.82rem;color:#555">🚗 Location</span></div></div>`},{bg:'#fff',textColor:'#0d0d0d'}),
    ]},
  { id:'gp_conseil', icon:'⭐', label:'+ Ajouter Pour / Contre',
    generate:(y)=>[ blk('pros_cons',60,y,1080,280,{pros:[''],cons:['']},{bg:'#fff',textColor:'#0d0d0d'}) ]},
  { id:'gp_resto', icon:'🍽️', label:'+ Ajouter un restaurant',
    generate:(y)=>[ blk('restaurant',60,y,520,260,{name:'',link:'',price:'',rating:'',review:'',cuisine:''},{bg:'#fff',textColor:'#0d0d0d'}) ]},
  { id:'gp_hotel', icon:'🏨', label:'+ Ajouter un hôtel',
    generate:(y)=>[ blk('hotel',60,y,520,280,{name:'',link:'',price:'',rating:'',review:''},{bg:'#fff',textColor:'#0d0d0d'}) ]},
];

// ─── RANDONNÉE modules ────────────────────────────────────────────────────────
const RANDO_MODULES: Module[] = [
  { id:'ra_etape', icon:'⛰️', label:'+ Ajouter une étape',
    generate:(y,i)=>[
      blk('text',0,y,1200,76,{html:`<div style="padding:0 60px;display:flex;align-items:center;gap:20px;height:100%"><div style="width:40px;height:40px;background:#4caf7d;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui;font-weight:700;color:#0d0d0d;font-size:1rem;flex-shrink:0">${i+1}</div><p style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:#fff;letter-spacing:0.05em">ÉTAPE ${i+1}</p><div style="margin-left:auto;display:flex;gap:24px"><span style="font-family:'DM Sans',system-ui;font-size:0.78rem;color:#4caf7d">↔ — km</span><span style="font-family:'DM Sans',system-ui;font-size:0.78rem;color:#4caf7d">↑ — m D+</span><span style="font-family:'DM Sans',system-ui;font-size:0.78rem;color:#4caf7d">⏱ — h</span></div></div>`},{bg:'#162a1c',textColor:'#fff',font:'display'}),
      blk('photo',0,y+76,1200,360,{url:'',caption:''},{bg:'#0f1923'}),
      blk('text',60,y+456,640,220,{html:`<div style="padding:24px 0"><p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#4caf7d;margin-bottom:12px">Récit de l'étape</p><p style="font-family:'DM Sans',system-ui;font-size:0.9rem;line-height:1.8;color:rgba(255,255,255,0.7)">Décrivez le terrain, la végétation, les difficultés, les passages marquants…</p></div>`},{bg:'transparent',textColor:'#fff'}),
      blk('text',730,y+456,410,220,{html:`<div style="padding:16px 20px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(76,175,125,0.2);padding-bottom:8px"><span style="font-family:'DM Sans',system-ui;font-size:0.75rem;color:rgba(255,255,255,0.5)">Départ</span><span style="font-family:'DM Sans',system-ui;font-size:0.8rem;color:#fff;font-weight:600">— m</span></div><div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(76,175,125,0.2);padding-bottom:8px"><span style="font-family:'DM Sans',system-ui;font-size:0.75rem;color:rgba(255,255,255,0.5)">Point haut</span><span style="font-family:'DM Sans',system-ui;font-size:0.8rem;color:#4caf7d;font-weight:600">— m</span></div><div style="display:flex;justify-content:space-between"><span style="font-family:'DM Sans',system-ui;font-size:0.75rem;color:rgba(255,255,255,0.5)">Difficulté</span><span style="font-family:'DM Sans',system-ui;font-size:0.8rem;color:#c9a84c;font-weight:600">Modérée</span></div></div>`},{bg:'#162a1c',textColor:'#fff'}),
    ]},
  { id:'ra_panorama', icon:'🏔️', label:'+ Ajouter un panorama',
    generate:(y)=>[
      blk('photo',0,y,1200,460,{url:'',caption:''},{bg:'#0f1923'}),
      blk('text',80,y+360,700,80,{html:`<p style="font-family:'Fraunces',serif;font-style:italic;font-size:1.2rem;color:rgba(255,255,255,0.85)">Un panorama à couper le souffle…</p>`},{bg:'transparent',textColor:'#fff',zIndex:6}),
    ]},
  { id:'ra_materiel', icon:'🎒', label:'+ Ajouter matériel',
    generate:(y)=>[
      blk('text',60,y,1080,180,{html:`<div style="padding:20px 28px;display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#4caf7d;margin-bottom:12px">🎒 Matériel conseillé</p><ul style="list-style:none;padding:0;font-family:'DM Sans',system-ui;font-size:0.85rem;color:rgba(255,255,255,0.7);display:flex;flex-direction:column;gap:6px"><li>▸ Chaussures de randonnée</li><li>▸ Eau : min. 2L</li><li>▸ Vêtements imperméables</li></ul></div><div><p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#c9a84c;margin-bottom:12px">⚠️ Points d'attention</p><ul style="list-style:none;padding:0;font-family:'DM Sans',system-ui;font-size:0.85rem;color:rgba(255,255,255,0.7);display:flex;flex-direction:column;gap:6px"><li>▸ Départ tôt conseillé</li><li>▸ Météo capricieuse</li></ul></div></div>`},{bg:'#1a2a1e',textColor:'#fff'}),
    ]},
  { id:'ra_bivouac', icon:'⛺', label:'+ Ajouter refuge / bivouac',
    generate:(y)=>[
      blk('text',60,y,500,40,{html:`<p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#4caf7d">⛺ Refuge / Bivouac</p>`},{textColor:'#4caf7d'}),
      blk('hotel',60,y+46,1080,240,{name:'',link:'',price:'',rating:'',review:''},{bg:'#162a1c',textColor:'#fff'}),
    ]},
];

// ─── CITY GUIDE modules ───────────────────────────────────────────────────────
const CITYGUIDE_MODULES: Module[] = [
  { id:'cg_quartier', icon:'🗺️', label:'+ Ajouter un quartier',
    generate:(y,i)=>[
      blk('text',0,y,1200,92,{html:`<div style="padding:0 60px;height:100%;display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:16px"><div style="width:34px;height:34px;background:#c9a84c;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui;font-weight:700;color:#0d0d0d">${i+1}</div><p style="font-family:'Fraunces',serif;font-size:2rem;font-weight:300;color:#0d0d0d">Nom du quartier</p></div><p style="font-family:'DM Sans',system-ui;font-size:0.72rem;color:#888;letter-spacing:0.1em">📍 Arrondissement · Métro</p></div>`},{bg:'#faf8f4',textColor:'#0d0d0d'}),
      blk('photo',0,y+92,680,380,{url:'',caption:''},{bg:'#ddd'}),
      blk('text',700,y+92,500,220,{html:`<div style="padding:24px"><p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;margin-bottom:10px">L'ambiance</p><p style="font-family:'DM Sans',system-ui;font-size:0.9rem;line-height:1.8;color:#555">Décrivez l'atmosphère — architecture, horaires idéaux…</p></div>`},{bg:'#fff',textColor:'#0d0d0d'}),
      blk('text',700,y+312,500,160,{html:`<div style="padding:16px 24px"><p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#c9a84c;margin-bottom:10px">⭐ À ne pas manquer</p><ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:6px"><li style="font-family:'DM Sans',system-ui;font-size:0.85rem;color:#333">▸ Lieu 1</li><li style="font-family:'DM Sans',system-ui;font-size:0.85rem;color:#333">▸ Lieu 2</li><li style="font-family:'DM Sans',system-ui;font-size:0.85rem;color:#333">▸ Lieu 3</li></ul></div>`},{bg:'rgba(201,168,76,0.06)',textColor:'#0d0d0d'}),
    ]},
  { id:'cg_spot', icon:'📸', label:'+ Ajouter un spot photo',
    generate:(y)=>[
      blk('text',60,y,460,40,{html:`<p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c">📸 Spot photo</p>`},{textColor:'#c9a84c'}),
      blk('photo',60,y+46,440,300,{url:'',caption:''},{bg:'#ddd'}),
      blk('text',520,y+46,620,300,{html:`<div style="padding:20px 24px"><p style="font-family:'Fraunces',serif;font-size:1.4rem;font-weight:300;color:#0d0d0d;margin-bottom:10px">Nom du spot</p><p style="font-family:'DM Sans',system-ui;font-size:0.85rem;line-height:1.75;color:#666">Meilleure heure pour la lumière, comment y accéder…</p><div style="margin-top:14px;display:flex;gap:10px"><span style="background:#f5f0e8;padding:5px 10px;font-family:'DM Sans',system-ui;font-size:0.72rem;color:#888">🌅 Heure dorée</span><span style="background:#f5f0e8;padding:5px 10px;font-family:'DM Sans',system-ui;font-size:0.72rem;color:#888">📍 Adresse</span></div></div>`},{bg:'#fff',textColor:'#0d0d0d'}),
    ]},
  { id:'cg_resto', icon:'🍽️', label:'+ Ajouter un restaurant',
    generate:(y)=>[ blk('restaurant',60,y,520,260,{name:'',link:'',price:'',rating:'',review:'',cuisine:''},{bg:'#fff',textColor:'#0d0d0d'}) ]},
  { id:'cg_hotel', icon:'🏨', label:'+ Ajouter un hôtel',
    generate:(y)=>[ blk('hotel',60,y,520,280,{name:'',link:'',price:'',rating:'',review:''},{bg:'#fff',textColor:'#0d0d0d'}) ]},
  { id:'cg_itineraire', icon:'🗺️', label:'+ Ajouter un itinéraire',
    generate:(y)=>[
      blk('text',60,y,1080,180,{html:`<div style="padding:24px 32px"><p style="font-family:'DM Sans',system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;margin-bottom:16px">🗺️ Itinéraire suggéré</p><div style="display:flex;align-items:center;gap:0"><div style="text-align:center;flex-shrink:0"><div style="width:34px;height:34px;background:#c9a84c;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui;font-weight:700;font-size:0.8rem;margin:0 auto 6px">1</div><p style="font-family:'DM Sans',system-ui;font-size:0.72rem;color:#555">Lieu A</p></div><div style="flex:1;height:2px;background:linear-gradient(90deg,#c9a84c,#e6dfd3);min-width:40px"></div><div style="text-align:center;flex-shrink:0"><div style="width:34px;height:34px;background:#c9a84c;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui;font-weight:700;font-size:0.8rem;margin:0 auto 6px">2</div><p style="font-family:'DM Sans',system-ui;font-size:0.72rem;color:#555">Lieu B</p></div><div style="flex:1;height:2px;background:linear-gradient(90deg,#c9a84c,#e6dfd3);min-width:40px"></div><div style="text-align:center;flex-shrink:0"><div style="width:34px;height:34px;background:#c9a84c;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui;font-weight:700;font-size:0.8rem;margin:0 auto 6px">3</div><p style="font-family:'DM Sans',system-ui;font-size:0.72rem;color:#555">Lieu C</p></div></div></div>`},{bg:'#fff',textColor:'#0d0d0d'}),
    ]},
];

type TemplateId = 'roadtrip'|'guide'|'rando'|'cityguide'|'film'|'magazine'|'bali'|'postcard'|null;

const MODULAR_TEMPLATES: Record<string,{label:string;icon:string;modules:Module[];accentColor:string;bgColor:string}> = {
  roadtrip:  { label:'Road Trip',      icon:'🚗', modules:ROADTRIP_MODULES,  accentColor:'#e8a020', bgColor:'#0d0d0d' },
  guide:     { label:'Guide pratique', icon:'📖', modules:GUIDE_MODULES,     accentColor:'#2d7a72', bgColor:'#faf8f4' },
  rando:     { label:'Randonnée',      icon:'⛰️', modules:RANDO_MODULES,     accentColor:'#4caf7d', bgColor:'#0f1923' },
  cityguide: { label:'City Guide',     icon:'🌆', modules:CITYGUIDE_MODULES, accentColor:'#c9a84c', bgColor:'#f5f0e8' },
};

// ─── Templates ────────────────────────────────────────────────────────────────
// Each template returns a fresh array of CanvasBlock with new uids
const TEMPLATES: { id: string; label: string; icon: string; desc: string; color: string; canvasH: number; generate: () => any[] }[] = [
  {
    id: 'film',
    label: 'Film Strip',
    icon: '🎞️',
    desc: 'Bande pellicule verticale + grande photo panoramique',
    color: '#1a0a0a',
    canvasH: 1800,
    generate: () => {
      const id = uid;
      return [
        // Dark background
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 0, y: 0, w: 1200, h: 1800, font: 'sans', bg: '#111', textColor: '#fff', fontSize: 1, zIndex: 1 },
        // Film strip bar (left)
        { id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 220, h: 1800, font: 'sans', bg: '#0a0a0a', textColor: '#fff', fontSize: 1, zIndex: 2 },
        // Film perforations top
        { id: id(), type: 'text', data: { html: '<div style="display:flex;flex-direction:column;gap:32px;padding:16px 0;align-items:center">⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛</div>' }, x: 0, y: 0, w: 24, h: 1800, font: 'sans', bg: 'transparent', textColor: '#1a1a1a', fontSize: 0.5, zIndex: 3 },
        { id: id(), type: 'text', data: { html: '<div style="display:flex;flex-direction:column;gap:32px;padding:16px 0;align-items:center">⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛</div>' }, x: 196, y: 0, w: 24, h: 1800, font: 'sans', bg: 'transparent', textColor: '#1a1a1a', fontSize: 0.5, zIndex: 3 },
        // Film photos (left strip)
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 26, y: 40, w: 168, h: 200, font: 'sans', bg: '#222', textColor: '#fff', fontSize: 1, zIndex: 3 },
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 26, y: 268, w: 168, h: 200, font: 'sans', bg: '#222', textColor: '#fff', fontSize: 1, zIndex: 3 },
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 26, y: 496, w: 168, h: 200, font: 'sans', bg: '#222', textColor: '#fff', fontSize: 1, zIndex: 3 },
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 26, y: 724, w: 168, h: 200, font: 'sans', bg: '#222', textColor: '#fff', fontSize: 1, zIndex: 3 },
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 26, y: 952, w: 168, h: 200, font: 'sans', bg: '#222', textColor: '#fff', fontSize: 1, zIndex: 3 },
        // Main title
        { id: id(), type: 'text', data: { html: '<div style="font-family:Bebas Neue,sans-serif;font-size:5.5rem;line-height:0.9;color:#c9a84c;text-transform:uppercase;letter-spacing:0.02em">MON<br/>VOYAGE</div>' }, x: 260, y: 80, w: 680, h: 280, font: 'display', bg: 'transparent', textColor: '#c9a84c', fontSize: 5, zIndex: 4 },
        // Subtitle italic
        { id: id(), type: 'text', data: { html: '<p style="font-family:Fraunces,serif;font-style:italic;font-weight:300;font-size:1.3rem;color:rgba(255,255,255,0.7);line-height:1.6">Racontez votre aventure ici.<br/>Remplacez ce texte par votre histoire.</p>' }, x: 260, y: 370, w: 500, h: 120, font: 'serif', bg: 'transparent', textColor: 'rgba(255,255,255,0.7)', fontSize: 1.2, zIndex: 4 },
        // Big landscape photo
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 240, y: 520, w: 820, h: 480, font: 'sans', bg: '#1a1a1a', textColor: '#fff', fontSize: 1, zIndex: 4 },
        // Season badge
        { id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-weight:700;font-size:0.9rem;letter-spacing:0.18em;text-transform:uppercase;color:#0d0d0d">Été 2024</p>' }, x: 260, y: 1040, w: 180, h: 44, font: 'sans', bg: '#c9a84c', textColor: '#0d0d0d', fontSize: 0.9, zIndex: 5 },
        // Body text
        { id: id(), type: 'text', data: { html: '<p style="line-height:1.8;color:rgba(255,255,255,0.75)">Votre récit de voyage commence ici. Décrivez vos expériences, les lieux que vous avez visités, les rencontres inoubliables et les moments qui ont marqué votre aventure.</p>' }, x: 260, y: 1110, w: 600, h: 180, font: 'sans', bg: 'transparent', textColor: 'rgba(255,255,255,0.75)', fontSize: 1, zIndex: 4 },
        // Quote block
        { id: id(), type: 'quote', data: { text: 'Le voyage est la seule chose que l\'on achète qui nous rend plus riches.', author: '— Anonyme' }, x: 240, y: 1340, w: 720, h: 200, font: 'serif', bg: 'rgba(201,168,76,0.08)', textColor: '#fff', fontSize: 1.3, zIndex: 4 },
        // Second landscape
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 26, y: 1200, w: 168, h: 200, font: 'sans', bg: '#222', textColor: '#fff', fontSize: 1, zIndex: 3 },
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 26, y: 1428, w: 168, h: 200, font: 'sans', bg: '#222', textColor: '#fff', fontSize: 1, zIndex: 3 },
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 26, y: 1560, w: 168, h: 200, font: 'sans', bg: '#222', textColor: '#fff', fontSize: 1, zIndex: 3 },
      ];
    },
  },
  {
    id: 'magazine',
    label: 'Magazine',
    icon: '📰',
    desc: 'Typographie asymétrique, textes croisés, style éditorial',
    color: '#f5f0e8',
    canvasH: 2000,
    generate: () => {
      const id = uid;
      return [
        // Cream background
        { id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 1200, h: 2000, font: 'sans', bg: '#f5f0e8', textColor: '#0d0d0d', fontSize: 1, zIndex: 1 },
        // Giant background letter
        { id: id(), type: 'text', data: { html: '<div style="font-family:Bebas Neue,sans-serif;font-size:32rem;line-height:1;color:rgba(0,0,0,0.04);user-select:none">V</div>' }, x: -40, y: -80, w: 700, h: 700, font: 'display', bg: 'transparent', textColor: 'rgba(0,0,0,0.04)', fontSize: 32, zIndex: 2 },
        // Top eyebrow
        { id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-size:0.65rem;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#c9a84c">— Récit de voyage · Édition 2024</p>' }, x: 80, y: 60, w: 600, h: 36, font: 'sans', bg: 'transparent', textColor: '#c9a84c', fontSize: 0.65, zIndex: 4 },
        // Huge asymmetric title
        { id: id(), type: 'text', data: { html: '<div style="font-family:Bebas Neue,sans-serif;font-size:8rem;line-height:0.88;color:#0d0d0d;text-transform:uppercase;letter-spacing:0.01em">MON<br/>VOYAGE<br/><span style="color:#c9a84c">INCROYABLE</span></div>' }, x: 60, y: 100, w: 700, h: 420, font: 'display', bg: 'transparent', textColor: '#0d0d0d', fontSize: 8, zIndex: 4 },
        // Full bleed hero photo (right side)
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 640, y: 0, w: 560, h: 560, font: 'sans', bg: '#ddd', textColor: '#fff', fontSize: 1, zIndex: 3 },
        // Diagonal accent line
        { id: id(), type: 'divider', data: { style: 'line' }, x: 60, y: 540, w: 400, h: 24, font: 'sans', bg: 'transparent', textColor: '#0d0d0d', fontSize: 1, zIndex: 4 },
        // Lead paragraph — wide
        { id: id(), type: 'text', data: { html: '<p style="font-family:Fraunces,serif;font-style:italic;font-weight:300;font-size:1.4rem;line-height:1.65;color:#0d0d0d">Un voyage qui a tout changé. Des paysages à couper le souffle, des rencontres qui marquent une vie, et des souvenirs que l\'on garde pour toujours.</p>' }, x: 60, y: 574, w: 760, h: 180, font: 'serif', bg: 'transparent', textColor: '#0d0d0d', fontSize: 1.4, zIndex: 4 },
        // Small photo left
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 60, y: 790, w: 360, h: 440, font: 'sans', bg: '#ddd', textColor: '#fff', fontSize: 1, zIndex: 4 },
        // Column text right of small photo
        { id: id(), type: 'text', data: { html: '<p style="line-height:1.85;color:#333;font-size:0.95rem">Racontez ici votre première impression. Comment tout a commencé, l\'arrivée, les premières heures dans ce pays inconnu. Qu\'est-ce qui vous a frappé en premier ?<br/><br/>Continuez votre récit en décrivant les lieux, les odeurs, les sons. Faites vivre votre aventure à travers les mots.</p>' }, x: 460, y: 790, w: 420, h: 300, font: 'sans', bg: 'transparent', textColor: '#333', fontSize: 1, zIndex: 4 },
        // Section label rotated feel
        { id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c9a84c;border-top:2px solid #c9a84c;padding-top:8px">02 — Découvertes</p>' }, x: 460, y: 1110, w: 300, h: 40, font: 'sans', bg: 'transparent', textColor: '#c9a84c', fontSize: 0.62, zIndex: 4 },
        // Full width photo strip
        { id: id(), type: 'gallery', data: { images: [], layout: 'grid' }, x: 0, y: 1280, w: 1200, h: 320, font: 'sans', bg: '#eee', textColor: '#fff', fontSize: 1, zIndex: 4 },
        // Big quote
        { id: id(), type: 'quote', data: { text: 'Chaque lieu nous apprend quelque chose sur nous-mêmes.', author: '' }, x: 100, y: 1650, w: 900, h: 200, font: 'serif', bg: 'transparent', textColor: '#0d0d0d', fontSize: 2, zIndex: 4 },
        // Bottom section — 2 col
        { id: id(), type: 'text', data: { html: '<p style="line-height:1.85;color:#333">Partagez vos impressions finales. Ce voyage valait-il le détour ? Que recommanderiez-vous à quelqu\'un qui veut vivre la même expérience ?</p>' }, x: 60, y: 1880, w: 500, h: 150, font: 'sans', bg: 'transparent', textColor: '#333', fontSize: 1, zIndex: 4 },
        { id: id(), type: 'text', data: { html: '<p style="font-family:Bebas Neue,sans-serif;font-size:5rem;line-height:1;color:rgba(0,0,0,0.06)">FIN</p>' }, x: 700, y: 1860, w: 400, h: 150, font: 'display', bg: 'transparent', textColor: 'rgba(0,0,0,0.06)', fontSize: 5, zIndex: 3 },
      ];
    },
  },
  {
    id: 'bali',
    label: 'Mosaïque',
    icon: '🌿',
    desc: 'Sections alternées image/texte, ambiance nature et luxe',
    color: '#1e3a2f',
    canvasH: 2200,
    generate: () => {
      const id = uid;
      return [
        // Section 1 — Full hero
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 0, y: 0, w: 1200, h: 600, font: 'sans', bg: '#1e3a2f', textColor: '#fff', fontSize: 1, zIndex: 1 },
        { id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 1200, h: 600, font: 'sans', bg: 'linear-gradient(to top,rgba(0,0,0,0.7),transparent)', textColor: '#fff', fontSize: 1, zIndex: 2 },
        { id: id(), type: 'text', data: { html: '<div style="font-family:Fraunces,serif;font-weight:300;font-size:3.5rem;color:white;line-height:1.1">Un paradis<br/><em>retrouvé</em></div>' }, x: 80, y: 400, w: 600, h: 180, font: 'serif', bg: 'transparent', textColor: '#fff', fontSize: 3.5, zIndex: 3 },
        // Section 2 — text left, photo right
        { id: id(), type: 'spacer', data: {}, x: 0, y: 600, w: 1200, h: 400, font: 'sans', bg: '#f5f0e8', textColor: '#0d0d0d', fontSize: 1, zIndex: 1 },
        { id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-size:0.65rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;margin-bottom:16px">01 — Arrivée</p><div style="font-family:Fraunces,serif;font-size:2.2rem;font-weight:300;line-height:1.2;color:#0d0d0d;margin-bottom:20px">Le premier<br/>regard</div><p style="line-height:1.8;color:#555;font-size:0.95rem">Décrivez votre arrivée, vos premières impressions, ce sentiment unique de débarquer dans un pays inconnu.</p>' }, x: 80, y: 640, w: 480, h: 320, font: 'serif', bg: 'transparent', textColor: '#0d0d0d', fontSize: 1, zIndex: 2 },
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 640, y: 600, w: 560, h: 400, font: 'sans', bg: '#ddd', textColor: '#fff', fontSize: 1, zIndex: 2 },
        // Section 3 — full dark + quote
        { id: id(), type: 'spacer', data: {}, x: 0, y: 1000, w: 1200, h: 380, font: 'sans', bg: '#1e3a2f', textColor: '#fff', fontSize: 1, zIndex: 1 },
        { id: id(), type: 'quote', data: { text: 'Certains endroits vous changent. Pas juste pour quelques jours — pour toujours.', author: '' }, x: 120, y: 1040, w: 960, h: 200, font: 'serif', bg: 'transparent', textColor: '#fff', fontSize: 1.8, zIndex: 2 },
        { id: id(), type: 'divider', data: { style: 'dots' }, x: 120, y: 1290, w: 200, h: 40, font: 'sans', bg: 'transparent', textColor: '#c9a84c', fontSize: 1, zIndex: 2 },
        // Section 4 — photo left, text right
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 0, y: 1380, w: 560, h: 420, font: 'sans', bg: '#ddd', textColor: '#fff', fontSize: 1, zIndex: 2 },
        { id: id(), type: 'spacer', data: {}, x: 560, y: 1380, w: 640, h: 420, font: 'sans', bg: '#f0ede8', textColor: '#0d0d0d', fontSize: 1, zIndex: 1 },
        { id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-size:0.65rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;margin-bottom:16px">02 — Découverte</p><div style="font-family:Fraunces,serif;font-size:2rem;font-weight:300;line-height:1.2;color:#0d0d0d;margin-bottom:20px">Les trésors<br/>cachés</div><p style="line-height:1.8;color:#555;font-size:0.92rem">Parlez des endroits inattendus, des ruelles oubliées, des restaurants sans menu, des couchers de soleil volés au détour d\'un chemin.</p>' }, x: 620, y: 1420, w: 480, h: 340, font: 'serif', bg: 'transparent', textColor: '#0d0d0d', fontSize: 1, zIndex: 2 },
        // Section 5 — mosaic gallery
        { id: id(), type: 'gallery', data: { images: [], layout: 'mosaic' }, x: 0, y: 1800, w: 1200, h: 400, font: 'sans', bg: '#111', textColor: '#fff', fontSize: 1, zIndex: 2 },
      ];
    },
  },
  {
    id: 'postcard',
    label: 'Carte Postale',
    icon: '🏷️',
    desc: 'Grande photo pleine page avec titre monumental',
    color: '#0d0d0d',
    canvasH: 1400,
    generate: () => {
      const id = uid;
      return [
        // Full bleed photo
        { id: id(), type: 'photo', data: { url: '', caption: '' }, x: 0, y: 0, w: 1200, h: 1400, font: 'sans', bg: '#111', textColor: '#fff', fontSize: 1, zIndex: 1 },
        // Gradient overlay bottom
        { id: id(), type: 'spacer', data: {}, x: 0, y: 600, w: 1200, h: 800, font: 'sans', bg: 'linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.4) 50%,transparent 100%)', textColor: '#fff', fontSize: 1, zIndex: 2 },
        // Gradient overlay top subtle
        { id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 1200, h: 300, font: 'sans', bg: 'linear-gradient(to bottom,rgba(0,0,0,0.4),transparent)', textColor: '#fff', fontSize: 1, zIndex: 2 },
        // Top label
        { id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-size:0.65rem;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.6)">Odyssey · Récit de voyage</p>' }, x: 60, y: 50, w: 500, h: 36, font: 'sans', bg: 'transparent', textColor: 'rgba(255,255,255,0.6)', fontSize: 0.65, zIndex: 4 },
        // Country badge top right
        { id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-weight:700;font-size:0.75rem;letter-spacing:0.14em;text-transform:uppercase;color:#0d0d0d;text-align:center">📍 PAYS</p>' }, x: 980, y: 40, w: 170, h: 44, font: 'sans', bg: '#c9a84c', textColor: '#0d0d0d', fontSize: 0.75, zIndex: 4 },
        // Giant destination name
        { id: id(), type: 'text', data: { html: '<div style="font-family:Bebas Neue,sans-serif;font-size:10rem;line-height:0.85;color:white;text-transform:uppercase;letter-spacing:0.02em;text-shadow:0 4px 40px rgba(0,0,0,0.5)">DESTI<br/>NATION</div>' }, x: 50, y: 720, w: 900, h: 400, font: 'display', bg: 'transparent', textColor: '#fff', fontSize: 10, zIndex: 4 },
        // Tagline
        { id: id(), type: 'text', data: { html: '<p style="font-family:Fraunces,serif;font-style:italic;font-weight:300;font-size:1.4rem;color:rgba(255,255,255,0.8);line-height:1.5">Remplacez ce texte par une phrase qui<br/>capture l\'essence de votre voyage.</p>' }, x: 60, y: 1150, w: 700, h: 140, font: 'serif', bg: 'transparent', textColor: 'rgba(255,255,255,0.8)', fontSize: 1.4, zIndex: 4 },
        // Date + duration
        { id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-size:0.8rem;font-weight:500;letter-spacing:0.12em;color:rgba(255,255,255,0.5)">Été 2024 · 14 jours</p>' }, x: 60, y: 1330, w: 400, h: 40, font: 'sans', bg: 'transparent', textColor: 'rgba(255,255,255,0.5)', fontSize: 0.8, zIndex: 4 },
        // Watermark right
        { id: id(), type: 'text', data: { html: '<p style="font-family:Fraunces,serif;font-size:1rem;font-weight:300;letter-spacing:0.2em;color:rgba(255,255,255,0.25);text-align:right">Odyssey</p>' }, x: 900, y: 1330, w: 260, h: 40, font: 'serif', bg: 'transparent', textColor: 'rgba(255,255,255,0.25)', fontSize: 1, zIndex: 4 },
      ];
    },
  },
];

// ─── Template Modal ───────────────────────────────────────────────────────────
function TemplateModal({ onApply, onClose }: {
  onApply: (blocks: any[], canvasH: number) => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'relative', width: '90vw', maxWidth: 900, background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: '1.5rem', fontWeight: 300, color: 'white', marginBottom: 4 }}>Choisir un template</h2>
            <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', color: '#555' }}>Blocs pré-placés · Tout est modifiable après application</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 22, padding: '4px 8px' }}>×</button>
        </div>
        {/* Grid */}
        <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '1rem' }}>
          {TEMPLATES.map(tpl => (
            <div key={tpl.id}
              onMouseEnter={() => setHovered(tpl.id)} onMouseLeave={() => setHovered(null)}
              onClick={() => { onApply(tpl.generate(), tpl.canvasH); onClose(); }}
              style={{ cursor: 'pointer', border: `2px solid ${hovered === tpl.id ? '#c9a84c' : '#2a2a2a'}`, borderRadius: 4, overflow: 'hidden', transition: 'all 0.2s', transform: hovered === tpl.id ? 'translateY(-3px)' : 'none' }}>
              {/* Preview */}
              <div style={{ height: 160, background: tpl.color, position: 'relative', overflow: 'hidden' }}>
                {tpl.id === 'film' && (
                  <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                    <div style={{ width: '26%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 6px' }}>
                      {[0,1,2,3,4].map(i => <div key={i} style={{ height: 22, background: '#2a2a2a', borderRadius: 1 }} />)}
                    </div>
                    <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontFamily: 'sans-serif', fontSize: '2rem', fontWeight: 900, lineHeight: 0.9, color: '#c9a84c', letterSpacing: '0.05em' }}>MON<br/>VOYAGE</div>
                      <div style={{ height: 50, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }} />
                      <div style={{ height: 16, background: 'rgba(201,168,76,0.3)', width: '50%', borderRadius: 1 }} />
                    </div>
                  </div>
                )}
                {tpl.id === 'magazine' && (
                  <div style={{ width: '100%', height: '100%', background: '#f5f0e8', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -10, left: 6, fontFamily: 'sans-serif', fontSize: '6rem', fontWeight: 900, color: 'rgba(0,0,0,0.06)', lineHeight: 1 }}>M</div>
                    <div style={{ position: 'absolute', top: 8, left: 10, fontFamily: 'sans-serif', fontSize: '2.8rem', fontWeight: 900, lineHeight: 0.88, color: '#0d0d0d' }}>MAG<br/><span style={{ color: '#c9a84c' }}>AZINE</span></div>
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '40%', height: '65%', background: '#bbb' }} />
                    <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, height: 28, background: 'rgba(0,0,0,0.06)', borderRadius: 2 }} />
                    <div style={{ position: 'absolute', bottom: 46, left: 10, width: 60, height: 4, background: '#c9a84c', borderRadius: 2 }} />
                  </div>
                )}
                {tpl.id === 'bali' && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ flex: 3, background: '#2d5a45', display: 'flex', alignItems: 'flex-end', padding: '8px 10px' }}>
                      <div style={{ fontFamily: 'sans-serif', fontSize: '1.3rem', fontStyle: 'italic', fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>Un paradis retrouvé</div>
                    </div>
                    <div style={{ flex: 2, display: 'flex', gap: 2 }}>
                      <div style={{ flex: 1, background: '#f5f0e8', padding: 8 }}>
                        <div style={{ height: 5, background: '#c9a84c', width: '50%', marginBottom: 5, borderRadius: 1 }} />
                        <div style={{ height: 4, background: '#ccc', width: '80%', borderRadius: 1 }} />
                        <div style={{ height: 4, background: '#ccc', width: '65%', marginTop: 3, borderRadius: 1 }} />
                      </div>
                      <div style={{ flex: 1, background: '#8aab95' }} />
                    </div>
                    <div style={{ height: 24, background: '#1e3a2f' }} />
                  </div>
                )}
                {tpl.id === 'postcard' && (
                  <div style={{ width: '100%', height: '100%', background: '#1e1e1e', position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.2) 100%)' }} />
                    <div style={{ position: 'relative', zIndex: 2, padding: '10px 12px' }}>
                      <div style={{ fontFamily: 'sans-serif', fontSize: '2.5rem', fontWeight: 900, lineHeight: 0.88, color: 'white', letterSpacing: '0.02em' }}>DESTI<br/>NATION</div>
                      <div style={{ fontFamily: 'sans-serif', fontStyle: 'italic', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>Une phrase qui capture votre voyage…</div>
                    </div>
                    <div style={{ position: 'absolute', top: 8, right: 8, background: '#c9a84c', padding: '4px 10px', zIndex: 2 }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#0d0d0d' }}>📍 PAYS</div>
                    </div>
                  </div>
                )}
                {/* Hover */}
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(201,168,76,0.18)', opacity: hovered === tpl.id ? 1 : 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', fontWeight: 700, color: '#0d0d0d', background: '#c9a84c', padding: '0.5rem 1.25rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Utiliser ce template →</span>
                </div>
              </div>
              {/* Info */}
              <div style={{ padding: '0.85rem 1rem', background: '#161616' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.88rem', fontWeight: 600, color: '#e0e0e0' }}>{tpl.label}</span>
                </div>
                <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#555', lineHeight: 1.5 }}>{tpl.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Footer */}
        <div style={{ padding: '1rem 2rem', borderTop: '1px solid #1e1e1e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#444' }}>⚠️ Appliquer remplace les blocs actuels du canvas</p>
          <button type="button" onClick={onClose} style={{ padding: '0.45rem 1.25rem', background: 'transparent', border: '1px solid #2a2a2a', color: '#666', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', borderRadius: 3 }}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

function Stars({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(String(n))}
          style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: Number(value) >= n ? '#c9a84c' : '#444' }}>★</button>
      ))}
    </div>
  );
}

// ─── Block content (what's rendered inside each block on canvas) ──────────────
// ─── TextBlock — composant séparé pour éviter le bug de curseur contentEditable ─
// Le problème : utiliser dangerouslySetInnerHTML + contentEditable ensemble
// fait que React remet le curseur au début à chaque re-render (chaque frappe).
// Solution : initialiser le DOM une seule fois via useEffect([]),
// puis laisser le navigateur gérer l'état du DOM nativement.
function TextBlock({ data, font, color, fontSize, onChange }: {
  data: any; font: string; color: string; fontSize: number;
  onChange: (d: any) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Initialisation unique au montage — ne JAMAIS passer dangerouslySetInnerHTML
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = data.html || '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← tableau vide = une seule fois, le curseur ne sera jamais resetté

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange({ ...data, html: ref.current.innerHTML }); }}
        data-ph="Cliquez pour écrire…"
        style={{
          flex: 1, outline: 'none', padding: '0.4rem',
          fontFamily: font, fontSize: `${fontSize}rem`,
          color, lineHeight: 1.75, wordBreak: 'break-word',
          overflowY: 'auto', cursor: 'text',
        }}
      />
      <style>{`[data-ph]:empty:before{content:attr(data-ph);color:rgba(150,150,150,0.4);pointer-events:none;font-style:italic}`}</style>
    </div>
  );
}

function BlockContent({ block, onChange, onUpload }: {
  block: CanvasBlock;
  onChange: (data: any) => void;
  onUpload: (f: File) => Promise<string | null>;
}) {
  const d = block.data;
  const font = FONT_MAP[block.font];
  const color = block.textColor;

  const iS: React.CSSProperties = {
    width: '100%', padding: '0.4rem 0.6rem',
    border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)',
    color: 'inherit', fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem',
    outline: 'none', borderRadius: 2, boxSizing: 'border-box' as const,
  };

  switch (block.type) {

    case 'text':
      return <TextBlock data={d} font={font} color={color} fontSize={block.fontSize} onChange={onChange} />;

    case 'quote':
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0.5rem', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: '0.5rem', fontFamily: "'Fraunces',serif", fontSize: '5rem', color: 'rgba(201,168,76,0.25)', lineHeight: 1, pointerEvents: 'none' }}>"</div>
          <textarea
            value={d.text} placeholder="Votre citation…"
            onChange={e => onChange({ ...d, text: e.target.value })}
            style={{ ...iS, flex: 1, resize: 'none', fontFamily: font, fontSize: `${block.fontSize}rem`, fontStyle: 'italic', background: 'transparent', border: 'none', color, lineHeight: 1.6, zIndex: 1 }}
          />
          <input value={d.author} placeholder="— Auteur" onChange={e => onChange({ ...d, author: e.target.value })}
            style={{ ...iS, fontSize: '0.75rem', color: '#c9a84c', background: 'transparent', border: 'none', marginTop: 4 }} />
        </div>
      );

    case 'photo':
      return d.url ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <img src={d.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {d.caption && (
            <p style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.4rem 0.75rem', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '0.72rem', fontStyle: 'italic' }}>{d.caption}</p>
          )}
          <button type="button" onClick={() => onChange({ ...d, url: '' })}
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.15)' }}>
          <span style={{ fontSize: 32, opacity: 0.4 }}>🖼️</span>
          <label style={{ padding: '0.45rem 1rem', background: '#c9a84c', color: '#0d0d0d', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'DM Sans',system-ui", fontWeight: 600 }}>
            📁 Choisir une photo
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return;
              const url = await onUpload(f); if (url) onChange({ ...d, url });
            }} />
          </label>
          <input type="text" placeholder="ou coller une URL…" style={{ ...iS, width: '80%', textAlign: 'center' }}
            onBlur={e => { if (e.target.value) onChange({ ...d, url: optimizeImageUrl(e.target.value) }); }}
            onChange={e => { if (e.target.value) onChange({ ...d, url: e.target.value }); }} />
        </div>
      );

    case 'gallery': {
      const images: string[] = d.images || [];
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          {images.length === 0 ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, border: '1.5px dashed rgba(255,255,255,0.15)' }}>
              <span style={{ fontSize: 28, opacity: 0.4 }}>🗂️</span>
              <label style={{ padding: '0.4rem 0.85rem', background: '#c9a84c', color: '#0d0d0d', cursor: 'pointer', fontSize: '0.72rem', fontFamily: "'DM Sans',system-ui", fontWeight: 600 }}>
                📁 Ajouter des photos
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={async e => {
                  const files = Array.from(e.target.files || []);
                  const urls: string[] = [];
                  for (const f of files) { const u = await onUpload(f); if (u) urls.push(u); }
                  onChange({ ...d, images: [...images, ...urls] });
                }} />
              </label>
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {d.layout === 'mosaic' && images.length >= 2 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 3, height: '100%' }}>
                  <img src={images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ display: 'grid', gap: 3 }}>
                    {images.slice(1, 4).map((img, i) => (
                      <img key={i} src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, 1fr)`, gap: 3, height: '100%' }}>
                  {images.map((img, i) => <img key={i} src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
                </div>
              )}
              <button type="button" onClick={() => onChange({ ...d, images: [] })}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
          )}
        </div>
      );
    }

    case 'hotel':
      return (
        <div style={{ padding: '0.75rem', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🏨</span>
            <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c9a84c' }}>Hôtel</span>
          </div>
          <input style={iS} value={d.name} placeholder="Nom de l'hôtel *" onChange={e => onChange({ ...d, name: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <input style={iS} value={d.price} placeholder="Prix / nuit" onChange={e => onChange({ ...d, price: e.target.value })} />
            <Stars value={d.rating} onChange={v => onChange({ ...d, rating: v })} />
          </div>
          <input style={iS} value={d.link} placeholder="Lien réservation" onChange={e => onChange({ ...d, link: e.target.value })} />
          <textarea style={{ ...iS, flex: 1, resize: 'none' }} value={d.review} placeholder="Votre avis…" onChange={e => onChange({ ...d, review: e.target.value })} />
          {d.name && <div style={{ padding: '0.4rem 0.75rem', background: 'rgba(201,168,76,0.15)', borderLeft: '2px solid #c9a84c', fontSize: '0.82rem', color }}>✓ {d.name}{d.price ? ` · ${d.price}` : ''}</div>}
        </div>
      );

    case 'restaurant':
      return (
        <div style={{ padding: '0.75rem', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🍽️</span>
            <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e88c4a' }}>Restaurant</span>
          </div>
          <input style={iS} value={d.name} placeholder="Nom du restaurant *" onChange={e => onChange({ ...d, name: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <input style={iS} value={d.cuisine} placeholder="Cuisine" onChange={e => onChange({ ...d, cuisine: e.target.value })} />
            <input style={iS} value={d.price} placeholder="Budget" onChange={e => onChange({ ...d, price: e.target.value })} />
          </div>
          <Stars value={d.rating} onChange={v => onChange({ ...d, rating: v })} />
          <textarea style={{ ...iS, flex: 1, resize: 'none' }} value={d.review} placeholder="Votre avis…" onChange={e => onChange({ ...d, review: e.target.value })} />
        </div>
      );

    case 'pros_cons':
      return (
        <div style={{ padding: '0.75rem', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', overflowY: 'auto' }}>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4caf7d', marginBottom: 8 }}>✅ Pour</p>
            {d.pros.map((p: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                <input style={{ ...iS, flex: 1 }} value={p} placeholder="Atout…"
                  onChange={e => { const a = [...d.pros]; a[i] = e.target.value; onChange({ ...d, pros: a }); }} />
                <button type="button" onClick={() => onChange({ ...d, pros: d.pros.filter((_: any, j: number) => j !== i) })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 16 }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => onChange({ ...d, pros: [...d.pros, ''] })}
              style={{ fontSize: '0.72rem', color: '#4caf7d', background: 'none', border: 'none', cursor: 'pointer' }}>+ Ajouter</button>
          </div>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#e05555', marginBottom: 8 }}>❌ Contre</p>
            {d.cons.map((c: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                <input style={{ ...iS, flex: 1 }} value={c} placeholder="Inconvénient…"
                  onChange={e => { const a = [...d.cons]; a[i] = e.target.value; onChange({ ...d, cons: a }); }} />
                <button type="button" onClick={() => onChange({ ...d, cons: d.cons.filter((_: any, j: number) => j !== i) })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 16 }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => onChange({ ...d, cons: [...d.cons, ''] })}
              style={{ fontSize: '0.72rem', color: '#e05555', background: 'none', border: 'none', cursor: 'pointer' }}>+ Ajouter</button>
          </div>
        </div>
      );

    case 'divider':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
          {d.style === 'dots' ? (
            <div style={{ width: '100%', textAlign: 'center', letterSpacing: '0.5em', color: '#c9a84c' }}>· · · · ·</div>
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
      return <div style={{ width: '100%', height: '100%', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 2 }} />;

    default: return null;
  }
}

// ─── Canvas block (draggable + resizable) ─────────────────────────────────────
const RESIZE_HANDLES = ['se','sw','ne','nw','n','s','e','w'] as const;
type Handle = typeof RESIZE_HANDLES[number];

function CanvasBlockEl({ block, selected, onSelect, onUpdate, onDelete, onUpload }: {
  block: CanvasBlock;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (b: CanvasBlock) => void;
  onDelete: () => void;
  onUpload: (f: File) => Promise<string | null>;
}) {
  const dragStart = useRef<{ mx: number; my: number; bx: number; by: number } | null>(null);
  const resizeStart = useRef<{ mx: number; my: number; bx: number; by: number; bw: number; bh: number; handle: Handle } | null>(null);

  const onMouseDownDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.resize) return;
    onSelect();
    dragStart.current = { mx: e.clientX, my: e.clientY, bx: block.x, by: block.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
      onUpdate({ ...block, x: Math.max(0, dragStart.current.bx + dx), y: Math.max(0, dragStart.current.by + dy) });
    };
    const onUp = () => { dragStart.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onMouseDownResize = (e: React.MouseEvent, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    resizeStart.current = { mx: e.clientX, my: e.clientY, bx: block.x, by: block.y, bw: block.w, bh: block.h, handle };

    const onMove = (ev: MouseEvent) => {
      if (!resizeStart.current) return;
      const { mx, my, bx, by, bw, bh, handle } = resizeStart.current;
      const dx = ev.clientX - mx;
      const dy = ev.clientY - my;
      let nx = bx, ny = by, nw = bw, nh = bh;

      if (handle.includes('e')) nw = Math.max(80, bw + dx);
      if (handle.includes('s')) nh = Math.max(40, bh + dy);
      if (handle.includes('w')) { nw = Math.max(80, bw - dx); nx = bx + (bw - nw); }
      if (handle.includes('n')) { nh = Math.max(40, bh - dy); ny = by + (bh - nh); }

      onUpdate({ ...block, x: nx, y: ny, w: nw, h: nh });
    };
    const onUp = () => { resizeStart.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleCursors: Record<Handle, string> = {
    se:'se-resize', sw:'sw-resize', ne:'ne-resize', nw:'nw-resize',
    n:'n-resize', s:'s-resize', e:'e-resize', w:'w-resize',
  };
  const handlePositions: Record<Handle, React.CSSProperties> = {
    se:{ bottom:-5, right:-5 }, sw:{ bottom:-5, left:-5 },
    ne:{ top:-5, right:-5 },   nw:{ top:-5, left:-5 },
    n: { top:-5, left:'50%', transform:'translateX(-50%)' },
    s: { bottom:-5, left:'50%', transform:'translateX(-50%)' },
    e: { top:'50%', right:-5, transform:'translateY(-50%)' },
    w: { top:'50%', left:-5, transform:'translateY(-50%)' },
  };

  return (
    <div
      onMouseDown={e => { e.stopPropagation(); onMouseDownDrag(e); }}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: block.x, top: block.y,
        width: block.w, height: block.h,
        zIndex: block.zIndex,
        background: block.bg || 'transparent',
        color: block.textColor,
        cursor: 'move',
        outline: selected ? '2px solid #c9a84c' : '1px solid rgba(255,255,255,0.06)',
        outlineOffset: selected ? 2 : 0,
        userSelect: 'none',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Content — pointer-events only when selected to avoid drag conflict */}
      <div style={{ width: '100%', height: '100%', pointerEvents: selected ? 'all' : 'none', cursor: selected ? 'auto' : 'move' }}
        onMouseDown={e => selected && e.stopPropagation()}>
        <BlockContent block={block} onChange={data => onUpdate({ ...block, data })} onUpload={onUpload} />
      </div>

      {/* Controls (only when selected) */}
      {selected && (
        <>
          {/* Top bar */}
          <div style={{ position: 'absolute', top: -32, left: 0, height: 28, display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', background: '#c9a84c', zIndex: 10 }}
            onMouseDown={e => e.stopPropagation()}>
            <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', fontWeight: 700, color: '#0d0d0d', letterSpacing: '0.1em', textTransform: 'uppercase', paddingRight: 8 }}>
              {SIDEBAR_CATS.flatMap(c => c.items).find(i => i.type === block.type)?.label || block.type}
            </span>
            {/* Bring forward / send back */}
            <button type="button" title="Avancer" onClick={() => onUpdate({ ...block, zIndex: block.zIndex + 1 })}
              style={{ background: 'rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer', color: '#0d0d0d', fontSize: 12, padding: '2px 6px', borderRadius: 2 }}>↑</button>
            <button type="button" title="Reculer" onClick={() => onUpdate({ ...block, zIndex: Math.max(1, block.zIndex - 1) })}
              style={{ background: 'rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer', color: '#0d0d0d', fontSize: 12, padding: '2px 6px', borderRadius: 2 }}>↓</button>
            <button type="button" title="Dupliquer" onClick={() => onUpdate({ ...block, id: uid(), x: block.x + 20, y: block.y + 20 })}
              style={{ background: 'rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer', color: '#0d0d0d', fontSize: 12, padding: '2px 6px', borderRadius: 2 }}>⧉</button>
            <button type="button" title="Supprimer (Del)" onClick={onDelete}
              style={{ background: '#c0392b', border: 'none', cursor: 'pointer', color: 'white', fontSize: 13, padding: '2px 10px', borderRadius: 2, marginLeft: 4, fontFamily: "'DM Sans',system-ui", fontWeight: 700, letterSpacing: '0.06em' }}>✕ Suppr.</button>
          </div>

          {/* Resize handles */}
          {RESIZE_HANDLES.map(h => (
            <div key={h} data-resize={h}
              onMouseDown={e => onMouseDownResize(e, h)}
              style={{
                position: 'absolute', ...handlePositions[h],
                width: 10, height: 10,
                background: '#c9a84c', border: '1.5px solid white',
                cursor: handleCursors[h],
                zIndex: 20,
                borderRadius: 2,
                pointerEvents: 'all',
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Right properties panel ───────────────────────────────────────────────────
function PropsPanel({ block, onUpdate }: { block: CanvasBlock; onUpdate: (b: CanvasBlock) => void }) {
  const lS: React.CSSProperties = { display: 'block', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#666', marginBottom: '0.35rem', fontFamily: "'DM Sans',system-ui" };
  const iS: React.CSSProperties = { width: '100%', padding: '0.45rem 0.65rem', border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#e0e0e0', fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', outline: 'none', borderRadius: 2, boxSizing: 'border-box' as const };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <p style={{ ...lS, color: '#c9a84c', fontSize: '0.65rem', marginBottom: '0.75rem' }}>POSITION & TAILLE</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[{k:'x',l:'X'},{k:'y',l:'Y'},{k:'w',l:'L'},{k:'h',l:'H'}].map(({k,l}) => (
            <div key={k}>
              <label style={lS}>{l}</label>
              <input type="number" style={iS} value={Math.round((block as any)[k])}
                onChange={e => onUpdate({ ...block, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p style={{ ...lS, color: '#c9a84c', fontSize: '0.65rem', marginBottom: '0.75rem' }}>FOND</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {BG_PRESETS.map(p => (
            <button key={p.value} type="button" title={p.label}
              onClick={() => onUpdate({ ...block, bg: p.value })}
              style={{ width: 28, height: 28, background: p.value === 'transparent' ? 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 10px 10px' : p.value, border: `2px solid ${block.bg === p.value ? '#c9a84c' : '#2a2a2a'}`, cursor: 'pointer', borderRadius: 3 }} />
          ))}
        </div>
        <input type="text" style={iS} value={block.bg} placeholder="CSS custom…"
          onChange={e => onUpdate({ ...block, bg: e.target.value })} />
      </div>

      <div>
        <p style={{ ...lS, color: '#c9a84c', fontSize: '0.65rem', marginBottom: '0.75rem' }}>TEXTE</p>
        <div style={{ marginBottom: 8 }}>
          <label style={lS}>Couleur</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#ffffff','#0d0d0d','#c9a84c','#faf8f4','#aaaaaa'].map(c => (
              <button key={c} type="button" onClick={() => onUpdate({ ...block, textColor: c })}
                style={{ width: 24, height: 24, background: c, border: `2px solid ${block.textColor === c ? '#c9a84c' : '#333'}`, cursor: 'pointer', borderRadius: '50%' }} />
            ))}
            <input type="color" value={block.textColor} onChange={e => onUpdate({ ...block, textColor: e.target.value })}
              style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', padding: 0, background: 'none' }} />
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={lS}>Police</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {([{v:'sans',l:'Sans'},{v:'serif',l:'Serif'},{v:'display',l:'Display'}] as {v:FontStyle,l:string}[]).map(({v,l}) => (
              <button key={v} type="button" onClick={() => onUpdate({ ...block, font: v })}
                style={{ flex:1, padding:'3px 4px', border:'1px solid', borderRadius:2, cursor:'pointer', fontSize:'0.68rem', fontFamily: FONT_MAP[v],
                  borderColor: block.font===v?'#c9a84c':'#2a2a2a', background: block.font===v?'rgba(201,168,76,0.15)':'transparent', color: block.font===v?'#c9a84c':'#888' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={lS}>Taille ({block.fontSize.toFixed(1)}rem)</label>
          <input type="range" min="0.7" max="4" step="0.1" value={block.fontSize}
            onChange={e => onUpdate({ ...block, fontSize: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#c9a84c' }} />
        </div>
      </div>

      <div>
        <p style={{ ...lS, color: '#c9a84c', fontSize: '0.65rem', marginBottom: '0.5rem' }}>ORDRE Z</p>
        <input type="number" style={iS} value={block.zIndex}
          onChange={e => onUpdate({ ...block, zIndex: Number(e.target.value) })} />
      </div>
    </div>
  );
}

// ─── Left sidebar ─────────────────────────────────────────────────────────────
function Sidebar({ onAdd, onTemplate, onAddModule, activeTemplate, setActiveTemplate, canvasH, setCanvasH }: {
  onAdd: (type: BlockType, defaults: { w: number; h: number; data: any }) => void;
  onTemplate: () => void;
  onAddModule: (mod: Module) => void;
  activeTemplate: string | null;
  setActiveTemplate: (t: string | null) => void;
  canvasH: number; setCanvasH: (h: number) => void;
}) {
  const [open, setOpen] = useState<string[]>(['texte','medias','voyage']);
  const [tab, setTab] = useState<'elements'|'modules'>('elements');
  const toggle = (id: string) => setOpen(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const activeMod = activeTemplate ? MODULAR_TEMPLATES[activeTemplate] : null;

  return (
    <div style={{ width: 240, flexShrink: 0, background: '#111', borderRight: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Template / Modules CTA ── */}
      <div style={{ padding: '0.75rem', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <button type="button" onClick={onTemplate}
          style={{ width: '100%', padding: '0.6rem', background: 'linear-gradient(135deg,#1e3a2f,#c9a84c)', border: 'none', cursor: 'pointer', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onMouseEnter={e => (e.currentTarget.style.opacity='0.85')} onMouseLeave={e => (e.currentTarget.style.opacity='1')}>
          <span style={{ fontSize: 15 }}>✨</span>
          <span style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.75rem', fontWeight:700, color:'white', letterSpacing:'0.08em', textTransform:'uppercase' }}>Templates visuels</span>
        </button>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        {(['elements','modules'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            style={{ flex: 1, padding: '0.6rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily:"'DM Sans',system-ui", fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', transition:'all 0.2s',
              color: tab===t ? '#c9a84c' : '#444',
              borderBottom: tab===t ? '2px solid #c9a84c' : '2px solid transparent' }}>
            {t === 'elements' ? '⊞ Éléments' : '📐 Modules'}
          </button>
        ))}
      </div>

      {/* ── ELEMENTS TAB ── */}
      {tab === 'elements' && (
        <div style={{ flex:1, overflowY:'auto', padding:'0.5rem 0' }}>
          {SIDEBAR_CATS.map(cat => (
            <div key={cat.id}>
              <button type="button" onClick={() => toggle(cat.id)}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.6rem 1rem', background:'none', border:'none', cursor:'pointer' }}>
                <span style={{ display:'flex', alignItems:'center', gap:8, fontFamily:"'DM Sans',system-ui", fontSize:'0.78rem', fontWeight:600, color:'#ccc' }}>
                  <span>{cat.icon}</span>{cat.label}
                </span>
                <span style={{ fontSize:9, color:'#555', transform: open.includes(cat.id)?'rotate(180deg)':'none', display:'inline-block', transition:'transform 0.2s' }}>▼</span>
              </button>
              {open.includes(cat.id) && (
                <div style={{ padding:'0 0.5rem 0.5rem' }}>
                  {cat.items.map(item => (
                    <button key={item.type+item.label} type="button"
                      onClick={() => onAdd(item.type, { w:item.w, h:item.h, data:item.data })}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'0.5rem 0.7rem', marginBottom:3, background:'rgba(255,255,255,0.03)', border:'1px solid #1e1e1e', cursor:'pointer', borderRadius:3, textAlign:'left', transition:'all 0.2s' }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor='#c9a84c'; e.currentTarget.style.background='rgba(201,168,76,0.07)'; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='#1e1e1e'; e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}>
                      <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
                      <span style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.75rem', fontWeight:500, color:'#ccc' }}>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── MODULES TAB ── */}
      {tab === 'modules' && (
        <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
          {/* Template selector */}
          <div style={{ padding:'0.6rem 0.75rem', borderBottom:'1px solid #1a1a1a' }}>
            <p style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:'#444', marginBottom:'0.5rem' }}>Type de récit actif</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
              {Object.entries(MODULAR_TEMPLATES).map(([key, tpl]) => (
                <button key={key} type="button" onClick={() => setActiveTemplate(activeTemplate===key ? null : key)}
                  style={{ padding:'0.45rem 0.4rem', border:`1px solid ${activeTemplate===key ? tpl.accentColor : '#2a2a2a'}`, background: activeTemplate===key ? `${tpl.accentColor}18` : 'transparent', cursor:'pointer', borderRadius:3, display:'flex', alignItems:'center', gap:5, transition:'all 0.2s' }}>
                  <span style={{ fontSize:14 }}>{tpl.icon}</span>
                  <span style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.65rem', fontWeight:600, color: activeTemplate===key ? tpl.accentColor : '#666', lineHeight:1.2 }}>{tpl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Module buttons */}
          {activeMod ? (
            <div style={{ padding:'0.6rem 0.75rem', flex:1 }}>
              <p style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color: activeMod.accentColor, marginBottom:'0.6rem' }}>
                {activeMod.icon} Modules {activeMod.label}
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {activeMod.modules.map(mod => (
                  <button key={mod.id} type="button" onClick={() => onAddModule(mod)}
                    style={{ width:'100%', padding:'0.6rem 0.75rem', border:`1px solid #2a2a2a`, background:'rgba(255,255,255,0.03)', cursor:'pointer', borderRadius:3, textAlign:'left', display:'flex', alignItems:'center', gap:8, transition:'all 0.2s' }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor=activeMod.accentColor; e.currentTarget.style.background=`${activeMod.accentColor}12`; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor='#2a2a2a'; e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}>
                    <span style={{ fontSize:16 }}>{mod.icon}</span>
                    <span style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.73rem', fontWeight:500, color:'#ccc', lineHeight:1.35 }}>{mod.label}</span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop:'1rem', padding:'0.75rem', background:'rgba(255,255,255,0.03)', borderRadius:3, border:'1px dashed #2a2a2a' }}>
                <p style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.65rem', color:'#555', lineHeight:1.6 }}>
                  Chaque module s'empile sous le contenu existant. Tout reste déplaçable et personnalisable.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem 1rem', gap:10 }}>
              <span style={{ fontSize:32, opacity:0.3 }}>📐</span>
              <p style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.78rem', color:'#444', textAlign:'center', lineHeight:1.6 }}>
                Choisissez un type de récit pour afficher ses modules
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Canvas height ── */}
      <div style={{ padding:'0.65rem 0.75rem', borderTop:'1px solid #1e1e1e', flexShrink:0 }}>
        <p style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#444', marginBottom:5 }}>Hauteur canvas</p>
        <div style={{ display:'flex', gap:5 }}>
          <input type="number" value={canvasH} min={800} step={200}
            onChange={e => setCanvasH(Number(e.target.value))}
            style={{ flex:1, padding:'0.4rem 0.5rem', background:'#1a1a1a', border:'1px solid #2a2a2a', color:'#ccc', fontFamily:"'DM Sans',system-ui", fontSize:'0.75rem', outline:'none', borderRadius:2 }} />
          <button type="button" onClick={() => setCanvasH(canvasH + 800)}
            style={{ padding:'0.4rem 0.6rem', background:'#c9a84c', color:'#0d0d0d', border:'none', cursor:'pointer', fontFamily:"'DM Sans',system-ui", fontSize:'0.75rem', fontWeight:700, borderRadius:2 }}>+</button>
        </div>
      </div>
    </div>
  );
}

// ─── Steps indicator ──────────────────────────────────────────────────────────
function Steps({ current }: { current: number }) {
  const steps = ['Détails', 'Couverture', 'Mise en page', 'Publier'];
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.3s',
              background: i < current ? '#c9a84c' : i === current ? 'white' : '#2a2a2a',
              color: i < current ? '#0d0d0d' : i === current ? '#0d0d0d' : '#555' }}>
              {i < current ? '✓' : i + 1}
            </div>
            <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 5, whiteSpace: 'nowrap', color: i === current ? 'white' : '#555' }}>{s}</span>
          </div>
          {i < steps.length - 1 && <div style={{ height: 1, flex: 1, marginBottom: 16, background: i < current ? '#c9a84c' : '#2a2a2a', transition: 'background 0.3s' }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CreateTrip() {
  const supabase = createClientComponentClient();
  const [isMounted, setIsMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Metadata
  const [meta, setMeta] = useState<Metadata>({ country:'',city:'',travelers:'1',duration:'',budget:'',category:'',season:'' });

  // Cover
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  // Canvas
  const [blocks, setBlocks] = useState<CanvasBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasH, setCanvasH] = useState(1600);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  // Compteurs par module pour numérotation (Jour 1, Jour 2…)
  const moduleCounters = useRef<Record<string, number>>({});

  const applyTemplate = (newBlocks: any[], newH: number) => {
    setBlocks(newBlocks);
    setCanvasH(newH);
    setSelectedId(null);
    moduleCounters.current = {};
  };

  // Calcule le bas du dernier bloc + marge, puis empile le module
  const addModule = useCallback((mod: Module) => {
    const bottomY = blocks.length > 0
      ? Math.max(...blocks.map(b => b.y + b.h)) + 40
      : 80;
    const count = moduleCounters.current[mod.id] || 0;
    moduleCounters.current[mod.id] = count + 1;
    const rawBlocks = mod.generate(bottomY, count);
    const newBlocks: CanvasBlock[] = rawBlocks.map(b => ({ ...b, id: uid() }));
    const totalH = Math.max(...newBlocks.map(b => b.y + b.h)) + 60;
    if (totalH > canvasH) setCanvasH(totalH);
    setBlocks(p => [...p, ...newBlocks]);
    setSelectedId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, canvasH]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const maxZ = blocks.reduce((m, b) => Math.max(m, b.zIndex), 0);

  const selectedBlock = blocks.find(b => b.id === selectedId) || null;

  const addBlock = (type: BlockType, defaults: { w: number; h: number; data: any }) => {
    // Place near center of visible canvas area
    const canvas = canvasRef.current;
    const scrollY = canvas?.parentElement?.scrollTop || 0;
    const cx = Math.round(CANVAS_W / 2 - defaults.w / 2);
    const cy = Math.round(scrollY + 200);
    const nb: CanvasBlock = {
      id: uid(), type, data: defaults.data,
      x: cx, y: cy, w: defaults.w, h: defaults.h,
      font: 'sans', bg: 'transparent', textColor: '#ffffff',
      fontSize: 1, zIndex: maxZ + 1,
    };
    setBlocks(p => [...p, nb]);
    setSelectedId(nb.id);
  };

  const updateBlock = useCallback((updated: CanvasBlock) => {
    setBlocks(p => p.map(b => b.id === updated.id ? updated : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(p => p.filter(b => b.id !== id));
    setSelectedId(null);
  }, []);

  // Upload
  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${uid()}.${ext}`;
      const { data, error } = await supabase.storage.from('trip-images').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) { console.error(error); return null; }
      const { data: { publicUrl } } = supabase.storage.from('trip-images').getPublicUrl(fileName);
      return publicUrl;
    } finally { setUploading(false); }
  }, [supabase]);

  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = await uploadFile(file); if (url) setCoverUrl(url);
  };

  const canProceed = Boolean([
    meta.country && meta.category,
    title.trim().length > 0,
    true,
    true,
  ][step]);

  // Montage — anti-hydratation
  useEffect(() => { setIsMounted(true); }, []);

  // Delete selected block with keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteBlock(selectedId);
      }
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, deleteBlock]);

  const publishTrip = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('Connectez-vous pour publier.'); setLoading(false); return; }
    const slug = title.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error } = await supabase.from('trips').insert({
      title, subtitle, slug: `${slug}-${uid()}`, author_id: user.id,
      cover_image: coverUrl || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200',
      country: meta.country, city: meta.city, duration_days: Number(meta.duration) || null,
      travelers: Number(meta.travelers) || 1, budget: meta.budget, category: meta.category, season: meta.season,
      is_published: true, published_at: new Date().toISOString(),
      content: blocks.map(b => ({ ...b })),
      canvas: true,
      canvas_height: canvasH,
      total_size_mb: 0,
    });
    if (error) { alert('Erreur : ' + error.message); }
    else { setPublished(true); setTimeout(() => { window.location.href = '/'; }, 2000); }
    setLoading(false);
  };

  // Shared input styles (for meta/cover steps)
  const iS: React.CSSProperties = { width:'100%', padding:'0.75rem 1rem', border:'1px solid #2a2a2a', background:'#1a1a1a', color:'#e0e0e0', fontFamily:"'DM Sans',system-ui", fontSize:'0.92rem', outline:'none', borderRadius:3, boxSizing:'border-box' as const };
  const selS: React.CSSProperties = { ...iS, appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 1rem center', cursor:'pointer' };
  const lS: React.CSSProperties = { display:'block', fontFamily:"'DM Sans',system-ui", fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase' as const, color:'#555', marginBottom:'0.5rem' };
  const fg = (e: React.FocusEvent<any>) => (e.target.style.borderColor = '#c9a84c');
  const fb = (e: React.FocusEvent<any>) => (e.target.style.borderColor = '#2a2a2a');

  // ── Guard anti-hydratation ──
  if (!isMounted) return null;

  const globalCss = [
    "@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300&family=DM+Sans:wght@300;400;500;600;700&display=swap');",
    "@keyframes spin{to{transform:rotate(360deg)}}",
    ".spin{animation:spin 0.8s linear infinite}",
    "* { box-sizing: border-box; }",
    "::-webkit-scrollbar{width:6px;height:6px}",
    "::-webkit-scrollbar-track{background:#111}",
    "::-webkit-scrollbar-thumb{background:#333;border-radius:3px}",
    "::-webkit-scrollbar-thumb:hover{background:#555}",

    /* ── Top bar responsive ── */
    `@media (max-width: 768px) {
      .topbar-title { display: none !important; }
      .topbar-divider { display: none !important; }
      .topbar-steps { width: auto !important; flex: 1 !important; min-width: 0 !important; }
      .topbar-steps > div { zoom: 0.8; }
    }`,
    `@media (max-width: 480px) {
      .topbar-logo-label { display: none !important; }
      .topbar-steps > div { zoom: 0.65; }
    }`,

    /* ── Steps 0 & 1 : formulaires ── */
    `@media (max-width: 640px) {
      .form-grid-2col { grid-template-columns: 1fr !important; }
      .form-container { padding: 1.5rem 1rem !important; }
      .form-inner { padding: 0 !important; }
    }`,

    /* ── Step 3 : recap ── */
    `@media (max-width: 640px) {
      .recap-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .recap-container { padding: 1.5rem 1rem !important; }
    }`,

    /* ── Canvas (step 2) : message mobile ── */
    `@media (max-width: 900px) {
      .canvas-mobile-warn { display: flex !important; }
    }`,
  ].join('\n');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d0d0d', color: '#e0e0e0', overflow: 'hidden' }}>

        {/* ── Top bar ── */}
        <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', background: '#111', borderBottom: '1px solid #1e1e1e', zIndex: 1100, gap: '0.5rem' }}>
          {/* Logo + title + home button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            {/* Home button */}
            <button type="button"
              onClick={() => { if (blocks.length === 0 || confirm('Quitter ? Votre récit non publié sera perdu.')) window.location.href = '/'; }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.35rem 0.75rem', background: 'transparent', border: '1px solid #2a2a2a', color: '#666', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', borderRadius: 3, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#ccc'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#666'; }}>
              ← Accueil
            </button>
            <div className="topbar-divider" style={{ width: 1, height: 20, background: '#2a2a2a' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, background: 'linear-gradient(135deg,#1e3a2f,#c9a84c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'white', fontSize: 13 }}>O</span>
              </div>
              <span className="topbar-logo-label" style={{ fontFamily: "'Fraunces',serif", fontSize: '1rem', color: '#c9a84c', letterSpacing: '0.1em' }}>Odyssey</span>
            </div>
            <div className="topbar-divider" style={{ width: 1, height: 20, background: '#2a2a2a' }} />
            <span className="topbar-title" style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {title || 'Nouveau récit'}
            </span>
          </div>

          {/* Steps (compact) */}
          <div className="topbar-steps" style={{ width: 440, flexShrink: 1 }}>
            <Steps current={step} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {uploading && <div style={{ width: 16, height: 16, border: '2px solid #333', borderTopColor: '#c9a84c', borderRadius: '50%' }} className="spin" />}
            {step > 0 && (
              <button type="button" onClick={() => setStep(s => s - 1)}
                style={{ padding: '0.45rem 1rem', background: 'transparent', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', borderRadius: 3 }}>
                ← Retour
              </button>
            )}
            {step < 3 ? (
              <button type="button" disabled={!canProceed} onClick={() => setStep(s => s + 1)}
                style={{ padding: '0.45rem 1.25rem', border: 'none', cursor: canProceed ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 3,
                  background: canProceed ? '#c9a84c' : '#2a2a2a', color: canProceed ? '#0d0d0d' : '#555' }}>
                Suivant →
              </button>
            ) : (
              <button type="button" onClick={publishTrip} disabled={loading || published}
                style={{ padding: '0.45rem 1.5rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6,
                  background: published ? '#2d7a72' : '#c9a84c', color: '#0d0d0d' }}>
                {loading ? <><div style={{width:14,height:14,border:'2px solid rgba(0,0,0,0.3)',borderTopColor:'#0d0d0d',borderRadius:'50%'}} className="spin"/>En cours…</> : published ? '✓ Publié !' : '🚀 Publier'}
              </button>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ════ STEPS 0 & 1 — centered forms ════ */}
          {(step === 0 || step === 1) && (
            <div className="form-container" style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '3rem 1.5rem' }}>
              <div className="form-inner" style={{ width: '100%', maxWidth: 640 }}>

                {step === 0 && (
                  <>
                    <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: '2rem', fontWeight: 300, color: 'white', marginBottom: '0.5rem' }}>Quelques précisions</h2>
                    <p style={{ color: '#555', fontSize: '0.88rem', marginBottom: '2.5rem', fontFamily: "'DM Sans',system-ui" }}>Ces informations aident les lecteurs à trouver votre récit. * = obligatoire</p>
                    <div className="form-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem' }}>
                      <div><label style={lS}>Pays *</label>
                        <select style={selS} value={meta.country} onChange={e => setMeta(m => ({ ...m, country: e.target.value }))} onFocus={fg} onBlur={fb}>
                          <option value="">Sélectionner…</option>
                          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div><label style={lS}>Ville</label><input style={iS} placeholder="Tokyo, Lisbonne…" value={meta.city} onChange={e => setMeta(m => ({ ...m, city: e.target.value }))} onFocus={fg} onBlur={fb} /></div>
                      <div><label style={lS}>Catégorie *</label>
                        <select style={selS} value={meta.category} onChange={e => setMeta(m => ({ ...m, category: e.target.value }))} onFocus={fg} onBlur={fb}>
                          <option value="">Choisir…</option>
                          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div><label style={lS}>Saison</label>
                        <select style={selS} value={meta.season} onChange={e => setMeta(m => ({ ...m, season: e.target.value }))} onFocus={fg} onBlur={fb}>
                          <option value="">Saison…</option>
                          {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div><label style={lS}>Durée (jours)</label><input style={iS} type="number" min="1" max="365" placeholder="14" value={meta.duration} onChange={e => setMeta(m => ({ ...m, duration: e.target.value }))} onFocus={fg} onBlur={fb} /></div>
                      <div><label style={lS}>Voyageurs</label><input style={iS} type="number" min="1" max="50" placeholder="1" value={meta.travelers} onChange={e => setMeta(m => ({ ...m, travelers: e.target.value }))} onFocus={fg} onBlur={fb} /></div>
                      <div style={{ gridColumn: '1/-1' }}>
                        <label style={lS}>Budget</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {BUDGETS.map(b => (
                            <button key={b} type="button" onClick={() => setMeta(m => ({ ...m, budget: b }))}
                              style={{ padding: '0.45rem 1rem', border: '1px solid', borderRadius: 3, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', transition: 'all 0.2s',
                                borderColor: meta.budget === b ? '#c9a84c' : '#2a2a2a',
                                background: meta.budget === b ? 'rgba(201,168,76,0.15)' : '#1a1a1a',
                                color: meta.budget === b ? '#c9a84c' : '#666' }}>{b}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: '2rem', fontWeight: 300, color: 'white', marginBottom: '0.5rem' }}>Couverture du récit</h2>
                    <p style={{ color: '#555', fontSize: '0.88rem', marginBottom: '2.5rem', fontFamily: "'DM Sans',system-ui" }}>Ce sera affiché en haut de votre récit publié.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                        <label style={lS}>Image de couverture</label>
                        <div style={{ position: 'relative', height: 280, background: '#1a1a1a', border: '1px solid #2a2a2a', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3 }}>
                          {coverUrl ? (
                            <>
                              <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
                              <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', color: 'white' }}>
                                <p style={{ fontFamily: "'Fraunces',serif", fontSize: '1.75rem', fontWeight: 300, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{title || 'Votre titre'}</p>
                                {subtitle && <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.9rem', opacity: 0.7, marginTop: 6, fontStyle: 'italic' }}>{subtitle}</p>}
                              </div>
                              <button type="button" onClick={() => setCoverUrl('')}
                                style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>×</button>
                            </>
                          ) : (
                            <div style={{ textAlign: 'center', color: '#444' }}>
                              <div style={{ fontSize: 40, marginBottom: 12 }}>🏔️</div>
                              <label style={{ padding: '0.6rem 1.4rem', background: '#c9a84c', color: '#0d0d0d', cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'DM Sans',system-ui", fontWeight: 700, borderRadius: 3, display: 'inline-block' }}>
                                📁 Depuis l'ordinateur
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadCover} />
                              </label>
                            </div>
                          )}
                        </div>
                        {!coverUrl && <input style={{ ...iS, marginTop: 8 }} placeholder="Ou coller une URL d'image" onChange={e => setCoverUrl(e.target.value)} onBlur={e => { if(e.target.value) setCoverUrl(optimizeImageUrl(e.target.value)); }} onFocus={fg} />}
                      </div>
                      <div><label style={lS}>Titre *</label>
                        <input style={{ ...iS, fontSize: '1.3rem', fontFamily: "'Fraunces',serif", fontWeight: 300, padding: '0.9rem 1rem' }}
                          placeholder="Un titre qui donne envie de voyager…" value={title} onChange={e => setTitle(e.target.value)} onFocus={fg} onBlur={fb} />
                      </div>
                      <div><label style={lS}>Sous-titre</label>
                        <input style={{ ...iS, fontStyle: 'italic', color: '#666' }}
                          placeholder="Un résumé poétique…" value={subtitle} onChange={e => setSubtitle(e.target.value)} onFocus={fg} onBlur={fb} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ════ STEP 2 — Canvas editor ════ */}
          {step === 2 && (
            <>
              {/* Avertissement mobile — caché sur desktop via CSS */}
              <div className="canvas-mobile-warn" style={{
                display: 'none', position: 'fixed', inset: 0, zIndex: 2000,
                background: '#0d0d0d', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '2rem', textAlign: 'center',
              }}>
                <span style={{ fontSize: 48, marginBottom: '1.5rem' }}>🖥️</span>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: '1.75rem', fontWeight: 300, color: 'white', marginBottom: '0.75rem' }}>
                  Éditeur disponible sur desktop
                </h2>
                <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.9rem', color: '#666', lineHeight: 1.7, maxWidth: 320, marginBottom: '2rem' }}>
                  L'éditeur de récit nécessite un écran plus large pour placer et déplacer les blocs. Ouvrez Odyssey sur un ordinateur pour continuer.
                </p>
                <button type="button"
                  onClick={() => setStep(1)}
                  style={{ padding: '0.75rem 2rem', background: '#c9a84c', color: '#0d0d0d', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  ← Retour
                </button>
              </div>
              {/* Left sidebar */}
              <Sidebar onAdd={addBlock} onTemplate={() => setShowTemplates(true)} onAddModule={addModule} activeTemplate={activeTemplate} setActiveTemplate={setActiveTemplate} canvasH={canvasH} setCanvasH={setCanvasH} />

              {/* Canvas area */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#1a1a1a', display: 'flex', justifyContent: 'center', padding: '2rem' }}
                onMouseDown={e => { if (e.target === e.currentTarget) setSelectedId(null); }}>
                <div
                  ref={canvasRef}
                  style={{ position: 'relative', width: CANVAS_W, height: canvasH, background: '#faf8f4', flexShrink: 0, boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5)' }}
                  onMouseDown={e => { if (e.target === canvasRef.current) setSelectedId(null); }}
                >
                  {/* Grid overlay */}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                    backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
                    backgroundSize: '40px 40px' }} />

                  {/* Empty state */}
                  {blocks.length === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <p style={{ fontFamily: "'Fraunces',serif", fontSize: '2rem', fontWeight: 300, color: 'rgba(0,0,0,0.12)', marginBottom: 8 }}>Page blanche</p>
                      <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.88rem', color: 'rgba(0,0,0,0.2)' }}>← Cliquez sur un élément à gauche pour l'ajouter</p>
                    </div>
                  )}

                  {/* Blocks */}
                  {blocks.map(block => (
                    <CanvasBlockEl
                      key={block.id}
                      block={block}
                      selected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onUpdate={updateBlock}
                      onDelete={() => deleteBlock(block.id)}
                      onUpload={uploadFile}
                    />
                  ))}
                </div>
              </div>

              {/* Right properties panel */}
              <div style={{ width: 220, flexShrink: 0, background: '#111', borderLeft: '1px solid #1e1e1e', overflowY: 'auto', padding: '1rem' }}>
                {selectedBlock ? (
                  <>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginBottom: '1rem' }}>
                      Propriétés
                    </p>
                    <PropsPanel block={selectedBlock} onUpdate={updateBlock} />
                    {/* Delete */}
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #1e1e1e' }}>
                      <button type="button"
                        onClick={() => deleteBlock(selectedBlock.id)}
                        style={{ width: '100%', padding: '0.6rem', background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)', color: '#e74c3c', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 3, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(192,57,43,0.25)'; e.currentTarget.style.borderColor = '#e74c3c'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(192,57,43,0.12)'; e.currentTarget.style.borderColor = 'rgba(192,57,43,0.3)'; }}>
                        ✕ Supprimer ce bloc
                      </button>
                      <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', color: '#333', textAlign: 'center', marginTop: 6 }}>ou touche Delete</p>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#333' }}>
                    <p style={{ fontFamily: "'Fraunces',serif", fontSize: '1rem', marginBottom: 8, color: '#444' }}>Sélectionnez un bloc</p>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', lineHeight: 1.6 }}>Cliquez sur un élément du canvas pour modifier ses propriétés</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ════ STEP 3 — Recap ════ */}
          {step === 3 && (
            <div className="recap-container" style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '3rem 1.5rem' }}>
              <div style={{ width: '100%', maxWidth: 640 }}>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: '2rem', fontWeight: 300, color: 'white', marginBottom: '0.5rem' }}>Prêt à publier ?</h2>
                <p style={{ color: '#555', fontSize: '0.88rem', marginBottom: '2.5rem', fontFamily: "'DM Sans',system-ui" }}>Vérifiez avant de partager votre récit.</p>
                <div style={{ border: '1px solid #1e1e1e', background: '#111', overflow: 'hidden', borderRadius: 4, marginBottom: '1.5rem' }}>
                  {coverUrl && (
                    <div style={{ height: 200, overflow: 'hidden', position: 'relative' }}>
                      <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.7),transparent)' }} />
                      <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', color: 'white' }}>
                        <p style={{ fontFamily: "'Fraunces',serif", fontSize: '1.5rem', fontWeight: 300 }}>{title}</p>
                        {subtitle && <p style={{ fontSize: '0.85rem', opacity: 0.7, fontStyle: 'italic', marginTop: 4 }}>{subtitle}</p>}
                      </div>
                    </div>
                  )}
                  <div className="recap-grid" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
                    {[
                      { label: 'Destination', value: [meta.city, meta.country].filter(Boolean).join(', ') || '—' },
                      { label: 'Catégorie', value: CATEGORIES.find(c => c.value === meta.category)?.label || '—' },
                      { label: 'Durée', value: meta.duration ? `${meta.duration} jours` : '—' },
                      { label: 'Voyageurs', value: meta.travelers || '1' },
                      { label: 'Budget', value: meta.budget || '—' },
                      { label: 'Blocs', value: `${blocks.length} élément${blocks.length !== 1 ? 's' : ''}` },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>{label}</p>
                        <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.9rem', color: '#ccc', fontWeight: 500 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '1rem 1.25rem', background: 'rgba(45,122,114,0.1)', borderLeft: '3px solid #2d7a72', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', borderRadius: '0 3px 3px 0' }}>
                  <span style={{ fontSize: 18 }}>🌍</span>
                  <div>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', fontWeight: 600, color: '#2d7a72', marginBottom: 3 }}>Récit public</p>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', color: '#555', lineHeight: 1.6 }}>Visible par tous les visiteurs d'Odyssey sans inscription.</p>
                  </div>
                </div>
                {published && (
                  <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: 'rgba(45,122,114,0.15)', border: '1px solid #2d7a72', display: 'flex', gap: '0.75rem', alignItems: 'center', borderRadius: 3 }}>
                    <span style={{ fontSize: 22 }}>✅</span>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.92rem', color: '#2d7a72', fontWeight: 600 }}>Publié avec succès ! Redirection…</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template modal */}
      {showTemplates && (
        <TemplateModal
          onApply={applyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </>
  );
}