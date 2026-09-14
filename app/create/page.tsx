'use client';
import { Fragment, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
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

// ─── 8 Templates adaptatifs ───────────────────────────────────────────────────
// Chaque template : titre unique en haut (titleH) + sections répétées (sectionH)
// generate(canvasH) calcule automatiquement le nombre de sections.

type ScalableTemplate = {
  id: string; label: string; icon: string; desc: string;
  accentColor: string; bgColor: string;
  sectionH: number; titleH: number;
  generate: (canvasH: number) => any[];
};

const SCALABLE_TEMPLATES: ScalableTemplate[] = [

  // ── 1. JOURNAL DE BORD ────────────────────────────────────────────
  {
    id: 'journal', label: 'Journal de bord', icon: '📓',
    desc: 'Photo + récit alternés gauche/droite. Un jour par section.',
    accentColor: '#c9a84c', bgColor: '#0d0d0d', titleH: 500, sectionH: 700,
    generate: (canvasH) => {
      const b: any[] = []; const id = uid;
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:canvasH, bg:'#0d0d0d',textColor:'#fff',font:'sans',fontSize:1,zIndex:1 });
      b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:0,y:0,w:1200,h:420, bg:'#1a1a1a',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:420, bg:'linear-gradient(to top,#0d0d0d 0%,rgba(0,0,0,0.5) 60%,transparent 100%)',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:DM Sans,system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#c9a84c">Journal de voyage</p>'}, x:80,y:260,w:500,h:36, bg:'transparent',textColor:'#c9a84c',font:'sans',fontSize:0.62,zIndex:5 });
      b.push({ id:id(), type:'text', data:{html:'<div style="font-family:Fraunces,serif;font-weight:300;font-size:4.5rem;line-height:0.9;color:white">Mon<br/><em>Voyage</em></div>'}, x:80,y:300,w:700,h:200, bg:'transparent',textColor:'#fff',font:'serif',fontSize:4.5,zIndex:5 });
      const n = Math.max(1, Math.floor((canvasH - 500) / 700));
      for (let i = 0; i < n; i++) {
        const y = 500 + i*700; const ev = i%2===0;
        b.push({ id:id(), type:'spacer', data:{}, x:0,y,w:1200,h:700, bg:ev?'#111':'#0d0d0d',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
        b.push({ id:id(), type:'text', data:{html:`<div style="font-family:Bebas Neue,sans-serif;font-size:4rem;color:rgba(201,168,76,0.15);line-height:1">JOUR ${String(i+1).padStart(2,'0')}</div>`}, x:ev?60:640,y:y+30,w:500,h:80, bg:'transparent',textColor:'rgba(201,168,76,0.15)',font:'display',fontSize:4,zIndex:3 });
        b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:ev?0:600,y:y+60,w:560,h:420, bg:'#1a1a1a',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
        b.push({ id:id(), type:'text', data:{html:`<p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;margin-bottom:14px">Jour ${i+1}</p><div style="font-family:Fraunces,serif;font-weight:300;font-size:1.8rem;line-height:1.2;color:white;margin-bottom:18px">Titre de l'étape</div><p style="font-family:DM Sans,system-ui;font-size:0.9rem;line-height:1.8;color:rgba(255,255,255,0.6)">Racontez cette journée — les routes, les paysages, les rencontres inattendues.</p>`}, x:ev?620:40,y:y+80,w:520,h:380, bg:'transparent',textColor:'#fff',font:'serif',fontSize:1,zIndex:3 });
        b.push({ id:id(), type:'divider', data:{style:'line'}, x:ev?620:40,y:y+640,w:400,h:24, bg:'transparent',textColor:'rgba(201,168,76,0.3)',font:'sans',fontSize:1,zIndex:3 });
      }
      return b;
    },
  },

  // ── 2. MAGAZINE NOIR ──────────────────────────────────────────────
  {
    id: 'noir', label: 'Magazine Noir', icon: '🖤',
    desc: 'Éditorial sombre, typo monumentale, galeries pleine largeur.',
    accentColor: '#ffffff', bgColor: '#111', titleH: 680, sectionH: 760,
    generate: (canvasH) => {
      const b: any[] = []; const id = uid;
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:canvasH, bg:'#111',textColor:'#fff',font:'sans',fontSize:1,zIndex:1 });
      b.push({ id:id(), type:'text', data:{html:'<div style="font-family:Bebas Neue,sans-serif;font-size:12rem;line-height:0.82;color:rgba(255,255,255,0.04)">OD</div>'}, x:-20,y:-20,w:700,h:380, bg:'transparent',textColor:'rgba(255,255,255,0.04)',font:'display',fontSize:12,zIndex:2 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.35)">VOL. 01 · ODYSSEY MAGAZINE</p>'}, x:80,y:60,w:600,h:32, bg:'transparent',textColor:'rgba(255,255,255,0.35)',font:'sans',fontSize:0.6,zIndex:4 });
      b.push({ id:id(), type:'text', data:{html:'<div style="font-family:Bebas Neue,sans-serif;font-size:8rem;line-height:0.88;color:white;text-transform:uppercase">MON<br/>GRAND<br/>VOYAGE</div>'}, x:60,y:110,w:680,h:420, bg:'transparent',textColor:'#fff',font:'display',fontSize:8,zIndex:4 });
      b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:680,y:0,w:520,h:680, bg:'#222',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
      b.push({ id:id(), type:'divider', data:{style:'line'}, x:60,y:560,w:500,h:24, bg:'transparent',textColor:'rgba(255,255,255,0.15)',font:'sans',fontSize:1,zIndex:4 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:Fraunces,serif;font-style:italic;font-weight:300;font-size:1.25rem;line-height:1.7;color:rgba(255,255,255,0.55)">Une ligne accroche poétique, précise, inoubliable.</p>'}, x:60,y:600,w:580,h:80, bg:'transparent',textColor:'rgba(255,255,255,0.55)',font:'serif',fontSize:1.25,zIndex:4 });
      const n = Math.max(1, Math.floor((canvasH - 680) / 760));
      for (let i = 0; i < n; i++) {
        const y = 680 + i*760;
        b.push({ id:id(), type:'gallery', data:{images:[],layout:'grid'}, x:0,y,w:1200,h:320, bg:'#0d0d0d',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
        b.push({ id:id(), type:'text', data:{html:`<div style="font-family:DM Sans,system-ui;font-size:0.6rem;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:10px">Chapitre ${String(i+1).padStart(2,'0')}</div><div style="font-family:Fraunces,serif;font-weight:300;font-size:2.2rem;line-height:1.15;color:white;margin-bottom:18px">Titre du chapitre</div><p style="font-family:DM Sans,system-ui;font-size:0.88rem;line-height:1.85;color:rgba(255,255,255,0.5)">Développez ici une partie de votre récit.</p>`}, x:80,y:y+350,w:500,h:320, bg:'transparent',textColor:'#fff',font:'serif',fontSize:1,zIndex:3 });
        b.push({ id:id(), type:'quote', data:{text:'Une citation qui marque ce chapitre du voyage.',author:''}, x:620,y:y+380,w:520,h:200, bg:'rgba(255,255,255,0.03)',textColor:'rgba(255,255,255,0.7)',font:'serif',fontSize:1.3,zIndex:3 });
      }
      return b;
    },
  },

  // ── 3. PANORAMA ───────────────────────────────────────────────────
  {
    id: 'panorama', label: 'Panorama', icon: '🌅',
    desc: 'Fond clair, photos pleine largeur, texte centré épuré.',
    accentColor: '#c9a84c', bgColor: '#faf8f4', titleH: 600, sectionH: 800,
    generate: (canvasH) => {
      const b: any[] = []; const id = uid;
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:canvasH, bg:'#faf8f4',textColor:'#0d0d0d',font:'sans',fontSize:1,zIndex:1 });
      b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:0,y:0,w:1200,h:480, bg:'#ddd',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:480, bg:'linear-gradient(to top,#faf8f4 0%,rgba(250,248,244,0.3) 40%,transparent 100%)',textColor:'#0d0d0d',font:'sans',fontSize:1,zIndex:3 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#c9a84c;text-align:center">Récit de voyage</p>'}, x:300,y:390,w:600,h:32, bg:'transparent',textColor:'#c9a84c',font:'sans',fontSize:0.6,zIndex:5 });
      b.push({ id:id(), type:'text', data:{html:'<div style="font-family:Fraunces,serif;font-weight:300;font-size:3.8rem;line-height:1;color:#0d0d0d;text-align:center">Mon Voyage</div>'}, x:200,y:430,w:800,h:140, bg:'transparent',textColor:'#0d0d0d',font:'serif',fontSize:3.8,zIndex:5 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:Fraunces,serif;font-style:italic;font-weight:300;font-size:1.15rem;color:#888;line-height:1.6;text-align:center">Un sous-titre poétique pour votre aventure…</p>'}, x:250,y:540,w:700,h:60, bg:'transparent',textColor:'#888',font:'serif',fontSize:1.15,zIndex:5 });
      const n = Math.max(1, Math.floor((canvasH - 600) / 800));
      for (let i = 0; i < n; i++) {
        const y = 600 + i*800;
        b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:0,y,w:1200,h:480, bg:'#ddd',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
        b.push({ id:id(), type:'text', data:{html:`<p style="font-family:DM Sans,system-ui;font-size:0.58rem;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c9a84c;text-align:center;margin-bottom:12px">Étape ${i+1}</p><div style="font-family:Fraunces,serif;font-weight:300;font-size:2.4rem;line-height:1.1;color:#0d0d0d;text-align:center;margin-bottom:20px">Titre du lieu</div><p style="font-family:DM Sans,system-ui;font-size:0.92rem;line-height:1.85;color:#555;text-align:center">Décrivez ce lieu, son ambiance, ce qui vous a touché.</p>`}, x:100,y:y+500,w:1000,h:280, bg:'transparent',textColor:'#0d0d0d',font:'serif',fontSize:1,zIndex:3 });
      }
      return b;
    },
  },

  // ── 4. CARNET NATURE ──────────────────────────────────────────────
  {
    id: 'nature', label: 'Carnet Nature', icon: '🌿',
    desc: 'Fond forêt sombre, mosaïques, fiches terrain. Aventure brute.',
    accentColor: '#4caf7d', bgColor: '#0f1a14', titleH: 560, sectionH: 720,
    generate: (canvasH) => {
      const b: any[] = []; const id = uid;
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:canvasH, bg:'#0f1a14',textColor:'#fff',font:'sans',fontSize:1,zIndex:1 });
      b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:0,y:0,w:1200,h:480, bg:'#162a1c',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:480, bg:'linear-gradient(to top,#0f1a14 0%,rgba(15,26,20,0.6) 50%,transparent 100%)',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#4caf7d">Exploration · Nature</p>'}, x:80,y:300,w:500,h:32, bg:'transparent',textColor:'#4caf7d',font:'sans',fontSize:0.6,zIndex:5 });
      b.push({ id:id(), type:'text', data:{html:'<div style="font-family:Fraunces,serif;font-weight:300;font-size:4rem;line-height:0.92;color:white">Dans les<br/><em>profondeurs</em><br/>du monde</div>'}, x:80,y:340,w:700,h:220, bg:'transparent',textColor:'#fff',font:'serif',fontSize:4,zIndex:5 });
      b.push({ id:id(), type:'divider', data:{style:'dots'}, x:80,y:500,w:200,h:40, bg:'transparent',textColor:'#4caf7d',font:'sans',fontSize:1,zIndex:4 });
      const n = Math.max(1, Math.floor((canvasH - 560) / 720));
      for (let i = 0; i < n; i++) {
        const y = 560 + i*720;
        b.push({ id:id(), type:'gallery', data:{images:[],layout:'mosaic'}, x:0,y,w:1200,h:360, bg:'#0a1410',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
        b.push({ id:id(), type:'spacer', data:{}, x:0,y:y+360,w:1200,h:360, bg:'#111d15',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
        b.push({ id:id(), type:'text', data:{html:`<div style="display:flex;align-items:center;gap:16px;margin-bottom:14px"><div style="width:32px;height:32px;background:#4caf7d;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui;font-weight:700;color:#0d0d0d;font-size:0.85rem">${i+1}</div><p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#4caf7d">Observation ${i+1}</p></div><div style="font-family:Fraunces,serif;font-weight:300;font-size:1.75rem;line-height:1.2;color:white;margin-bottom:16px">Titre de l'exploration</div><p style="font-family:DM Sans,system-ui;font-size:0.88rem;line-height:1.85;color:rgba(255,255,255,0.55)">Décrivez ce que vous avez observé, ressenti, découvert.</p>`}, x:80,y:y+390,w:540,h:300, bg:'transparent',textColor:'#fff',font:'serif',fontSize:1,zIndex:3 });
        b.push({ id:id(), type:'text', data:{html:'<div style="padding:20px 24px"><p style="font-family:DM Sans,system-ui;font-size:0.58rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#4caf7d;margin-bottom:12px">🌡 Infos terrain</p><div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(76,175,125,0.15);padding-bottom:6px"><span style="font-family:DM Sans,system-ui;font-size:0.78rem;color:rgba(255,255,255,0.4)">Altitude</span><span style="font-family:DM Sans,system-ui;font-size:0.78rem;color:white;font-weight:600">— m</span></div><div style="display:flex;justify-content:space-between"><span style="font-family:DM Sans,system-ui;font-size:0.78rem;color:rgba(255,255,255,0.4)">Difficulté</span><span style="font-family:DM Sans,system-ui;font-size:0.78rem;color:#4caf7d;font-weight:600">Modérée</span></div></div></div>'}, x:680,y:y+390,w:440,h:270, bg:'rgba(76,175,125,0.06)',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
      }
      return b;
    },
  },

  // ── 5. FILM STRIP ─────────────────────────────────────────────────
  {
    id: 'film', label: 'Film Strip', icon: '🎞️',
    desc: 'Bande pellicule à gauche, contenu éditorial à droite. Style cinéma.',
    accentColor: '#c9a84c', bgColor: '#0a0a0a', titleH: 560, sectionH: 660,
    generate: (canvasH) => {
      const b: any[] = []; const id = uid;
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:canvasH, bg:'#0a0a0a',textColor:'#fff',font:'sans',fontSize:1,zIndex:1 });
      // Bande pellicule gauche — fixe toute la hauteur
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:220,h:canvasH, bg:'#050505',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
      b.push({ id:id(), type:'text', data:{html:'<div style="display:flex;flex-direction:column;gap:28px;padding:12px 0;align-items:center">⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛</div>'}, x:0,y:0,w:24,h:canvasH, bg:'transparent',textColor:'#111',font:'sans',fontSize:0.5,zIndex:3 });
      b.push({ id:id(), type:'text', data:{html:'<div style="display:flex;flex-direction:column;gap:28px;padding:12px 0;align-items:center">⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛</div>'}, x:196,y:0,w:24,h:canvasH, bg:'transparent',textColor:'#111',font:'sans',fontSize:0.5,zIndex:3 });
      // Titre unique
      b.push({ id:id(), type:'text', data:{html:'<div style="font-family:Bebas Neue,sans-serif;font-size:5.5rem;line-height:0.9;color:#c9a84c;text-transform:uppercase">MON<br/>VOYAGE</div>'}, x:260,y:60,w:680,h:280, bg:'transparent',textColor:'#c9a84c',font:'display',fontSize:5,zIndex:4 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:Fraunces,serif;font-style:italic;font-weight:300;font-size:1.3rem;color:rgba(255,255,255,0.7);line-height:1.6">Racontez votre aventure ici.</p>'}, x:260,y:360,w:500,h:80, bg:'transparent',textColor:'rgba(255,255,255,0.7)',font:'serif',fontSize:1.3,zIndex:4 });
      b.push({ id:id(), type:'divider', data:{style:'line'}, x:260,y:455,w:400,h:24, bg:'transparent',textColor:'rgba(201,168,76,0.4)',font:'sans',fontSize:1,zIndex:4 });
      // Photos pellicule gauche — titre zone
      b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:26,y:40,w:168,h:190, bg:'#222',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
      b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:26,y:246,w:168,h:190, bg:'#222',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
      // Sections répétables
      const n = Math.max(1, Math.floor((canvasH - 560) / 660));
      for (let i = 0; i < n; i++) {
        const y = 560 + i*660;
        b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:26,y:y+20,w:168,h:190, bg:'#222',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
        b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:26,y:y+226,w:168,h:190, bg:'#222',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
        b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:240,y,w:820,h:400, bg:'#1a1a1a',textColor:'#fff',font:'sans',fontSize:1,zIndex:4 });
        b.push({ id:id(), type:'text', data:{html:`<span style="font-family:DM Sans,system-ui;font-weight:700;font-size:0.8rem;letter-spacing:0.18em;text-transform:uppercase;color:#0d0d0d">Scène ${i+1}</span>`}, x:240,y:y+428,w:160,h:36, bg:'#c9a84c',textColor:'#0d0d0d',font:'sans',fontSize:0.9,zIndex:5 });
        b.push({ id:id(), type:'text', data:{html:'<p style="line-height:1.8;color:rgba(255,255,255,0.75)">Décrivez ce moment — l\'ambiance, la lumière, les sons. Faites revivre la scène.</p>'}, x:240,y:y+490,w:600,h:140, bg:'transparent',textColor:'rgba(255,255,255,0.75)',font:'sans',fontSize:1,zIndex:4 });
        b.push({ id:id(), type:'quote', data:{text:'Une citation qui illustre ce moment du voyage.',author:''}, x:240,y:y+445,w:720,h:180, bg:'rgba(201,168,76,0.06)',textColor:'#fff',font:'serif',fontSize:1.2,zIndex:4 });
      }
      return b;
    },
  },

  // ── 6. MAGAZINE CLAIR ─────────────────────────────────────────────
  {
    id: 'magazine', label: 'Magazine Clair', icon: '📰',
    desc: 'Fond parchemin, typo asymétrique, style éditorial luxe.',
    accentColor: '#c9a84c', bgColor: '#f5f0e8', titleH: 620, sectionH: 740,
    generate: (canvasH) => {
      const b: any[] = []; const id = uid;
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:canvasH, bg:'#f5f0e8',textColor:'#0d0d0d',font:'sans',fontSize:1,zIndex:1 });
      b.push({ id:id(), type:'text', data:{html:'<div style="font-family:Bebas Neue,sans-serif;font-size:32rem;line-height:1;color:rgba(0,0,0,0.04);user-select:none">V</div>'}, x:-40,y:-80,w:700,h:700, bg:'transparent',textColor:'rgba(0,0,0,0.04)',font:'display',fontSize:32,zIndex:2 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:DM Sans,system-ui;font-size:0.65rem;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#c9a84c">— Récit de voyage · Édition 2024</p>'}, x:80,y:60,w:600,h:36, bg:'transparent',textColor:'#c9a84c',font:'sans',fontSize:0.65,zIndex:4 });
      b.push({ id:id(), type:'text', data:{html:'<div style="font-family:Bebas Neue,sans-serif;font-size:8rem;line-height:0.88;color:#0d0d0d;text-transform:uppercase">MON<br/>VOYAGE<br/><span style="color:#c9a84c">INCROYABLE</span></div>'}, x:60,y:100,w:700,h:420, bg:'transparent',textColor:'#0d0d0d',font:'display',fontSize:8,zIndex:4 });
      b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:640,y:0,w:560,h:560, bg:'#ddd',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
      b.push({ id:id(), type:'divider', data:{style:'line'}, x:60,y:540,w:400,h:24, bg:'transparent',textColor:'#0d0d0d',font:'sans',fontSize:1,zIndex:4 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:Fraunces,serif;font-style:italic;font-weight:300;font-size:1.4rem;line-height:1.65;color:#0d0d0d">Un voyage qui a tout changé. Des paysages à couper le souffle.</p>'}, x:60,y:578,w:760,h:100, bg:'transparent',textColor:'#0d0d0d',font:'serif',fontSize:1.4,zIndex:4 });
      const n = Math.max(1, Math.floor((canvasH - 620) / 740));
      for (let i = 0; i < n; i++) {
        const y = 620 + i*740; const ev = i%2===0;
        b.push({ id:id(), type:'spacer', data:{}, x:0,y,w:1200,h:740, bg:ev?'#f5f0e8':'#fff',textColor:'#0d0d0d',font:'sans',fontSize:1,zIndex:2 });
        b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:ev?60:620,y:y+40,w:440,h:380, bg:'#ddd',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
        b.push({ id:id(), type:'text', data:{html:`<p style="font-family:DM Sans,system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c9a84c;border-top:2px solid #c9a84c;padding-top:8px;margin-bottom:14px">0${i+1} — Section</p><div style="font-family:Fraunces,serif;font-size:2rem;font-weight:300;line-height:1.2;color:#0d0d0d;margin-bottom:18px">Titre de la section</div><p style="line-height:1.85;color:#555;font-size:0.92rem">Racontez cette partie de votre voyage — les impressions, les détails qui font toute la différence.</p>`}, x:ev?560:60,y:y+60,w:500,h:360, bg:'transparent',textColor:'#0d0d0d',font:'serif',fontSize:1,zIndex:3 });
        if (i === n-1) b.push({ id:id(), type:'quote', data:{text:'Chaque lieu nous apprend quelque chose sur nous-mêmes.',author:''}, x:100,y:y+480,w:900,h:180, bg:'transparent',textColor:'#0d0d0d',font:'serif',fontSize:1.8,zIndex:4 });
      }
      return b;
    },
  },

  // ── 7. CARTE POSTALE ──────────────────────────────────────────────
  {
    id: 'postcard', label: 'Carte Postale', icon: '🏷️',
    desc: 'Grande photo pleine page, titre monumental, ambiance minimaliste.',
    accentColor: '#c9a84c', bgColor: '#0d0d0d', titleH: 700, sectionH: 680,
    generate: (canvasH) => {
      const b: any[] = []; const id = uid;
      b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:0,y:0,w:1200,h:Math.min(canvasH,700), bg:'#111',textColor:'#fff',font:'sans',fontSize:1,zIndex:1 });
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:Math.min(canvasH,700)-300,w:1200,h:300, bg:'linear-gradient(to top,rgba(0,0,0,0.92) 0%,transparent 100%)',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:200, bg:'linear-gradient(to bottom,rgba(0,0,0,0.4),transparent)',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:DM Sans,system-ui;font-size:0.65rem;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.6)">Odyssey · Récit de voyage</p>'}, x:60,y:50,w:500,h:36, bg:'transparent',textColor:'rgba(255,255,255,0.6)',font:'sans',fontSize:0.65,zIndex:4 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:DM Sans,system-ui;font-weight:700;font-size:0.75rem;letter-spacing:0.14em;text-transform:uppercase;color:#0d0d0d;text-align:center">📍 PAYS</p>'}, x:980,y:40,w:170,h:44, bg:'#c9a84c',textColor:'#0d0d0d',font:'sans',fontSize:0.75,zIndex:4 });
      b.push({ id:id(), type:'text', data:{html:'<div style="font-family:Bebas Neue,sans-serif;font-size:10rem;line-height:0.85;color:white;text-transform:uppercase;text-shadow:0 4px 40px rgba(0,0,0,0.5)">DESTI<br/>NATION</div>'}, x:50,y:340,w:900,h:320, bg:'transparent',textColor:'#fff',font:'display',fontSize:10,zIndex:4 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:Fraunces,serif;font-style:italic;font-weight:300;font-size:1.4rem;color:rgba(255,255,255,0.8);line-height:1.5">Une phrase qui capture l\'essence de votre voyage.</p>'}, x:60,y:580,w:700,h:80, bg:'transparent',textColor:'rgba(255,255,255,0.8)',font:'serif',fontSize:1.4,zIndex:4 });
      // Sections — fond sombre + photo + texte
      const n = Math.max(1, Math.floor((canvasH - 700) / 680));
      for (let i = 0; i < n; i++) {
        const y = 700 + i*680;
        b.push({ id:id(), type:'spacer', data:{}, x:0,y,w:1200,h:680, bg:i%2===0?'#0d0d0d':'#111',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
        b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:0,y:y+40,w:560,h:400, bg:'#1a1a1a',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
        b.push({ id:id(), type:'text', data:{html:`<p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;margin-bottom:14px">Lieu ${i+1}</p><div style="font-family:Fraunces,serif;font-weight:300;font-size:2rem;line-height:1.2;color:white;margin-bottom:18px">Nom de la destination</div><p style="font-family:DM Sans,system-ui;font-size:0.9rem;line-height:1.8;color:rgba(255,255,255,0.6)">Ce lieu vous a marqué pour une raison particulière. Décrivez-la.</p>`}, x:620,y:y+60,w:520,h:360, bg:'transparent',textColor:'#fff',font:'serif',fontSize:1,zIndex:3 });
      }
      return b;
    },
  },

  // ── 8. ROAD TRIP ──────────────────────────────────────────────────
  {
    id: 'roadtrip', label: 'Road Trip', icon: '🚗',
    desc: 'Fond asphalte, km et étapes. Pour les carnets de route.',
    accentColor: '#e8a020', bgColor: '#0d0d0d', titleH: 580, sectionH: 750,
    generate: (canvasH) => {
      const b: any[] = []; const id = uid;
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:canvasH, bg:'#0d0d0d',textColor:'#fff',font:'sans',fontSize:1,zIndex:1 });
      // Ligne de route verticale centrale
      b.push({ id:id(), type:'spacer', data:{}, x:598,y:0,w:4,h:canvasH, bg:'linear-gradient(to bottom,transparent,#e8a020 5%,#e8a020 95%,transparent)',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
      // Titre
      b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:0,y:0,w:1200,h:460, bg:'#1a1a1a',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
      b.push({ id:id(), type:'spacer', data:{}, x:0,y:0,w:1200,h:460, bg:'linear-gradient(to top,#0d0d0d 0%,rgba(0,0,0,0.5) 60%,transparent 100%)',textColor:'#fff',font:'sans',fontSize:1,zIndex:4 });
      b.push({ id:id(), type:'text', data:{html:'<p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#e8a020">Road Trip · Odyssey</p>'}, x:80,y:280,w:500,h:32, bg:'transparent',textColor:'#e8a020',font:'sans',fontSize:0.6,zIndex:6 });
      b.push({ id:id(), type:'text', data:{html:'<div style="font-family:Bebas Neue,sans-serif;font-size:5rem;line-height:0.88;color:white;text-transform:uppercase;letter-spacing:0.02em">La Route<br/><span style="color:#e8a020">Sans fin</span></div>'}, x:80,y:320,w:700,h:240, bg:'transparent',textColor:'#fff',font:'display',fontSize:5,zIndex:6 });
      // Sections — chaque section = un jour de route
      const n = Math.max(1, Math.floor((canvasH - 580) / 750));
      for (let i = 0; i < n; i++) {
        const y = 580 + i*750; const ev = i%2===0;
        // Marqueur de route (point sur la ligne)
        b.push({ id:id(), type:'text', data:{html:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><div style="width:28px;height:28px;background:#e8a020;border:3px solid #0d0d0d;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui;font-weight:700;color:#0d0d0d;font-size:0.75rem">${i+1}</div></div>`}, x:572,y:y+20,w:56,h:56, bg:'transparent',textColor:'#fff',font:'sans',fontSize:1,zIndex:6 });
        b.push({ id:id(), type:'spacer', data:{}, x:0,y:y+80,w:ev?560:640,h:600, bg:ev?'#111':'transparent',textColor:'#fff',font:'sans',fontSize:1,zIndex:2 });
        b.push({ id:id(), type:'photo', data:{url:'',caption:''}, x:ev?0:640,y:y+80,w:560,h:380, bg:'#1a1a1a',textColor:'#fff',font:'sans',fontSize:1,zIndex:3 });
        b.push({ id:id(), type:'text', data:{html:`<div style="font-family:Bebas Neue,sans-serif;font-size:3.5rem;line-height:1;color:rgba(232,160,32,0.15);margin-bottom:8px">JOUR ${String(i+1).padStart(2,'0')}</div><div style="font-family:Fraunces,serif;font-weight:300;font-size:1.8rem;line-height:1.2;color:white;margin-bottom:16px">Titre de l'étape</div><p style="font-family:DM Sans,system-ui;font-size:0.88rem;line-height:1.8;color:rgba(255,255,255,0.6)">Racontez la route, les haltes, les panoramas. Chaque kilomètre a son histoire.</p><div style="margin-top:16px;display:flex;gap:20px"><span style="font-family:DM Sans,system-ui;font-size:0.72rem;color:#e8a020">📍 Départ : —</span><span style="font-family:DM Sans,system-ui;font-size:0.72rem;color:#e8a020">🏁 — km</span></div>`}, x:ev?640:40,y:y+100,w:520,h:380, bg:'transparent',textColor:'#fff',font:'serif',fontSize:1,zIndex:3 });
      }
      return b;
    },
  },
];

// ─── Template Modal — 2 étapes : choix + taille ───────────────────────────────
const HEIGHT_OPTIONS = [1500, 2000, 2500, 3000, 3500, 4000, 5000];

function TemplateModal({ onApply, onClose }: {
  onApply: (blocks: any[], canvasH: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [canvasH, setCanvasH] = useState(2500);
  const [customH, setCustomH] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);

  const tpl = SCALABLE_TEMPLATES.find(t => t.id === selected);
  const sectionCount = tpl ? Math.max(1, Math.floor((canvasH - tpl.titleH) / tpl.sectionH)) : 0;
  const finalH = tpl ? tpl.titleH + sectionCount * tpl.sectionH : canvasH;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }} />
      <div style={{ position: 'relative', width: '94vw', maxWidth: 1100, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: '1.4rem', fontWeight: 300, color: 'white', marginBottom: 3 }}>
              {selected ? `② Choisir le rythme — ${tpl?.label}` : '① Choisir un template'}
            </h2>
            <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#555' }}>
              {selected ? 'Une couverture forte · des chapitres qui se répètent naturellement' : '8 styles visuels · tout reste modifiable après utilisation'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selected && (
              <button type="button" onClick={() => setSelected(null)}
                style={{ padding: '0.4rem 1rem', background: 'transparent', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', borderRadius: 3 }}>
                ← Retour
              </button>
            )}
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 22, lineHeight: 1, padding: '4px 8px' }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── ÉTAPE 1 : grille 4×2 ── */}
          {!selected && (
            <div style={{ padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.85rem' }}>
              {SCALABLE_TEMPLATES.map(t => (
                <div key={t.id}
                  onMouseEnter={() => setHovered(t.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => { setSelected(t.id); setCanvasH(2500); setCustomH(''); }}
                  style={{ cursor: 'pointer', border: `2px solid ${hovered === t.id ? t.accentColor : '#2a2a2a'}`, borderRadius: 5, overflow: 'hidden', transition: 'all 0.2s', transform: hovered === t.id ? 'translateY(-3px)' : 'none', boxShadow: hovered === t.id ? `0 8px 24px ${t.accentColor}22` : 'none' }}>
                  {/* Miniature */}
                  <div style={{ height: 120, background: t.bgColor, position: 'relative', overflow: 'hidden' }}>
                    {/* Zone titre */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', zIndex: 2 }}>
                      <div style={{ width: 28, height: 2, background: t.accentColor, borderRadius: 1 }} />
                      <div style={{ width: '80%', height: 10, background: t.id === 'panorama' || t.id === 'magazine' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
                      <div style={{ width: '55%', height: 7, background: t.id === 'panorama' || t.id === 'magazine' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
                    </div>
                    {/* Zones sections */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '62%', display: 'flex', flexDirection: 'column', gap: 2, padding: '3px 0' }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ flex: 1, display: 'flex', gap: 2, padding: '0 8px', opacity: 0.7 }}>
                          {(t.id === 'journal' || t.id === 'postcard' || t.id === 'roadtrip') && <>
                            <div style={{ flex: i%2===0?1:2, background: `${t.accentColor}25`, borderRadius: 1 }} />
                            <div style={{ flex: i%2===0?2:1, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
                          </>}
                          {(t.id === 'noir' || t.id === 'film') && <>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 1 }} />
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }} />
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 1 }} />
                          </>}
                          {t.id === 'panorama' && <div style={{ flex: 1, background: 'rgba(0,0,0,0.08)', borderRadius: 1 }} />}
                          {t.id === 'magazine' && <>
                            <div style={{ flex: 1, background: 'rgba(0,0,0,0.07)', borderRadius: 1 }} />
                            <div style={{ flex: 1, background: `${t.accentColor}20`, borderRadius: 1 }} />
                          </>}
                          {t.id === 'nature' && <>
                            <div style={{ flex: 2, background: `${t.accentColor}20`, borderRadius: 1 }} />
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }} />
                          </>}
                        </div>
                      ))}
                    </div>
                    {/* Hover overlay */}
                    <div style={{ position: 'absolute', inset: 0, background: `${t.accentColor}20`, opacity: hovered === t.id ? 1 : 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                      <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.68rem', fontWeight: 700, color: '#0d0d0d', background: t.accentColor, padding: '0.35rem 0.9rem', letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 2 }}>Choisir →</span>
                    </div>
                  </div>
                  {/* Infos */}
                  <div style={{ padding: '0.65rem 0.85rem', background: '#161616' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 14 }}>{t.icon}</span>
                      <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', fontWeight: 600, color: '#e0e0e0' }}>{t.label}</span>
                    </div>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', color: '#555', lineHeight: 1.45 }}>{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ÉTAPE 2 : sélecteur de taille ── */}
          {selected && tpl && (
            <div style={{ padding: '1.75rem 2rem' }}>

              {/* Rappel du template */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.75rem', padding: '0.9rem 1.25rem', background: '#1a1a1a', borderRadius: 5, border: `1px solid ${tpl.accentColor}33` }}>
                <span style={{ fontSize: 22 }}>{tpl.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', fontWeight: 600, color: 'white', marginBottom: 2 }}>{tpl.label}</p>
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.7rem', color: '#555' }}>{tpl.desc}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Section</p>
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', color: tpl.accentColor, fontWeight: 600 }}>{tpl.sectionH}px</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'start' }}>
                <div>
                  {/* Boutons rapides */}
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', marginBottom: '0.75rem' }}>Rythme du récit</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    {HEIGHT_OPTIONS.map(h => (
                      <button key={h} type="button" onClick={() => { setCanvasH(h); setCustomH(''); }}
                        style={{ padding: '0.5rem 1rem', border: '1.5px solid', borderRadius: 3, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                          borderColor: canvasH === h && !customH ? tpl.accentColor : '#2a2a2a',
                          background: canvasH === h && !customH ? `${tpl.accentColor}18` : '#1a1a1a',
                          color: canvasH === h && !customH ? tpl.accentColor : '#666' }}>
                        {h >= 1000 ? `${h/1000}k` : h}px
                      </button>
                    ))}
                  </div>

                  {/* Slider */}
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', marginBottom: '0.5rem' }}>Ajuster le rythme</p>
                  <input type="range" min={1000} max={6000} step={100} value={canvasH}
                    onChange={e => { setCanvasH(Number(e.target.value)); setCustomH(''); }}
                    style={{ width: '100%', accentColor: tpl.accentColor, marginBottom: 4 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.58rem', color: '#444' }}>1 000 px</span>
                    <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', color: tpl.accentColor, fontWeight: 600 }}>{canvasH} px</span>
                    <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.58rem', color: '#444' }}>6 000 px</span>
                  </div>

                  {/* Valeur personnalisée */}
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', marginBottom: '0.5rem' }}>Longueur avancée</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" min={800} max={10000} step={100}
                      placeholder="ex : 3800"
                      value={customH}
                      onChange={e => { setCustomH(e.target.value); if (Number(e.target.value) >= 800) setCanvasH(Number(e.target.value)); }}
                      style={{ flex: 1, padding: '0.6rem 0.85rem', background: '#1a1a1a', border: `1px solid ${customH ? tpl.accentColor : '#2a2a2a'}`, color: '#e0e0e0', fontFamily: "'DM Sans',system-ui", fontSize: '0.88rem', outline: 'none', borderRadius: 3 }} />
                    {customH && (
                      <button type="button" onClick={() => { setCustomH(''); setCanvasH(2500); }}
                        style={{ padding: '0.6rem 0.85rem', background: 'transparent', border: '1px solid #2a2a2a', color: '#666', cursor: 'pointer', borderRadius: 3, fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem' }}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Schéma proportionnel */}
                <div style={{ width: 72, flexShrink: 0 }}>
                  <div style={{ width: 72, background: '#0d0d0d', border: `1px solid ${tpl.accentColor}44`, borderRadius: 3, overflow: 'hidden' }}>
                    {/* Titre */}
                    <div style={{ height: Math.max(18, Math.round(tpl.titleH / finalH * 260)), background: `${tpl.accentColor}22`, borderBottom: `1px solid ${tpl.accentColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 7, color: tpl.accentColor, fontFamily: "'DM Sans',system-ui", letterSpacing: '0.08em', textTransform: 'uppercase', writingMode: 'horizontal-tb' }}>TITRE</span>
                    </div>
                    {/* Sections */}
                    {Array.from({ length: sectionCount }).map((_, i) => (
                      <div key={i} style={{ height: Math.max(14, Math.round(tpl.sectionH / finalH * 260)), background: i%2===0?'rgba(255,255,255,0.04)':'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Sans',system-ui" }}>§{i+1}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.52rem', color: '#555', textAlign: 'center', marginTop: 5 }}>{finalH}px</p>
                </div>
              </div>

              {/* Résumé */}
              <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4, display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, background: tpl.accentColor, borderRadius: 1 }} />
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', color: 'white' }}>1 couverture ({tpl.titleH}px)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, background: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', color: 'white' }}>
                    <span style={{ color: tpl.accentColor, fontWeight: 700 }}>{sectionCount} section{sectionCount > 1 ? 's' : ''}</span> × {tpl.sectionH}px
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#666' }}>Composition : {finalH}px</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 2rem', borderTop: '1px solid #1e1e1e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.68rem', color: '#444' }}>
            {selected ? '⚠️ Utiliser ce style remplace la composition actuelle' : `${SCALABLE_TEMPLATES.length} templates · taille au choix de 1 000 à 6 000 px`}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '0.45rem 1.25rem', background: 'transparent', border: '1px solid #2a2a2a', color: '#666', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', borderRadius: 3 }}>
              Annuler
            </button>
            {selected && tpl && (
              <button type="button"
                onClick={() => { onApply(tpl.generate(finalH), finalH); onClose(); }}
                style={{ padding: '0.45rem 1.75rem', background: tpl.accentColor, color: '#0d0d0d', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 3 }}>
                Appliquer →
              </button>
            )}
          </div>
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
  const [busy, setBusy] = useState(false);

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
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 14 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,57,43,0.85)')} onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}>×</button>
        </div>
      ) : (
        <div className="fade-slide-in" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', border: `1.5px dashed ${busy ? '#c9a84c' : 'rgba(255,255,255,0.15)'}`, transition: 'border-color 0.2s' }}>
            {busy ? (
              <>
                <div className="spin" style={{ width: 26, height: 26, border: '2.5px solid rgba(201,168,76,0.25)', borderTopColor: '#c9a84c', borderRadius: '50%' }} />
                <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#c9a84c' }}>Envoi en cours…</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 32, opacity: 0.4 }}>🖼️</span>
                <label style={{ padding: '0.45rem 1rem', background: '#c9a84c', color: '#0d0d0d', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'DM Sans',system-ui", fontWeight: 600, borderRadius: 3 }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')} onMouseLeave={e => (e.currentTarget.style.filter = 'none')}>
                  📁 Choisir une photo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setBusy(true);
                    try { const url = await onUpload(f); if (url) onChange({ ...d, url }); } finally { setBusy(false); }
                  }} />
                </label>
                <input type="text" placeholder="ou coller une URL…" style={{ ...iS, width: '80%', textAlign: 'center' }}
                  onBlur={e => { if (e.target.value) onChange({ ...d, url: optimizeImageUrl(e.target.value) }); }}
                  onChange={e => { if (e.target.value) onChange({ ...d, url: e.target.value }); }} />
              </>
            )}
        </div>
      );

    case 'gallery': {
      const images: string[] = d.images || [];
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          {images.length === 0 ? (
            <div className="fade-slide-in" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, border: `1.5px dashed ${busy ? '#c9a84c' : 'rgba(255,255,255,0.15)'}`, transition: 'border-color 0.2s' }}>
              {busy ? (
                <>
                  <div className="spin" style={{ width: 24, height: 24, border: '2.5px solid rgba(201,168,76,0.25)', borderTopColor: '#c9a84c', borderRadius: '50%' }} />
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.7rem', color: '#c9a84c' }}>Envoi des photos…</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 28, opacity: 0.4 }}>🗂️</span>
                  <label style={{ padding: '0.4rem 0.85rem', background: '#c9a84c', color: '#0d0d0d', cursor: 'pointer', fontSize: '0.72rem', fontFamily: "'DM Sans',system-ui", fontWeight: 600, borderRadius: 3 }}
                    onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')} onMouseLeave={e => (e.currentTarget.style.filter = 'none')}>
                    📁 Ajouter des photos
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={async e => {
                      const files = Array.from(e.target.files || []);
                      setBusy(true);
                      try {
                        const urls: string[] = [];
                        for (const f of files) { const u = await onUpload(f); if (u) urls.push(u); }
                        onChange({ ...d, images: [...images, ...urls] });
                      } finally { setBusy(false); }
                    }} />
                  </label>
                </>
              )}
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
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 14 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,57,43,0.85)')} onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}>×</button>
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

// ─── Dropdown personnalisé (remplace les <select> natifs du navigateur) ───────
function CustomSelect({ value, onChange, options, placeholder = 'Sélectionner…', searchable = false }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    if (searchable) setTimeout(() => searchRef.current?.focus(), 30);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, searchable]);

  const filtered = searchable && query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;
  const current = options.find(o => o.value === value);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen(o => !o); setQuery(''); }}
        style={{
          width: '100%', padding: '0.75rem 1rem', border: `1px solid ${open ? '#c9a84c' : '#2a2a2a'}`,
          background: '#1a1a1a', color: current ? '#e0e0e0' : '#555',
          fontFamily: "'DM Sans',system-ui", fontSize: '0.92rem', textAlign: 'left',
          cursor: 'pointer', borderRadius: 3, boxShadow: open ? '0 0 0 3px rgba(201,168,76,0.12)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current ? current.label : placeholder}</span>
        <span style={{ fontSize: 10, color: '#666', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {open && (
        <div className="pop-in" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
          background: '#161616', border: '1px solid #2a2a2a', borderRadius: 5,
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}>
          {searchable && (
            <div style={{ padding: 8, borderBottom: '1px solid #1e1e1e' }}>
              <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher…"
                style={{ width: '100%', padding: '0.5rem 0.7rem', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 3, color: '#e0e0e0', fontFamily: "'DM Sans',system-ui", fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
          )}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <p style={{ padding: '0.85rem 1rem', fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', color: '#555' }}>Aucun résultat</p>
            )}
            {filtered.map(o => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.6rem 1rem', background: o.value === value ? 'rgba(201,168,76,0.12)' : 'transparent',
                  border: 'none', cursor: 'pointer', color: o.value === value ? '#c9a84c' : '#ccc',
                  fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', fontWeight: o.value === value ? 600 : 400,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
                onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}>
                {o.label}
                {o.value === value && <span style={{ fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pinterest-style editor helpers ──────────────────────────────────────────
// The visual editor below intentionally keeps CanvasBlock's x/y/w/h contract.
// The database and the reader therefore continue to receive the same payload;
// only the authoring experience becomes vertical and guided.

const TYPE_META: Record<BlockType, { icon: string; label: string; hint: string }> = {
  text: { icon: '✍️', label: 'Texte', hint: 'Racontez un souvenir' },
  photo: { icon: '📷', label: 'Photo', hint: 'Un moment fort' },
  gallery: { icon: '▦', label: 'Galerie', hint: 'Plusieurs souvenirs' },
  quote: { icon: '💬', label: 'Citation', hint: 'Une phrase à retenir' },
  hotel: { icon: '🏨', label: 'Hébergement', hint: 'Une adresse à partager' },
  restaurant: { icon: '🍽️', label: 'Restaurant', hint: 'Une bonne table' },
  pros_cons: { icon: '⚖️', label: 'Pour / Contre', hint: 'Votre avis' },
  divider: { icon: '—', label: 'Séparateur', hint: 'Créer une respiration' },
  spacer: { icon: '↕', label: 'Espace', hint: "Créer de l'air" },
};

function blockLabel(type: BlockType) {
  return TYPE_META[type]?.label || type;
}

function defaultBlock(type: BlockType): { w: number; h: number; data: any } {
  switch (type) {
    case 'text': return { w: 1080, h: 230, data: { html: '<p>Écrivez votre histoire ici…</p>' } };
    case 'photo': return { w: 1080, h: 520, data: { url: '', caption: '' } };
    case 'gallery': return { w: 1080, h: 430, data: { images: [], layout: 'mosaic' } };
    case 'quote': return { w: 900, h: 220, data: { text: '', author: '' } };
    case 'hotel': return { w: 720, h: 300, data: { name:'',link:'',price:'',rating:'',review:'',photo:'' } };
    case 'restaurant': return { w: 720, h: 280, data: { name:'',link:'',price:'',rating:'',review:'',cuisine:'' } };
    case 'pros_cons': return { w: 900, h: 300, data: { pros:[''],cons:[''] } };
    case 'divider': return { w: 900, h: 48, data: { style: 'line' } };
    case 'spacer': return { w: 900, h: 80, data: {} };
  }
}

function layoutBlock(block: CanvasBlock, layout: 'wide'|'standard'|'compact'|'large', align: 'left'|'center'|'right' = 'center'): CanvasBlock {
  const widths: Record<string, number> = { wide: 1080, large: 980, standard: 760, compact: 520 };
  const w = Math.min(CANVAS_W - 40, widths[layout]);
  const x = align === 'left' ? 60 : align === 'right' ? CANVAS_W - w - 60 : Math.round((CANVAS_W - w) / 2);
  return { ...block, x, w: Math.max(320, w) };
}

function autoLayoutBlocks(input: CanvasBlock[]): CanvasBlock[] {
  const ordered = [...input].sort((a,b) => (a.y - b.y) || (a.zIndex - b.zIndex));
  let y = 60;
  return ordered.map((b, index) => {
    const isPhoto = b.type === 'photo' || b.type === 'gallery';
    const isText = b.type === 'text' || b.type === 'quote';
    const w = isPhoto ? 1080 : isText ? 900 : Math.min(900, Math.max(520, b.w || 760));
    const x = b.type === 'divider' || b.type === 'spacer' ? 150 : Math.round((CANVAS_W - w) / 2);
    const h = Math.max(48, b.h || defaultBlock(b.type).h);
    const next = { ...b, x, y, w, h, zIndex: 5 };
    y += h + (b.type === 'divider' ? 26 : b.type === 'spacer' ? 10 : 34);
    return next;
  });
}

function AddPalette({ onAdd, onClose, onOpenMedia }: {
  onAdd: (type: BlockType) => void;
  onClose: () => void;
  onOpenMedia: (type: 'photo'|'gallery') => void;
}) {
  const items: { type: BlockType; icon: string; label: string; hint: string }[] = [
    { type:'photo', icon:'📷', label:'Photo', hint:'Un souvenir visuel' },
    { type:'gallery', icon:'▦', label:'Galerie', hint:'Plusieurs photos' },
    { type:'text', icon:'✍️', label:'Texte', hint:'Raconter votre histoire' },
    { type:'quote', icon:'💬', label:'Citation', hint:'Une phrase forte' },
    { type:'restaurant', icon:'🍽️', label:'Restaurant', hint:'Une bonne adresse' },
    { type:'hotel', icon:'🏨', label:'Hébergement', hint:'Où vous avez dormi' },
    { type:'pros_cons', icon:'⚖️', label:'Pour / Contre', hint:'Votre avis' },
    { type:'divider', icon:'—', label:'Séparateur', hint:'Une respiration' },
  ];
  return (
    <div className="od-popover od-add-popover" onClick={e => e.stopPropagation()}>
      <div className="od-popover-head">
        <div><strong>Ajouter</strong><span>Votre contenu, sans vous occuper du design.</span></div>
        <button type="button" onClick={onClose}>×</button>
      </div>
      <div className="od-pop-grid">
        {items.map(item => (
          <button key={item.type} type="button" className="od-pop-item"
            onClick={() => item.type === 'photo' || item.type === 'gallery' ? onOpenMedia(item.type as 'photo'|'gallery') : onAdd(item.type)}>
            <span className="od-pop-icon">{item.icon}</span>
            <span><b>{item.label}</b><small>{item.hint}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MediaLibraryModal({ supabase, onSelect, onClose, onUpload, purpose }: {
  supabase: ReturnType<typeof createClientComponentClient>;
  onSelect: (url: string) => void;
  onClose: () => void;
  onUpload: (file: File) => Promise<string | null>;
  purpose: 'cover'|'photo'|'gallery';
}) {
  const [mode, setMode] = useState<'upload'|'url'>('upload');
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const chooseFiles = async (files: File[]) => {
    if (!files.length) return;
    setError('');
    setBusy(true);
    try {
      for (const file of files) {
        const uploaded = await onUpload(file);
        if (uploaded) {
          onSelect(uploaded);
          if (purpose !== 'gallery') break;
        } else {
          // uploadFile already explains the exact reason via the global toast.
          setError(`Impossible d'importer « ${file.name} ». Consultez le message affiché pour connaître la raison.`);
          break;
        }
      }
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setBusy(false);
    }
  };

  const useUrl = () => {
    const value = url.trim();
    setError('');
    if (!value) {
      setError('Veuillez coller l’URL d’une image.');
      return;
    }
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      setError('Cette URL n’est pas valide. Utilisez une adresse http:// ou https:// vers une image.');
      return;
    }
    onSelect(value);
  };

  return (
    <div className="od-modal" onClick={onClose}>
      <div className="od-media-modal od-media-import-modal" onClick={e => e.stopPropagation()}>
        <div className="od-media-head">
          <div>
            <p className="od-eyebrow">Ajouter un média</p>
            <h3>{purpose === 'gallery' ? 'Ajouter des photos' : 'Ajouter une photo'}</h3>
            <span>Deux possibilités : importer un fichier ou coller une URL. Aucune bibliothèque du site n’est affichée.</span>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="od-media-tabs">
          <button type="button" className={mode === 'upload' ? 'active' : ''} onClick={() => { setMode('upload'); setError(''); }}>📤 Importer une image</button>
          <button type="button" className={mode === 'url' ? 'active' : ''} onClick={() => { setMode('url'); setError(''); }}>🔗 Utiliser une URL</button>
        </div>

        {mode === 'upload' ? (
          <div className="od-media-import-body">
            <button type="button" className="od-media-dropzone" disabled={busy} onClick={() => inputRef.current?.click()}>
              <span className="od-media-drop-icon">＋</span>
              <strong>{busy ? 'Import en cours…' : 'Choisir une image'}</strong>
              <small>JPG / JPEG, PNG ou WebP · 10 Mo maximum</small>
              <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                multiple={purpose === 'gallery'}
                style={{ display: 'none' }}
                onChange={e => chooseFiles(Array.from(e.target.files || []))}
              />
            </button>
            <p className="od-media-help">Vous pouvez aussi glisser-déposer votre fichier dans cette zone.</p>
          </div>
        ) : (
          <div className="od-media-url-body">
            <label>URL de l’image</label>
            <input
              autoFocus
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') useUrl(); }}
              placeholder="https://exemple.com/ma-photo.jpg"
            />
            <small>L’image doit être accessible publiquement depuis cette adresse.</small>
            <button type="button" className="od-primary" onClick={useUrl}>Utiliser cette image</button>
          </div>
        )}

        {error && <div className="od-media-error">⚠️ {error}</div>}

        <div className="od-media-foot">
          <span style={{ fontSize: 11, color: '#858c87' }}>Les photos existantes du site ne sont pas proposées ici.</span>
          <button type="button" className="od-ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

function AdvancedInspector({ block, onUpdate, onDelete }: {
  block: CanvasBlock;
  onUpdate: (b: CanvasBlock) => void;
  onDelete: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [styleOpen, setStyleOpen] = useState(true);
  const update = (patch: Partial<CanvasBlock>) => onUpdate({ ...block, ...patch });
  const align = block.x <= 80 ? 'left' : block.x + block.w >= CANVAS_W - 80 ? 'right' : 'center';

  return (
    <aside className="od-inspector-new">
      <div className="od-inspector-new-head">
        <div><p>Modifier</p><h3>{TYPE_META[block.type]?.icon} {blockLabel(block.type)}</h3></div>
        <button type="button" className="od-close-soft" onClick={onDelete}>Suppr.</button>
      </div>
      <div className="od-inspector-new-body">
        <section className="od-inspector-section">
          <div className="od-inspector-section-title"><span>Mise en page</span><small>Le moteur s'occupe du reste.</small></div>
          <div className="od-layout-pills">
            {(['wide','standard','compact'] as const).map(v=>(
              <button key={v} type="button" className={Math.abs(block.w - ({wide:1080,standard:760,compact:520}[v])) < 20 ? 'active' : ''}
                onClick={()=>update(layoutBlock(block,v,align as 'left'|'center'|'right'))}>
                {v==='wide'?'Large':v==='standard'?'Standard':'Compact'}
              </button>
            ))}
          </div>
          <div className="od-align-row">
            {(['left','center','right'] as const).map(v=><button key={v} type="button" className={align===v?'active':''} onClick={()=>update(layoutBlock(block, Math.abs(block.w-1080)<20?'wide':Math.abs(block.w-520)<20?'compact':'standard',v))}>{v==='left'?'Gauche':v==='center'?'Centre':'Droite'}</button>)}
          </div>
        </section>

        <section className="od-inspector-section">
          <button type="button" className="od-collapse-title" onClick={()=>setStyleOpen(v=>!v)}>
            <span>🎨 Style</span><span>{styleOpen?'−':'+'}</span>
          </button>
          {styleOpen && <>
            <div className="od-color-row">
              {BG_PRESETS.slice(0,7).map(p=><button key={p.value} title={p.label} type="button" className={block.bg===p.value?'active':''} style={{background:p.value}} onClick={()=>update({bg:p.value})}/>)}
            </div>
            <div className="od-font-row">
              {(['sans','serif','display'] as FontStyle[]).map(v=><button key={v} type="button" className={block.font===v?'active':''} onClick={()=>update({font:v})}>{v==='sans'?'Sans':v==='serif'?'Serif':'Display'}</button>)}
            </div>
          </>}
        </section>

        <section className="od-inspector-section">
          <div className="od-inspector-section-title"><span>Superposition</span><small>Uniquement si nécessaire.</small></div>
          <div className="od-z-row"><button type="button" onClick={()=>update({zIndex:Math.max(1,block.zIndex-1)})}>−</button><span>{block.zIndex}</span><button type="button" onClick={()=>update({zIndex:block.zIndex+1})}>+</button></div>
        </section>

        <button type="button" className="od-advanced-toggle" onClick={()=>setAdvanced(v=>!v)}>{advanced?'Masquer les options avancées':'Options avancées'}</button>
        {advanced && <div className="od-advanced-grid">
          {(['x','y','w','h'] as const).map(k=><label key={k}><span>{k.toUpperCase()}</span><input type="number" value={Math.round(block[k])} onChange={e=>update({[k]:Number(e.target.value)} as Partial<CanvasBlock>)} /></label>)}
          <label className="od-advanced-full"><span>Couleur du texte</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(block.textColor)?block.textColor:'#0d0d0d'} onChange={e=>update({textColor:e.target.value})}/></label>
        </div>}
      </div>
    </aside>
  );
}

function StoryBlockCard({ block, selected, onSelect, onUpdate, onDelete, onUpload, onMoveUp, onMoveDown }: {
  block: CanvasBlock; selected: boolean; onSelect: ()=>void; onUpdate:(b:CanvasBlock)=>void; onDelete:()=>void;
  onUpload:(f:File)=>Promise<string|null>; onMoveUp:()=>void; onMoveDown:()=>void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const meta = TYPE_META[block.type];
  return (
    <article
      className={`od-story-card ${selected?'selected':''} ${dragOver?'drag-over':''}`}
      style={{ background:block.bg || '#fff', color:block.textColor }}
      onClick={onSelect}
      onDragOver={e=>{e.preventDefault();setDragOver(true)}}
      onDragLeave={()=>setDragOver(false)}
      onDrop={e=>{e.preventDefault();setDragOver(false);}}
    >
      <div className="od-story-card-top" onClick={e=>e.stopPropagation()}>
        <span>{meta?.icon} {meta?.label}</span>
        <div>
          <button type="button" title="Monter" onClick={onMoveUp}>↑</button>
          <button type="button" title="Descendre" onClick={onMoveDown}>↓</button>
          <button type="button" title="Supprimer" onClick={onDelete}>×</button>
        </div>
      </div>
      <div className="od-story-card-content">
        <BlockContent block={block} onChange={data=>onUpdate({...block,data})} onUpload={onUpload} />
      </div>
    </article>
  );
}

export default function CreateTrip() {
  const supabase = createClientComponentClient();
  const [isMounted, setIsMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editTripId, setEditTripId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [meta, setMeta] = useState<Metadata>({country:'',city:'',travelers:'1',duration:'',budget:'',category:'',season:''});
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [blocks, setBlocks] = useState<CanvasBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [mediaPurpose, setMediaPurpose] = useState<'cover'|'photo'|'gallery'|null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmTemplate, setShowConfirmTemplate] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [toast, setToast] = useState<{id:number;msg:string;kind:'error'|'success'}|null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [publishedId, setPublishedId] = useState<string|null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  const notify = useCallback((msg:string, kind:'error'|'success'='error')=>{
    if(toastTimer.current) clearTimeout(toastTimer.current);
    const id=Date.now(); setToast({id,msg,kind});
    toastTimer.current=setTimeout(()=>setToast(t=>t?.id===id?null:t),4200);
  },[]);

  const destination=[meta.city,meta.country].filter(Boolean).join(', ');
  const currentCategory=CATEGORIES.find(c=>c.value===meta.category)?.label || '';
  const storyBlocks=[...blocks].sort((a,b)=>(a.y-b.y)||(a.zIndex-b.zIndex));
  const selectedBlock=blocks.find(b=>b.id===selectedId)||null;

  useEffect(()=>{setIsMounted(true)},[]);

  useEffect(()=>{
    if(!isMounted) return;
    const id=new URLSearchParams(window.location.search).get('edit');
    if(!id) return;
    setEditLoading(true);
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){notify('Connectez-vous pour modifier un récit.');setEditLoading(false);return;}
      const {data:trip,error}=await supabase.from('trips').select('*').eq('id',id).single();
      if(error||!trip){notify('Récit introuvable.');setEditLoading(false);return;}
      if(trip.author_id!==user.id){notify('Vous ne pouvez modifier que vos propres récits.');window.location.href='/';return;}
      setEditTripId(id); setTitle(trip.title||''); setSubtitle(trip.subtitle||''); setCoverUrl(trip.cover_image||'');
      setMeta({
        country:trip.country||'',city:trip.city||'',travelers:String(trip.travelers||1),
        duration:String(trip.duration_days||''),budget:trip.budget||'',category:trip.category||'',season:trip.season||''
      });
      if(Array.isArray(trip.content)) setBlocks(trip.content as CanvasBlock[]);
      setStep(2); setEditLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isMounted]);

  const uploadFile=useCallback(async(file:File):Promise<string|null>=>{
    const extension=(file.name.split('.').pop()||'').toLowerCase();
    const allowedExtensions=['jpg','jpeg','png','webp'];
    const allowedTypes=['image/jpeg','image/png','image/webp'];
    const type=(file.type||'').toLowerCase();

    // Some browsers report an empty MIME type for local JPG files, so validate
    // both the extension and the MIME type instead of relying on file.type only.
    if(!allowedExtensions.includes(extension) || (type && !allowedTypes.includes(type))){
      const reason=type ? `format « ${type} » non accepté` : `extension « .${extension||'inconnue'} » non acceptée`;
      notify(`Image refusée : ${reason}. Formats acceptés : JPG, PNG ou WebP.`);
      return null;
    }
    if(file.size>10*1024*1024){
      notify(`Image refusée : le fichier pèse ${(file.size/1024/1024).toFixed(1)} Mo. La limite est de 10 Mo.`);
      return null;
    }

    setUploading(true);
    try{
      const finalExt=extension==='jpeg'?'jpg':extension;
      const contentType=type || (finalExt==='jpg'?'image/jpeg':`image/${finalExt}`);
      const fileName=`${uid()}.${finalExt}`;
      const {error}=await supabase.storage.from('trip-images').upload(fileName,file,{
        cacheControl:'3600',upsert:false,contentType,
      });
      if(error){
        console.error(error);
        notify(`Image refusée par le stockage : ${error.message || 'erreur inconnue'}`);
        return null;
      }
      const publicUrl=supabase.storage.from('trip-images').getPublicUrl(fileName).data.publicUrl;
      if(!publicUrl){
        notify("Image importée mais impossible de récupérer son adresse publique.");
        return null;
      }
      notify('Image importée avec succès.');
      return publicUrl;
    }catch(error:any){
      console.error(error);
      notify(`Échec de l'import : ${error?.message || 'une erreur est survenue.'}`);
      return null;
    }finally{setUploading(false);}
  },[supabase,notify]);

  const addBlock=(type:BlockType, dataOverride?:any)=>{
    const d=defaultBlock(type);
    const data=dataOverride ?? d.data;
    const lastBottom=blocks.length ? Math.max(...blocks.map(b=>b.y+b.h))+34 : 60;
    const w=Math.min(d.w,1080);
    const b:CanvasBlock={id:uid(),type,data,x:Math.round((CANVAS_W-w)/2),y:lastBottom,w,h:d.h,font:'sans',bg:type==='photo'||type==='gallery'?'#eee':'#fff',textColor:'#17231e',fontSize:type==='text'?1.05:1,zIndex:5};
    setBlocks(prev=>[...prev,b]); setSelectedId(b.id); setShowAddMenu(false);
  };

  const updateBlock=useCallback((updated:CanvasBlock)=>{
    setBlocks(prev=>prev.map(b=>b.id===updated.id?updated:b));
  },[]);
  const deleteBlock=useCallback((id:string)=>{setBlocks(prev=>prev.filter(b=>b.id!==id));setSelectedId(null)},[]);
  const moveBlock=(id:string,dir:-1|1)=>{
    setBlocks(prev=>{
      const ordered=[...prev].sort((a,b)=>(a.y-b.y)||(a.zIndex-b.zIndex));
      const idx=ordered.findIndex(b=>b.id===id); if(idx<0)return prev;
      const ni=idx+dir; if(ni<0||ni>=ordered.length)return prev;
      [ordered[idx],ordered[ni]]=[ordered[ni],ordered[idx]];
      let y=60;
      const next=ordered.map(b=>{const n={...b,y};y+=b.h+(b.type==='divider'?26:34);return n;});
      return prev.map(b=>next.find(n=>n.id===b.id)||b);
    });
  };

  const openMedia=(purpose:'cover'|'photo'|'gallery')=>{setMediaPurpose(purpose);setShowAddMenu(false)};
  const selectMedia=(url:string)=>{
    if(mediaPurpose==='cover') { setCoverUrl(url); setMediaPurpose(null); return; }
    if(mediaPurpose==='photo' && selectedBlock?.type==='photo') { updateBlock({...selectedBlock,data:{...selectedBlock.data,url}}); setMediaPurpose(null); return; }
    if(mediaPurpose==='gallery' && selectedBlock?.type==='gallery') {
      updateBlock({...selectedBlock,data:{...selectedBlock.data,images:[...(selectedBlock.data.images||[]),url]}});
      // Keep the dialog open so several images can be imported in one pass.
    }
  };

  const applyMagicLayout=()=>{
    if(!blocks.length){notify('Ajoutez au moins un élément avant de lancer l’organisation automatique.');return;}
    setBlocks(autoLayoutBlocks(blocks)); setSelectedId(null); notify('Votre récit a été organisé automatiquement.','success');
  };

  const applyTemplate=(newBlocks:any[],newH:number)=>{
    // Templates keep the legacy coordinates expected by the reader.
    const withIds=newBlocks.map(b=>({...b,id:uid()}));
    setBlocks(withIds); setSelectedId(null);
    setActiveTemplate('style personnalisé');
    notify(`Style appliqué · ${Math.round(newH)} px de composition.`,'success');
  };

  const canProceed=step===0 ? Boolean(meta.country) : step===1 ? Boolean(title.trim()) : true;

  // Slug legacy-compatible: generated from the title, unique per author.
  // Same title is therefore allowed for different users, but not twice for the same user.
  const slugify = (value:string) => value
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
    .slice(0,90) || 'recit';

  const getUniqueSlug = async (rawTitle:string, authorId:string, currentId?:string|null) => {
    const base=slugify(rawTitle);
    let candidate=base;
    let suffix=2;
    while(true){
      let query=supabase.from('trips').select('id').eq('author_id',authorId).eq('slug',candidate).limit(1);
      if(currentId) query=query.neq('id',currentId);
      const {data,error}=await query.maybeSingle();
      if(error) throw error;
      if(!data) return candidate;
      candidate=`${base}-${suffix++}`;
    }
  };

  const publishTrip=async()=>{
    setLoading(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){notify('Connectez-vous pour publier votre récit.');return;}

      const cleanTitle=title.trim();
      if(!cleanTitle){notify('Ajoutez un titre à votre récit.');return;}

      // On update, keep the existing slug when the title has not changed.
      // If the title changed, regenerate it while keeping uniqueness per author.
      let slug:string;
      if(editTripId){
        const {data:existing,error:existingError}=await supabase
          .from('trips').select('id,title,slug').eq('id',editTripId).eq('author_id',user.id).maybeSingle();
        if(existingError) throw existingError;
        if(!existing){notify('Récit introuvable ou accès refusé.');return;}
        slug = existing.title === cleanTitle && existing.slug ? existing.slug : await getUniqueSlug(cleanTitle,user.id,editTripId);
      }else{
        slug = await getUniqueSlug(cleanTitle,user.id);
      }

      const payload:any={
        title:cleanTitle, slug, subtitle:subtitle.trim(), cover_image:coverUrl||null,
        country:meta.country, city:meta.city||null, travelers:Number(meta.travelers)||1,
        duration_days:meta.duration?Number(meta.duration):null, budget:meta.budget||null,
        category:meta.category||null, season:meta.season||null, content:blocks,
      };
      if(editTripId){
        const {error}=await supabase.from('trips').update(payload).eq('id',editTripId).eq('author_id',user.id);
        if(error)throw error;
        setPublishedId(editTripId);
      }else{
        const {data,error}=await supabase.from('trips').insert({...payload,author_id:user.id}).select('id').single();
        if(error)throw error;
        setPublishedId(data?.id||null);
      }
      setPublished(true); notify(editTripId?'Votre récit a été mis à jour.':'Votre récit est publié.','success');
    }catch(e:any){
      console.error(e); notify(e?.message||'La publication a échoué.');
    }finally{setLoading(false);}
  };

  const field=(label:string,value:string,onChange:(v:string)=>void,placeholder:string,type='text')=>(
    <label className="od-field"><span>{label}</span><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type}/></label>
  );

  if(!isMounted)return null;
  if(editLoading)return <div className="od-loading"><div className="od-spinner"/><p>Préparation de votre récit…</p></div>;

  const progress=[['Destination','Où êtes-vous allé ?'],['Histoire','Donnez-lui une voix.'],['Construire','Ajoutez vos souvenirs.'],['Publier','Voyez le résultat.']];

  return <>
    <style dangerouslySetInnerHTML={{__html:`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&display=swap');
      *{box-sizing:border-box}html,body{margin:0}body{background:#f4f1eb}button,input,textarea{font:inherit}button{cursor:pointer}
      ::selection{background:#d9e8df;color:#17372d}@keyframes odSpin{to{transform:rotate(360deg)}}@keyframes odUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
      .od-app{height:100vh;display:flex;flex-direction:column;background:#f4f1eb;color:#17231e;font-family:'DM Sans',system-ui,sans-serif;overflow:hidden}
      .od-top{height:70px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:rgba(255,255,255,.92);backdrop-filter:blur(18px);border-bottom:1px solid #e7e2d9;z-index:100}
      .od-brand{display:flex;align-items:center;gap:11px;min-width:210px}.od-mark{width:36px;height:36px;border:0;border-radius:12px;background:#17372d;color:#f6f1e8;display:grid;place-items:center;font-family:Georgia,serif;font-size:18px}.od-brand strong{font-family:Georgia,serif;font-size:17px;letter-spacing:-.02em}.od-brand small{display:block;color:#8b938d;font-size:11px;margin-top:1px}
      .od-progress{display:flex;align-items:center;gap:8px;position:absolute;left:50%;transform:translateX(-50%)}.od-progress-item{border:0;background:none;display:flex;align-items:center;color:#9aa09c;font-size:11px;font-weight:600}.od-progress-item.active{color:#17372d}.od-progress-dot{width:28px;height:28px;border:1px solid #ddd8cf;border-radius:50%;display:grid;place-items:center;background:white;font-size:11px}.od-progress-item.active .od-progress-dot{background:#17372d;border-color:#17372d;color:white}.od-progress-item.done .od-progress-dot{background:#dce9e1;border-color:#c9dbd0;color:#17372d}.od-progress-line{width:28px;height:1px;background:#ddd8cf}
      .od-top-actions{display:flex;align-items:center;gap:7px;min-width:210px;justify-content:flex-end}.od-ghost,.od-secondary-action{border:1px solid #e1ddd5;background:white;color:#69716c;border-radius:11px;padding:9px 13px;font-size:12px;font-weight:600}.od-primary{border:0;background:#17372d;color:white;border-radius:11px;padding:10px 16px;font-size:12px;font-weight:700;box-shadow:0 7px 18px rgba(23,55,45,.16)}.od-primary:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}
      .od-body{min-height:0;flex:1;display:flex;overflow:hidden}.od-content{flex:1;min-width:0;overflow:auto}.od-form-shell{max-width:1080px;margin:0 auto;padding:50px 28px 80px}.od-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#8c938e;font-weight:700;margin:0 0 10px}.od-h1{font-family:Georgia,serif;font-size:44px;line-height:1.04;font-weight:400;letter-spacing:-.035em;margin:0;color:#17231e}.od-lead{font-size:15px;line-height:1.7;color:#737a75;max-width:640px;margin:12px 0 32px}.od-card{background:rgba(255,255,255,.84);border:1px solid #e5e0d7;border-radius:24px;padding:28px;box-shadow:0 15px 45px rgba(46,49,43,.05);animation:odUp .35s ease both}.od-section-title{font-family:Georgia,serif;font-size:23px;font-weight:400;margin:0 0 5px}.od-section-sub{color:#858c87;font-size:13px;margin:0 0 22px}.od-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.od-field{display:block}.od-field>span{display:block;font-size:11px;font-weight:700;color:#707873;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px}.od-field input,.od-field select,.od-field textarea{width:100%;border:1px solid #e1ddd5;background:#faf9f6;color:#25302b;border-radius:13px;padding:13px 14px;outline:none;transition:.18s}.od-field input:focus,.od-field textarea:focus{border-color:#9ab5a5;box-shadow:0 0 0 4px rgba(154,181,165,.16);background:white}.od-full{grid-column:1/-1}.od-pills{display:flex;flex-wrap:wrap;gap:8px}.od-pill{border:1px solid #e1ddd5;background:#faf9f6;border-radius:999px;padding:9px 13px;color:#65706a;font-size:12px}.od-pill.active{background:#e2eee7;border-color:#b9d0c1;color:#17372d;font-weight:700}.od-next-row{display:flex;justify-content:flex-end;margin-top:24px}.od-more{margin-top:18px;border:0;background:none;color:#315a48;font-size:12px;font-weight:700;padding:0}.od-detail-grid{margin-top:18px;padding-top:18px;border-top:1px solid #eee9e1}
      .od-cover-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:22px;align-items:start}.od-cover-drop{min-height:430px;border:1px dashed #cfc9be;border-radius:20px;background:#ebe7df;position:relative;overflow:hidden;display:grid;place-items:center}.od-cover-drop img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.od-cover-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.03),rgba(0,0,0,.62))}.od-cover-copy{position:absolute;left:28px;right:28px;bottom:26px;color:white}.od-cover-copy h2{font-family:Georgia,serif;font-size:34px;font-weight:400;margin:0 0 6px}.od-cover-copy p{margin:0;color:rgba(255,255,255,.76);font-size:13px}.od-upload{position:relative;z-index:2;text-align:center}.od-upload-icon{width:58px;height:58px;border-radius:18px;background:white;display:grid;place-items:center;margin:0 auto 14px;font-size:23px;box-shadow:0 10px 25px rgba(0,0,0,.06)}.od-upload label{display:inline-flex;background:#17372d;color:white;border-radius:12px;padding:11px 15px;font-size:12px;font-weight:700}.od-upload input{display:none}.od-cover-side{display:flex;flex-direction:column;gap:14px}.od-tip{padding:16px;background:#edf3ee;border:1px solid #d8e5db;border-radius:16px;color:#516158;font-size:12px;line-height:1.6}.od-tip strong{display:block;color:#17372d;margin-bottom:4px}
      .od-builder{display:flex;min-height:0;flex:1;overflow:hidden}.od-builder-main{flex:1;min-width:0;overflow:auto;background:#e9e6df}.od-builder-toolbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:10px 18px;background:rgba(244,242,237,.9);backdrop-filter:blur(12px);border-bottom:1px solid #dcd7ce}.od-toolbar-left{display:flex;align-items:center;gap:8px}.od-toolbar-title{font-family:Georgia,serif;font-size:17px}.od-toolbar-count{font-size:11px;color:#89908b}.od-toolbar-actions{display:flex;gap:6px}.od-toolbar-actions button{border:1px solid #ddd8cf;background:white;color:#66706a;border-radius:9px;padding:8px 10px;font-size:11px;font-weight:700}.od-toolbar-actions .main{background:#17372d;color:white;border-color:#17372d}
      .od-story{width:min(900px,calc(100% - 40px));margin:30px auto 100px;background:#fff;border-radius:4px;box-shadow:0 22px 55px rgba(43,43,38,.15);padding:48px 54px}.od-story-cover{text-align:center;padding:10px 0 48px;border-bottom:1px solid #e7e2d9;margin-bottom:30px}.od-story-cover .eyebrow{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#a18c57;font-weight:700}.od-story-cover h2{font-family:Georgia,serif;font-weight:400;font-size:40px;line-height:1.08;margin:10px auto 8px;max-width:700px}.od-story-cover p{margin:0;color:#7d847f;font-size:14px}.od-story-cover img{width:100%;max-height:400px;object-fit:cover;border-radius:16px;margin-top:26px;display:block}.od-story-empty{text-align:center;padding:80px 30px;color:#919892}.od-story-empty b{display:block;font-family:Georgia,serif;font-size:24px;color:#5e6861;margin-bottom:8px}.od-story-empty span{font-size:12px}
      .od-story-card{position:relative;border:1px solid #e4dfd6;border-radius:18px;overflow:visible;margin:18px 0;min-height:80px;box-shadow:0 7px 22px rgba(43,43,38,.04);transition:.18s}.od-story-card.selected{border-color:#9bb5a5;box-shadow:0 0 0 4px rgba(154,181,165,.13),0 12px 30px rgba(43,43,38,.08)}.od-story-card.drag-over{border-color:#17372d}.od-story-card-top{position:absolute;left:10px;right:10px;top:-13px;height:26px;display:flex;justify-content:space-between;align-items:center;z-index:8;opacity:0;pointer-events:none;transition:.18s}.od-story-card:hover .od-story-card-top,.od-story-card.selected .od-story-card-top{opacity:1;pointer-events:auto}.od-story-card-top>span{background:#17372d;color:white;border-radius:8px;padding:5px 8px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.od-story-card-top>div{display:flex;gap:3px}.od-story-card-top button{width:26px;height:26px;border:1px solid #ddd8cf;background:white;border-radius:7px;color:#68716c}.od-story-card-content{min-height:100px;height:100%;padding:6px}
      .od-add-zone{border:1px dashed #c7c1b7;border-radius:18px;padding:18px;text-align:center;margin-top:22px;background:#faf8f4}.od-add-zone button{border:0;background:#17372d;color:white;border-radius:12px;padding:12px 18px;font-size:12px;font-weight:800}.od-add-zone p{margin:8px 0 0;font-size:11px;color:#8b918d}
      .od-inspector-new{width:300px;flex:none;background:white;border-left:1px solid #e4dfd6;overflow:auto}.od-inspector-new-head{padding:17px 16px;border-bottom:1px solid #eee9e1;display:flex;align-items:center;justify-content:space-between}.od-inspector-new-head p{font-size:10px;color:#999f9a;margin:0 0 3px}.od-inspector-new-head h3{font-family:Georgia,serif;font-size:18px;font-weight:400;margin:0}.od-close-soft{border:1px solid #edd0cb;background:#fff7f5;color:#b44b3f;border-radius:9px;padding:7px 9px;font-size:10px;font-weight:700}.od-inspector-new-body{padding:14px}.od-inspector-section{padding:0 0 17px;margin-bottom:16px;border-bottom:1px solid #eee9e1}.od-inspector-section-title{display:flex;flex-direction:column;gap:3px;margin-bottom:10px}.od-inspector-section-title span{font-size:11px;font-weight:800;color:#435048}.od-inspector-section-title small{font-size:10px;color:#969c97}.od-layout-pills,.od-align-row,.od-font-row{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.od-layout-pills button,.od-align-row button,.od-font-row button{border:1px solid #e2ddd5;background:#faf9f6;color:#68716c;border-radius:8px;padding:8px 5px;font-size:10px}.od-layout-pills button.active,.od-align-row button.active,.od-font-row button.active{background:#e2eee7;border-color:#b9d0c1;color:#17372d;font-weight:800}.od-align-row{margin-top:7px}.od-collapse-title{width:100%;border:0;background:none;display:flex;justify-content:space-between;padding:0;color:#435048;font-size:11px;font-weight:800}.od-color-row{display:flex;gap:6px;margin-top:11px;flex-wrap:wrap}.od-color-row button{width:27px;height:27px;border:2px solid #e0dbd2;border-radius:7px}.od-color-row button.active{border-color:#17372d;box-shadow:0 0 0 2px #dce9e1}.od-font-row{margin-top:9px}.od-z-row{display:flex;align-items:center;gap:8px}.od-z-row button{width:30px;height:30px;border:1px solid #e1ddd5;background:#faf9f6;border-radius:8px}.od-z-row span{font-size:11px;color:#68716c;min-width:25px;text-align:center}.od-advanced-toggle{width:100%;border:0;background:none;text-align:left;color:#315a48;font-size:11px;font-weight:800;padding:2px 0}.od-advanced-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.od-advanced-grid label{display:block}.od-advanced-grid label span{display:block;font-size:9px;color:#929892;text-transform:uppercase;margin-bottom:4px}.od-advanced-grid input{width:100%;border:1px solid #e1ddd5;border-radius:8px;padding:7px;background:#faf9f6;color:#34403a}.od-advanced-full{grid-column:1/-1}
      .od-popover{position:absolute;z-index:1000;background:white;border:1px solid #e1ddd5;border-radius:18px;box-shadow:0 25px 70px rgba(28,37,32,.2)}.od-add-popover{left:18px;top:62px;width:360px}.od-popover-head{display:flex;justify-content:space-between;padding:16px 17px;border-bottom:1px solid #eee9e1}.od-popover-head strong{display:block;font-family:Georgia,serif;font-size:18px;font-weight:400}.od-popover-head span{display:block;font-size:10px;color:#8a918c;margin-top:3px}.od-popover-head button{border:0;background:none;color:#777;font-size:18px}.od-pop-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:10px}.od-pop-item{border:1px solid #e7e2da;background:#fbfaf7;border-radius:12px;padding:11px;display:flex;gap:9px;text-align:left}.od-pop-item:hover{background:#f0f6f2;border-color:#aec6b7}.od-pop-icon{width:30px;height:30px;border-radius:9px;background:#e7eee9;display:grid;place-items:center}.od-pop-item b{display:block;font-size:11px;color:#34403a}.od-pop-item small{display:block;font-size:9px;color:#929892;margin-top:2px;line-height:1.3}
      .od-media-modal{position:relative;width:min(760px,94vw);max-height:88vh;overflow:hidden;background:white;border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.25)}.od-media-head{padding:20px 22px 15px;display:flex;justify-content:space-between;border-bottom:1px solid #eee9e1}.od-media-head h3{font-family:Georgia,serif;font-weight:400;font-size:24px;margin:0 0 4px}.od-media-head span{font-size:11px;color:#888f8a}.od-media-head button{border:0;background:none;font-size:22px;color:#777}.od-media-tabs{display:flex;border-bottom:1px solid #eee9e1;padding:0 18px}.od-media-tabs button{border:0;background:none;padding:11px 12px;color:#8a918c;font-size:11px;font-weight:800}.od-media-tabs button.active{color:#17372d;border-bottom:2px solid #17372d}.od-media-grid{padding:14px;display:grid;grid-template-columns:repeat(5,1fr);gap:7px;max-height:50vh;overflow:auto}.od-media-grid button{padding:0;border:0;border-radius:9px;overflow:hidden;aspect-ratio:1;background:#eee}.od-media-grid img{width:100%;height:100%;object-fit:cover}.od-media-empty{padding:60px;text-align:center;color:#858c87;font-size:12px}.od-media-empty div{font-size:34px;margin-bottom:9px}.od-media-empty b{display:block;color:#4f5b54;margin-bottom:5px}.od-media-empty span{display:block}.od-url-panel{padding:24px;display:flex;flex-direction:column;gap:12px}.od-url-note b{display:block;font-family:Georgia,serif;font-size:18px;font-weight:400;margin-bottom:4px}.od-url-note span{font-size:11px;color:#858c87}.od-url-panel input{border:1px solid #e1ddd5;background:#faf9f6;border-radius:11px;padding:12px}.od-media-foot{padding:13px 18px;border-top:1px solid #eee9e1;display:flex;justify-content:space-between}.od-media-import-body{padding:28px 24px 20px;text-align:center}.od-media-dropzone{width:100%;min-height:220px;border:1.5px dashed #cfc9bf;border-radius:16px;background:#faf9f6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;color:#263b33}.od-media-dropzone:hover:not(:disabled){border-color:#17372d;background:#f5f3ed}.od-media-dropzone:disabled{opacity:.65;cursor:wait}.od-media-drop-icon{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#e9e5dc;font-size:28px}.od-media-dropzone strong{font-size:14px}.od-media-dropzone small,.od-media-help,.od-media-url-body small{font-size:11px;color:#858c87}.od-media-help{margin:10px 0 0}.od-media-url-body{padding:28px 24px;display:flex;flex-direction:column;gap:10px}.od-media-url-body label{font-size:12px;font-weight:700;color:#34443d}.od-media-url-body input{border:1px solid #dcd7cf;background:#faf9f6;border-radius:11px;padding:13px 14px;font-size:13px;outline:none}.od-media-url-body input:focus{border-color:#17372d}.od-media-url-body .od-primary{align-self:flex-start;margin-top:5px}.od-media-error{margin:0 24px 16px;padding:12px 14px;border-radius:10px;background:#fff1ef;border:1px solid #f0c9c3;color:#9b3d32;font-size:11px;line-height:1.5}
      .od-publish-shell{max-width:980px;margin:0 auto;padding:46px 28px 80px}.od-publish-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:22px}.od-preview{background:white;border:1px solid #e2ddd5;border-radius:22px;overflow:hidden;box-shadow:0 15px 45px rgba(46,49,43,.06)}.od-preview-cover{height:270px;position:relative;background:#ddd}.od-preview-cover img{width:100%;height:100%;object-fit:cover}.od-preview-cover>div{position:absolute;inset:0;background:linear-gradient(transparent 25%,rgba(0,0,0,.7))}.od-preview-title{position:absolute;left:24px;right:24px;bottom:22px;color:white}.od-preview-title h2{font-family:Georgia,serif;font-weight:400;font-size:29px;margin:0 0 5px}.od-preview-title p{font-size:12px;color:#ddd;margin:0}.od-preview-meta{padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:14px}.od-meta-item small{display:block;text-transform:uppercase;letter-spacing:.1em;font-size:9px;color:#999f9a;font-weight:700;margin-bottom:4px}.od-meta-item strong{font-size:12px;color:#34403a}.od-ready{background:#17372d;color:white;border-radius:22px;padding:25px}.od-ready h3{font-family:Georgia,serif;font-size:24px;font-weight:400;margin:0 0 7px}.od-ready p{font-size:12px;line-height:1.6;color:#c9d8d0;margin:0 0 20px}.od-ready-list{display:grid;gap:8px;margin-bottom:22px}.od-ready-list div{display:flex;gap:8px;align-items:center;font-size:11px;color:#e3eee8}.od-ready-list i{font-style:normal;width:19px;height:19px;border-radius:50%;background:#315a48;display:grid;place-items:center}.od-full-button{width:100%;border:0;border-radius:12px;padding:12px;background:#f4f1eb;color:#17372d;font-weight:800;font-size:12px}
      .od-preview-mode{position:fixed;inset:0;z-index:2500;background:rgba(20,27,23,.72);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:30px}.od-phone{width:min(430px,92vw);height:min(88vh,820px);background:#fff;border-radius:32px;overflow:auto;box-shadow:0 30px 100px rgba(0,0,0,.35);position:relative}.od-phone-bar{position:sticky;top:0;z-index:10;padding:13px 16px;background:rgba(255,255,255,.9);backdrop-filter:blur(12px);border-bottom:1px solid #eee9e1;display:flex;justify-content:space-between}.od-phone-bar span{font-size:10px;font-weight:800;color:#69716c}.od-phone-bar button{border:0;background:none;color:#17372d;font-size:11px;font-weight:800}.od-phone-body{padding:0 0 35px}.od-phone-cover img{width:100%;height:300px;object-fit:cover}.od-phone-cover-copy{padding:24px}.od-phone-cover-copy small{color:#a18c57;text-transform:uppercase;letter-spacing:.16em;font-size:9px;font-weight:800}.od-phone-cover-copy h2{font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.08;margin:8px 0}.od-phone-cover-copy p{font-size:12px;color:#7c847f;line-height:1.6}.od-phone-block{margin:14px 16px;border:1px solid #e7e2da;border-radius:15px;overflow:hidden;min-height:80px}.od-phone-block>div{height:100%}
      .od-loading{height:100vh;display:grid;place-items:center;align-content:center;gap:12px;background:#f4f1eb;color:#727a75}.od-spinner{width:28px;height:28px;border:3px solid #dce4de;border-top-color:#17372d;border-radius:50%;animation:odSpin .8s linear infinite}.od-toast{position:fixed;top:82px;left:50%;transform:translateX(-50%);z-index:3000;background:#17372d;color:white;border-radius:13px;padding:12px 15px;box-shadow:0 16px 35px rgba(0,0,0,.18);font-size:12px;display:flex;align-items:center;gap:9px;max-width:min(90vw,500px)}
      .od-modal{position:fixed;inset:0;background:rgba(24,30,27,.48);backdrop-filter:blur(7px);z-index:2000;display:grid;place-items:center;padding:20px}.od-modal-card{width:min(440px,100%);background:#fff;border-radius:22px;padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.2)}.od-modal-card h3{font-family:Georgia,serif;font-weight:400;font-size:23px;margin:0 0 8px}.od-modal-card p{font-size:12px;color:#737a75;line-height:1.6;margin:0 0 20px}.od-modal-actions{display:flex;justify-content:flex-end;gap:8px}
      @media(max-width:1050px){.od-inspector-new{width:260px}.od-story{width:min(820px,calc(100% - 28px));padding:38px 35px}.od-progress{display:none}}
      @media(max-width:820px){.od-cover-layout,.od-publish-grid,.od-grid{grid-template-columns:1fr}.od-inspector-new{display:none}.od-story{padding:30px 18px;width:calc(100% - 24px)}.od-story-cover h2{font-size:32px}.od-top{padding:0 14px}.od-brand{min-width:auto}.od-brand small{display:none}.od-top-actions{min-width:auto}.od-top-actions .od-ghost{display:none}.od-form-shell,.od-publish-shell{padding:30px 16px 60px}.od-h1{font-size:34px}.od-card{padding:20px;border-radius:18px}.od-add-popover{left:10px;right:10px;width:auto}.od-media-grid{grid-template-columns:repeat(3,1fr)}}
    .od-media-import-modal{max-width:820px}
.od-media-import-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}
.od-upload-zone,.od-url-zone{min-height:220px;border:1px solid #e3e8e4;border-radius:18px;padding:24px;display:flex;flex-direction:column;justify-content:center;gap:10px;background:#fafcfb}
.od-upload-zone{border-style:dashed;cursor:pointer;text-align:center}
.od-upload-zone input{display:none}
.od-upload-icon{font-size:32px;line-height:1}
.od-upload-zone small,.od-url-zone small{color:#748079}
.od-url-title{font-weight:700;font-size:16px}
.od-url-zone input{width:100%;box-sizing:border-box;border:1px solid #d8dfda;border-radius:10px;padding:12px 13px;background:#fff;outline:none}
.od-url-zone input:focus{border-color:#263b31;box-shadow:0 0 0 3px rgba(38,59,49,.08)}
.od-primary-btn{border:0;border-radius:10px;padding:11px 14px;background:#263b31;color:#fff;font-weight:700;cursor:pointer}
.od-primary-btn:disabled{opacity:.45;cursor:not-allowed}
.od-secondary-btn{border:1px solid #d8dfda;border-radius:10px;padding:9px 13px;background:#fff;cursor:pointer}
.od-media-error{display:flex;gap:12px;align-items:flex-start;margin-top:18px;padding:13px 15px;border:1px solid #f0c9c9;background:#fff6f6;border-radius:12px;color:#7d2626}
.od-media-error p{margin:3px 0 0;color:#8d4141}
.od-media-footer{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:20px;padding-top:16px;border-top:1px solid #edf0ee;color:#748079;font-size:12px}
@media(max-width:700px){.od-media-import-grid{grid-template-columns:1fr}.od-media-footer{align-items:flex-start;flex-direction:column}.od-upload-zone,.od-url-zone{min-height:180px}}
`}} />
    <div className="od-app">
      <header className="od-top">
        <div className="od-brand">
          <button className="od-mark" type="button" onClick={()=>blocks.length?setConfirmLeave(true):window.location.href='/'}>O</button>
          <div><strong>Odyssey</strong><small>{editTripId?'Modifier un récit':'Nouveau récit'}</small></div>
        </div>
        <div className="od-progress">
          {progress.map(([label],i)=><Fragment key={label}>
            <button type="button" className={`od-progress-item ${i===step?'active':''} ${i<step?'done':''}`} onClick={()=>i<=step&&setStep(i)}>
              <span className="od-progress-dot">{i<step?'✓':i+1}</span><span style={{marginLeft:7}}>{label}</span>
            </button>
            {i<3&&<span className="od-progress-line" style={{background:i<step?'#b8cdbf':undefined}}/>}
          </Fragment>)}
        </div>
        <div className="od-top-actions">
          {uploading&&<div className="od-spinner" style={{width:18,height:18,borderWidth:2}}/>}
          {step>0&&<button className="od-ghost" type="button" onClick={()=>setStep(s=>s-1)}>← Retour</button>}
          {step===2&&<button className="od-ghost" type="button" onClick={()=>setShowPreview(true)}>Aperçu</button>}
          {step<3&&<button className="od-primary" type="button" disabled={!canProceed} onClick={()=>setStep(s=>s+1)}>{step===2?'Vérifier':'Continuer'} →</button>}
          {step===3&&<button className="od-primary" type="button" disabled={loading} onClick={publishTrip}>{loading?'Publication…':editTripId?'Mettre à jour':'Publier le récit'}</button>}
        </div>
      </header>

      <main className="od-body">
        {step===0&&<div className="od-content"><div className="od-form-shell">
          <p className="od-eyebrow">Étape 1 · Destination</p>
          <h1 className="od-h1">Racontez votre voyage.</h1>
          <p className="od-lead">Commencez par l'essentiel. Odyssey s'occupe de la structure ; vous vous occupez de l'histoire.</p>
          <section className="od-card">
            <h2 className="od-section-title">Où êtes-vous allé ?</h2>
            <p className="od-section-sub">Une destination suffit pour commencer.</p>
            <div className="od-grid">
              <label className="od-field"><span>Pays *</span><CustomSelect value={meta.country} onChange={v=>setMeta(m=>({...m,country:v}))} options={COUNTRIES.map(v=>({value:v,label:v}))} placeholder="Choisir un pays…" searchable/></label>
              <label className="od-field"><span>Ville / région</span><input value={meta.city} onChange={e=>setMeta(m=>({...m,city:e.target.value}))} placeholder="Paris, Kyoto, Toscane…"/></label>
            </div>
            <div style={{marginTop:22}}>
              <label className="od-field"><span>Quel type de voyage ?</span></label>
              <div className="od-pills">{CATEGORIES.map(c=><button key={c.value} type="button" className={`od-pill ${meta.category===c.value?'active':''}`} onClick={()=>setMeta(m=>({...m,category:c.value}))}>{c.label}</button>)}</div>
            </div>
            <button className="od-more" type="button" onClick={()=>setShowMoreDetails(v=>!v)}>{showMoreDetails?'− Masquer les détails':'＋ Ajouter la durée, le budget et la saison'}</button>
            {showMoreDetails&&<div className="od-detail-grid od-grid">
              <label className="od-field"><span>Durée</span><input type="number" value={meta.duration} onChange={e=>setMeta(m=>({...m,duration:e.target.value}))} placeholder="7"/></label>
              <label className="od-field"><span>Voyageurs</span><input type="number" min="1" value={meta.travelers} onChange={e=>setMeta(m=>({...m,travelers:e.target.value}))} placeholder="2"/></label>
              <label className="od-field"><span>Budget</span><CustomSelect value={meta.budget} onChange={v=>setMeta(m=>({...m,budget:v}))} options={BUDGETS.map(v=>({value:v,label:v}))} placeholder="Fourchette…"/></label>
              <label className="od-field"><span>Saison</span><CustomSelect value={meta.season} onChange={v=>setMeta(m=>({...m,season:v}))} options={SEASONS.map(v=>({value:v,label:v}))} placeholder="Quand ?"/></label>
            </div>}
          </section>
          <div className="od-next-row"><button className="od-primary" type="button" disabled={!canProceed} onClick={()=>setStep(1)}>Continuer →</button></div>
        </div></div>}

        {step===1&&<div className="od-content"><div className="od-form-shell">
          <p className="od-eyebrow">Étape 2 · Histoire</p>
          <h1 className="od-h1">Donnez-lui une voix.</h1>
          <p className="od-lead">Un titre, une phrase et une image forte. Vous pourrez raconter le reste dans l'étape suivante.</p>
          <section className="od-card"><div className="od-cover-layout">
            <div>
              <div className="od-cover-drop" onDragOver={e=>e.preventDefault()} onDrop={async e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f){const u=await uploadFile(f);if(u)setCoverUrl(u)}}}>
                {coverUrl?<><img src={coverUrl} alt="Couverture"/><div className="od-cover-overlay"/><div className="od-cover-copy"><h2>{title||'Votre titre'}</h2><p>{subtitle||destination||'Un voyage à raconter'}</p></div><button className="od-ghost" type="button" style={{position:'absolute',right:14,top:14,zIndex:3}} onClick={()=>setCoverUrl('')}>Changer</button></>:
                uploading?<div className="od-upload"><div className="od-upload-icon">↗</div><p>Envoi de votre photo…</p></div>:
                <div className="od-upload"><div className="od-upload-icon">＋</div><label>Ajouter une photo<input type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;const u=await uploadFile(f);if(u)setCoverUrl(u)}}/></label><p style={{fontSize:11,color:'#949b96',marginTop:10}}>Glissez-déposez ici · JPG, PNG ou WebP</p></div>}
              </div>
              {!coverUrl&&<div style={{marginTop:10}}>{field('Ou utiliser une URL',coverUrl,v=>setCoverUrl(optimizeImageUrl(v)),'https://images.unsplash.com/…')}</div>}
            </div>
            <div className="od-cover-side">
              {field('Titre *',title,setTitle,'Une semaine au Japon…')}
              {field("Phrase d'accroche",subtitle,setSubtitle,'Entre temples, ramen et néons…')}
              <div className="od-tip"><strong>✨ Faites simple</strong>Le titre raconte l'émotion ; les détails viendront ensuite.</div>
            </div>
          </div></section>
          <div className="od-next-row"><button className="od-primary" type="button" disabled={!canProceed} onClick={()=>setStep(2)}>Construire mon récit →</button></div>
        </div></div>}

        {step===2&&<div className="od-builder">
          <section className="od-builder-main" style={{position:'relative'}}>
            <div className="od-builder-toolbar">
              <div className="od-toolbar-left"><button className="od-primary" type="button" onClick={()=>setShowAddMenu(v=>!v)}>＋ Ajouter</button><div><div className="od-toolbar-title">{title||destination||'Votre récit'}</div><span className="od-toolbar-count">{blocks.length} élément{blocks.length!==1?'s':''}</span></div></div>
              <div className="od-toolbar-actions">
                <button type="button" onClick={applyMagicLayout}>✨ Organiser automatiquement</button>
                <button type="button" onClick={()=>setShowConfirmTemplate(true)}>🎨 Styles</button>
                <button type="button" onClick={()=>setShowPreview(true)}>📱 Aperçu</button>
              </div>
            </div>
            {showAddMenu&&<AddPalette onClose={()=>setShowAddMenu(false)} onAdd={addBlock} onOpenMedia={type=>{addBlock(type);setTimeout(()=>setMediaPurpose(type),0)}}/>}
            <div className="od-story">
              <div className="od-story-cover">
                <div className="eyebrow">{destination||'Odyssey'} · {currentCategory||'Récit de voyage'}</div>
                <h2>{title||'Votre voyage'}</h2><p>{subtitle||'Ajoutez vos souvenirs et racontez ce qui vous a marqué.'}</p>
                {coverUrl&&<img src={coverUrl} alt="Couverture"/>}
              </div>
              {storyBlocks.length===0?<div className="od-story-empty"><b>Votre carnet commence ici.</b><span>Ajoutez une photo, un texte ou un lieu avec le bouton «＋ Ajouter».</span></div>:
                storyBlocks.map((b,i)=><StoryBlockCard key={b.id} block={b} selected={selectedId===b.id} onSelect={()=>setSelectedId(b.id)} onUpdate={updateBlock} onDelete={()=>deleteBlock(b.id)} onUpload={uploadFile} onMoveUp={()=>moveBlock(b.id,-1)} onMoveDown={()=>moveBlock(b.id,1)}/>)
              }
              <div className="od-add-zone"><button type="button" onClick={()=>setShowAddMenu(true)}>＋ Ajouter à votre histoire</button><p>Photo · Galerie · Texte · Citation · Restaurant · Hébergement · Conseil</p></div>
            </div>
          </section>
          {selectedBlock&&<AdvancedInspector block={selectedBlock} onUpdate={updateBlock} onDelete={()=>deleteBlock(selectedBlock.id)}/>}
        </div>}

        {step===3&&<div className="od-content"><div className="od-publish-shell">
          <p className="od-eyebrow">Étape 4 · Publier</p>
          <h1 className="od-h1">Voyez ce que vos lecteurs vont voir.</h1>
          <p className="od-lead">Votre récit est prêt. Vous pouvez encore revenir modifier chaque élément avant de le partager.</p>
          <div className="od-publish-grid">
            <div className="od-preview"><div className="od-preview-cover">{coverUrl&&<img src={coverUrl} alt=""/>}<div/><div className="od-preview-title"><h2>{title||'Sans titre'}</h2><p>{subtitle||destination||'Un voyage à raconter'}</p></div></div>
              <div className="od-preview-meta">{[{l:'Destination',v:destination||'—'},{l:'Catégorie',v:currentCategory||'—'},{l:'Durée',v:meta.duration?`${meta.duration} jours`:'—'},{l:'Voyageurs',v:meta.travelers||'1'},{l:'Budget',v:meta.budget||'—'},{l:'Éléments',v:String(blocks.length)}].map(x=><div className="od-meta-item" key={x.l}><small>{x.l}</small><strong>{x.v}</strong></div>)}</div>
            </div>
            <div className="od-ready"><h3>Prêt à voyager ?</h3><p>{editTripId?'Vos modifications seront enregistrées dans le récit existant.':'Votre récit sera public et pourra être découvert par les visiteurs d’Odyssey.'}</p>
              <div className="od-ready-list"><div><i>✓</i> Titre et destination</div><div><i>✓</i> Couverture choisie</div><div><i>✓</i> {blocks.length} élément{blocks.length!==1?'s':''} dans le récit</div><div><i>✓</i> Mise en page automatique</div></div>
              <button className="od-full-button" type="button" disabled={loading} onClick={publishTrip}>{loading?'Publication en cours…':editTripId?'Mettre à jour mon récit':'Publier mon récit'}</button>
            </div>
          </div>
        </div></div>}
      </main>

      {showPreview&&<div className="od-preview-mode" onClick={()=>setShowPreview(false)}>
        <div className="od-phone" onClick={e=>e.stopPropagation()}>
          <div className="od-phone-bar"><span>APERÇU LECTEUR</span><button type="button" onClick={()=>setShowPreview(false)}>Fermer ×</button></div>
          <div className="od-phone-body">
            <div className="od-phone-cover">{coverUrl&&<img src={coverUrl} alt=""/>}<div className="od-phone-cover-copy"><small>{destination||'Odyssey'}</small><h2>{title||'Votre voyage'}</h2><p>{subtitle||'Un voyage à raconter.'}</p></div></div>
            {storyBlocks.map(b=><div className="od-phone-block" key={b.id} style={{background:b.bg||'#fff',color:b.textColor}}><BlockContent block={b} onChange={()=>{}} onUpload={uploadFile}/></div>)}
            {!storyBlocks.length&&<div style={{padding:30,textAlign:'center',color:'#8a918c',fontSize:12}}>Ajoutez du contenu pour voir l'aperçu.</div>}
          </div>
        </div>
      </div>}

      {mediaPurpose&&<MediaLibraryModal supabase={supabase} onSelect={selectMedia} onUpload={uploadFile} purpose={mediaPurpose} onClose={()=>setMediaPurpose(null)}/>}
      {showConfirmTemplate&&<TemplateModal onApply={applyTemplate} onClose={()=>setShowConfirmTemplate(false)}/>}
      {toast&&<div className="od-toast"><span>{toast.kind==='success'?'✓':'!'}</span><span>{toast.msg}</span><button type="button" onClick={()=>setToast(null)} style={{background:'transparent',border:0,color:'white',opacity:.65}}>×</button></div>}
      {confirmLeave&&<div className="od-modal" onClick={()=>setConfirmLeave(false)}><div className="od-modal-card" onClick={e=>e.stopPropagation()}><h3>Quitter ce récit ?</h3><p>Les modifications non publiées seront perdues. Vous pourrez revenir plus tard uniquement si vous avez déjà publié le récit.</p><div className="od-modal-actions"><button className="od-ghost" type="button" onClick={()=>setConfirmLeave(false)}>Continuer à créer</button><button className="od-primary" style={{background:'#b44b3f'}} type="button" onClick={()=>window.location.href='/'}>Quitter</button></div></div></div>}
      {published&&<div className="od-modal"><div className="od-modal-card"><p className="od-eyebrow">Odyssey</p><h3>{editTripId?'Récit mis à jour':'Récit publié'} ✦</h3><p>Votre histoire est enregistrée. {publishedId?'Vous pouvez revenir à l’accueil ou continuer à créer un autre récit.':''}</p><div className="od-modal-actions"><button className="od-ghost" type="button" onClick={()=>window.location.href='/'}>Accueil</button><button className="od-primary" type="button" onClick={()=>setPublished(false)}>Continuer</button></div></div></div>}
    </div>
  </>;
}
