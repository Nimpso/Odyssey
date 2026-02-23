// ─── lib/odyssey-constants.ts ─────────────────────────────────────────────────
// Avatars et bannières partagés entre profile et settings

export const AVATARS = [
  {
    id: 'f1', label: 'Fille — Brune',
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#fce4ec"/><circle cx="40" cy="31" r="15" fill="#f48fb1"/><path d="M12 72 Q40 50 68 72" fill="#f48fb1"/><path d="M25 22 Q28 10 40 10 Q52 10 55 22" fill="#4a2c2a"/><path d="M21 28 Q16 18 25 16" stroke="#4a2c2a" stroke-width="2.5" fill="none"/><path d="M59 28 Q64 18 55 16" stroke="#4a2c2a" stroke-width="2.5" fill="none"/></svg>`,
  },
  {
    id: 'f2', label: 'Fille — Rousse',
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#fff8e1"/><circle cx="40" cy="31" r="15" fill="#ffca28"/><path d="M12 72 Q40 50 68 72" fill="#ffca28"/><path d="M25 19 Q40 5 55 19 L58 28 Q40 22 22 28Z" fill="#bf360c"/></svg>`,
  },
  {
    id: 'f3', label: 'Fille — Cheveux verts',
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#e8f5e9"/><circle cx="40" cy="31" r="15" fill="#81c784"/><path d="M12 72 Q40 50 68 72" fill="#81c784"/><rect x="25" y="10" width="30" height="9" rx="5" fill="#1b5e20"/><path d="M23 16 Q20 26 25 28" stroke="#1b5e20" stroke-width="3" fill="none"/><path d="M57 16 Q60 26 55 28" stroke="#1b5e20" stroke-width="3" fill="none"/></svg>`,
  },
  {
    id: 'f4', label: 'Fille — Cheveux violets',
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#ede7f6"/><circle cx="40" cy="31" r="15" fill="#ba68c8"/><path d="M12 72 Q40 50 68 72" fill="#ba68c8"/><path d="M26 21 Q40 7 54 21 L56 27 L24 27Z" fill="#1a0533"/><path d="M19 29 Q14 19 25 19" stroke="#1a0533" stroke-width="2.5" fill="none"/><path d="M61 29 Q66 19 55 19" stroke="#1a0533" stroke-width="2.5" fill="none"/></svg>`,
  },
  {
    id: 'f5', label: 'Fille — Chapeau',
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#fce4ec"/><circle cx="40" cy="33" r="13" fill="#f48fb1"/><path d="M14 72 Q40 52 66 72" fill="#f48fb1"/><ellipse cx="40" cy="19" rx="20" ry="5" fill="#c9a84c"/><rect x="30" y="10" width="20" height="10" rx="3" fill="#b5922a"/></svg>`,
  },
  {
    id: 'm1', label: 'Garçon — Casquette',
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#e3f2fd"/><circle cx="40" cy="31" r="15" fill="#64b5f6"/><path d="M12 72 Q40 50 68 72" fill="#64b5f6"/><rect x="25" y="15" width="30" height="7" rx="2" fill="#1a237e"/><rect x="23" y="18" width="34" height="5" rx="0" fill="#1a237e"/><rect x="42" y="20" width="14" height="4" rx="1" fill="#1565c0"/></svg>`,
  },
  {
    id: 'm2', label: 'Garçon — Brun',
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#e0f7fa"/><circle cx="40" cy="31" r="15" fill="#4dd0e1"/><path d="M12 72 Q40 50 68 72" fill="#4dd0e1"/><path d="M26 23 Q27 12 40 12 Q53 12 54 23 L56 28 L24 28Z" fill="#3e2723"/></svg>`,
  },
  {
    id: 'm3', label: 'Garçon — Barbu',
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#fbe9e7"/><circle cx="40" cy="31" r="15" fill="#ff8a65"/><path d="M14 72 Q40 52 66 72" fill="#ff8a65"/><path d="M28 38 Q30 46 40 46 Q50 46 52 38 L54 44 Q50 54 40 54 Q30 54 26 44Z" fill="#4a2c2a"/><path d="M26 24 Q28 12 40 12 Q52 12 54 24" fill="none" stroke="#4a2c2a" stroke-width="5.5" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'm4', label: 'Garçon — Cheveux bouclés',
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#f1f8e9"/><circle cx="40" cy="31" r="15" fill="#aed581"/><path d="M12 72 Q40 50 68 72" fill="#aed581"/><circle cx="31" cy="19" r="6" fill="#33691e"/><circle cx="40" cy="15" r="6" fill="#33691e"/><circle cx="49" cy="19" r="6" fill="#33691e"/><circle cx="27" cy="25" r="5" fill="#33691e"/><circle cx="53" cy="25" r="5" fill="#33691e"/></svg>`,
  },
  {
    id: 'm5', label: 'Garçon — Lunettes',
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#e8eaf6"/><circle cx="40" cy="31" r="15" fill="#7986cb"/><path d="M12 72 Q40 50 68 72" fill="#7986cb"/><path d="M26 24 Q28 12 40 12 Q52 12 54 24" fill="#1a237e" stroke="none"/><rect x="27" y="30" width="10" height="7" rx="3" fill="none" stroke="white" stroke-width="1.5"/><rect x="43" y="30" width="10" height="7" rx="3" fill="none" stroke="white" stroke-width="1.5"/><line x1="37" y1="33" x2="43" y2="33" stroke="white" stroke-width="1.5"/></svg>`,
  },
];

export const COVERS = [
  { id: 'c1', label: 'Aurore boréale',   css: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 40%,#0f3460 70%,#533483 100%)' },
  { id: 'c2', label: 'Forêt tropicale',  css: 'linear-gradient(135deg,#1e3a2f 0%,#2d7a72 50%,#1a4a3a 100%)' },
  { id: 'c3', label: 'Désert doré',      css: 'linear-gradient(135deg,#c9a84c 0%,#b55435 40%,#8b2e2e 100%)' },
  { id: 'c4', label: 'Océan profond',    css: 'linear-gradient(135deg,#0f2027 0%,#203a43 40%,#2c5364 100%)' },
  { id: 'c5', label: 'Montagne mauve',   css: 'linear-gradient(135deg,#2d1b69 0%,#5e35b1 50%,#9575cd 100%)' },
  { id: 'c6', label: 'Coucher de soleil',css: 'linear-gradient(135deg,#0d0d0d 0%,#1a0a00 30%,#b55435 70%,#c9a84c 100%)' },
  { id: 'c7', label: 'Glacier',          css: 'linear-gradient(135deg,#b2dfdb 0%,#80cbc4 40%,#4db6ac 100%)' },
  { id: 'c8', label: 'Nuit étoilée',     css: 'linear-gradient(135deg,#0d0d0d 0%,#1a1a2e 60%,#0d0d0d 100%)' },
  { id: 'c9', label: 'Savane',           css: 'linear-gradient(135deg,#f9a825 0%,#e65100 50%,#4e342e 100%)' },
  { id: 'c10',label: 'Méditerranée',     css: 'linear-gradient(135deg,#0288d1 0%,#26c6da 40%,#f9f7f0 100%)' },
];