// La minute cyber, ép. 6 « Le message du Capitaine » : fonction pure du temps (window.seek(t)).
// Rendu « 3D » : chaque élément est un plan placé dans l'espace (x, y, z), vu par une caméra en perspective qui
// se déplace (travellings, orbites, traversées), avec profondeur de champ, brume, poussières, traînées de lumière,
// HUD et flares, dans l'esprit des références. Tout est calé sur la voix off de Mara (PHRASES, en secondes).
import * as M from './lib/motion.js';

const { W, H, E, prog, lerp, clamp, font, kf, hash01, noise1 } = M;
const D = 'Display', UI = 'UI';
const C = { noir: '#04060A', encre: '#0A0A0A', papier: '#F3F1EC', orange: '#E94A06', ambre: '#FF8A3D', bleu: '#2563EB', ciel: '#6E9BFF', gris: '#8A93A6', vert: '#22C55E', carte: '#141B2B' };
const B = (s) => s / 0.625;

const PHRASES = [
  [0.30, 1.56, 'Mesdames, messieurs,'],
  [1.88, 4.58, 'le camarade Capitaine Ibrahim Traoré m’a écrit ce matin…'],
  [4.91, 7.38, 'Enfin, c’est ce qu’a cru *Adama.*'],
  [7.63, 8.56, 'Le « président »'],
  [9.03, 10.05, 'lui promet *deux millions,*'],
  [10.35, 11.66, 'et l’envoie chez son secrétaire.'],
  [12.11, 14.50, 'Le secrétaire réclame *15 000 F* de frais de dossier.'],
  [14.86, 16.86, 'Adama pense déjà à tout ce qu’il va réaliser.'],
  [17.25, 17.85, 'Quinze mille,'],
  [18.08, 19.23, 'à côté de deux millions ?'],
  [19.58, 19.99, '*Rien.*'],
  [20.46, 21.24, 'Il paie.'],
  [21.70, 24.47, 'Le secrétaire explique que c’est le comptable qui gère les paiements.'],
  [25.06, 27.75, 'Celui-ci réclame *25 000 F* de frais de transaction.'],
  [28.07, 29.02, 'Adama hésite…'],
  [29.65, 30.41, 'mais reculer,'],
  [30.64, 31.67, 'ce serait *tout perdre.*'],
  [32.28, 33.29, 'Il paie *encore.*'],
  [33.80, 36.16, 'Puis plus personne ne répond.'],
  [37.06, 38.76, 'C’était une usurpation d’identité.'],
  [39.42, 40.96, 'Président, secrétaire,'],
  [41.18, 41.81, 'comptable :'],
  [42.17, 43.70, 'ces trois personnes n’en font *qu’une.*'],
  [44.07, 45.49, 'Un seul *cybercriminel,*'],
  [45.79, 47.83, 'qui promet *gros* pour faire payer *petit.*'],
  [48.30, 50.80, 'Aucune autorité ne réclame de frais par message.'],
  [51.07, 51.65, 'Vérifiez.'],
  [52.12, 52.68, 'Signalez.'],
  [53.28, 53.81, 'Partagez :'],
  [54.12, 55.60, 'vous protégerez vos proches.'],
];

const HITS = [
  [B(0.20), 'notification', 'blip', { pitch: 'E6' }],
  [B(0.32), 'notification 2', 'blip', { pitch: 'B6' }],
  [B(1.9), 'frappe', 'type', { n: 14, len: 2.4 }],
  [B(4.75), 'traversée', 'whoosh', { len: 0.5, from: 3000, to: 300 }],
  [B(4.91), 'coupe', 'thud'],
  [B(6.6), 'Adama', 'sub', { len: 0.6 }],
  [B(7.55), 'carte président', 'whoosh', { len: 0.45, from: 400, to: 2200 }],
  [B(7.9), 'bulle', 'pop', { pitch: 'A5' }],
  [B(9.03), 'compteur', 'type', { n: 10, len: 0.9 }],
  [B(10.0), 'deux millions', 'coins'],
  [B(10.35), 'flèche', 'whoosh', { len: 0.4, from: 500, to: 2500 }],
  [B(11.75), 'travelling', 'whoosh', { len: 0.6, from: 300, to: 1500, pan: 0.5 }],
  [B(12.2), 'bulle secrétaire', 'pop', { pitch: 'E5' }],
  [B(14.8), 'rêve', 'swell'],
  [B(17.25), 'quinze mille', 'tick'],
  [B(18.08), 'deux millions', 'thud'],
  [B(19.58), 'rien', 'boing', { pitch: 'E5', to: 'E4' }],
  [B(20.5), 'il paie', 'bell', { pitch: 'G6' }],
  [B(21.75), 'travelling 2', 'whoosh', { len: 0.6, from: 300, to: 1500, pan: 0.5 }],
  [B(25.0), 'bulle comptable', 'pop', { pitch: 'C5' }],
  [B(30.64), 'tout perdre', 'sub', { len: 0.8 }],
  [B(32.3), 'il paie encore', 'bell', { pitch: 'D6' }],
  [B(32.5), 'pièces', 'coins'],
  [B(33.8), 'recul', 'whoosh', { len: 0.8, from: 1500, to: 200 }],
  [B(35.0), 'gris', 'tick'],
  [B(35.6), 'montée', 'riser', { len: 1.4 }],
  [B(37.0), 'révélation', 'impact'],
  [B(39.35), 'mur', 'whoosh', { len: 0.5, from: 300, to: 1800 }],
  [B(39.6), 'carte 1', 'click'],
  [B(40.3), 'carte 2', 'click'],
  [B(41.2), 'carte 3', 'click'],
  [B(42.3), 'fusion', 'whoosh', { len: 0.6, from: 2000, to: 200 }],
  [B(44.07), 'cybercriminel', 'impact'],
  [B(45.9), 'gros', 'thud'],
  [B(47.3), 'petit', 'tick'],
  [B(48.2), 'page blanche', 'whoosh', { len: 0.45, from: 400, to: 3000 }],
  [B(51.07), 'réflexe 1', 'click'],
  [B(52.12), 'réflexe 2', 'click'],
  [B(53.28), 'réflexe 3', 'click'],
  [B(56.25), 'vers la fin', 'whoosh', { len: 0.4, from: 600, to: 3000 }],
];

// ================================================================== moteur 3D (plans en perspective)
const FOC = 1150;
let CAM = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, focus: FOC };
function proj(x, y, z) {
  const dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z;
  const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
  const x1 = dx * cy - dz * sy, z1 = dx * sy + dz * cy;
  const cp = Math.cos(CAM.pitch), sp_ = Math.sin(CAM.pitch);
  const y1 = dy * cp - z1 * sp_, z2 = dy * sp_ + z1 * cp;
  const cr = Math.cos(CAM.roll), sr = Math.sin(CAM.roll);
  const x2 = x1 * cr - y1 * sr, y2 = x1 * sr + y1 * cr;
  if (z2 < 40) return null;
  const s = FOC / z2;
  return { x: W / 2 + x2 * s, y: H / 2 + y2 * s, s, z: z2 };
}
function rot(lx, ly, rx, ry, rz) {
  let x = lx, y = ly, z = 0;
  const cz = Math.cos(rz), sz = Math.sin(rz); [x, y] = [x * cz - y * sz, x * sz + y * cz];
  const cx = Math.cos(rx), sx = Math.sin(rx); [y, z] = [y * cx - z * sx, y * sx + z * cx];
  const cy = Math.cos(ry), sy = Math.sin(ry); [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  return [x, y, z];
}
// Dessine un plan w×h centré en (x,y,z), tourné (rx, ry, rz) ; draw(ctx, w, h) en coordonnées locales.
function plane(ctx, o, draw) {
  const { x, y, z, w, h, rx = 0, ry = 0, rz = 0, alpha = 1, dof = 1, fog = true } = o;
  const c = [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2]].map(([a, b]) => { const r = rot(a, b, rx, ry, rz); return proj(x + r[0], y + r[1], z + r[2]); });
  if (c.some((p) => !p)) return;
  const pc = proj(x, y, z); if (!pc) return;
  let a = alpha;
  if (fog) a *= clamp((pc.z - 90) / 260) * clamp((7000 - pc.z) / 3000);
  if (a <= 0.003) return;
  const bl = dof * Math.min(16, Math.abs(pc.z - CAM.focus) / 170);
  ctx.save();
  ctx.setTransform((c[1].x - c[0].x) / w, (c[1].y - c[0].y) / w, (c[2].x - c[0].x) / h, (c[2].y - c[0].y) / h, c[0].x, c[0].y);
  ctx.globalAlpha = a;
  if (bl > 1.2) ctx.filter = `blur(${bl.toFixed(1)}px)`;
  draw(ctx, w, h);
  ctx.restore();
}
// Texte posé dans l'espace (n = nombre de caractères visibles, pour l'effet « tapé »).
function text3(ctx, str, o) {
  const { size = 80, weight = 800, color = '#fff', glow = 0, align = 'left', n = null, cursor = false, fam = D } = o;
  ctx.save(); ctx.font = font(size, weight, fam); const tw = ctx.measureText(str).width; ctx.restore();
  const w = Math.max(10, tw), h = size * 1.3;
  const ox = align === 'center' ? 0 : align === 'right' ? -w / 2 : w / 2;
  plane(ctx, { ...o, x: o.x + ox, w, h }, (c) => {
    c.font = font(size, weight, fam); c.textBaseline = 'middle'; c.fillStyle = color;
    if (glow) { c.shadowColor = typeof glow === 'string' ? glow : color; c.shadowBlur = size * 0.35; }
    const s = n == null ? str : str.slice(0, Math.max(0, Math.floor(n)));
    c.fillText(s, 0, h / 2);
    if (cursor) { const cw = c.measureText(s).width; c.shadowBlur = 0; c.fillStyle = C.ambre; c.fillRect(cw + size * 0.08, h * 0.18, size * 0.07, h * 0.64); }
  });
}
// Poussières lumineuses dans l'espace, autour de la caméra
function dust(ctx, seed = 1, n = 160, color = '200,220,255') {
  const cell = 6000;
  for (let i = 0; i < n; i++) {
    const px = (hash01(i, seed) - 0.5) * 3200 + CAM.x;
    const py = (hash01(i, seed + 1) - 0.5) * 4200 + CAM.y;
    const base = hash01(i, seed + 2) * cell;
    const pz = CAM.z + 60 + ((((base - CAM.z) % cell) + cell) % cell);
    const p = proj(px, py, pz);
    if (!p) continue;
    const a = clamp((p.z - 80) / 400) * clamp((5000 - p.z) / 2500) * (0.25 + 0.6 * hash01(i, seed + 3));
    const r = Math.max(0.6, 5 * p.s * (0.4 + hash01(i, seed + 4)));
    ctx.fillStyle = `rgba(${color},${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }
}
function setCam(t, keys, focusKeys = null) {
  const [x, y, z, yaw, pitch, roll] = kf(t, keys, E.inOutCubic);
  CAM = { x, y, z, yaw, pitch, roll, focus: focusKeys ? kf(t, focusKeys) : FOC };
  CAM.x += noise1(t * 0.7, 3) * 14; CAM.y += noise1(t * 0.6, 8) * 10; CAM.roll += noise1(t * 0.5, 5) * 0.004;
}
const deg = (d) => (d * Math.PI) / 180;

// ================================================================== éléments
const sp = (t, t0, k = 'snappy') => M.spring(Math.max(0, t - t0), M.SPRING[k]);
const ease = (t, a, b, f = E.outCubic) => f(prog(t, a, b));
const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');

function bg(ctx, top = '#071018', bot = '#020305') {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function haze(ctx, x, y, r, rgb, a) {
  if (r <= 1) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function vignette(ctx, k = 0.75) {
  const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.2, W / 2, H * 0.5, H * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${k})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// Traînée de lumière orange : courbe qui se dessine, tête brillante
function trail(ctx, t, t0, dur, seed = 1, rgb = '233,74,6') {
  const p = prog(t, t0, t0 + dur * 1.3); if (p <= 0 || p >= 1) return;
  const N = 70, pts = [];
  for (let i = 0; i <= N; i++) { const s = i / N; pts.push([W * (1.1 - 1.25 * s) + 160 * Math.sin(s * 5 + seed), H * (0.15 + 0.85 * s) + 120 * Math.sin(s * 7 + seed * 2)]); }
  const q = p * 1.3;
  const head = Math.min(N, Math.floor(N * E.outCubic(clamp(q))));
  const tail = Math.max(0, Math.floor(N * E.inCubic(clamp(q - 0.3))));
  if (head - tail < 2) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [lw, a] of [[46, 0.06], [18, 0.18], [6, 0.9]]) {
    ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = lw; ctx.beginPath();
    for (let i = tail; i <= head; i++) { if (i === tail) ctx.moveTo(...pts[i]); else ctx.lineTo(...pts[i]); }
    ctx.stroke();
  }
  const [hx, hy] = pts[head]; haze(ctx, hx, hy, 140, '255,170,90', 0.55);
  ctx.restore();
}
function flare(ctx, x, y, a, rgb = '255,150,70') {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y, W, y);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(clamp(x / W, 0.01, 0.99), `rgba(${rgb},${0.8 * a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, y - 3, W, 6);
  ctx.globalAlpha = 0.5; ctx.fillRect(0, y - 14, W, 28);
  ctx.globalAlpha = 1; haze(ctx, x, y, 220, rgb, 0.6 * a); haze(ctx, x, y, 60, '255,240,220', a);
  ctx.restore();
}
function hud(ctx, t, a = 1, ink = '255,255,255') {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = `rgba(${ink},0.35)`; ctx.fillStyle = `rgba(${ink},0.55)`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(44, 300); ctx.lineTo(44, 380); ctx.moveTo(44, 1500); ctx.lineTo(44, 1580); ctx.stroke();
  for (let i = 0; i < 14; i++) ctx.fillRect(W - 52, 560 + i * 9, i % 5 === 0 ? 16 : 9, 2);
  ctx.font = font(20, 600, UI);
  ctx.save(); ctx.translate(W - 40, 1120); ctx.rotate(Math.PI / 2); ctx.fillText(`12.3714 N / 1.5197 W  ·  ${String(Math.floor(t * 24)).padStart(5, '0')}`, 0, 0); ctx.restore();
  ctx.restore();
}

// Sous-titres : les mots arrivent du fond (profondeur), au rythme de la voix
function words(str) {
  let acc = false;
  return str.split(' ').map((raw) => {
    let t = raw, a = acc;
    if (t.startsWith('*')) { a = true; acc = true; t = t.slice(1); }
    if (t.includes('*')) { t = t.replace('*', ''); acc = false; a = true; }
    return { t, a };
  });
}
function caption(ctx, t, p, { y = 1330, size = 74, color = '#fff', accent = C.ambre, align = 'center', maxW = 920, weight = 800, out = null, glow = true } = {}) {
  const [a, b, str] = p;
  const nx = PHRASES[PHRASES.indexOf(p) + 1];
  let end = out ?? b + 0.35;
  if (nx && out == null) end = Math.min(end, nx[0] - 0.12);
  if (t < a - 0.1 || t > end + 0.12) return;
  const ws = words(str);
  ctx.save(); ctx.font = font(size, weight, D);
  const space = ctx.measureText(' ').width;
  const lines = [[]]; let lw = 0;
  for (const w of ws) { w.w = ctx.measureText(w.t).width; if (lines.at(-1).length && lw + space + w.w > maxW) { lines.push([]); lw = 0; } lines.at(-1).push(w); lw += (lines.at(-1).length > 1 ? space : 0) + w.w; }
  const total = str.replace(/\*/g, '').length; let seen = 0;
  const lh = size * 1.14, y0 = y - (lines.length - 1) * lh / 2;
  const fo = 1 - ease(t, end, end + 0.12, E.inCubic);
  lines.forEach((line, li) => {
    const lwid = line.reduce((s, w) => s + w.w, 0) + space * (line.length - 1);
    let x = align === 'center' ? (W - lwid) / 2 : 80;
    for (const w of line) {
      const tw = a + (b - a) * 0.9 * (seen / total) - 0.08; seen += w.t.length + 1;
      const k = clamp(E.outCubic(prog(t, tw, tw + 0.32)));
      if (k > 0) {
        const z = 1 + 0.55 * (1 - k);
        ctx.save(); ctx.globalAlpha = k * fo;
        ctx.translate(x + w.w / 2, y0 + li * lh); ctx.scale(z, z);
        if (k < 0.95) ctx.filter = `blur(${((1 - k) * 10).toFixed(1)}px)`;
        if (glow) { ctx.shadowColor = w.a ? 'rgba(233,74,6,0.8)' : 'rgba(150,190,255,0.35)'; ctx.shadowBlur = size * 0.3; }
        ctx.fillStyle = w.a ? accent : color; ctx.fillText(w.t, -w.w / 2, 0);
        ctx.restore();
      }
      x += w.w + space;
    }
  });
  ctx.restore();
}

function avatarDraw(c, img, x, y, r, letter, color) {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  if (img) { const s = Math.max((r * 2) / (img.width * 0.42), (r * 2) / (img.height * 0.29)); const iw = img.width * s, ih = img.height * s; c.drawImage(img, x - iw / 2, y - r - ih * 0.03, iw, ih); }
  else { c.fillStyle = color; c.fillRect(x - r, y - r, r * 2, r * 2); c.fillStyle = '#fff'; c.font = font(r, 800, D); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(letter, x, y + 2); }
  c.restore();
}
function chatCard(ctx, t, o) {
  const { x, y, z, ry = 0, rx = 0, name, sub, img, letter, color = '#334155', label, money, moneyT, from = 0, grey = 0, t0 = -9, alpha = 1, statut } = o;
  const k = sp(t, t0, 'gentle');
  if (k <= 0) return;
  plane(ctx, { x, y: y + (1 - k) * 300, z, w: 900, h: 640, ry, rx, alpha: alpha * clamp(k * 1.3) }, (c, w, h) => {
    c.fillStyle = 'rgba(20,27,43,0.92)'; c.beginPath(); c.roundRect(0, 0, w, h, 48); c.fill();
    c.strokeStyle = grey ? 'rgba(255,255,255,0.08)' : 'rgba(110,155,255,0.35)'; c.lineWidth = 3; c.stroke();
    if (grey) c.filter = `grayscale(${grey.toFixed(2)})`;
    avatarDraw(c, img, 110, 110, 62, letter, color);
    c.filter = 'none';
    c.fillStyle = '#fff'; c.font = font(44, 800, D); c.textBaseline = 'alphabetic'; c.fillText(name, 200, 104);
    c.fillStyle = grey > 0.5 ? C.orange : C.gris; c.font = font(28, 600, UI); c.fillText(grey > 0.5 ? 'Vous ne pouvez plus répondre' : sub, 200, 146);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(40, 205, w - 80, 2);
    c.fillStyle = '#C9D2E6'; c.font = font(36, 600, UI); c.fillText(label, 50, 290);
    if (money) {
      const v = moneyT ? lerp(from, money, E.outCubic(prog(t, moneyT[0], moneyT[1]))) : money;
      c.save(); c.fillStyle = grey > 0.5 ? '#5B6476' : C.ambre; c.shadowColor = 'rgba(233,74,6,0.7)'; c.shadowBlur = grey > 0.5 ? 0 : 40;
      c.font = font(124, 800, D); c.fillText(`${fmt(v)} F`, 46, 440); c.restore();
    }
    if (statut) { c.fillStyle = C.gris; c.font = font(26, 600, UI); c.fillText(statut, 50, 560); }
  });
}
function transfer3(ctx, t, t0, amount, z = 1150) {
  const k = sp(t, t0, 'bouncy'); if (k <= 0) return;
  plane(ctx, { x: 0, y: -120, z: z + (1 - k) * 1600, w: 700, h: 200, ry: deg(-10 * (1 - k)), alpha: clamp(k * 1.5), dof: 0 }, (c, w, h) => {
    c.fillStyle = C.vert; c.shadowColor = 'rgba(34,197,94,0.7)'; c.shadowBlur = 60; c.beginPath(); c.roundRect(0, 0, w, h, h / 2); c.fill(); c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.arc(100, h / 2, 64, 0, Math.PI * 2); c.fill();
    const q = clamp(prog(t, t0 + 0.1, t0 + 0.45));
    c.strokeStyle = '#fff'; c.lineWidth = 13; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    const P = [[72, h / 2], [94, h / 2 + 22], [132, h / 2 - 26]];
    c.moveTo(...P[0]); if (q < 0.4) c.lineTo(lerp(P[0][0], P[1][0], q / 0.4), lerp(P[0][1], P[1][1], q / 0.4)); else { c.lineTo(...P[1]); const r = (q - 0.4) / 0.6; c.lineTo(lerp(P[1][0], P[2][0], r), lerp(P[1][1], P[2][1], r)); }
    c.stroke();
    c.fillStyle = '#fff'; c.font = font(32, 600, UI); c.fillText('Transfert envoyé', 200, 82);
    c.font = font(70, 800, D); c.fillText(`− ${amount} F`, 196, 156);
  });
}


// Illustration : Adama de profil, à contre-jour devant une fenêtre à stores, le visage éclairé par son téléphone
const PROFIL = [[0.30, 0.62], [0.22, 0.46], [0.24, 0.27], [0.36, 0.16], [0.50, 0.14], [0.60, 0.20], [0.635, 0.30], [0.645, 0.345], [0.635, 0.375], [0.705, 0.445], [0.66, 0.47], [0.645, 0.48], [0.665, 0.505], [0.645, 0.53], [0.655, 0.56], [0.625, 0.615], [0.55, 0.64], [0.53, 0.70], [0.66, 0.77], [0.80, 0.86], [0.88, 1.02], [-0.05, 1.02], [0.02, 0.84], [0.17, 0.74], [0.29, 0.70]];
function courbe(c, pts, w, h, ox, oy, sc) {
  const P = pts.map(([x, y]) => [ox + x * sc, oy + y * sc]);
  c.beginPath(); c.moveTo(...P[0]);
  for (let i = 0; i < P.length; i++) {
    const p0 = P[(i - 1 + P.length) % P.length], p1 = P[i], p2 = P[(i + 1) % P.length], p3 = P[(i + 2) % P.length];
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  c.closePath();
}
function drawAdama(c, w, h, t = 0) {
  c.fillStyle = '#04070F'; c.fillRect(0, 0, w, h);
  // fenêtre à stores, lumière froide de la nuit
  const fx = w * 0.08, fy = h * 0.12, fw = w * 0.84, fh = h * 0.42;
  const g = c.createLinearGradient(0, fy, 0, fy + fh); g.addColorStop(0, '#3D5A9E'); g.addColorStop(1, '#1A2A55');
  c.fillStyle = g; c.fillRect(fx, fy, fw, fh);
  c.fillStyle = 'rgba(5,8,18,0.85)';
  for (let i = 0; i < 16; i++) c.fillRect(fx, fy + i * (fh / 16) + fh / 32, fw, fh / 50);
  c.fillRect(fx + fw / 2 - w * 0.008, fy, w * 0.016, fh);
  const sc = w * 0.95, ox = w * 0.02, oy = h * 0.30;
  // silhouette
  c.fillStyle = '#010204'; courbe(c, PROFIL, w, h, ox, oy, sc); c.fill();
  // main + téléphone devant le visage
  const px = ox + 0.80 * sc, py = oy + 0.50 * sc;
  c.save(); c.translate(px, py); c.rotate(-0.5);
  c.fillStyle = '#010204'; c.beginPath(); c.ellipse(0, sc * 0.075, sc * 0.05, sc * 0.085, 0, 0, Math.PI * 2); c.fill();
  c.shadowColor = 'rgba(150,200,255,1)'; c.shadowBlur = sc * 0.08; c.fillStyle = '#E4EEFF'; c.beginPath(); c.roundRect(-sc * 0.03, -sc * 0.06, sc * 0.06, sc * 0.11, sc * 0.01); c.fill();
  c.restore();
  // avant-bras
  c.fillStyle = '#010204'; c.beginPath(); c.moveTo(px - sc * 0.02, py + sc * 0.1); c.lineTo(px + sc * 0.03, py + sc * 0.14); c.lineTo(ox + 0.7 * sc, oy + 0.95 * sc); c.lineTo(ox + 0.58 * sc, oy + 0.95 * sc); c.fill();
  // lueur du téléphone sur le visage
  c.save(); c.globalCompositeOperation = 'lighter';
  const lg = c.createRadialGradient(px, py, 0, px, py, sc * 0.35); lg.addColorStop(0, `rgba(130,180,255,${0.5 + 0.06 * Math.sin(t * 7)})`); lg.addColorStop(1, 'rgba(130,180,255,0)');
  c.fillStyle = lg; c.fillRect(0, 0, w, h);
  c.restore();
  // liseré de lumière sur le profil (front, nez, lèvres, menton)
  c.save(); courbe(c, PROFIL, w, h, ox, oy, sc); c.clip();
  c.strokeStyle = 'rgba(170,205,255,0.9)'; c.lineWidth = sc * 0.012; c.filter = `blur(${(sc * 0.004).toFixed(1)}px)`;
  const P = PROFIL.slice(5, 17).map(([x, y]) => [ox + x * sc, oy + y * sc]);
  c.beginPath(); c.moveTo(...P[0]); for (const q of P.slice(1)) c.lineTo(...q); c.stroke();
  c.restore();
}

// Habillage « flash spécial » façon télé
function tvBanner(ctx, t) {
  const k = sp(t, 0.15, 'snappy');
  ctx.save();
  // EN DIRECT + logo de l'émission
  ctx.globalAlpha = clamp(k * 1.5);
  ctx.fillStyle = '#E11D2E'; ctx.beginPath(); ctx.roundRect(80 - (1 - k) * 300, 230, 250, 64, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.globalAlpha *= Math.floor(t * 2) % 2 ? 1 : 0.35; ctx.beginPath(); ctx.arc(116 - (1 - k) * 300, 262, 11, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = clamp(k * 1.5);
  ctx.fillStyle = '#fff'; ctx.font = font(32, 800, D); ctx.fillText('EN DIRECT', 140 - (1 - k) * 300, 274);
  ctx.textAlign = 'right'; ctx.fillStyle = C.ambre; ctx.font = font(30, 800, D); ctx.fillText('LA MINUTE CYBER', 1000 + (1 - k) * 300, 274);
  ctx.textAlign = 'left';
  // bandeau bas : flash spécial
  const k2 = sp(t, 0.35, 'snappy');
  const y = 1500;
  ctx.globalAlpha = clamp(k2 * 1.5);
  ctx.fillStyle = C.orange; ctx.fillRect(0, y, W * k2, 80);
  ctx.fillStyle = '#fff'; ctx.font = font(40, 800, D); ctx.fillText('FLASH SPÉCIAL', 60, y + 54);
  ctx.fillStyle = 'rgba(8,10,16,0.92)'; ctx.fillRect(0, y + 80, W * k2, 96);
  ctx.fillStyle = '#fff'; ctx.font = font(36, 700, D); ctx.fillText('Un message au nom du chef de l’État', 60, y + 142);
  // fil d'actualité qui défile
  ctx.fillStyle = '#E8E8E8'; ctx.fillRect(0, y + 176, W, 54);
  ctx.save(); ctx.beginPath(); ctx.rect(0, y + 176, W, 54); ctx.clip();
  ctx.fillStyle = C.encre; ctx.font = font(28, 700, UI);
  const tick = 'FAUX COMPTES   •   FRAIS DE DOSSIER   •   USURPATION D’IDENTITÉ   •   NE PAYEZ RIEN   •   ';
  const tw = ctx.measureText(tick).width; const off = (t * 260) % tw;
  for (let x = -off; x < W; x += tw) ctx.fillText(tick, x, y + 213);
  ctx.restore();
  ctx.restore();
}

// ================================================================== scènes
const CARD = { P: [0, -230, 1500], S: [1700, -230, 1500], Cp: [3400, -230, 1500] };

function sHook(ctx, t, I) {
  bg(ctx, '#06101A', '#010204');
  setCam(t, [[0, [0, 0, -700, deg(-5), deg(2), 0]], [4.9, [0, -60, -380, deg(3), 0, deg(-1)]]], [[0, 1600], [4.9, 1380]]);
  dust(ctx, 2, 170);
  haze(ctx, W * 0.5, H * 0.32, 700, '37,99,235', 0.16);
  const k = sp(t, 0.05, 'gentle');
  plane(ctx, { x: 0, y: -300 + (1 - k) * -400, z: 1000, w: 900, h: 300, ry: deg(-12 + 12 * ease(t, 0, 4.5)), alpha: clamp(k * 1.4) }, (c, w, h) => {
    c.fillStyle = 'rgba(24,31,47,0.94)'; c.beginPath(); c.roundRect(0, 0, w, h, 46); c.fill(); c.strokeStyle = 'rgba(110,155,255,0.35)'; c.lineWidth = 3; c.stroke();
    avatarDraw(c, I.cap, 100, 100, 58);
    c.fillStyle = '#fff'; c.font = font(40, 800, D); c.fillText('Capitaine Ibrahim Traoré', 186, 94);
    c.fillStyle = C.gris; c.font = font(26, 600, UI); c.fillText('Message · maintenant', 186, 134);
    const msg = ['Bonjour. Votre projet a été', 'retenu pour un financement…'];
    const n = Math.floor(55 * prog(t, 1.9, 4.3));
    c.fillStyle = '#E6E9F2'; c.font = font(34, 600, UI);
    c.fillText(msg[0].slice(0, n), 50, 214); if (n > msg[0].length) c.fillText(msg[1].slice(0, n - msg[0].length - 1), 50, 258);
    if (t < 1.9) for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(64 + i * 30, 214 - 12 * Math.max(0, Math.sin(t * 9 - i)), 9, 0, Math.PI * 2); c.fillStyle = C.gris; c.fill(); }
  });
  const fm = 1 - ease(t, 1.5, 1.82);
  if (fm > 0) text3(ctx, 'Mesdames,', { alpha: fm, x: -470, y: 330, z: 1500, size: 150, n: 9 * ease(t, 0.3, 0.8, E.linear), glow: 'rgba(150,190,255,0.5)', ry: deg(8) });
  if (fm > 0) text3(ctx, 'messieurs,', { alpha: fm, x: -330, y: 520, z: 1600, size: 150, n: 10 * ease(t, 0.8, 1.5, E.linear), glow: 'rgba(150,190,255,0.5)', ry: deg(8), cursor: t < 1.9 });
  caption(ctx, t, PHRASES[1], { y: 1240, size: 76, out: 4.75 });
  trail(ctx, t, 2.6, 2.6, 1);
}

function sCru(ctx, t, I) {
  bg(ctx, '#05080F', '#010203');
  setCam(t, [[4.9, [0, 0, -600, deg(10), 0, deg(2)]], [7.5, [0, 0, 300, deg(-4), 0, 0]]], [[4.9, 1300], [7.5, 1100]]);
  // la façade de nuit : une seule fenêtre allumée, celle d'Adama
  if (I.fen) {
    plane(ctx, { x: 120, y: -40, z: 3400, w: 4800, h: 6400, dof: 0.35, fog: false }, (c, w, h) => { c.drawImage(I.fen, 0, 0, w, h); c.fillStyle = 'rgba(2,4,10,0.25)'; c.fillRect(0, 0, w, h); });
    const pw = proj(120 - 2400 + 4800 * 0.5, -40 - 3200 + 6400 * 0.57, 3400);
    if (pw) haze(ctx, pw.x, pw.y, 260 * pw.s * 3, '255,200,140', 0.18 + 0.06 * Math.sin(t * 3));
  }
  dust(ctx, 5, 140);
  text3(ctx, 'Enfin,', { x: -420, y: -520, z: 2400, size: 90, weight: 600, color: '#9FB3D9', ry: deg(-14) });
  text3(ctx, 'c’est ce', { x: -440, y: -260, z: 1500, size: 140, glow: 'rgba(150,190,255,0.4)', ry: deg(-10) });
  text3(ctx, 'qu’a cru', { x: -440, y: -100, z: 1500, size: 140, glow: 'rgba(150,190,255,0.4)', ry: deg(-10) });
  const k = sp(t, 6.55, 'bouncy');
  if (k > 0) text3(ctx, 'Adama.', { x: -460, y: 160 + (1 - k) * 120, z: 1300 - 300 * (1 - k), size: 200, color: C.ambre, glow: 'rgba(233,74,6,0.8)', ry: deg(-8), alpha: clamp(k * 1.4) });
  const k2 = sp(t, 6.9, 'snappy');
  if (k2 > 0) text3(ctx, 'jeune diplômé · Ouagadougou', { x: -430, y: 330, z: 1250, size: 40, weight: 600, fam: UI, color: C.gris, alpha: clamp(k2), ry: deg(-8) });
  if (t > 6.6) flare(ctx, W * 0.3, 1060, 1 - ease(t, 6.6, 7.5));
}

function chatWorld(ctx, t, I, camKeys, focus, extra = {}) {
  bg(ctx, '#071018', '#020305');
  setCam(t, camKeys, focus);
  dust(ctx, 9, 150);
  haze(ctx, W / 2, H * 0.4, 800, '37,99,235', 0.12);
  const g = extra.grey ?? [0, 0, 0];
  chatCard(ctx, t, { x: CARD.P[0], y: CARD.P[1], z: CARD.P[2], ry: deg(-6), name: 'Capitaine Ibrahim Traoré', sub: 'Compte · en ligne', img: I.cap, label: 'Financement accordé :', money: 2000000, moneyT: [9.05, 10.05], t0: 7.5, grey: g[0], statut: 'Vu à 21:47' });
  chatCard(ctx, t, { x: CARD.S[0], y: CARD.S[1], z: CARD.S[2], ry: deg(-6), name: 'Secrétaire du Président', sub: 'Conversation privée', letter: 'S', label: 'Frais de dossier :', money: 15000, t0: 11.9, grey: g[1], statut: '« Les paiements ? Voyez le comptable. »' });
  chatCard(ctx, t, { x: CARD.Cp[0], y: CARD.Cp[1], z: CARD.Cp[2], ry: deg(-6), name: 'Comptable', sub: 'Service des paiements', letter: 'C', color: '#7C3AED', label: 'Frais de transaction :', money: 25000, t0: 24.7, grey: g[2] });
  const link = (A, Bp, t0, rgb) => {
    const pa = proj(A[0] + 450, A[1], A[2]), pb = proj(Bp[0] - 450, Bp[1], Bp[2]);
    if (!pa || !pb || t < t0) return;
    const q = ease(t, t0, t0 + 1.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${rgb},0.7)`; ctx.lineWidth = 4; ctx.setLineDash([16, 14]); ctx.lineDashOffset = -t * 60;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(lerp(pa.x, pb.x, q), lerp(pa.y, pb.y, q)); ctx.stroke(); ctx.restore();
  };
  link(CARD.P, CARD.S, 10.4, '110,155,255');
  link(CARD.S, CARD.Cp, 23.2, '160,110,255');
}

function sPresident(ctx, t, I) {
  chatWorld(ctx, t, I, [[7.5, [-500, 150, -400, deg(14), deg(-3), deg(2)]], [10.2, [0, 60, 0, deg(2), 0, 0]], [11.9, [700, 60, -100, deg(-6), 0, 0]]], [[7.5, 1900], [10.2, 1500]]);
  const k = sp(t, 10.35, 'bouncy');
  if (k > 0) text3(ctx, '→ Voyez mon secrétaire', { x: -380, y: 230, z: 1250, size: 56, color: '#fff', glow: 'rgba(37,99,235,0.9)', alpha: clamp(k * 1.4), ry: deg(-6) });
  if (t > 10.0 && t < 10.9) flare(ctx, W * 0.55, 850, 1 - ease(t, 10.0, 10.9));
  for (const p of PHRASES.slice(3, 6)) caption(ctx, t, p, { y: 1460, size: 68, out: p[1] + 0.2 });
}
function sSecretaire(ctx, t, I) {
  chatWorld(ctx, t, I, [[11.9, [700, 60, -100, deg(-6), 0, 0]], [12.8, [1700, 60, 0, deg(0), 0, 0]], [14.8, [1750, 40, 220, deg(-3), 0, deg(-1)]]], [[11.9, 1500]]);
  caption(ctx, t, PHRASES[6], { y: 1460, size: 64, out: 14.65 });
}

function sReve(ctx, t) {
  bg(ctx, '#0B1A3E', '#03060F');
  setCam(t, [[14.8, [0, 0, -500, 0, 0, 0]], [17.15, [0, 0, 2600, deg(4), 0, deg(2)]]], [[14.8, 1400], [17.15, 1400]]);
  dust(ctx, 12, 200, '255,210,160');
  const reves = [['Sa boutique', -300, -420, 900], ['Son atelier', 260, -120, 1400], ['Une moto', -320, 200, 1900], ['Aider sa mère', 180, 480, 2400], ['Son projet', 0, -60, 3300]];
  reves.forEach(([s, x, y, z], i) => text3(ctx, s, { x, y, z, size: i === 4 ? 150 : 100, color: i === 4 ? '#fff' : '#CFE0FF', glow: 'rgba(255,190,120,0.7)', align: 'center', ry: deg(i % 2 ? -12 : 12) }));
  for (let i = 0; i < 18; i++) { const p = proj((hash01(i, 4) - 0.5) * 2600, (hash01(i, 5) - 0.5) * 3000, 600 + hash01(i, 6) * 4000); if (p) haze(ctx, p.x, p.y, 160 * p.s, '255,180,110', 0.35); }
  caption(ctx, t, PHRASES[7], { y: 1460, size: 62, out: 17.0 });
}

function sCompare(ctx, t) {
  bg(ctx, '#05080F', '#010203');
  setCam(t, [[17.15, [0, 0, -300, deg(-4), 0, 0]], [19.5, [0, 0, 100, deg(2), 0, 0]], [20.38, [0, 0, 300, deg(0), 0, 0]]], [[17.15, 1700], [18.1, 1300]]);
  dust(ctx, 15, 120);
  const kB = sp(t, 18.08, 'bouncy');
  if (kB > 0) text3(ctx, '2 000 000', { x: 0, y: -260, z: 1400 - 500 * (1 - kB), size: 180, align: 'center', glow: 'rgba(150,190,255,0.5)', alpha: clamp(kB * 1.4) });
  const kS = sp(t, 17.25, 'snappy');
  const rien = ease(t, 19.6, 20.05, E.inBack);
  if (kS > 0 && rien < 1) text3(ctx, '15 000', { x: 0, y: kB > 0 ? 40 : -260, z: kB > 0 ? 3000 + rien * 4000 : 1300, size: 220, color: C.ambre, align: 'center', glow: 'rgba(233,74,6,0.8)', alpha: clamp(kS * 1.4) * (1 - rien) });
  if (t > 19.55) { const k = sp(t, 19.58, 'bouncy'); text3(ctx, 'Rien.', { x: 0, y: 260, z: 1250 + (1 - k) * 900, size: 200, color: C.ambre, align: 'center', glow: 'rgba(233,74,6,0.9)', alpha: clamp(k * 1.4) }); }
  else caption(ctx, t, PHRASES[t < 18.0 ? 8 : 9], { y: 1460, size: 66 });
}

function sPaie(ctx, t, amount, t0, total, phrase) {
  bg(ctx, '#03120A', '#010302');
  setCam(t, [[t0 - 0.2, [0, 0, -200, deg(-6), 0, 0]], [t0 + 1.3, [0, 0, 120, deg(3), 0, 0]]]);
  dust(ctx, 21, 120, '160,255,200');
  haze(ctx, W / 2, H * 0.42, 700, '34,197,94', 0.16);
  transfer3(ctx, t, t0, amount);
  if (total) { const k = sp(t, t0 + 0.5, 'snappy'); if (k > 0) { text3(ctx, 'Total envoyé', { x: 0, y: 130, z: 1150, size: 40, weight: 600, fam: UI, color: C.gris, align: 'center', alpha: clamp(k) }); text3(ctx, `${fmt(lerp(15000, total, E.outCubic(prog(t, t0 + 0.5, t0 + 1.0))))} F`, { x: 0, y: 240, z: 1150, size: 130, color: C.ambre, glow: 'rgba(233,74,6,0.8)', align: 'center', alpha: clamp(k) }); } }
  caption(ctx, t, phrase, { y: 1430, size: 96 });
}

function sComptable(ctx, t, I) {
  chatWorld(ctx, t, I, [[21.7, [1750, 40, 220, deg(-3), 0, 0]], [23.0, [2300, 100, -500, deg(-14), 0, deg(-2)]], [24.8, [3400, 60, 0, deg(0), 0, 0]], [27.95, [3450, 40, 260, deg(-3), 0, deg(1)]]], [[21.7, 1300], [24.8, 1500]]);
  caption(ctx, t, PHRASES[12], { y: 1460, size: 60, out: 24.55 });
  caption(ctx, t, PHRASES[13], { y: 1460, size: 64, out: 27.85 });
}

function sHesite(ctx, t, I) {
  const beat = Math.max(0, Math.sin((t - 28) * Math.PI * 2 * 1.25)) ** 8;
  bg(ctx, '#E2C795', '#000');
  setCam(t, [[27.95, [0, 0, -300, deg(3), 0, 0]], [32.15, [0, 0, 260, deg(-2), 0, deg(-1)]]], [[27.95, 1400]]);
  CAM.z += beat * 30;
  // l'homme seul à sa table (beige en haut, noir en bas)
  if (I.seul) plane(ctx, { x: 0, y: 420, z: 1700, w: 2300, h: 4600, dof: 0.2, fog: false }, (c, w, h) => c.drawImage(I.seul, 0, 0, w, h));
  haze(ctx, W / 2, H * 0.62, 700 + beat * 160, '233,74,6', 0.05 + 0.12 * beat);
  text3(ctx, 'Adama', { x: -430, y: -800, z: 1250, size: 130, color: C.encre, ry: deg(8), dof: 0 });
  text3(ctx, 'hésite…', { x: -430, y: -650, z: 1250, size: 130, color: C.encre, ry: deg(8), dof: 0, cursor: Math.floor(t * 2.2) % 2 === 0, n: 7 * ease(t, 28.2, 28.9, E.linear) });
  text3(ctx, 'reculer ?', { x: 170, y: -420, z: 1700, size: 96, weight: 600, color: '#6B5A3A', ry: deg(-10), alpha: ease(t, 29.6, 30.0), dof: 0 });
  caption(ctx, t, PHRASES[16], { y: 1380, size: 96, out: 32.0 });
}

function sPersonne(ctx, t, I) {
  if (t >= 35.15) { // la salle de cinéma vide : « THE END »
    bg(ctx, '#000', '#000');
    setCam(t, [[35.15, [0, 0, -200, deg(-2), 0, 0]], [36.6, [0, -30, 260, deg(1), 0, 0]]], [[35.15, 1500]]);
    if (I.cine) plane(ctx, { x: 0, y: 0, z: 1300, w: 1460, h: 1990, dof: 0, fog: false }, (c, w, h) => c.drawImage(I.cine, 0, 0, w, h));
    dust(ctx, 61, 90, '220,220,220');
    return caption(ctx, t, PHRASES[18], { y: 1500, size: 74, out: 36.3 });
  }
  const g = (i) => ease(t, 34.0 + i * 0.2, 34.6 + i * 0.2);
  chatWorld(ctx, t, I, [[33.75, [1700, 0, -900, 0, 0, 0]], [35.0, [1700, -40, -1250, deg(-3), 0, 0]], [36.6, [1700, -100, -1500, deg(2), 0, deg(-1)]]], [[33.75, 2400], [35.0, 3000]], { grey: [g(0), g(1), g(2)] });
  ctx.fillStyle = `rgba(0,0,0,${0.45 * ease(t, 35.4, 36.6)})`; ctx.fillRect(0, 0, W, H);
  caption(ctx, t, PHRASES[18], { y: 1460, size: 74, out: 36.3 });
}

function sRevelation(ctx, t) {
  if (t < 37.0) {
    bg(ctx, '#020203', '#000');
    setCam(t, [[36.6, [0, 0, 0, 0, 0, 0]], [37.0, [0, 0, 2500, 0, 0, deg(3)]]]);
    dust(ctx, 40, 260, '255,200,170');
    return;
  }
  bg(ctx, '#FF5A14', '#B83204');
  setCam(t, [[37.0, [0, 0, -900, deg(-8), 0, deg(3)]], [39.35, [0, 0, 0, deg(4), 0, 0]]], [[37.0, 1150]]);
  const sh = 26 * Math.exp(-(t - 37.0) / 0.25);
  CAM.x += sh * noise1(t * 50, 1); CAM.y += sh * noise1(t * 50, 2);
  dust(ctx, 41, 120, '255,230,200');
  const ab = Math.max(0, 1 - (t - 37.0) * 2.2) * 16;
  for (const [l, y] of [['USURPATION', -170], ['D’IDENTITÉ', 30]]) {
    if (ab > 0.5) { text3(ctx, l, { x: -ab, y, z: 1150, size: 160, color: 'rgba(0,255,255,0.6)', align: 'center', dof: 0 }); text3(ctx, l, { x: ab, y, z: 1150, size: 160, color: 'rgba(255,0,80,0.6)', align: 'center', dof: 0 }); }
    text3(ctx, l, { x: 0, y, z: 1150, size: 160, color: '#fff', align: 'center', dof: 0, glow: 'rgba(0,0,0,0.35)' });
  }
  const k2 = sp(t, 37.6, 'snappy');
  if (k2 > 0) text3(ctx, 'Le vrai chef de l’État n’a jamais écrit.', { x: 0, y: 330, z: 1150, size: 52, color: C.encre, align: 'center', alpha: clamp(k2) });
  trail(ctx, t, 37.1, 2.0, 3, '255,240,200');
}

function sMur(ctx, t, I) {
  bg(ctx, '#05070B', '#000');
  setCam(t, [[39.35, [-200, 0, -1100, deg(8), deg(-2), 0]], [42.2, [0, -50, -500, deg(3), 0, 0]], [44.0, [0, -80, -250, 0, 0, deg(-1)]]], [[39.35, 1300], [42.2, 900]]);
  if (I.mur) plane(ctx, { x: 0, y: 0, z: 2600, w: 2250, h: 4000, dof: 0.5 }, (c, w, h) => { c.drawImage(I.mur, 0, 0, w, h); c.fillStyle = 'rgba(4,6,10,0.35)'; c.fillRect(0, 0, w, h); });
  vignette(ctx, 0.7);
  const fuse = ease(t, 42.2, 43.4, E.inOutCubic);
  const cards = [['PRÉSIDENT', 'P', C.bleu, 39.5, -250, -280, 900, -8, I.cap], ['SECRÉTAIRE', 'S', '#334155', 40.25, 260, -150, 1050, 6, null], ['COMPTABLE', 'C', '#7C3AED', 41.18, -40, 220, 1200, -4, null]];
  const pts = [];
  cards.forEach(([name, l, col, t0, x, y, z, r, img], i) => {
    const k = sp(t, t0, 'bouncy'); if (k <= 0) return;
    const X = lerp(x, 0, fuse), Y = lerp(y, -60, fuse), Z = lerp(z, 800, fuse);
    pts.push([X, Y - 150, Z]);
    plane(ctx, { x: X, y: Y + (1 - k) * -200, z: Z, w: 300, h: 380, rz: deg(r * (1 - fuse)), ry: deg(-10 * (1 - fuse)), alpha: clamp(k * 1.5) * (i > 0 ? 1 - fuse : 1), dof: 0.6 }, (c, w, h) => {
      c.fillStyle = '#F3EEDF'; c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 40; c.fillRect(0, 0, w, h); c.shadowBlur = 0;
      avatarDraw(c, fuse > 0.85 && i === 0 ? null : img, w / 2, 140, 82, fuse > 0.85 ? '?' : l, fuse > 0.85 ? C.encre : col);
      c.fillStyle = C.encre; c.font = font(36, 800, D); c.textAlign = 'center'; c.fillText(fuse > 0.85 && i === 0 ? 'UN SEUL' : name, w / 2, 300);
      c.beginPath(); c.arc(w / 2, 26, 13, 0, Math.PI * 2); c.fillStyle = '#C81E1E'; c.fill();
    });
  });
  if (pts.length > 1 && fuse < 0.95) {
    const P = pts.map((p) => proj(...p)).filter(Boolean);
    ctx.save(); ctx.strokeStyle = `rgba(220,38,38,${0.9 * (1 - fuse)})`; ctx.lineWidth = 5; ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); if (P.length === 3) ctx.closePath(); ctx.stroke(); ctx.restore();
  }
  if (fuse > 0.9) flare(ctx, W / 2, 700, 1 - ease(t, 43.3, 44.0));
  caption(ctx, t, PHRASES[20], { y: 1480, size: 72, out: 41.05 });
  caption(ctx, t, PHRASES[21], { y: 1480, size: 72, out: 42.05 });
  caption(ctx, t, PHRASES[22], { y: 1480, size: 72, out: 43.95 });
}

function sCriminel(ctx, t, I) {
  bg(ctx, '#000', '#000');
  setCam(t, [[44.0, [60, 0, -300, deg(-3), 0, 0]], [48.2, [-40, -40, 200, deg(3), 0, deg(1)]]], [[44.0, 1150]]);
  if (I.noir) plane(ctx, { x: 0, y: 0, z: 1900, w: 1950, h: 3470, dof: 0.2, fog: false }, (c, w, h) => c.drawImage(I.noir, 0, 0, w, h));
  dust(ctx, 50, 140, '255,200,180');
  vignette(ctx, 0.5);
  const k = sp(t, 44.1, 'bouncy');
  if (k > 0) {
    text3(ctx, 'UN SEUL', { x: -400, y: -640, z: 1150 + (1 - k) * 600, size: 84, glow: 'rgba(255,255,255,0.4)', alpha: clamp(k * 1.4), ry: deg(8), dof: 0 });
    text3(ctx, 'CYBERCRIMINEL', { x: -410, y: -520, z: 1150 + (1 - k) * 800, size: 92, color: C.ambre, glow: 'rgba(233,74,6,0.9)', alpha: clamp(k * 1.4), ry: deg(8), dof: 0 });
  }
  const g = sp(t, 45.9, 'bouncy'), pt = sp(t, 47.25, 'snappy');
  if (g > 0) { text3(ctx, 'Promettre', { x: 440, y: 260, z: 1150, size: 64, align: 'right', alpha: clamp(g), dof: 0 }); text3(ctx, 'GROS.', { x: 440, y: 400, z: 1150 + (1 - g) * 700, size: 190, align: 'right', glow: 'rgba(255,255,255,0.4)', alpha: clamp(g * 1.4), dof: 0 }); }
  if (pt > 0) text3(ctx, 'Faire payer petit.', { x: 440, y: 520, z: 1150, size: 52, color: C.ambre, align: 'right', alpha: clamp(pt), dof: 0 });
  trail(ctx, t, 44.0, 3.2, 5);
}

function sReflexes(ctx, t) {
  ctx.fillStyle = C.papier; ctx.fillRect(0, 0, W, H);
  setCam(t, [[48.2, [0, 0, -260, deg(-6), deg(2), 0]], [57.9, [0, 0, 80, deg(4), 0, 0]]], [[48.2, 1150]]);
  ctx.save(); ctx.fillStyle = 'rgba(10,10,10,0.55)'; ctx.font = font(26, 600, UI); ctx.textAlign = 'center'; ctx.fillText('LES BONS RÉFLEXES', W / 2, 260); ctx.restore();
  ctx.save(); ctx.translate(W / 2, 1660); ctx.rotate(t * 0.8); ctx.fillStyle = C.encre; ctx.font = font(90, 800, D); ctx.textAlign = 'center'; ctx.fillText('*', 0, 32); ctx.restore();
  caption(ctx, t, PHRASES[25], { y: 560, size: 70, color: C.encre, glow: false, out: 57.8 });
  const items = [['Vérifiez.', 'le compte officiel', 51.0, C.bleu], ['Signalez.', 'le faux profil', 52.05, C.encre], ['Partagez :', 'vous protégerez vos proches', 53.2, C.orange]];
  items.forEach(([a, b, t0, col], i) => {
    const k = sp(t, t0, 'gentle'); if (k <= 0) return;
    plane(ctx, { x: 0, y: -60 + i * 250, z: 1150, w: 900, h: 210, ry: deg(90 * (1 - k)), alpha: clamp(k * 2), dof: 0, fog: false }, (c, w, h) => {
      c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = 30; c.shadowOffsetY = 10; c.beginPath(); c.roundRect(0, 0, w, h, 26); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
      c.fillStyle = col; c.fillRect(0, 30, 12, h - 60);
      c.fillStyle = C.encre; c.font = font(76, 800, D); c.fillText(a, 50, 102);
      c.fillStyle = '#545B66'; c.font = font(36, 600, UI); c.fillText(b, 52, 160);
      c.fillStyle = col; c.font = font(60, 800, D); c.textAlign = 'right'; c.fillText(String(i + 1), w - 40, 120);
    });
  });
}


// ================================================================== accroche flash (2,2 s) avant l'histoire
const INTRO = 2.2;
const FLASH = [ // [début, type, contenu]
  [0.00, 'notif'], [0.13, 'txt', '2 000 000 F', C.ambre], [0.26, 'img', 'fen', 0.5, 0.55], [0.38, 'txt', 'FRAIS DE DOSSIER', '#fff'],
  [0.50, 'img', 'seul', 0.5, 0.45], [0.62, 'txt', '15 000 F', C.ambre], [0.74, 'img', 'mur', 0.5, 0.4], [0.86, 'txt', '25 000 F', C.ambre],
  [0.98, 'img', 'cine', 0.5, 0.5], [1.10, 'stamp', 'FAUX COMPTE'], [1.22, 'img', 'noir', 0.45, 0.4], [1.34, 'noise'],
  [1.44, 'orange', 'ATTENTION.'], [1.62, 'titre'],
];
const FLASH_HITS = [0.0, 0.13, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86, 0.98, 1.10, 1.22, 1.34, 1.44];
function coverImg(c, img, fx, fy, zoom) {
  const s = Math.max(W / img.width, H / img.height) * zoom;
  const iw = img.width * s, ih = img.height * s;
  c.drawImage(img, (W - iw) * fx, (H - ih) * fy, iw, ih);
}
function intro(ctx, t, I) {
  let k = 0; while (k + 1 < FLASH.length && t >= FLASH[k + 1][0]) k++;
  const [t0, type, a, b, c2] = FLASH[k];
  const lt = t - t0;
  const z = 1.18 - 0.18 * E.outCubic(clamp(lt / 0.13));     // chaque plan claque puis se pose
  const jx = (hash01(k, 3) - 0.5) * 60, jy = (hash01(k, 4) - 0.5) * 60;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2 + jx, H / 2 + jy); ctx.scale(z, z); ctx.rotate((hash01(k, 5) - 0.5) * 0.06); ctx.translate(-W / 2, -H / 2);
  if (type === 'img' && I[a]) {
    ctx.filter = 'contrast(1.25) saturate(0.6)'; coverImg(ctx, I[a], b, c2, 1.25); ctx.filter = 'none';
    ctx.fillStyle = 'rgba(233,74,6,0.12)'; ctx.fillRect(0, 0, W, H);
  } else if (type === 'txt') {
    ctx.textAlign = 'center'; ctx.font = font(a.length > 12 ? 104 : 150, 800, D);
    ctx.shadowColor = b === '#fff' ? 'rgba(150,190,255,0.6)' : 'rgba(233,74,6,0.9)'; ctx.shadowBlur = 60; ctx.fillStyle = b; ctx.fillText(a, W / 2, H / 2 + 50);
  } else if (type === 'notif') {
    ctx.fillStyle = 'rgba(24,31,47,1)'; ctx.beginPath(); ctx.roundRect(90, 800, 900, 300, 46); ctx.fill();
    avatarDraw(ctx, I.cap, 190, 900, 60);
    ctx.fillStyle = '#fff'; ctx.font = font(40, 800, D); ctx.fillText('Nouveau message', 280, 890);
    ctx.fillStyle = C.gris; ctx.font = font(30, 600, UI); ctx.fillText('Financement accordé…', 280, 940);
    ctx.fillStyle = '#E6E9F2'; ctx.font = font(34, 600, UI); ctx.fillText('Payez les frais pour débloquer.', 140, 1050);
  } else if (type === 'adama') {
    drawAdama(ctx, W, H, t);
  } else if (type === 'stamp') {
    ctx.fillStyle = '#0B0B0B'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.16);
    ctx.strokeStyle = '#E11D2E'; ctx.lineWidth = 16; ctx.strokeRect(-430, -120, 860, 240);
    ctx.fillStyle = '#E11D2E'; ctx.textAlign = 'center'; ctx.font = font(104, 800, D); ctx.fillText(a, 0, 38); ctx.restore();
  } else if (type === 'noise') {
    for (let i = 0; i < 900; i++) { const v = Math.floor(hash01(i + Math.floor(t * 60) * 97, 2) * 255); ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(hash01(i, 6 + Math.floor(t * 60)) * W, hash01(i, 7 + Math.floor(t * 60)) * H, 40, 40); }
  } else if (type === 'orange') {
    ctx.fillStyle = C.orange; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = font(150, 800, D); ctx.fillText(a, W / 2, H / 2 + 55);
  }
  ctx.restore();
  if (type === 'titre') { // le titre de la série claque, puis on plonge dans l'histoire
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const kk = sp(t, 1.62, 'bouncy');
    ctx.save(); ctx.translate(W / 2, H / 2); const sc = 1.6 - 0.6 * kk; ctx.scale(sc, sc);
    ctx.textAlign = 'center'; ctx.globalAlpha = clamp(kk * 1.6);
    ctx.fillStyle = '#fff'; ctx.font = font(84, 800, D); ctx.fillText('LA MINUTE', 0, -40);
    ctx.fillStyle = C.ambre; ctx.shadowColor = 'rgba(233,74,6,0.9)'; ctx.shadowBlur = 50; ctx.font = font(190, 800, D); ctx.fillText('CYBER', 0, 140);
    ctx.restore();
    flare(ctx, W / 2, H / 2 + 80, 1 - ease(t, 1.62, 2.15));
    const out = ease(t, 2.0, INTRO, E.inCubic); if (out > 0) { ctx.fillStyle = `rgba(0,0,0,${out})`; ctx.fillRect(0, 0, W, H); }
  }
  // flash blanc d'une image sur trois coupes
  if ([2, 6, 10].includes(k) && lt < 0.034) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, 0, W, H); }
  // décalage RGB sur chaque coupe
  if (lt < 0.05 && type !== 'titre') { const d = 18; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(ctx.canvas, d, 0); ctx.drawImage(ctx.canvas, -d, 0); ctx.restore(); }
}

function scene(ctx, t, I) {
  if (t < 4.9) return sHook(ctx, t, I);
  if (t < 7.5) return sCru(ctx, t, I);
  if (t < 11.9) return sPresident(ctx, t, I);
  if (t < 14.8) return sSecretaire(ctx, t, I);
  if (t < 17.15) return sReve(ctx, t);
  if (t < 20.38) return sCompare(ctx, t);
  if (t < 21.7) return sPaie(ctx, t, '15 000', 20.45, null, PHRASES[11]);
  if (t < 27.95) return sComptable(ctx, t, I);
  if (t < 32.15) return sHesite(ctx, t, I);
  if (t < 33.75) return sPaie(ctx, t, '25 000', 32.28, 40000, PHRASES[17]);
  if (t < 36.6) return sPersonne(ctx, t, I);
  if (t < 39.35) return sRevelation(ctx, t);
  if (t < 44.0) return sMur(ctx, t, I);
  if (t < 48.2) return sCriminel(ctx, t, I);
  return sReflexes(ctx, t);
}

M.film({
  fonts: [font(100, 800, D), font(40, 600, UI)],
  images: { cap: 'assets/img/capitaine.jpg', mur: 'assets/img/mur.jpg', noir: 'assets/img/noir.jpg', fen: 'assets/img/fenetre.jpg', seul: 'assets/img/seul.jpg', cine: 'assets/img/cinema.jpg' },
  hits: [
    ...FLASH_HITS.map((x, i) => [B(x), `flash ${i}`, i % 3 === 0 ? 'impact' : i % 2 ? 'thud' : 'tick']),
    [B(1.34), 'bruit', 'whoosh', { len: 0.12, from: 6000, to: 2000 }],
    [B(1.3), 'montée', 'riser', { len: 0.35 }],
    [B(1.62), 'titre', 'impact'],
    [B(2.0), 'plongée', 'whoosh', { len: 0.3, from: 3000, to: 400 }],
    ...HITS.map(([b, ...r]) => [b + B(INTRO), ...r]),
  ],
  samples: 3,
  draw(ctx, u, t, I) { if (t < INTRO) intro(ctx, t, I); else scene(ctx, t - INTRO, I); },
  post(ctx, u, T) {
    if (T < INTRO) return;
    const t = T - INTRO;
    const dark = t < 48.2 && !(t >= 37.0 && t < 39.35);
    if (dark) { vignette(ctx, 0.55); hud(ctx, t, 1); }
    for (const [g0, dur] of [[4.88, 0.16], [36.97, 0.12], [44.02, 0.1], [48.18, 0.1]]) {
      if (t >= g0 && t < g0 + dur) for (let i = 0; i < 9; i++) {
        const y = Math.floor(hash01(i + Math.floor(t * 60) * 13, 5) * H), hh = 20 + hash01(i, 8) * 90, dx = (hash01(i + 3, Math.floor(t * 60)) - 0.5) * 140;
        ctx.drawImage(ctx.canvas, 0, y, W, hh, dx, y, W, hh);
      }
    }
    const s = Math.floor(t * 30);
    for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,255,255,${((dark ? 0.04 : 0.03) * hash01(i + s * 211, 11)).toFixed(3)})`; ctx.fillRect(hash01(i + s * 17, 3) * W, hash01(i + s * 29, 4) * H, 3, 3); }
  },
});
