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
              {selected ? `② Hauteur du canvas — ${tpl?.label}` : '① Choisir un template'}
            </h2>
            <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#555' }}>
              {selected ? 'Titre unique en haut · sections répétées selon la hauteur choisie' : '8 templates adaptatifs · tout est modifiable après application'}
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
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', marginBottom: '0.75rem' }}>Taille rapide</p>
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
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', marginBottom: '0.5rem' }}>Ajustement précis</p>
                  <input type="range" min={1000} max={6000} step={100} value={canvasH}
                    onChange={e => { setCanvasH(Number(e.target.value)); setCustomH(''); }}
                    style={{ width: '100%', accentColor: tpl.accentColor, marginBottom: 4 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.58rem', color: '#444' }}>1 000 px</span>
                    <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', color: tpl.accentColor, fontWeight: 600 }}>{canvasH} px</span>
                    <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.58rem', color: '#444' }}>6 000 px</span>
                  </div>

                  {/* Valeur personnalisée */}
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', marginBottom: '0.5rem' }}>Valeur personnalisée (px)</p>
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
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', color: 'white' }}>1 titre unique ({tpl.titleH}px)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, background: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.78rem', color: 'white' }}>
                    <span style={{ color: tpl.accentColor, fontWeight: 700 }}>{sectionCount} section{sectionCount > 1 ? 's' : ''}</span> × {tpl.sectionH}px
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#666' }}>Hauteur finale : {finalH}px</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 2rem', borderTop: '1px solid #1e1e1e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.68rem', color: '#444' }}>
            {selected ? '⚠️ Appliquer remplace les blocs actuels' : `${SCALABLE_TEMPLATES.length} templates · taille au choix de 1 000 à 6 000 px`}
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

const SCALABLE_TEMPLATES: ScalableTemplate[] = [
  // ── 1. JOURNAL DE BORD ─────────────────────────────────────────────
  {
    id: 'journal',
    label: 'Journal de bord',
    icon: '📓',
    desc: 'Chaque section = un jour. Photo + récit côte à côte.',
    accentColor: '#c9a84c',
    bgColor: '#0d0d0d',
    titleH: 500,
    sectionH: 700,
    preview: null,
    generate: (canvasH) => {
      const blocks: any[] = [];
      const id = uid;
      // ── Titre (unique) ──
      blocks.push({ id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 1200, h: canvasH, font: 'sans', bg: '#0d0d0d', textColor: '#fff', fontSize: 1, zIndex: 1 });
      blocks.push({ id: id(), type: 'photo', data: { url: '', caption: '' }, x: 0, y: 0, w: 1200, h: 420, font: 'sans', bg: '#1a1a1a', textColor: '#fff', fontSize: 1, zIndex: 2 });
      blocks.push({ id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 1200, h: 420, font: 'sans', bg: 'linear-gradient(to top,#0d0d0d 0%,rgba(0,0,0,0.5) 60%,transparent 100%)', textColor: '#fff', fontSize: 1, zIndex: 3 });
      blocks.push({ id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-size:0.62rem;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#c9a84c">Journal de voyage</p>' }, x: 80, y: 260, w: 500, h: 36, font: 'sans', bg: 'transparent', textColor: '#c9a84c', fontSize: 0.62, zIndex: 5 });
      blocks.push({ id: id(), type: 'text', data: { html: '<div style="font-family:Fraunces,serif;font-weight:300;font-size:4.5rem;line-height:0.9;color:white">Mon<br/><em>Voyage</em></div>' }, x: 80, y: 300, w: 700, h: 200, font: 'serif', bg: 'transparent', textColor: '#fff', fontSize: 4.5, zIndex: 5 });
      // ── Sections répétables ──
      const sections = Math.max(1, Math.floor((canvasH - 500) / 700));
      for (let i = 0; i < sections; i++) {
        const y = 500 + i * 700;
        const isEven = i % 2 === 0;
        blocks.push({ id: id(), type: 'spacer', data: {}, x: 0, y, w: 1200, h: 700, font: 'sans', bg: isEven ? '#111' : '#0d0d0d', textColor: '#fff', fontSize: 1, zIndex: 2 });
        blocks.push({ id: id(), type: 'text', data: { html: `<div style="font-family:Bebas Neue,sans-serif;font-size:4rem;color:rgba(201,168,76,0.15);line-height:1">JOUR ${String(i+1).padStart(2,'0')}</div>` }, x: isEven ? 60 : 640, y: y + 30, w: 500, h: 80, font: 'display', bg: 'transparent', textColor: 'rgba(201,168,76,0.15)', fontSize: 4, zIndex: 3 });
        blocks.push({ id: id(), type: 'photo', data: { url: '', caption: '' }, x: isEven ? 0 : 600, y: y + 60, w: 560, h: 420, font: 'sans', bg: '#1a1a1a', textColor: '#fff', fontSize: 1, zIndex: 3 });
        blocks.push({ id: id(), type: 'text', data: { html: `<p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;margin-bottom:14px">Jour ${i+1}</p><div style="font-family:Fraunces,serif;font-weight:300;font-size:1.8rem;line-height:1.2;color:white;margin-bottom:18px">Titre de l'étape</div><p style="font-family:DM Sans,system-ui;font-size:0.9rem;line-height:1.8;color:rgba(255,255,255,0.6)">Racontez cette journée — les routes, les paysages, les rencontres inattendues et les émotions du moment.</p>` }, x: isEven ? 620 : 40, y: y + 80, w: 520, h: 380, font: 'serif', bg: 'transparent', textColor: '#fff', fontSize: 1, zIndex: 3 });
        blocks.push({ id: id(), type: 'divider', data: { style: 'line' }, x: isEven ? 620 : 40, y: y + 640, w: 400, h: 24, font: 'sans', bg: 'transparent', textColor: 'rgba(201,168,76,0.3)', fontSize: 1, zIndex: 3 });
      }
      return blocks;
    },
  },

  // ── 2. MAGAZINE NOIR ───────────────────────────────────────────────
  {
    id: 'noir',
    label: 'Magazine Noir',
    icon: '🖤',
    desc: 'Éditorial sombre, typo contrastée, galeries pleine largeur.',
    accentColor: '#ffffff',
    bgColor: '#111',
    titleH: 680,
    sectionH: 760,
    preview: null,
    generate: (canvasH) => {
      const blocks: any[] = [];
      const id = uid;
      // ── Titre (unique) ──
      blocks.push({ id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 1200, h: canvasH, font: 'sans', bg: '#111', textColor: '#fff', fontSize: 1, zIndex: 1 });
      blocks.push({ id: id(), type: 'text', data: { html: '<div style="font-family:Bebas Neue,sans-serif;font-size:12rem;line-height:0.82;color:rgba(255,255,255,0.04);letter-spacing:0.01em;user-select:none">OD</div>' }, x: -20, y: -20, w: 700, h: 380, font: 'display', bg: 'transparent', textColor: 'rgba(255,255,255,0.04)', fontSize: 12, zIndex: 2 });
      blocks.push({ id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.35)">VOL. 01 · ODYSSEY MAGAZINE</p>' }, x: 80, y: 60, w: 600, h: 32, font: 'sans', bg: 'transparent', textColor: 'rgba(255,255,255,0.35)', fontSize: 0.6, zIndex: 4 });
      blocks.push({ id: id(), type: 'text', data: { html: '<div style="font-family:Bebas Neue,sans-serif;font-size:8rem;line-height:0.88;color:white;text-transform:uppercase;letter-spacing:0.01em">MON<br/>GRAND<br/>VOYAGE</div>' }, x: 60, y: 110, w: 680, h: 420, font: 'display', bg: 'transparent', textColor: '#fff', fontSize: 8, zIndex: 4 });
      blocks.push({ id: id(), type: 'photo', data: { url: '', caption: '' }, x: 680, y: 0, w: 520, h: 680, font: 'sans', bg: '#222', textColor: '#fff', fontSize: 1, zIndex: 3 });
      blocks.push({ id: id(), type: 'divider', data: { style: 'line' }, x: 60, y: 560, w: 500, h: 24, font: 'sans', bg: 'transparent', textColor: 'rgba(255,255,255,0.15)', fontSize: 1, zIndex: 4 });
      blocks.push({ id: id(), type: 'text', data: { html: '<p style="font-family:Fraunces,serif;font-style:italic;font-weight:300;font-size:1.25rem;line-height:1.7;color:rgba(255,255,255,0.55)">Une ligne accroche qui résume l\'esprit du voyage — poétique, précise, inoubliable.</p>' }, x: 60, y: 600, w: 580, h: 80, font: 'serif', bg: 'transparent', textColor: 'rgba(255,255,255,0.55)', fontSize: 1.25, zIndex: 4 });
      // ── Sections répétables ──
      const sections = Math.max(1, Math.floor((canvasH - 680) / 760));
      for (let i = 0; i < sections; i++) {
        const y = 680 + i * 760;
        blocks.push({ id: id(), type: 'gallery', data: { images: [], layout: 'grid' }, x: 0, y, w: 1200, h: 320, font: 'sans', bg: '#0d0d0d', textColor: '#fff', fontSize: 1, zIndex: 2 });
        blocks.push({ id: id(), type: 'text', data: { html: `<div style="font-family:Bebas Neue,sans-serif;font-size:0.6rem;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:10px">Chapitre ${String(i+1).padStart(2,'0')}</div><div style="font-family:Fraunces,serif;font-weight:300;font-size:2.2rem;line-height:1.15;color:white;margin-bottom:18px">Titre du chapitre</div><p style="font-family:DM Sans,system-ui;font-size:0.88rem;line-height:1.85;color:rgba(255,255,255,0.5)">Développez ici une partie de votre récit. Chaque chapitre peut couvrir un lieu, une journée ou une émotion particulière.</p>` }, x: 80, y: y + 350, w: 500, h: 320, font: 'serif', bg: 'transparent', textColor: '#fff', fontSize: 1, zIndex: 3 });
        blocks.push({ id: id(), type: 'quote', data: { text: 'Une citation qui marque ce chapitre du voyage.', author: '' }, x: 620, y: y + 380, w: 520, h: 200, font: 'serif', bg: 'rgba(255,255,255,0.03)', textColor: 'rgba(255,255,255,0.7)', fontSize: 1.3, zIndex: 3 });
      }
      return blocks;
    },
  },

  // ── 3. CARTE POSTALE PANORAMA ──────────────────────────────────────
  {
    id: 'panorama',
    label: 'Panorama',
    icon: '🌅',
    desc: 'Grandes photos pleine largeur alternées avec texte centré.',
    accentColor: '#c9a84c',
    bgColor: '#faf8f4',
    titleH: 600,
    sectionH: 800,
    preview: null,
    generate: (canvasH) => {
      const blocks: any[] = [];
      const id = uid;
      // ── Titre (unique) ──
      blocks.push({ id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 1200, h: canvasH, font: 'sans', bg: '#faf8f4', textColor: '#0d0d0d', fontSize: 1, zIndex: 1 });
      blocks.push({ id: id(), type: 'photo', data: { url: '', caption: '' }, x: 0, y: 0, w: 1200, h: 480, font: 'sans', bg: '#ddd', textColor: '#fff', fontSize: 1, zIndex: 2 });
      blocks.push({ id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 1200, h: 480, font: 'sans', bg: 'linear-gradient(to top,#faf8f4 0%,rgba(250,248,244,0.3) 40%,transparent 100%)', textColor: '#0d0d0d', fontSize: 1, zIndex: 3 });
      blocks.push({ id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#c9a84c;text-align:center">Récit de voyage</p>' }, x: 300, y: 390, w: 600, h: 32, font: 'sans', bg: 'transparent', textColor: '#c9a84c', fontSize: 0.6, zIndex: 5 });
      blocks.push({ id: id(), type: 'text', data: { html: '<div style="font-family:Fraunces,serif;font-weight:300;font-size:3.8rem;line-height:1;color:#0d0d0d;text-align:center">Mon Voyage</div>' }, x: 200, y: 430, w: 800, h: 140, font: 'serif', bg: 'transparent', textColor: '#0d0d0d', fontSize: 3.8, zIndex: 5 });
      blocks.push({ id: id(), type: 'text', data: { html: '<p style="font-family:Fraunces,serif;font-style:italic;font-weight:300;font-size:1.15rem;color:#888;line-height:1.6;text-align:center">Un sous-titre poétique pour votre aventure…</p>' }, x: 250, y: 540, w: 700, h: 60, font: 'serif', bg: 'transparent', textColor: '#888', fontSize: 1.15, zIndex: 5 });
      // ── Sections répétables ──
      const sections = Math.max(1, Math.floor((canvasH - 600) / 800));
      for (let i = 0; i < sections; i++) {
        const y = 600 + i * 800;
        blocks.push({ id: id(), type: 'photo', data: { url: '', caption: '' }, x: 0, y, w: 1200, h: 480, font: 'sans', bg: '#ddd', textColor: '#fff', fontSize: 1, zIndex: 2 });
        blocks.push({ id: id(), type: 'text', data: { html: `<p style="font-family:DM Sans,system-ui;font-size:0.58rem;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c9a84c;text-align:center;margin-bottom:12px">Étape ${i+1}</p><div style="font-family:Fraunces,serif;font-weight:300;font-size:2.4rem;line-height:1.1;color:#0d0d0d;text-align:center;margin-bottom:20px">Titre du lieu</div><p style="font-family:DM Sans,system-ui;font-size:0.92rem;line-height:1.85;color:#555;max-width:600px;margin:0 auto;text-align:center">Décrivez ce lieu, son ambiance, ce qui vous a touché. Chaque étape raconte une partie de votre histoire.</p>` }, x: 100, y: y + 500, w: 1000, h: 280, font: 'serif', bg: 'transparent', textColor: '#0d0d0d', fontSize: 1, zIndex: 3 });
      }
      return blocks;
    },
  },

  // ── 4. CARNET NATURE ──────────────────────────────────────────────
  {
    id: 'nature',
    label: 'Carnet Nature',
    icon: '🌿',
    desc: 'Fond sombre forêt, galeries mosaïque, ambiance aventure.',
    accentColor: '#4caf7d',
    bgColor: '#0f1a14',
    titleH: 560,
    sectionH: 720,
    preview: null,
    generate: (canvasH) => {
      const blocks: any[] = [];
      const id = uid;
      // ── Titre (unique) ──
      blocks.push({ id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 1200, h: canvasH, font: 'sans', bg: '#0f1a14', textColor: '#fff', fontSize: 1, zIndex: 1 });
      blocks.push({ id: id(), type: 'photo', data: { url: '', caption: '' }, x: 0, y: 0, w: 1200, h: 480, font: 'sans', bg: '#162a1c', textColor: '#fff', fontSize: 1, zIndex: 2 });
      blocks.push({ id: id(), type: 'spacer', data: {}, x: 0, y: 0, w: 1200, h: 480, font: 'sans', bg: 'linear-gradient(to top,#0f1a14 0%,rgba(15,26,20,0.6) 50%,transparent 100%)', textColor: '#fff', fontSize: 1, zIndex: 3 });
      blocks.push({ id: id(), type: 'text', data: { html: '<p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#4caf7d">Exploration · Nature</p>' }, x: 80, y: 300, w: 500, h: 32, font: 'sans', bg: 'transparent', textColor: '#4caf7d', fontSize: 0.6, zIndex: 5 });
      blocks.push({ id: id(), type: 'text', data: { html: '<div style="font-family:Fraunces,serif;font-weight:300;font-size:4rem;line-height:0.92;color:white">Dans les<br/><em>profondeurs</em><br/>du monde</div>' }, x: 80, y: 340, w: 700, h: 220, font: 'serif', bg: 'transparent', textColor: '#fff', fontSize: 4, zIndex: 5 });
      blocks.push({ id: id(), type: 'divider', data: { style: 'dots' }, x: 80, y: 500, w: 200, h: 40, font: 'sans', bg: 'transparent', textColor: '#4caf7d', fontSize: 1, zIndex: 4 });
      // ── Sections répétables ──
      const sections = Math.max(1, Math.floor((canvasH - 560) / 720));
      for (let i = 0; i < sections; i++) {
        const y = 560 + i * 720;
        blocks.push({ id: id(), type: 'gallery', data: { images: [], layout: 'mosaic' }, x: 0, y, w: 1200, h: 360, font: 'sans', bg: '#0a1410', textColor: '#fff', fontSize: 1, zIndex: 2 });
        blocks.push({ id: id(), type: 'spacer', data: {}, x: 0, y: y + 360, w: 1200, h: 360, font: 'sans', bg: '#111d15', textColor: '#fff', fontSize: 1, zIndex: 2 });
        blocks.push({ id: id(), type: 'text', data: { html: `<div style="display:flex;align-items:center;gap:16px;margin-bottom:14px"><div style="width:32px;height:32px;background:#4caf7d;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui;font-weight:700;color:#0d0d0d;font-size:0.85rem;flex-shrink:0">${i+1}</div><p style="font-family:DM Sans,system-ui;font-size:0.6rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#4caf7d">Observation ${i+1}</p></div><div style="font-family:Fraunces,serif;font-weight:300;font-size:1.75rem;line-height:1.2;color:white;margin-bottom:16px">Titre de l'exploration</div><p style="font-family:DM Sans,system-ui;font-size:0.88rem;line-height:1.85;color:rgba(255,255,255,0.55)">Décrivez ce que vous avez observé, ressenti, découvert. La nature a ses propres règles — racontez comment elle vous a surpris.</p>` }, x: 80, y: y + 390, w: 540, h: 300, font: 'serif', bg: 'transparent', textColor: '#fff', fontSize: 1, zIndex: 3 });
        blocks.push({ id: id(), type: 'text', data: { html: '<div style="padding:20px 24px;height:100%;box-sizing:border-box"><p style="font-family:DM Sans,system-ui;font-size:0.58rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#4caf7d;margin-bottom:12px">🌡 Infos terrain</p><div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(76,175,125,0.15);padding-bottom:6px"><span style="font-family:DM Sans,system-ui;font-size:0.78rem;color:rgba(255,255,255,0.4)">Altitude</span><span style="font-family:DM Sans,system-ui;font-size:0.78rem;color:white;font-weight:600">— m</span></div><div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(76,175,125,0.15);padding-bottom:6px"><span style="font-family:DM Sans,system-ui;font-size:0.78rem;color:rgba(255,255,255,0.4)">Météo</span><span style="font-family:DM Sans,system-ui;font-size:0.78rem;color:white;font-weight:600">—</span></div><div style="display:flex;justify-content:space-between"><span style="font-family:DM Sans,system-ui;font-size:0.78rem;color:rgba(255,255,255,0.4)">Difficulté</span><span style="font-family:DM Sans,system-ui;font-size:0.78rem;color:#4caf7d;font-weight:600">Modérée</span></div></div></div>' }, x: 680, y: y + 390, w: 440, h: 270, font: 'sans', bg: 'rgba(76,175,125,0.06)', textColor: '#fff', fontSize: 1, zIndex: 3 });
      }
      return blocks;
    },
  },
];

// ─── Template Modal avec sélecteur de taille ──────────────────────────────────
const HEIGHT_OPTIONS = [1500, 2000, 2500, 3000, 3500, 4000, 5000];

function TemplateModal({ onApply, onClose }: {
  onApply: (blocks: any[], canvasH: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [canvasH, setCanvasH] = useState(2500);
  const [hovered, setHovered] = useState<string | null>(null);

  const tpl = SCALABLE_TEMPLATES.find(t => t.id === selected);

  // Nombre de sections calculé dynamiquement pour l'affichage
  const sectionCount = tpl
    ? Math.max(1, Math.floor((canvasH - tpl.titleH) / tpl.sectionH))
    : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'relative', width: '92vw', maxWidth: 960, background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: '1.4rem', fontWeight: 300, color: 'white', marginBottom: 3 }}>
              {selected ? '② Choisir la taille' : '① Choisir un template'}
            </h2>
            <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', color: '#555' }}>
              {selected ? 'Le titre est unique · les sections se répètent selon la hauteur' : 'Blocs pré-placés · tout est modifiable après application'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selected && (
              <button type="button" onClick={() => setSelected(null)}
                style={{ padding: '0.4rem 1rem', background: 'transparent', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', borderRadius: 3 }}>
                ← Retour
              </button>
            )}
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 22, padding: '4px 8px' }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── STEP 1 : grille des templates ── */}
          {!selected && (
            <div style={{ padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '1rem' }}>
              {SCALABLE_TEMPLATES.map(t => (
                <div key={t.id}
                  onMouseEnter={() => setHovered(t.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(t.id)}
                  style={{ cursor: 'pointer', border: `2px solid ${hovered === t.id ? t.accentColor : '#2a2a2a'}`, borderRadius: 4, overflow: 'hidden', transition: 'all 0.2s', transform: hovered === t.id ? 'translateY(-3px)' : 'none' }}>
                  {/* Miniature visuelle */}
                  <div style={{ height: 140, background: t.bgColor, position: 'relative', overflow: 'hidden' }}>
                    {/* Titre zone */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: `linear-gradient(to bottom,${t.bgColor},transparent)`, zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 14px', gap: 5 }}>
                      <div style={{ width: 40, height: 3, background: t.accentColor, borderRadius: 2 }} />
                      <div style={{ width: 110, height: 14, background: t.id === 'panorama' ? '#0d0d0d' : 'white', borderRadius: 2, opacity: 0.85 }} />
                      <div style={{ width: 75, height: 10, background: t.id === 'panorama' ? '#0d0d0d' : 'white', borderRadius: 2, opacity: 0.35 }} />
                    </div>
                    {/* Sections répétées (visualisation) */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', display: 'flex', flexDirection: 'column', gap: 3, padding: '4px 0' }}>
                      {[0,1].map(i => (
                        <div key={i} style={{ flex: 1, display: 'flex', gap: 3, padding: '0 10px', opacity: 0.75 }}>
                          {t.id === 'journal' && <>
                            <div style={{ flex: i%2===0?1:2, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }} />
                            <div style={{ flex: i%2===0?2:1, background: t.accentColor, opacity: 0.2, borderRadius: 1 }} />
                          </>}
                          {t.id === 'noir' && <>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
                          </>}
                          {t.id === 'panorama' && <div style={{ flex: 1, background: 'rgba(0,0,0,0.1)', borderRadius: 1 }} />}
                          {t.id === 'nature' && <>
                            <div style={{ flex: 2, background: 'rgba(76,175,125,0.2)', borderRadius: 1 }} />
                            <div style={{ flex: 1, background: 'rgba(76,175,125,0.08)', borderRadius: 1 }} />
                          </>}
                        </div>
                      ))}
                    </div>
                    {/* Hover */}
                    <div style={{ position: 'absolute', inset: 0, background: `${t.accentColor}22`, opacity: hovered === t.id ? 1 : 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                      <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 700, color: '#0d0d0d', background: t.accentColor, padding: '0.4rem 1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Choisir →</span>
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', background: '#161616' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 16 }}>{t.icon}</span>
                      <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.85rem', fontWeight: 600, color: '#e0e0e0' }}>{t.label}</span>
                    </div>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.7rem', color: '#555', lineHeight: 1.5 }}>{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 2 : sélecteur de taille ── */}
          {selected && tpl && (
            <div style={{ padding: '2rem' }}>
              {/* Template choisi — rappel */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '2rem', padding: '1rem', background: '#1a1a1a', borderRadius: 4, border: `1px solid ${tpl.accentColor}33` }}>
                <span style={{ fontSize: 24 }}>{tpl.icon}</span>
                <div>
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.88rem', fontWeight: 600, color: 'white', marginBottom: 2 }}>{tpl.label}</p>
                  <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#555' }}>{tpl.desc}</p>
                </div>
              </div>

              {/* Hauteur */}
              <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', marginBottom: '1rem' }}>Hauteur du canvas</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {HEIGHT_OPTIONS.map(h => (
                  <button key={h} type="button" onClick={() => setCanvasH(h)}
                    style={{ padding: '0.5rem 1.1rem', border: `1.5px solid`, borderRadius: 3, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.18s',
                      borderColor: canvasH === h ? tpl.accentColor : '#2a2a2a',
                      background: canvasH === h ? `${tpl.accentColor}18` : '#1a1a1a',
                      color: canvasH === h ? tpl.accentColor : '#666' }}>
                    {h >= 1000 ? `${h/1000}k` : h} px
                  </button>
                ))}
              </div>

              {/* Aperçu du contenu généré */}
              <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Schéma proportionnel */}
                  <div style={{ width: 60, flexShrink: 0 }}>
                    <div style={{ width: 60, background: '#111', border: `1px solid ${tpl.accentColor}44`, borderRadius: 2, overflow: 'hidden' }}>
                      {/* Titre */}
                      <div style={{ height: Math.round(tpl.titleH / canvasH * 200), background: `${tpl.accentColor}22`, borderBottom: `1px solid ${tpl.accentColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 8, color: tpl.accentColor, fontFamily: "'DM Sans',system-ui", letterSpacing: '0.1em' }}>TITRE</span>
                      </div>
                      {/* Sections */}
                      {Array.from({ length: sectionCount }).map((_, i) => (
                        <div key={i} style={{ height: Math.round(tpl.sectionH / canvasH * 200), background: i%2===0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Sans',system-ui" }}>§{i+1}</span>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.55rem', color: '#555', textAlign: 'center', marginTop: 4 }}>{canvasH}px</p>
                  </div>

                  {/* Détails texte */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, background: tpl.accentColor, borderRadius: 1, flexShrink: 0 }} />
                        <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', color: 'white' }}>
                          1 titre unique ({tpl.titleH}px)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, background: 'rgba(255,255,255,0.15)', borderRadius: 1, flexShrink: 0 }} />
                        <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.8rem', color: 'white' }}>
                          <span style={{ color: tpl.accentColor, fontWeight: 700 }}>{sectionCount} section{sectionCount > 1 ? 's' : ''}</span> répétée{sectionCount > 1 ? 's' : ''} ({tpl.sectionH}px chacune)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 1, flexShrink: 0 }} />
                        <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.72rem', color: '#666' }}>
                          Hauteur réelle : {tpl.titleH + sectionCount * tpl.sectionH}px
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slider fin */}
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', marginBottom: '0.6rem' }}>
                  Ajustement précis
                </p>
                <input type="range" min={1000} max={6000} step={100} value={canvasH}
                  onChange={e => setCanvasH(Number(e.target.value))}
                  style={{ width: '100%', accentColor: tpl.accentColor }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', color: '#444' }}>1 000 px</span>
                  <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', color: '#444' }}>6 000 px</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 2rem', borderTop: '1px solid #1e1e1e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.7rem', color: '#444' }}>
            {selected
              ? `⚠️ Appliquer remplace les blocs actuels du canvas`
              : '4 templates adaptatifs disponibles'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '0.45rem 1.25rem', background: 'transparent', border: '1px solid #2a2a2a', color: '#666', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', borderRadius: 3 }}>
              Annuler
            </button>
            {selected && tpl && (
              <button type="button"
                onClick={() => {
                  const finalH = tpl.titleH + Math.max(1, Math.floor((canvasH - tpl.titleH) / tpl.sectionH)) * tpl.sectionH;
                  onApply(tpl.generate(finalH), finalH);
                  onClose();
                }}
                style={{ padding: '0.45rem 1.5rem', background: tpl.accentColor, color: '#0d0d0d', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 3 }}>
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

function CanvasBlockEl({ block, selected, onSelect, onUpdate, onDelete, onUpload, canvasScale }: {
  block: CanvasBlock;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (b: CanvasBlock) => void;
  onDelete: () => void;
  onUpload: (f: File) => Promise<string | null>;
  canvasScale: number;
}) {
  const dragStart = useRef<{ mx: number; my: number; bx: number; by: number } | null>(null);
  const resizeStart = useRef<{ mx: number; my: number; bx: number; by: number; bw: number; bh: number; handle: Handle } | null>(null);

  const onMouseDownDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.resize) return;
    onSelect();
    dragStart.current = { mx: e.clientX, my: e.clientY, bx: block.x, by: block.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = (ev.clientX - dragStart.current.mx) / canvasScale;
      const dy = (ev.clientY - dragStart.current.my) / canvasScale;
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
      const dx = (ev.clientX - mx) / canvasScale;
      const dy = (ev.clientY - my) / canvasScale;
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
function Sidebar({ onAdd, onTemplate, onAddModule, activeTemplate, setActiveTemplate, canvasH, setCanvasH, collapsed, onToggle }: {
  onAdd: (type: BlockType, defaults: { w: number; h: number; data: any }) => void;
  onTemplate: () => void;
  onAddModule: (mod: Module) => void;
  activeTemplate: string | null;
  setActiveTemplate: (t: string | null) => void;
  canvasH: number; setCanvasH: (h: number) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState<string[]>(['texte','medias','voyage']);
  const [tab, setTab] = useState<'elements'|'modules'>('elements');
  const toggle = (id: string) => setOpen(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const activeMod = activeTemplate ? MODULAR_TEMPLATES[activeTemplate] : null;

  if (collapsed) {
    return (
      <div style={{ width: 48, flexShrink: 0, background: '#111', borderRight: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '0.75rem', gap: '0.5rem', height: '100%' }}>
        <button type="button" onClick={onToggle} title="Ouvrir la sidebar"
          style={{ width: 34, height: 34, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 4, cursor: 'pointer', color: '#c9a84c', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ▶
        </button>
        {['¶','🖼️','🏨','⚖️','❝'].map((ic, i) => (
          <div key={i} style={{ width: 34, height: 34, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'default', opacity: 0.4 }}>
            {ic}
          </div>
        ))}
      </div>
    );
  }

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
      {/* ── Collapse toggle ── */}
      <button type="button" onClick={onToggle} title="Réduire la sidebar"
        style={{ padding:'0.5rem', borderTop:'1px solid #1e1e1e', background:'transparent', border:'none', cursor:'pointer', color:'#444', fontSize:'0.7rem', fontFamily:"'DM Sans',system-ui", letterSpacing:'0.08em', display:'flex', alignItems:'center', justifyContent:'center', gap:6, flexShrink:0, transition:'color 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.color='#c9a84c')}
        onMouseLeave={e => (e.currentTarget.style.color='#444')}>
        ◀ Réduire
      </button>
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

  // Mode édition — trip existant chargé depuis ?edit=<id>
  const [editTripId, setEditTripId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

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
  const [canvasScale, setCanvasScale] = useState(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
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

  // ── Mode édition : charge le trip existant si ?edit=<id> dans l'URL ──
  useEffect(() => {
    if (!isMounted) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('edit');
    if (!id) return;

    setEditLoading(true);
    (async () => {
      // Vérifier que l'utilisateur connecté est bien l'auteur
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert('Connectez-vous pour modifier un récit.'); setEditLoading(false); return; }

      const { data: trip, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !trip) { alert('Récit introuvable.'); setEditLoading(false); return; }
      if (trip.author_id !== user.id) { alert('Vous ne pouvez modifier que vos propres récits.'); window.location.href = '/'; return; }

      // Pré-remplir tous les états
      setEditTripId(id);
      setTitle(trip.title || '');
      setSubtitle(trip.subtitle || '');
      setCoverUrl(trip.cover_image || '');
      setMeta({
        country:   trip.country   || '',
        city:      trip.city      || '',
        travelers: String(trip.travelers || 1),
        duration:  String(trip.duration_days || ''),
        budget:    trip.budget    || '',
        category:  trip.category  || '',
        season:    trip.season    || '',
      });
      if (trip.content && Array.isArray(trip.content)) {
        setBlocks(trip.content as CanvasBlock[]);
      }
      if (trip.canvas_height) setCanvasH(trip.canvas_height);

      // Sauter directement à l'étape canvas (step 2)
      setStep(2);
      setEditLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  // ── Dynamic canvas scaling — adapte le canvas à la largeur disponible ──
  useEffect(() => {
    if (step !== 2) return;
    const SIDEBAR_W = sidebarCollapsed ? 48 : 240;
    const RIGHT_W = rightPanelCollapsed ? 32 : 220;
    const PADDING = 64; // 2rem de chaque côté
    const CANVAS_NOMINAL = CANVAS_W; // 1200px

    const compute = () => {
      const available = window.innerWidth - SIDEBAR_W - RIGHT_W - PADDING;
      const scale = Math.min(1, Math.max(0.35, available / CANVAS_NOMINAL));
      setCanvasScale(scale);
    };

    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [step, sidebarCollapsed, rightPanelCollapsed]);

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

    const tripPayload = {
      title, subtitle,
      cover_image: coverUrl || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200',
      country: meta.country, city: meta.city, duration_days: Number(meta.duration) || null,
      travelers: Number(meta.travelers) || 1, budget: meta.budget, category: meta.category, season: meta.season,
      is_published: true, published_at: new Date().toISOString(),
      content: blocks.map(b => ({ ...b })),
      canvas: true,
      canvas_height: canvasH,
      total_size_mb: 0,
    };

    let error: any = null;
    let redirectSlug: string | null = null;

    if (editTripId) {
      // ── Mode édition : UPDATE en vérifiant que l'auteur est bien le user connecté ──
      const { data: updated, error: updateErr } = await supabase
        .from('trips')
        .update(tripPayload)
        .eq('id', editTripId)
        .eq('author_id', user.id) // sécurité côté client (RLS Supabase doit aussi protéger)
        .select('slug')
        .single();
      error = updateErr;
      redirectSlug = updated?.slug ?? null;
    } else {
      // ── Mode création : INSERT ──
      const slug = title.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: inserted, error: insertErr } = await supabase
        .from('trips')
        .insert({ ...tripPayload, slug: `${slug}-${uid()}`, author_id: user.id })
        .select('slug')
        .single();
      error = insertErr;
      redirectSlug = inserted?.slug ?? null;
    }

    if (error) { alert('Erreur : ' + error.message); }
    else {
      setPublished(true);
      // Redirige vers le profil de l'utilisateur après publication/mise à jour
      const { data: prof } = await supabase.from('profiles').select('username').eq('id', user.id).single();
      const dest = prof?.username ? `/profile/${prof.username}` : (redirectSlug ? `/trip/${redirectSlug}` : '/');
      setTimeout(() => { window.location.href = dest; }, 2000);
    }
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

  // ── Chargement du trip en mode édition ──
  if (editLoading) return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin{to{transform:rotate(360deg)}}` }} />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d0d0d', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #222', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.88rem', color: '#555' }}>Chargement du récit…</p>
      </div>
    </>
  );

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
              {editTripId && <span style={{ color: 'rgba(201,168,76,0.7)', marginRight: 6 }}>✏️</span>}
              {title || (editTripId ? 'Modifier le récit' : 'Nouveau récit')}
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
                {loading ? <><div style={{width:14,height:14,border:'2px solid rgba(0,0,0,0.3)',borderTopColor:'#0d0d0d',borderRadius:'50%'}} className="spin"/>En cours…</> : published ? '✓ Publié !' : editTripId ? '💾 Mettre à jour' : '🚀 Publier'}
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
              <Sidebar
                onAdd={addBlock}
                onTemplate={() => setShowTemplates(true)}
                onAddModule={addModule}
                activeTemplate={activeTemplate}
                setActiveTemplate={setActiveTemplate}
                canvasH={canvasH}
                setCanvasH={setCanvasH}
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(v => !v)}
              />

              {/* Canvas area — avec dynamic scaling */}
              <div
                ref={canvasAreaRef}
                style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#1a1a1a', position: 'relative' }}
                onMouseDown={e => { if (e.target === e.currentTarget) setSelectedId(null); }}
              >
                {/* Scale indicator */}
                {canvasScale < 0.99 && (
                  <div style={{
                    position: 'sticky', top: 0, zIndex: 50, left: 0, right: 0,
                    background: 'rgba(201,168,76,0.12)', borderBottom: '1px solid rgba(201,168,76,0.2)',
                    padding: '4px 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.65rem', color: '#c9a84c', letterSpacing: '0.1em' }}>
                      🔍 Zoom automatique : {Math.round(canvasScale * 100)}%
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!sidebarCollapsed && (
                        <button type="button" onClick={() => setSidebarCollapsed(true)}
                          style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', color: '#c9a84c', background: 'transparent', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 2, padding: '2px 8px', cursor: 'pointer' }}>
                          ◀ Réduire sidebar
                        </button>
                      )}
                      {!rightPanelCollapsed && (
                        <button type="button" onClick={() => setRightPanelCollapsed(true)}
                          style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.6rem', color: '#c9a84c', background: 'transparent', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 2, padding: '2px 8px', cursor: 'pointer' }}>
                          Réduire panel ▶
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Scaled canvas wrapper */}
                <div style={{
                  padding: '2rem',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  // Reserve the correct height so scrollbar works
                  minHeight: canvasH * canvasScale + 64,
                }}>
                  <div style={{
                    transformOrigin: 'top left',
                    transform: `scale(${canvasScale})`,
                    // After scale, the element occupies less visual space but its layout box stays original size.
                    // We use negative margin-right to collapse the extra width, keeping the container tight.
                    marginRight: -(CANVAS_W * (1 - canvasScale)),
                    position: 'relative',
                  }}>
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
                          canvasScale={canvasScale}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right properties panel — collapsible */}
              {rightPanelCollapsed ? (
                <div style={{ width: 32, flexShrink: 0, background: '#111', borderLeft: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '0.75rem' }}>
                  <button type="button" onClick={() => setRightPanelCollapsed(false)} title="Ouvrir le panneau"
                    style={{ width: 24, height: 24, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 3, cursor: 'pointer', color: '#c9a84c', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ◀
                  </button>
                </div>
              ) : (
                <div style={{ width: 220, flexShrink: 0, background: '#111', borderLeft: '1px solid #1e1e1e', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {/* Panel header with collapse button */}
                  <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555' }}>
                      Propriétés
                    </p>
                    <button type="button" onClick={() => setRightPanelCollapsed(true)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#444', fontSize: '0.7rem', padding: '2px 4px', borderRadius: 2, transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color='#c9a84c')}
                      onMouseLeave={e => (e.currentTarget.style.color='#444')}>
                      ▶
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {selectedBlock ? (
                      <>
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
                </div>
              )}
            </>
          )}

          {/* ════ STEP 3 — Recap ════ */}
          {step === 3 && (
            <div className="recap-container" style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '3rem 1.5rem' }}>
              <div style={{ width: '100%', maxWidth: 640 }}>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: '2rem', fontWeight: 300, color: 'white', marginBottom: '0.5rem' }}>
                  {editTripId ? 'Mettre à jour le récit ?' : 'Prêt à publier ?'}
                </h2>
                <p style={{ color: '#555', fontSize: '0.88rem', marginBottom: '2.5rem', fontFamily: "'DM Sans',system-ui" }}>
                  {editTripId ? 'Vérifiez vos modifications avant de sauvegarder.' : 'Vérifiez avant de partager votre récit.'}
                </p>
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
                    <p style={{ fontFamily: "'DM Sans',system-ui", fontSize: '0.92rem', color: '#2d7a72', fontWeight: 600 }}>
                      {editTripId ? 'Mis à jour avec succès ! Redirection…' : 'Publié avec succès ! Redirection…'}
                    </p>
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