// Éditeur de création (Studio) : modèle de document, rendu sur <canvas> (édition, export PNG et vidéo) et animations.
// Le même moteur de rendu sert à l'écran, aux images exportées et aux images de la vidéo : ce que tu vois est ce qui part.

export type Format = "portrait" | "carre" | "story";
export const FORMATS: Record<Format, { w: number; h: number; nom: string }> = {
  portrait: { w: 1080, h: 1350, nom: "Post 4:5" },
  carre: { w: 1080, h: 1080, nom: "Carré" },
  story: { w: 1080, h: 1920, nom: "Story / Reel 9:16" },
};

export type Entree = "aucune" | "fondu" | "glisser-haut" | "glisser-bas" | "glisser-gauche" | "glisser-droite" | "zoom" | "pop";
export type Boucle = "aucune" | "flotter" | "pulser" | "tourner" | "balancer";
export type Anim = { entree: Entree; delai: number; duree: number; boucle: Boucle };
export type Ombre = "aucune" | "douce" | "forte" | "neon" | "verre";
export type TypeEl = "texte" | "image" | "forme" | "carte" | "icone" | "rayons";
export type Carte = { titre: string; etat: string; texte: string; bouton: string; icone: string; couleur: string };

export type El = {
  id: string; type: TypeEl; nom?: string; role?: string;
  x: number; y: number; w: number; h: number; rot: number; opacite: number;
  // texte
  texte?: string; police?: number; graisse?: 500 | 600 | 700 | 800; couleur?: string; align?: "left" | "center" | "right"; interligne?: number; espacement?: number; majuscules?: boolean;
  // fond (texte en pastille, forme, carte)
  fond?: string; rayon?: number; ombre?: Ombre; bordure?: string; epaisseur?: number; marge?: number;
  // image
  src?: string; ajustement?: "cover" | "contain"; fonduHaut?: number; fonduBas?: number;
  // forme
  forme?: "rect" | "cercle";
  // carte
  carte?: Carte;
  // icône
  icone?: string;
  anim: Anim;
};
export type Page = { id: string; fond: string; elements: El[] };
export type Doc = { format: Format; duree: number; pages: Page[] };

export const ANIM_FIXE: Anim = { entree: "aucune", delai: 0, duree: 0.8, boucle: "aucune" };
export const uid = () => Math.random().toString(36).slice(2, 10);

export const POLICE = { famille: "Montserrat, sans-serif" };

// ─── Icônes (tracés au format SVG, grille 24 × 24) ──────────────────
export const ICONES: Record<string, { nom: string; d: string[] }> = {
  bouclier: { nom: "Bouclier", d: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M8.5 12l2.5 2.5 4.5-5"] },
  maj: { nom: "Mise à jour", d: ["M12 3v12m0 0l-5-5m5 5l5-5M5 21h14"] },
  cle: { nom: "Cadenas", d: ["M5 11h14v10H5z", "M8 11V8a4 4 0 0 1 8 0v3"] },
  nuage: { nom: "Nuage", d: ["M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"] },
  lien: { nom: "Lien", d: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"] },
  bulle: { nom: "Message", d: ["M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"] },
  antenne: { nom: "Antenne", d: ["M12 20v-8", "M8.5 8.5a5 5 0 0 1 7 0", "M5.5 5.5a9 9 0 0 1 13 0"] },
  argent: { nom: "Argent", d: ["M3 6h18v12H3z", "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6"] },
  robot: { nom: "Robot", d: ["M5 8h14v11H5z", "M12 4v4", "M9 13h.01M15 13h.01"] },
  coeur: { nom: "Cœur", d: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"] },
  cal: { nom: "Calendrier", d: ["M4 5h16v16H4z", "M8 3v4M16 3v4M4 10h16"] },
  ia: { nom: "Étincelle", d: ["M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"] },
  check: { nom: "Validé", d: ["M5 12.5l4.5 4.5L19 7.5"] },
  alerte: { nom: "Alerte", d: ["M12 4l9 16H3z", "M12 10v4", "M12 17h.01"] },
};

// ─── Outils de dessin ────────────────────────────────────────────────
type Ctx = CanvasRenderingContext2D;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
function ressort(p: number) { // dépasse un peu puis se pose
  if (p >= 1) return 1;
  return 1 - Math.exp(-6 * p) * Math.cos(p * 9);
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rr);
}

// Fond : « #2563EB », « lin:#a,#b[,angle] », « rad:#a,#b[,#c] »
function peinture(ctx: Ctx, spec: string | undefined, x: number, y: number, w: number, h: number): string | CanvasGradient {
  if (!spec) return "transparent";
  if (spec.startsWith("lin:")) {
    const [a, b, ang] = spec.slice(4).split(",");
    const t = ((Number(ang) || 180) - 90) * (Math.PI / 180);
    const cx = x + w / 2, cy = y + h / 2, L = Math.abs(w * Math.cos(t)) / 2 + Math.abs(h * Math.sin(t)) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(t) * L, cy - Math.sin(t) * L, cx + Math.cos(t) * L, cy + Math.sin(t) * L);
    g.addColorStop(0, a); g.addColorStop(1, b ?? a);
    return g;
  }
  if (spec.startsWith("rad:")) {
    const cs = spec.slice(4).split(",");
    const g = ctx.createRadialGradient(x + w / 2, y + h * 0.4, 0, x + w / 2, y + h * 0.4, Math.max(w, h) * 0.75);
    cs.forEach((c, i) => g.addColorStop(i / Math.max(1, cs.length - 1), c));
    return g;
  }
  return spec;
}

function appliquerOmbre(ctx: Ctx, o: Ombre | undefined) {
  if (!o || o === "aucune") return;
  if (o === "douce") { ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18; }
  if (o === "forte") { ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30; }
  if (o === "neon" || o === "verre") { ctx.shadowColor = "rgba(110,155,255,0.85)"; ctx.shadowBlur = o === "neon" ? 60 : 44; ctx.shadowOffsetY = 0; }
}
function sansOmbre(ctx: Ctx) { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }

function police(taille: number, graisse = 700) { return `${graisse} ${Math.round(taille)}px ${POLICE.famille}`; }

// Coupe un texte en lignes à la largeur maxW (les retours à la ligne tapés sont gardés).
export function lignes(ctx: Ctx, texte: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of texte.split("\n")) {
    const mots = para.split(" "); let cur = "";
    for (const m of mots) {
      const t = cur ? cur + " " + m : m;
      if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = m; } else cur = t;
    }
    out.push(cur);
  }
  return out;
}

function dessinerIcone(ctx: Ctx, nom: string, x: number, y: number, taille: number, couleur: string, epaisseur = 2.2) {
  const ic = ICONES[nom] ?? ICONES.bulle;
  ctx.save(); ctx.translate(x, y); ctx.scale(taille / 24, taille / 24);
  ctx.strokeStyle = couleur; ctx.lineWidth = epaisseur; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const d of ic.d) ctx.stroke(new Path2D(d));
  ctx.restore();
}

// ─── Animation : état d'un élément au temps t (en secondes) ─────────
// t = Infinity : état final (édition, export PNG).
export function etat(el: El, t: number) {
  let dx = 0, dy = 0, s = 1, a = 1, r = 0;
  const { entree, delai, duree, boucle } = el.anim;
  if (entree !== "aucune" && Number.isFinite(t)) {
    const p = clamp((t - delai) / Math.max(0.05, duree));
    const e = easeOut(p);
    if (entree === "fondu") a = e;
    if (entree === "glisser-haut") { dy = (1 - e) * 90; a = clamp(p * 2); }
    if (entree === "glisser-bas") { dy = -(1 - e) * 90; a = clamp(p * 2); }
    if (entree === "glisser-gauche") { dx = (1 - e) * 140; a = clamp(p * 2); }
    if (entree === "glisser-droite") { dx = -(1 - e) * 140; a = clamp(p * 2); }
    if (entree === "zoom") { s = 0.6 + 0.4 * e; a = e; }
    if (entree === "pop") { s = p <= 0 ? 0 : ressort(p); a = clamp(p * 3); }
  }
  if (boucle !== "aucune" && Number.isFinite(t)) {
    const tl = Math.max(0, t - delai - duree);
    if (boucle === "flotter") dy += Math.sin(tl * 2 * Math.PI / 3.2) * 10;
    if (boucle === "pulser") s *= 1 + 0.04 * Math.sin(tl * 2 * Math.PI / 1.6);
    if (boucle === "tourner") r += tl * 12;
    if (boucle === "balancer") r += Math.sin(tl * 2 * Math.PI / 3) * 3;
  }
  return { dx, dy, s, a, r };
}

// ─── Rendu d'un élément ──────────────────────────────────────────────
export function dessinerElement(ctx: Ctx, el: El, t: number, images: Map<string, HTMLImageElement>) {
  const st = etat(el, t);
  if (st.a <= 0.001 || el.opacite <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(el.opacite * st.a);
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  ctx.translate(cx + st.dx, cy + st.dy);
  ctx.rotate(((el.rot + st.r) * Math.PI) / 180);
  ctx.scale(st.s, st.s);
  ctx.translate(-el.w / 2, -el.h / 2);
  const w = el.w, h = el.h;

  if (el.type === "forme") {
    appliquerOmbre(ctx, el.ombre);
    ctx.fillStyle = peinture(ctx, el.fond, 0, 0, w, h);
    if (el.forme === "cercle") { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); } else rrect(ctx, 0, 0, w, h, el.rayon ?? 0);
    ctx.fill(); sansOmbre(ctx);
    if (el.bordure && el.epaisseur) { ctx.strokeStyle = el.bordure; ctx.lineWidth = el.epaisseur; ctx.stroke(); }
  }

  if (el.type === "rayons") {
    const n = 24, R = Math.max(w, h) * 0.75;
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, R);
    const c = el.couleur ?? "rgba(255,240,190,0.4)";
    g.addColorStop(0, c); g.addColorStop(0.55, c.replace(/[\d.]+\)$/, (m) => `${Number(m.slice(0, -1)) * 0.5})`)); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / n / 2.6;
      ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + R * Math.cos(a0), h / 2 + R * Math.sin(a0)); ctx.lineTo(w / 2 + R * Math.cos(a1), h / 2 + R * Math.sin(a1)); ctx.closePath();
    }
    ctx.fill();
  }

  if (el.type === "image") {
    const img = el.src ? images.get(el.src) : undefined;
    ctx.save();
    appliquerOmbre(ctx, el.ombre);
    rrect(ctx, 0, 0, w, h, el.rayon ?? 0);
    if (el.ombre && el.ombre !== "aucune") { ctx.fillStyle = "#000"; ctx.fill(); }
    sansOmbre(ctx);
    ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      const r = el.ajustement === "contain" ? Math.min(w / img.naturalWidth, h / img.naturalHeight) : Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const iw = img.naturalWidth * r, ih = img.naturalHeight * r;
      ctx.drawImage(img, (w - iw) / 2, el.ajustement === "contain" ? (h - ih) : Math.min(0, (h - ih) * 0.3), iw, ih);
    } else {
      ctx.fillStyle = "#1D3A7A"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#BFD0FF"; ctx.font = police(34, 700); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(el.src ? "Chargement…" : "Ajoute une photo", w / 2, h / 2);
    }
    ctx.restore();
  }

  if (el.type === "texte") {
    const taille = el.police ?? 60, lh = (el.interligne ?? 1.1) * taille, marge = el.marge ?? 0;
    ctx.font = police(taille, el.graisse ?? 800);
    if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${el.espacement ?? 0}px`;
    const txt = el.majuscules ? (el.texte ?? "").toUpperCase() : el.texte ?? "";
    const ls = lignes(ctx, txt, Math.max(10, w - marge * 2));
    const hTexte = ls.length * lh;
    if (el.fond) {
      appliquerOmbre(ctx, el.ombre);
      ctx.fillStyle = peinture(ctx, el.fond, 0, 0, w, h);
      rrect(ctx, 0, 0, w, Math.max(h, hTexte + marge * 2), el.rayon ?? 0); ctx.fill(); sansOmbre(ctx);
    } else if (el.ombre && el.ombre !== "aucune") appliquerOmbre(ctx, el.ombre);
    ctx.fillStyle = peinture(ctx, el.couleur ?? "#FFFFFF", 0, 0, w, h);
    ctx.textBaseline = "alphabetic";
    const al = el.align ?? "left";
    ctx.textAlign = al;
    const x = al === "center" ? w / 2 : al === "right" ? w - marge : marge;
    const y0 = el.fond ? (Math.max(h, hTexte + marge * 2) - hTexte) / 2 : 0;
    ls.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh + taille * 0.86 + (lh - taille) / 2));
    sansOmbre(ctx);
  }

  if (el.type === "icone") {
    if (el.fond) { appliquerOmbre(ctx, el.ombre); ctx.fillStyle = peinture(ctx, el.fond, 0, 0, w, h); rrect(ctx, 0, 0, w, h, el.rayon ?? 12); ctx.fill(); sansOmbre(ctx); }
    const t2 = Math.min(w, h) * (el.fond ? 0.56 : 1);
    dessinerIcone(ctx, el.icone ?? "bulle", (w - t2) / 2, (h - t2) / 2, t2, el.couleur ?? "#FFFFFF");
  }

  if (el.type === "carte" && el.carte) {
    const c = el.carte;
    // anneau de verre + halo
    ctx.save();
    appliquerOmbre(ctx, el.ombre ?? "verre");
    ctx.fillStyle = "rgba(255,255,255,0.97)"; rrect(ctx, 0, 0, w, h, 20); ctx.fill();
    sansOmbre(ctx);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 12; rrect(ctx, -6, -6, w + 12, h + 12, 26); ctx.stroke();
    ctx.restore();
    const p = 20;
    ctx.fillStyle = c.couleur || "#2563EB"; rrect(ctx, p, p, 44, 44, 12); ctx.fill();
    dessinerIcone(ctx, c.icone || "bulle", p + 10, p + 10, 24, "#FFFFFF");
    ctx.fillStyle = "#0A0A0A"; ctx.font = police(20, 800); ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(c.titre, p + 56, p + 22, w - p * 2 - 56 - (c.etat ? 90 : 0));
    if (c.etat) {
      ctx.font = police(14, 700); const bw = ctx.measureText(c.etat).width + 18;
      ctx.fillStyle = "#DCE6FF"; rrect(ctx, w - p - bw, p + 9, bw, 26, 7); ctx.fill();
      ctx.fillStyle = "#1D4ED8"; ctx.textAlign = "center"; ctx.fillText(c.etat, w - p - bw / 2, p + 22);
    }
    const yTexte = p + 60, hBouton = c.bouton ? 50 : 0;
    const hBoite = Math.max(40, h - yTexte - p - hBouton);
    ctx.fillStyle = "#F3F4F6"; rrect(ctx, p, yTexte, w - p * 2, hBoite, 10); ctx.fill();
    ctx.fillStyle = "#374151"; ctx.font = police(18, 600); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    lignes(ctx, c.texte, w - p * 2 - 24).slice(0, Math.max(1, Math.floor((hBoite - 12) / 24))).forEach((l, i) => ctx.fillText(l, p + 12, yTexte + 28 + i * 24));
    if (c.bouton) {
      const yb = h - p - 36;
      ctx.fillStyle = "#6B7280"; ctx.font = police(16, 600); ctx.textBaseline = "middle"; ctx.fillText("✎ Modifier", p, yb + 18);
      ctx.font = police(17, 700); const bw = ctx.measureText(c.bouton).width + 36;
      ctx.fillStyle = "#2563EB"; rrect(ctx, w - p - bw, yb, bw, 36, 10); ctx.fill();
      ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center"; ctx.fillText(c.bouton, w - p - bw / 2, yb + 18);
    }
  }

  // fondus de l'image (pour fondre une photo dans le fond)
  ctx.restore();
}

export function dessinerPage(ctx: Ctx, page: Page, format: Format, t: number, images: Map<string, HTMLImageElement>) {
  const { w, h } = FORMATS[format];
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = peinture(ctx, page.fond, 0, 0, w, h);
  ctx.fillRect(0, 0, w, h);
  for (const el of page.elements) dessinerElement(ctx, el, t, images);
  ctx.restore();
}

// ─── Fabriques d'éléments ────────────────────────────────────────────
const base = (p: Partial<El>): El => ({ id: uid(), type: "texte", x: 100, y: 100, w: 400, h: 120, rot: 0, opacite: 1, anim: { ...ANIM_FIXE }, ...p });
export const nouveau = {
  texte: (p: Partial<El> = {}) => base({ type: "texte", nom: "Texte", texte: "Votre texte", police: 64, graisse: 800, couleur: "#FFFFFF", align: "left", interligne: 1.08, w: 700, h: 80, ...p }),
  pastille: (p: Partial<El> = {}) => base({ type: "texte", nom: "Pastille", texte: "Mot clé", police: 46, graisse: 700, couleur: "#FFFFFF", fond: "#2563EB", rayon: 16, marge: 18, align: "center", w: 520, h: 84, ...p }),
  image: (p: Partial<El> = {}) => base({ type: "image", nom: "Photo", x: 0, y: 0, w: 1080, h: 1350, ajustement: "cover", ...p }),
  forme: (p: Partial<El> = {}) => base({ type: "forme", nom: "Forme", forme: "rect", fond: "#2563EB", rayon: 24, w: 300, h: 200, ...p }),
  carte: (p: Partial<El> = {}, c: Partial<Carte> = {}) => base({ type: "carte", nom: "Carte", w: 320, h: 190, ombre: "verre", carte: { titre: "Titre", etat: "État", texte: "Une phrase courte.", bouton: "Bouton", icone: "bouclier", couleur: "#2563EB", ...c }, ...p }),
  icone: (p: Partial<El> = {}) => base({ type: "icone", nom: "Icône", icone: "ia", w: 90, h: 90, fond: "#2563EB", rayon: 20, couleur: "#FFFFFF", ...p }),
  rayons: (p: Partial<El> = {}) => base({ type: "rayons", nom: "Rayons de lumière", x: -410, y: -480, w: 1900, h: 1900, couleur: "rgba(255,240,190,0.38)", anim: { entree: "fondu", delai: 0, duree: 1, boucle: "tourner" }, ...p }),
};
const anim = (entree: Entree, delai: number, boucle: Boucle = "aucune", duree = 0.8): Anim => ({ entree, delai, duree, boucle });

function logo(x = 56, y = 52, clair = true): El[] {
  return [
    nouveau.forme({ nom: "Logo (carré)", x, y, w: 58, h: 58, rayon: 0, fond: "#2563EB" }),
    nouveau.texte({ nom: "Logo (sigle)", x, y: y + 20, w: 58, h: 20, texte: "TUVOA", police: 13, graisse: 800, align: "center" }),
    nouveau.texte({ nom: "Logo (nom)", x: x + 72, y: y + 6, w: 240, h: 50, texte: "TUVOA", police: 40, graisse: 800, couleur: clair ? "#FFFFFF" : "#0A0A0A" }),
  ];
}

// ─── Modèles de départ ───────────────────────────────────────────────
export type Modele = { id: string; nom: string; description: string; doc: () => Doc };
const page = (fond: string, elements: El[]): Page => ({ id: uid(), fond, elements });

export const MODELES: Modele[] = [
  {
    id: "tete", nom: "Cartes autour de la tête", description: "Photo plein cadre, 5 cartes qui surgissent puis flottent, titre surligné.",
    doc: () => ({ format: "portrait", duree: 8, pages: [page("#0B1633", [
      nouveau.image({ nom: "Photo", anim: anim("zoom", 0, "aucune", 1.2) }),
      nouveau.forme({ nom: "Ombre du haut", x: 0, y: 0, w: 1080, h: 420, rayon: 0, fond: "lin:rgba(11,22,51,0.75),rgba(11,22,51,0),180" }),
      nouveau.forme({ nom: "Ombre du bas", x: 0, y: 750, w: 1080, h: 600, rayon: 0, fond: "lin:rgba(0,0,0,0),rgba(0,0,0,0.97),180" }),
      ...logo(),
      nouveau.carte({ role: "carte1", x: 380, y: 40, anim: anim("pop", 0.3, "flotter") }, { titre: "Deux étapes", etat: "Activée", texte: "Votre WhatsApp est protégé par un code PIN.", bouton: "Activer", icone: "bouclier", couleur: "#2563EB" }),
      nouveau.carte({ role: "carte2", x: 40, y: 190, w: 310, anim: anim("pop", 0.48, "flotter") }, { titre: "Mise à jour", etat: "Installée", texte: "Téléphone à jour : failles corrigées.", bouton: "Vérifier", icone: "maj", couleur: "#0A2A66" }),
      nouveau.carte({ role: "carte3", x: 730, y: 190, w: 310, anim: anim("pop", 0.66, "flotter") }, { titre: "Mot de passe", etat: "Fort", texte: "Long, unique, jamais partagé.", bouton: "Changer", icone: "cle", couleur: "#E94A06" }),
      nouveau.carte({ role: "carte4", x: 30, y: 470, w: 300, anim: anim("pop", 0.84, "flotter") }, { titre: "Sauvegarde", etat: "Faite", texte: "Photos et discussions à l'abri.", bouton: "Lancer", icone: "nuage", couleur: "#1D4ED8" }),
      nouveau.carte({ role: "carte5", x: 750, y: 470, w: 300, anim: anim("pop", 1.02, "flotter") }, { titre: "Lien suspect", etat: "Évité", texte: "« Vous avez gagné » ? On ne clique pas.", bouton: "Signaler", icone: "lien", couleur: "#0A0A0A" }),
      nouveau.texte({ role: "titre", x: 60, y: 900, w: 960, h: 100, texte: "Nouvelle semaine", police: 92, align: "center", anim: anim("glisser-haut", 1.2) }),
      nouveau.pastille({ role: "fort", x: 230, y: 1010, w: 620, h: 110, texte: "bons réflexes", police: 88, graisse: 800, fond: "lin:#2563EB,#6E9BFF,90", rayon: 12, marge: 6, ombre: "neon", anim: anim("pop", 1.45) }),
      nouveau.texte({ role: "sous", x: 60, y: 1150, w: 960, h: 50, texte: "Activez la vérification en deux étapes sur WhatsApp", police: 32, graisse: 600, align: "center", anim: anim("fondu", 1.7) }),
      nouveau.pastille({ role: "bouton", x: 380, y: 1225, w: 320, h: 64, texte: "Voir l'astuce", police: 30, rayon: 12, marge: 10, ombre: "neon", anim: anim("pop", 1.95, "pulser") }),
    ])] }),
  },
  {
    id: "waouh", nom: "Effet waouh", description: "Rayons qui tournent, halo, cartes néon, titre doré. Idéal en vidéo.",
    doc: () => ({ format: "portrait", duree: 8, pages: [page("rad:#FFD45A,#F2B21B,#C27210,#4A2204", [
      nouveau.rayons(),
      nouveau.forme({ nom: "Halo", forme: "cercle", x: 250, y: 150, w: 580, h: 580, fond: "rad:rgba(255,248,215,0.95),rgba(255,240,190,0.4),rgba(255,240,190,0)", anim: anim("fondu", 0, "pulser", 1) }),
      nouveau.image({ nom: "Photo", y: 320, h: 1030, anim: anim("zoom", 0, "aucune", 1.4) }),
      nouveau.forme({ nom: "Ombre du bas", x: 0, y: 750, w: 1080, h: 600, rayon: 0, fond: "lin:rgba(0,0,0,0),rgba(0,0,0,0.97),180" }),
      ...logo(),
      nouveau.carte({ role: "carte1", x: 380, y: 40, ombre: "neon", anim: anim("pop", 0.3, "flotter") }, { titre: "Samedi", etat: "Repos", texte: "Le téléphone peut souffler, vous aussi.", bouton: "Profiter", icone: "bulle" }),
      nouveau.carte({ role: "carte2", x: 40, y: 190, w: 310, rot: -3, ombre: "neon", anim: anim("pop", 0.48, "balancer") }, { titre: "À lire", etat: "4 actus", texte: "La semaine tech, au calme.", bouton: "Lire", icone: "antenne", couleur: "#0A2A66" }),
      nouveau.carte({ role: "carte3", x: 730, y: 190, w: 310, rot: 3, ombre: "neon", anim: anim("pop", 0.66, "balancer") }, { titre: "Lien suspect", etat: "Évité", texte: "« Vous avez gagné » ? Non.", bouton: "Signaler", icone: "lien", couleur: "#E94A06" }),
      nouveau.carte({ role: "carte4", x: 30, y: 470, w: 300, rot: 2, ombre: "neon", anim: anim("pop", 0.84, "flotter") }, { titre: "Messenger", etat: "Ouvert", texte: "Une question ? On répond.", bouton: "Écrire", icone: "bulle", couleur: "#1D4ED8" }),
      nouveau.carte({ role: "carte5", x: 750, y: 470, w: 300, rot: -2, ombre: "neon", anim: anim("pop", 1.02, "flotter") }, { titre: "Lundi 7h", etat: "À suivre", texte: "Une nouvelle semaine d'actu.", bouton: "Rappel", icone: "cal", couleur: "#0A0A0A" }),
      nouveau.texte({ role: "titre", x: 60, y: 900, w: 960, h: 100, texte: "Bon week-end", police: 96, align: "center", couleur: "lin:#FFFFFF,#FFE6A3,180", ombre: "forte", anim: anim("glisser-haut", 1.2) }),
      nouveau.pastille({ role: "fort", x: 180, y: 1010, w: 720, h: 110, texte: "prudents en ligne", police: 88, fond: "lin:#2563EB,#6E9BFF,90", rayon: 12, marge: 6, ombre: "neon", anim: anim("pop", 1.45) }),
      nouveau.texte({ role: "sous", x: 60, y: 1150, w: 960, h: 50, texte: "Déconnectez-vous, mais gardez les bons réflexes", police: 32, graisse: 600, align: "center", anim: anim("fondu", 1.7) }),
      nouveau.pastille({ role: "bouton", x: 370, y: 1225, w: 340, h: 64, texte: "Voir nos conseils", police: 30, rayon: 12, marge: 10, ombre: "neon", anim: anim("pop", 1.95, "pulser") }),
    ])] }),
  },
  {
    id: "semaine", nom: "Nouvelle semaine", description: "Gros titre deux couleurs, pastille, étiquettes, photo en bas, barre d'appel.",
    doc: () => ({ format: "portrait", duree: 6, pages: [page("#F5F8FF", [
      nouveau.image({ nom: "Photo", y: 600, h: 750 }),
      nouveau.forme({ nom: "Fondu clair", x: 0, y: 600, w: 1080, h: 260, rayon: 0, fond: "lin:#F5F8FF,rgba(245,248,255,0),180" }),
      ...logo(56, 52, false),
      nouveau.texte({ role: "surtitre", x: 90, y: 175, w: 900, h: 60, texte: "Bienvenue dans une", police: 48, graisse: 600, couleur: "#0A0A0A", align: "center", anim: anim("fondu", 0.1) }),
      nouveau.texte({ role: "titre", x: 40, y: 245, w: 1000, h: 110, texte: "NOUVELLE", police: 104, couleur: "#0A0A0A", align: "center", anim: anim("glisser-haut", 0.3) }),
      nouveau.texte({ role: "fort", x: 40, y: 345, w: 1000, h: 110, texte: "SEMAINE", police: 104, couleur: "#2563EB", align: "center", anim: anim("glisser-haut", 0.5) }),
      nouveau.pastille({ role: "pastille", x: 260, y: 470, w: 560, h: 84, texte: "Passionnés de tech.", anim: anim("pop", 0.8) }),
      nouveau.texte({ role: "sous", x: 60, y: 575, w: 960, h: 44, texte: "Restez informés, vite et bien, avec TUVOA.", police: 32, graisse: 600, couleur: "#0A0A0A", align: "center", anim: anim("fondu", 1) }),
      ...["IA", "Cybersécurité", "Mobile money", "Startups"].map((t, i) => nouveau.pastille({ role: `etiquette${i + 1}`, x: i < 2 ? 50 : 730, y: 680 + (i % 2) * 82, w: 300, h: 62, texte: t, police: 28, fond: ["#DCE6FF", "#2563EB", "#0A2A66", "#0A0A0A"][i], couleur: i === 0 ? "#0A2A66" : "#FFFFFF", ombre: "douce", anim: anim(i < 2 ? "glisser-droite" : "glisser-gauche", 1.2 + i * 0.12, "flotter") })),
      nouveau.forme({ nom: "Barre du bas", x: 0, y: 1150, w: 1080, h: 220, rayon: 44, fond: "#0A0A0A" }),
      nouveau.texte({ role: "barre", x: 60, y: 1225, w: 470, h: 50, texte: "Toute l'actu tech sur :", police: 34, graisse: 600, align: "right" }),
      nouveau.pastille({ role: "bouton", x: 550, y: 1210, w: 470, h: 80, texte: "warmachinertech.com", police: 34, rayon: 40, anim: anim("aucune", 0, "pulser") }),
    ])] }),
  },
  {
    id: "carrousel", nom: "Carrousel « La semaine en actus »", description: "Une couverture et une page par actu, à faire défiler.",
    doc: () => {
      const actu = (n: number, cat: string, titre: string, ic: string): Page => page("lin:#0B1633,#1D3A7A,160", [
        nouveau.image({ nom: "Photo de l'actu", x: 60, y: 160, w: 960, h: 620, rayon: 28, ombre: "forte" }),
        ...logo(60, 52),
        nouveau.texte({ nom: "Numéro", x: 860, y: 50, w: 160, h: 60, texte: `${n}/4`, police: 44, align: "right", couleur: "#6E9BFF" }),
        nouveau.icone({ x: 60, y: 830, icone: ic, w: 80, h: 80 }),
        nouveau.texte({ role: `categorie${n}`, x: 160, y: 845, w: 600, h: 50, texte: cat, police: 34, graisse: 700, couleur: "#6E9BFF", majuscules: true, espacement: 3 }),
        nouveau.texte({ role: `actu${n}`, x: 60, y: 940, w: 960, h: 260, texte: titre, police: 64, interligne: 1.08 }),
        nouveau.texte({ nom: "Glisser", x: 60, y: 1250, w: 960, h: 40, texte: n < 4 ? "Glissez pour la suite →" : "Tout lire sur warmachinertech.com", police: 28, graisse: 600, couleur: "#BFD0FF" }),
      ]);
      return { format: "portrait", duree: 6, pages: [
        page("rad:#FFFFFF,#E4ECFF,#BFD0FF", [
          nouveau.image({ nom: "Photo", x: -10, y: 430, w: 1100, h: 920, ajustement: "contain" }),
          ...logo(56, 52, false),
          nouveau.texte({ role: "titre", x: 60, y: 160, w: 960, h: 100, texte: "La semaine tech", police: 92, couleur: "#0A0A0A", align: "center" }),
          nouveau.texte({ role: "fort", x: 60, y: 262, w: 960, h: 100, texte: "en 4 actus", police: 92, couleur: "#2563EB", align: "center" }),
          nouveau.pastille({ role: "bouton", x: 330, y: 390, w: 420, h: 70, texte: "Glissez →", police: 34 }),
        ]),
        actu(1, "Télécoms", "5G en Afrique : les premiers cas d'usage", "antenne"),
        actu(2, "Mobile money", "PI-SPI : payer avec son numéro de téléphone", "argent"),
        actu(3, "CyberActu", "Europol frappe un vaste réseau criminel", "bouclier"),
        actu(4, "Robotique", "Meta prépare Max, un robot humanoïde", "robot"),
      ] };
    },
  },
  {
    id: "reel", nom: "Vidéo Reel 9:16", description: "Format vertical animé pour Reels, stories et TikTok.",
    doc: () => ({ format: "story", duree: 10, pages: [page("rad:#3B6CF0,#1D3A9E,#060B1A", [
      nouveau.rayons({ x: -410, y: -200, couleur: "rgba(200,220,255,0.25)" }),
      nouveau.image({ nom: "Photo", x: 90, y: 560, w: 900, h: 1000, rayon: 40, ombre: "forte", anim: anim("zoom", 0.2, "flotter", 1) }),
      ...logo(70, 90),
      nouveau.texte({ role: "surtitre", x: 70, y: 250, w: 940, h: 60, texte: "L'actu tech du jour", police: 44, graisse: 600, couleur: "#BFD0FF", anim: anim("fondu", 0.1) }),
      nouveau.texte({ role: "titre", x: 70, y: 320, w: 940, h: 220, texte: "Le titre qui arrête le pouce", police: 96, interligne: 1.02, anim: anim("glisser-haut", 0.3) }),
      nouveau.carte({ role: "carte1", x: 560, y: 1450, w: 440, h: 190, anim: anim("pop", 1.4, "flotter") }, { titre: "À retenir", etat: "Important", texte: "Une info clé en une phrase.", bouton: "Lire", icone: "ia" }),
      nouveau.pastille({ role: "bouton", x: 290, y: 1720, w: 500, h: 90, texte: "Suivez TUVOA", police: 40, ombre: "neon", anim: anim("pop", 2, "pulser") }),
    ])] }),
  },
  { id: "vierge", nom: "Page vierge", description: "Partir de zéro.", doc: () => ({ format: "portrait", duree: 6, pages: [page("#0B1633", [...logo()])] }) },
];
