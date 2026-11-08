"use client";
// Studio de VOA : éditeur visuel (façon Canva) pour les posts, carrousels et vidéos animées.
// Glisser-déposer, poignée de redimensionnement, double-clic pour écrire, propriétés, animations, pages, export PNG/vidéo,
// et envoi au calendrier. VOA peut réécrire tous les textes d'un modèle à partir d'un sujet.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Trait } from "@/components/BottomNav";
import { ImageField } from "@/components/ImageField";
import Voa from "@/components/Voa";
import { montserrat } from "@/lib/studio-font";
import {
  ANIM_FIXE, FORMATS, ICONES, POLICE, dessinerPage, dessinerSequence, dureeTotale, nouveau, uid,
  type Boucle, type Doc, type El, type Entree, type Format, type Genre, type Ombre, type Page,
} from "@/lib/creation";
import { GALERIE, GENRES, type Maquette } from "@/lib/modeles";
import { logo as elementsLogo } from "@/lib/creation";
import { listPosts } from "@/lib/client";

const CLE_BROUILLON = "tuvoa-studio-brouillon";
const ENTREES: [Entree, string][] = [["aucune", "Aucune"], ["fondu", "Fondu"], ["glisser-haut", "Glisse du bas"], ["glisser-bas", "Glisse du haut"], ["glisser-gauche", "Glisse de la droite"], ["glisser-droite", "Glisse de la gauche"], ["zoom", "Zoom"], ["pop", "Pop (rebond)"], ["machine", "Machine à écrire"]];
const BOUCLES: [Boucle, string][] = [["aucune", "Aucune"], ["flotter", "Flotter"], ["pulser", "Pulser"], ["balancer", "Balancer"], ["tourner", "Tourner"], ["defiler", "Défiler (bandeau)"], ["clignoter", "Clignoter"], ["trembler", "Trembler"]];
const OMBRES: [Ombre, string][] = [["aucune", "Aucune"], ["douce", "Douce"], ["forte", "Forte"], ["neon", "Néon bleu"], ["verre", "Verre"]];
const NUANCIER = ["#FFFFFF", "#0A0A0A", "#2563EB", "#6E9BFF", "#0A2A66", "#E94A06", "#F2B21B", "#DCE6FF", "#F3F4F6"];

type Glisse = { mode: "deplacer" | "redim"; id: string; x0: number; y0: number; el0: El } | null;

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T; }

// ─── Décliner dans un autre format : positions proportionnelles, tailles à l'échelle, fonds pleine page étirés ───
function decliner(d: Doc, f: Format): Doc {
  if (d.format === f) return d;
  const A = FORMATS[d.format], B = FORMATS[f];
  const sx = B.w / A.w, sy = B.h / A.h, k = Math.min(sx, sy);
  const pages = d.pages.map((p) => ({
    ...p,
    elements: p.elements.map((e) => {
      if (e.w >= A.w * 0.95 && e.h >= A.h * 0.95) return { ...e, x: e.x * sx, y: e.y * sy, w: e.w * sx, h: e.h * sy };
      const w = e.w * k, h = e.h * k;
      return {
        ...e, w, h, x: (e.x + e.w / 2) * sx - w / 2, y: (e.y + e.h / 2) * sy - h / 2,
        police: e.police ? Math.round(e.police * k) : e.police, rayon: e.rayon ? e.rayon * k : e.rayon, marge: e.marge ? e.marge * k : e.marge, epaisseur: e.epaisseur ? e.epaisseur * k : e.epaisseur,
      };
    }),
  }));
  return { ...d, format: f, pages };
}

// ─── Contrôle qualité ───
// Zone sûre : marges où les interfaces (TikTok, stories, recadrages) masquent le contenu.
const ZONE: Record<Format, { g: number; d: number; h: number; b: number }> = {
  portrait: { g: 0.05, d: 0.05, h: 0.04, b: 0.04 },
  carre: { g: 0.05, d: 0.05, h: 0.05, b: 0.05 },
  story: { g: 0.06, d: 0.12, h: 0.13, b: 0.2 },
};
function hexRgb(c?: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((c ?? "").trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((x) => x + x).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function contraste(a?: string, b?: string): number | null {
  const ca = hexRgb(a), cb = hexRgb(b);
  if (!ca || !cb) return null;
  const L = (c: number[]) => { const [r, g, bl] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [x, y] = [L(ca), L(cb)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
type Point = { ok: boolean; texte: string; el?: string; page?: number };
function controler(doc: Doc): Point[] {
  const { w: W, h: H } = FORMATS[doc.format];
  const vu = 390 / W; // taille affichée sur un téléphone de 390 px de large
  const textes = doc.pages.flatMap((p, i) => p.elements.filter((e) => e.type === "texte" && (e.texte ?? "").trim() && !(e.nom ?? "").startsWith("Logo")).map((e) => ({ e, i, p })));
  const out: Point[] = [];
  const grand = textes.reduce<{ e: El; i: number } | null>((m, t) => (!m || (t.e.police ?? 0) > (m.e.police ?? 0) ? t : m), null);
  if (grand) out.push({ ok: (grand.e.police ?? 0) * vu >= 20, texte: `Titre lisible sur téléphone : ${Math.round((grand.e.police ?? 0) * vu)} px affichés${(grand.e.police ?? 0) * vu >= 20 ? "" : ", visez 20 au moins"}`, el: grand.e.id, page: grand.i });
  const petit = textes.reduce<{ e: El; i: number } | null>((m, t) => (!m || (t.e.police ?? 99) < (m.e.police ?? 99) ? t : m), null);
  if (petit && petit !== grand) {
    const px = (petit.e.police ?? 0) * vu;
    out.push({ ok: px >= 11, texte: px >= 11 ? `Plus petit texte : ${Math.round(px)} px affichés, lisible` : `Texte trop petit sur téléphone : « ${(petit.e.texte ?? "").slice(0, 24)}… » (${Math.round(px)} px, visez 11)`, el: petit.e.id, page: petit.i });
  }
  const faibles = textes.filter(({ e, p }) => { const c = contraste(e.couleur ?? "#FFFFFF", e.fond ?? p.fond); return c !== null && c < ((e.police ?? 0) * vu >= 18 ? 3 : 4.5); });
  out.push({ ok: faibles.length === 0, texte: faibles.length ? `Contraste trop faible : « ${(faibles[0].e.texte ?? "").slice(0, 24)}… »` : "Contraste suffisant sur les fonds unis", el: faibles[0]?.e.id, page: faibles[0]?.i });
  const sansLogo = doc.pages.findIndex((p) => !p.elements.some((e) => (e.nom ?? "").startsWith("Logo") || (e.texte ?? "").trim().toUpperCase() === "TUVOA"));
  out.push({ ok: sansLogo === -1 || (doc.pages.length > 1 && sansLogo > 0), texte: sansLogo === -1 ? "Logo TUVOA présent" : sansLogo === 0 ? "Logo TUVOA absent de la première page" : "Logo TUVOA sur la couverture", page: sansLogo === 0 ? 0 : undefined });
  const z = ZONE[doc.format];
  const hors = doc.pages.flatMap((p, i) => p.elements.filter((e) => ["texte", "icone", "carte"].includes(e.type) && (e.x < W * z.g - 2 || e.y < H * z.h - 2 || e.x + e.w > W * (1 - z.d) + 2 || e.y + e.h > H * (1 - z.b) + 2)).map((e) => ({ e, i })));
  out.push({ ok: hors.length === 0, texte: hors.length ? `${hors.length} élément${hors.length > 1 ? "s" : ""} hors de la zone sûre (« ${hors[0].e.nom ?? hors[0].e.type} »)` : `Tout est dans la zone sûre${doc.format === "story" ? " de TikTok et des stories" : ""}`, el: hors[0]?.e.id, page: hors[0]?.i });
  return out;
}

export default function Studio() {
  const [doc, setDoc] = useState<Doc>(() => GALERIE.visuel[0].doc());
  const [etape, setEtape] = useState<"accueil" | "galerie" | "editeur">("accueil");
  const [genre, setGenre] = useState<Genre>("visuel");
  const [brouillon, setBrouillon] = useState<Doc | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [passe, setPasse] = useState<Doc[]>([]);
  const [futur, setFutur] = useState<Doc[]>([]);
  const [lecture, setLecture] = useState(false);
  const [edition, setEdition] = useState<string | null>(null);
  const [guide, setGuide] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const [version, setVersion] = useState(0); // redessin quand une image finit de charger
  const [policePrete, setPolicePrete] = useState(false);
  const [sujet, setSujet] = useState("");
  const [legende, setLegende] = useState("");
  const [quand, setQuand] = useState("");
  const [enVideo, setEnVideo] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [envoye, setEnvoye] = useState<string | null>(null);
  const [zone, setZone] = useState(true);
  const [actus, setActus] = useState<string[]>([]);
  useEffect(() => {
    listPosts().then((ps) => setActus(ps.filter((p) => p.rubrique === "actu" && p.status === "publie").slice(0, 8).map((p) => p.title || p.idea).filter(Boolean))).catch(() => {});
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boiteRef = useRef<HTMLDivElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const glisse = useRef<Glisse>(null);
  const [largeurVue, setLargeurVue] = useState(480);

  const { w: W, h: H } = FORMATS[doc.format];
  const page = doc.pages[Math.min(pageIdx, doc.pages.length - 1)];
  const elSel = page.elements.find((e) => e.id === sel) ?? null;
  const echelle = largeurVue / W;

  // Police TUVOA pour le canvas
  useEffect(() => {
    POLICE.famille = `${montserrat.style.fontFamily}, Montserrat, sans-serif`;
    const f = montserrat.style.fontFamily.split(",")[0].replace(/['"]/g, "");
    Promise.all([500, 600, 700, 800].map((g) => document.fonts.load(`${g} 40px "${f}"`))).finally(() => setPolicePrete(true));
  }, []);

  // Brouillon gardé dans ce navigateur
  useEffect(() => {
    try {
      const b = localStorage.getItem(CLE_BROUILLON);
      if (b) {
        const d = JSON.parse(b) as Doc;
        setBrouillon(d);
        if (new URLSearchParams(window.location.search).get("reprendre") === "1") {
          setDoc(d); setPageIdx(0); setEnVideo(d.genre === "video"); setEtape("editeur");
          const l = localStorage.getItem("tuvoa-studio-legende"); if (l) { setLegende(l); localStorage.removeItem("tuvoa-studio-legende"); }
          window.history.replaceState(null, "", "/studio");
        }
      }
    } catch { /* stockage indisponible */ }
  }, []);
  useEffect(() => { if (etape !== "editeur") return; try { localStorage.setItem(CLE_BROUILLON, JSON.stringify(doc)); } catch { /* stockage indisponible */ } }, [doc, etape]);

  // Photos des maquettes de la galerie
  const chargerImage = useCallback((src?: string) => {
    if (!src || images.current.has(src)) return;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => setVersion((v) => v + 1);
    img.src = src; images.current.set(src, img);
  }, []);
  const exemples = useMemo(() => ({ visuel: GALERIE.visuel[3].doc(), carrousel: GALERIE.carrousel[1].doc(), video: GALERIE.video[2].doc() }) as Record<Genre, Doc>, []);
  useEffect(() => { if (etape === "accueil") for (const d of Object.values(exemples)) for (const p of d.pages) for (const e of p.elements) if (e.type === "image") chargerImage(e.src); }, [etape, exemples, chargerImage]);
  const maquettes = useMemo(() => GALERIE[genre].map((m) => ({ m, d: m.doc() })), [genre]);
  useEffect(() => { if (etape === "galerie") for (const { d } of maquettes) for (const p of d.pages) for (const e of p.elements) if (e.type === "image") chargerImage(e.src); }, [etape, maquettes, chargerImage]);

  // Largeur d'affichage du canvas
  useEffect(() => {
    const maj = () => { const b = boiteRef.current; if (b) setLargeurVue(Math.min(b.clientWidth, doc.format === "story" ? 420 : 560)); };
    maj(); window.addEventListener("resize", maj); return () => window.removeEventListener("resize", maj);
  }, [doc.format]);

  // Chargement des photos (avec CORS pour pouvoir exporter)
  useEffect(() => {
    for (const p of doc.pages) for (const e of p.elements) {
      if (e.type === "image" && e.src && !images.current.has(e.src)) {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => setVersion((v) => v + 1);
        img.onerror = () => setError("Une photo n'a pas pu être chargée : importe-la depuis ton téléphone (bouton « Photo »).");
        img.src = e.src; images.current.set(e.src, img);
      }
    }
  }, [doc]);

  // Dessin (fixe, ou en lecture animée)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    if (!lecture) { dessinerPage(ctx, page, doc.format, Infinity, images.current); return; }
    let raf = 0; const t0 = performance.now();
    const total = dureeTotale(doc);
    // Vidéo en scènes : toute la séquence, avec la voix off
    const son = doc.sequence && doc.audio ? new Audio(doc.audio) : null;
    if (son) { son.loop = false; void son.play().catch(() => undefined); }
    const boucle = () => {
      const brut = (performance.now() - t0) / 1000;
      if (doc.sequence) {
        if (son && brut >= total) { son.currentTime = 0; void son.play().catch(() => undefined); }
        const t = son && !son.paused ? son.currentTime : brut % total;
        dessinerSequence(ctx, doc, Math.min(t, total), images.current);
      } else dessinerPage(ctx, page, doc.format, brut % doc.duree, images.current);
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => { cancelAnimationFrame(raf); son?.pause(); };
  }, [page, doc, lecture, version, policePrete]);

  // ─── Historique ────────────────────────────────────────────────
  const changer = useCallback((f: (d: Doc) => Doc, historique = true) => {
    setDoc((d) => { if (historique) { setPasse((p) => [...p.slice(-40), d]); setFutur([]); } return f(clone(d)); });
  }, []);
  const annuler = () => { const p = passe[passe.length - 1]; if (!p) return; setFutur((f) => [doc, ...f]); setPasse((x) => x.slice(0, -1)); setDoc(p); };
  const retablir = () => { const n = futur[0]; if (!n) return; setPasse((p) => [...p, doc]); setFutur((f) => f.slice(1)); setDoc(n); };
  const majEl = (id: string, patch: Partial<El>, historique = true) => changer((d) => { const pg = d.pages[pageIdx]; pg.elements = pg.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)); return d; }, historique);
  const majPage = (patch: Partial<Page>) => changer((d) => { d.pages[pageIdx] = { ...d.pages[pageIdx], ...patch }; return d; });

  function ajouter(el: El) {
    el.x = Math.round((W - el.w) / 2); el.y = Math.round((H - el.h) / 2);
    changer((d) => { d.pages[pageIdx].elements.push(el); return d; });
    setSel(el.id);
  }
  function supprimer() { if (!sel) return; changer((d) => { d.pages[pageIdx].elements = d.pages[pageIdx].elements.filter((e) => e.id !== sel); return d; }); setSel(null); }
  function dupliquer() { if (!elSel) return; const c = { ...clone(elSel), id: uid(), x: elSel.x + 30, y: elSel.y + 30 }; changer((d) => { d.pages[pageIdx].elements.push(c); return d; }); setSel(c.id); }
  function ordre(delta: number) {
    if (!sel) return;
    changer((d) => { const l = d.pages[pageIdx].elements; const i = l.findIndex((e) => e.id === sel); const j = Math.max(0, Math.min(l.length - 1, i + delta)); const [e] = l.splice(i, 1); l.splice(j, 0, e); return d; });
  }

  // Clavier : supprimer, flèches, annuler
  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      const cible = ev.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName) || cible.isContentEditable) return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); if (ev.shiftKey) retablir(); else annuler(); return; }
      if (!sel) return;
      if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); supprimer(); }
      const pas = ev.shiftKey ? 20 : 4;
      const d: Record<string, [number, number]> = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] };
      if (d[ev.key] && elSel) { ev.preventDefault(); majEl(sel, { x: elSel.x + d[ev.key][0], y: elSel.y + d[ev.key][1] }); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  // ─── Souris / doigt sur le canvas ──────────────────────────────
  const versDoc = (ev: React.PointerEvent) => { const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); return { x: (ev.clientX - r.left) / echelle, y: (ev.clientY - r.top) / echelle }; };
  function toucher(ev: React.PointerEvent) {
    if (lecture) return;
    const p = versDoc(ev);
    if (elSel && Math.abs(p.x - (elSel.x + elSel.w)) < 34 / echelle * 0.5 + 18 && Math.abs(p.y - (elSel.y + elSel.h)) < 34 / echelle * 0.5 + 18) {
      glisse.current = { mode: "redim", id: elSel.id, x0: p.x, y0: p.y, el0: clone(elSel) };
    } else {
      const hit = [...page.elements].reverse().find((e) => p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h && !(e.type === "rayons"));
      setSel(hit?.id ?? null);
      if (hit) glisse.current = { mode: "deplacer", id: hit.id, x0: p.x, y0: p.y, el0: clone(hit) };
    }
    if (glisse.current) { (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId); setPasse((x) => [...x.slice(-40), clone(doc)]); setFutur([]); }
  }
  function bouger(ev: React.PointerEvent) {
    const g = glisse.current; if (!g) return;
    const p = versDoc(ev); const dx = p.x - g.x0, dy = p.y - g.y0;
    if (g.mode === "deplacer") {
      let x = Math.round(g.el0.x + dx), y = Math.round(g.el0.y + dy);
      const v = Math.abs(x + g.el0.w / 2 - W / 2) < 10, h = Math.abs(y + g.el0.h / 2 - H / 2) < 10;
      if (v) x = Math.round(W / 2 - g.el0.w / 2);
      if (h) y = Math.round(H / 2 - g.el0.h / 2);
      setGuide({ v, h });
      majEl(g.id, { x, y }, false);
    } else {
      const w = Math.max(30, Math.round(g.el0.w + dx));
      const hh = ev.shiftKey || g.el0.type === "image" && false ? Math.round(w * (g.el0.h / g.el0.w)) : Math.max(20, Math.round(g.el0.h + dy));
      const patch: Partial<El> = { w, h: hh };
      if (g.el0.type === "texte" && g.el0.police && ev.altKey) patch.police = Math.round(g.el0.police * (w / g.el0.w));
      majEl(g.id, patch, false);
    }
  }
  function lacher() { glisse.current = null; setGuide({ v: false, h: false }); }

  // ─── Pages ─────────────────────────────────────────────────────
  const ajouterPage = () => { changer((d) => { const p = clone(d.pages[pageIdx]); p.id = uid(); p.elements = p.elements.map((e) => ({ ...e, id: uid() })); d.pages.splice(pageIdx + 1, 0, p); return d; }); setPageIdx(pageIdx + 1); setSel(null); };
  const supprimerPage = () => { if (doc.pages.length < 2) return; changer((d) => { d.pages.splice(pageIdx, 1); return d; }); setPageIdx(Math.max(0, pageIdx - 1)); setSel(null); };
  const deplacerPage = (delta: number) => { const j = pageIdx + delta; if (j < 0 || j >= doc.pages.length) return; changer((d) => { const [p] = d.pages.splice(pageIdx, 1); d.pages.splice(j, 0, p); return d; }); setPageIdx(j); };

  // ─── Export ────────────────────────────────────────────────────
  function rendrePage(p: Page, t = Infinity): HTMLCanvasElement {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d"); if (ctx) dessinerPage(ctx, p, doc.format, t, images.current);
    return c;
  }
  const versBlob = (c: HTMLCanvasElement, type = "image/png", q = 0.92) => new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("Export impossible : une photo vient d'un site qui bloque la copie. Importe-la depuis ton téléphone."))), type, q));
  function telecharger(b: Blob, nom: string) { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nom; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

  async function exporterPNG(toutes: boolean) {
    setBusy("png"); setError("");
    try {
      const liste = toutes ? doc.pages : [page];
      for (const [i, p] of liste.entries()) telecharger(await versBlob(rendrePage(p)), `TUVOA_${toutes ? `page${i + 1}` : `page${pageIdx + 1}`}.png`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  async function enregistrerVideo(): Promise<{ blob: Blob; ext: string }> {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d"); if (!ctx) throw new Error("Canvas indisponible.");
    const total = dureeTotale(doc);
    const dessiner = (t: number) => (doc.sequence ? dessinerSequence(ctx, doc, t, images.current) : dessinerPage(ctx, page, doc.format, t, images.current));
    const avecSon = Boolean(doc.sequence && doc.audio);
    const types = avecSon
      ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    const mime = types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    if (!mime) throw new Error("Ce navigateur ne sait pas enregistrer de vidéo. Essaie avec Chrome.");
    dessiner(0);
    const flux = c.captureStream(30);
    // Voix off mixée dans la vidéo
    let source: AudioBufferSourceNode | null = null; let ac: AudioContext | null = null;
    if (avecSon) {
      setMsg("Préparation de la voix off…");
      ac = new AudioContext();
      const tampon = await ac.decodeAudioData(await (await fetch(doc.audio as string)).arrayBuffer());
      const sortie = ac.createMediaStreamDestination();
      source = ac.createBufferSource(); source.buffer = tampon; source.connect(sortie);
      for (const piste of sortie.stream.getAudioTracks()) flux.addTrack(piste);
    }
    const rec = new MediaRecorder(flux, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const morceaux: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) morceaux.push(e.data); };
    const fini = new Promise<void>((ok) => { rec.onstop = () => ok(); });
    rec.start(200);
    source?.start();
    const t0 = performance.now();
    await new Promise<void>((ok) => {
      const pas = () => {
        const t = (performance.now() - t0) / 1000;
        dessiner(Math.min(t, total));
        setMsg(`Enregistrement de la vidéo… ${Math.min(100, Math.round((t / total) * 100))} %`);
        if (t >= total) ok(); else requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
    });
    rec.stop(); await fini; setMsg("");
    try { source?.stop(); await ac?.close(); } catch { /* déjà arrêté */ }
    const type = mime.split(";")[0];
    return { blob: new Blob(morceaux, { type }), ext: type === "video/mp4" ? "mp4" : "webm" };
  }
  async function exporterVideo() {
    setBusy("video"); setError("");
    try { const v = await enregistrerVideo(); telecharger(v.blob, `TUVOA_video.${v.ext}`); }
    catch (e) { setError((e as Error).message); } finally { setBusy(""); setMsg(""); }
  }

  // ─── VOA réécrit les textes ────────────────────────────────────
  async function rediger() {
    setBusy("rediger"); setError("");
    try {
      const elements = doc.pages.flatMap((p) => p.elements.filter((e) => (e.type === "texte" && e.role) || e.type === "carte").map((e) => ({ id: e.id, role: e.role ?? e.type, type: e.type, texte: e.texte, carte: e.carte })));
      const res = await fetch("/api/studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "textes", sujet, elements }) });
      const d = await res.json(); if (!res.ok) throw new Error(d.error || `Erreur ${res.status}`);
      changer((x) => {
        for (const p of x.pages) for (const e of p.elements) {
          const n = d.textes?.[e.id];
          if (!n) continue;
          if (e.type === "carte" && e.carte && typeof n === "object") e.carte = { ...e.carte, ...n };
          else if (typeof n === "string") e.texte = n;
        }
        return x;
      });
      if (d.legende) setLegende(d.legende);
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  // ─── Envoi au calendrier ───────────────────────────────────────
  async function envoyer() {
    setBusy("envoyer"); setError(""); setEnvoye(null);
    try {
      const urls: string[] = [];
      let video: string | undefined;
      if (enVideo) {
        const v = await enregistrerVideo();
        setMsg("Envoi de la vidéo…");
        const r = await fetch("/api/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: v.blob.type, ext: v.ext }) });
        const s = await r.json(); if (!r.ok) throw new Error(s.error || "Envoi de la vidéo impossible.");
        const up = await fetch(s.signedUrl, { method: "PUT", headers: { "Content-Type": v.blob.type }, body: v.blob });
        if (!up.ok) throw new Error(`Envoi de la vidéo impossible (${up.status}).`);
        video = s.publicUrl;
      }
      const pages = enVideo ? [page] : doc.pages;
      for (const [i, p] of pages.entries()) {
        setMsg(`Envoi de l'image ${i + 1}/${pages.length}…`);
        const f = new FormData(); f.append("file", await versBlob(rendrePage(p), "image/jpeg", 0.92), `page${i + 1}.jpg`);
        const r = await fetch("/api/upload", { method: "POST", body: f });
        const d = await r.json(); if (!r.ok) throw new Error(d.error || "Envoi de l'image impossible.");
        urls.push(d.url);
      }
      const titre = doc.titre ?? doc.pages[0].elements.find((e) => e.role === "titre")?.texte ?? "Création du Studio";
      const r = await fetch("/api/studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "creation", images: urls, video, legende, titre, quand: quand ? new Date(quand).toISOString() : undefined }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Création du post impossible.");
      setEnvoye(d.id);
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); setMsg(""); }
  }

  const ouvrir = (m: Maquette) => { setPasse([]); setFutur([]); setDoc(m.doc()); setPageIdx(0); setSel(null); setEnvoye(null); setEnVideo(m.doc().genre === "video"); setLecture(m.doc().genre === "video"); setEtape("editeur"); };
  const reprendre = () => { if (!brouillon) return; setDoc(brouillon); setPageIdx(0); setSel(null); setEnVideo(brouillon.genre === "video"); setEtape("editeur"); };
  const minis = useMemo(() => doc.pages.map((p) => p.id), [doc.pages]);
  const directions = useMemo(() => GALERIE[doc.genre ?? "visuel"].slice(0, 3).map((m) => ({ m, d: m.doc() })), [doc.genre]);

  // ─── Rendu de l'interface ──────────────────────────────────────
  const btn = (label: string, f: () => void, opts: { actif?: boolean; titre?: string; off?: boolean } = {}) => (
    <button type="button" className={`btn small ${opts.actif ? "primary" : "ghost"}`} onClick={f} disabled={opts.off || !!busy} title={opts.titre}>{label}</button>
  );
  const num = (label: string, v: number, f: (n: number) => void, step = 1) => (
    <label className="field" style={{ minWidth: 0 }}>{label}<input type="number" step={step} value={Number.isFinite(v) ? Math.round(v * 100) / 100 : 0} onChange={(e) => f(Number(e.target.value))} /></label>
  );
  const couleur = (label: string, v: string | undefined, f: (c: string) => void) => (
    <div className="stack" style={{ gap: 6 }}>
      <span className="label">{label}</span>
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        {NUANCIER.map((c) => <button key={c} type="button" aria-label={`Couleur ${c}`} onClick={() => f(c)} style={{ width: 30, height: 30, borderRadius: 8, background: c, border: v === c ? "3px solid var(--bleu)" : "1px solid #CBD5E1", cursor: "pointer" }} />)}
        <input type="text" aria-label={`${label} (code)`} value={v ?? ""} onChange={(e) => f(e.target.value)} placeholder="#2563EB ou lin:#a,#b,90" style={{ flex: 1, minWidth: 140 }} />
      </div>
    </div>
  );

  return (
    <div className={montserrat.className} style={{ display: "contents" }}>
      {etape !== "editeur" ? (
        <header className="tv-studio-haut">
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <Link href="/creer" className="tv-gris" style={{ textDecoration: "none", fontWeight: 600 }}>← Créer</Link>
            <h1 className="tv-titre" style={{ fontFamily: "var(--font-mont), sans-serif" }}>Studio</h1>
            <span style={{ fontSize: 14, color: "#33425C" }}>Visuels, carrousels et vidéos aux couleurs de TUVOA</span>
          </div>
        </header>
      ) : null}
      {etape === "accueil" ? (
        <main className="page sub wide" style={{ paddingTop: 8, maxWidth: 1100 }}>
          <div className="row" style={{ gap: 18, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <Voa humeur="parle" taille={110} />
            <div>
              <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, margin: 0 }}>Que veux-tu créer ?</h1>
              <p className="muted" style={{ margin: "6px 0 0" }}>Choisis le format : VOA te propose 10 maquettes d&apos;inspiration à personnaliser.</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
            {GENRES.map((g) => {
              const ex = exemples[g.id];
              return (
                <button key={g.id} type="button" onClick={() => { setGenre(g.id); setEtape("galerie"); }} className="card" style={{ cursor: "pointer", gap: 12, alignItems: "center", textAlign: "center", padding: 20 }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", height: 220, alignItems: "flex-end" }}>
                    {(g.id === "carrousel" ? ex.pages.slice(0, 3) : [ex.pages[0]]).map((p, i) => (
                      <div key={p.id} style={{ transform: g.id === "carrousel" ? `rotate(${(i - 1) * 6}deg) translateY(${i === 1 ? -10 : 0}px)` : undefined }}>
                        <Miniature page={p} format={ex.format} images={images.current} version={version} actif={false} onClick={() => undefined} numero={i + 1} largeur={g.id === "video" ? 124 : 150} anime={g.id === "video"} duree={ex.duree} charger={chargerImage} />
                      </div>
                    ))}
                  </div>
                  <strong style={{ fontSize: 26 }}>{g.nom}</strong>
                  <span className="muted">{g.sous}</span>
                </button>
              );
            })}
          </div>
          <Link href="/minute-cyber" className="card" style={{ flexDirection: "row", alignItems: "center", gap: 16, textDecoration: "none", color: "#fff", background: "#0A0A0A", borderColor: "#0A0A0A", padding: 18 }}>
            <span style={{ width: 64, height: 64, borderRadius: 14, background: "#E94A06", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 26, flexShrink: 0 }}>60s</span>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong style={{ fontSize: 22 }}>La minute cyber</strong>
              <span style={{ color: "#C7CBD6", fontSize: 14 }}>L&apos;assistant de la série vidéo : script, storyboard, voix off et montage automatique.</span>
            </span>
            <span className="btn small primary">Ouvrir</span>
          </Link>
          {brouillon ? <button type="button" className="btn ghost" onClick={reprendre}>Reprendre ma dernière création</button> : null}
        </main>
      ) : etape === "galerie" ? (
        <main className="page sub wide" style={{ paddingTop: 8, maxWidth: 1400 }}>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, margin: 0 }}>10 idées de {GENRES.find((g) => g.id === genre)?.nom.toLowerCase()}</h1>
              <p className="muted" style={{ margin: "4px 0 0" }}>Clique sur une maquette pour la personnaliser{genre === "video" ? " (survole-la pour voir l'animation)" : ""}. Tout est modifiable : textes, photos, couleurs, animations.</p>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {GENRES.map((g) => <button key={g.id} type="button" className={`btn small ${g.id === genre ? "primary" : "ghost"}`} onClick={() => setGenre(g.id)}>{g.nom}</button>)}
              <button type="button" className="btn small ghost" onClick={() => setEtape("accueil")}>← Retour</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${genre === "carrousel" ? 300 : 210}px, 1fr))`, gap: 18 }}>
            {maquettes.map(({ m, d }) => (
              <button key={m.id} type="button" onClick={() => ouvrir(m)} className="card" style={{ cursor: "pointer", gap: 10, textAlign: "left", padding: 12 }}>
                <div style={{ display: "flex", gap: 4, overflow: "hidden", borderRadius: 10 }}>
                  {(genre === "carrousel" ? d.pages.slice(0, 3) : [d.pages[0]]).map((p, i) => (
                    <Miniature key={p.id} page={p} format={d.format} images={images.current} version={version} actif={false} onClick={() => undefined} numero={i + 1} largeur={genre === "carrousel" ? 92 : 186} anime={genre === "video"} survol duree={d.duree} charger={chargerImage} />
                  ))}
                </div>
                <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                  <strong style={{ fontSize: 16 }}>{m.nom}</strong>
                  {genre === "carrousel" ? <span className="badge">{d.pages.length} pages</span> : genre === "video" ? <span className="badge bleu">{d.duree} s</span> : null}
                </div>
                <span className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>{m.idee}</span>
              </button>
            ))}
          </div>
        </main>
      ) : (
      <main className="tv-studio-scene">
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {msg ? <p className="notice" role="status">{msg}</p> : null}

        {/* Barre du haut */}
        <div className="tv-studio-barre">
          <button type="button" className="tv-verre-btn" aria-label="Revenir à l'accueil du Studio" onClick={() => setEtape("accueil")}><Trait d="M15 18l-6-6 6-6" size={20} stroke={2.2} /></button>
          <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="tv-kicker" style={{ color: "#FFB48A", letterSpacing: 2 }}>STUDIO · {(GENRES.find((g) => g.id === (doc.genre ?? "visuel"))?.nom ?? "Création").toUpperCase()}</span>
            <label><span className="sr-only">Nom de la création</span><input className="tv-studio-titre" value={doc.titre ?? ""} placeholder="Sans titre" onChange={(e) => changer((d) => ({ ...d, titre: e.target.value }), false)} /></label>
          </div>
          <div role="radiogroup" aria-label="Format" className="tv-studio-formats">
            {(Object.keys(FORMATS) as Format[]).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={doc.format === f} onClick={() => { changer((d) => decliner(d, f)); setSel(null); }}>{f === "portrait" ? "4:5" : f === "carre" ? "1:1" : "9:16"}</button>
            ))}
          </div>
          <button type="button" className="tv-verre-btn" aria-label="Annuler" title="Ctrl+Z" disabled={!passe.length} onClick={annuler}><Trait d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" size={18} stroke={2} /></button>
          <button type="button" className="tv-verre-btn" aria-label="Rétablir" title="Ctrl+Maj+Z" disabled={!futur.length} onClick={retablir}><Trait d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" size={18} stroke={2} /></button>
          <button type="button" className="tv-verre-btn" aria-label={lecture ? "Arrêter la lecture" : "Lire l'animation"} aria-pressed={lecture} onClick={() => setLecture(!lecture)}><Trait d={lecture ? "M6 4h4v16H6zM14 4h4v16h-4z" : "M7 4l13 8-13 8z"} size={18} stroke={2} /></button>
          <a href="#exporter" className="tv-studio-publier"><Trait d="M3 5h18v16H3zM16 3v4M8 3v4M3 10h18" size={16} stroke={2} />PUBLIER</a>
        </div>

        <div className="tv-studio-grille">
          {/* Gauche : directions et briques */}
          <aside className="tv-studio-gauche">
            <section className="tv-studio-panneau" aria-labelledby="t-directions">
              <div className="row" style={{ gap: 10 }}><Voa humeur={busy === "rediger" ? "parle" : "veille"} taille={40} /><span style={{ display: "flex", flexDirection: "column" }}><h2 id="t-directions" className="tv-studio-h2">Trois directions</h2><span className="tv-studio-gris">d&apos;autres styles pour ce format</span></span></div>
              {directions.map(({ m, d }) => (
                <button key={m.id} type="button" className="tv-direction" onClick={() => { if (window.confirm(`Passer au style « ${m.nom} » ? Vos modifications actuelles seront remplacées (« Annuler » reste possible).`)) { changer(() => m.doc()); setPageIdx(0); setSel(null); } }}>
                  <Miniature page={d.pages[0]} format={d.format} images={images.current} version={version} actif={false} onClick={() => undefined} numero={1} largeur={58} charger={chargerImage} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, textAlign: "left" }}><strong style={{ fontSize: 13 }}>{m.nom}</strong><span className="tv-studio-gris" style={{ fontSize: 11 }}>{m.idee}</span></span>
                </button>
              ))}
              <button type="button" className="tv-studio-pointille" onClick={() => { setGenre(doc.genre ?? "visuel"); setEtape("galerie"); }}>Voir les 10 styles</button>
            </section>
            <section className="tv-studio-panneau" aria-labelledby="t-briques">
              <h2 id="t-briques" className="tv-studio-h2">Briques</h2>
              <span className="tv-studio-gris">Ajoutées sur la page en cours, aux couleurs de la charte.</span>
              <div className="tv-briques">
                {([["Texte", "M4 7V4h16v3M9 20h6M12 4v16", () => ajouter(nouveau.texte())], ["Pastille", "M4 8h16v8H4z", () => ajouter(nouveau.pastille())], ["Photo", "M3 5h18v14H3zM8 11a2 2 0 1 0 0-.01M21 15l-5-5L5 19", () => ajouter(nouveau.image({ w: 600, h: 750, rayon: 24 }))], ["Forme", "M12 3l9 16H3z", () => ajouter(nouveau.forme())], ["Carte", "M3 6h18v12H3zM7 10h6M7 14h10", () => ajouter(nouveau.carte())], ["Icône", "M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z", () => ajouter(nouveau.icone())], ["Rayons", "M12 2v20M2 12h20M5 5l14 14M19 5L5 19", () => { const r = nouveau.rayons(); changer((d) => { d.pages[pageIdx].elements.unshift(r); return d; }); }], ["Logo", "M12 3l8 4.5v9L12 21l-8-4.5v-9z", () => { const els = elementsLogo(Math.round(FORMATS[doc.format].w * ZONE[doc.format].g) + 8, Math.round(FORMATS[doc.format].h * ZONE[doc.format].h) + 8, true); changer((d) => { d.pages[pageIdx].elements.push(...els); return d; }); }]] as const).map(([l, d, f]) => (
                  <button key={l} type="button" onClick={f}><Trait d={d} size={20} />{l}</button>
                ))}
              </div>
            </section>
          </aside>

          {/* Centre : la scène */}
          <div ref={boiteRef} className="tv-studio-centre">
            <div style={{ position: "relative", width: largeurVue, height: H * echelle, boxShadow: "0 30px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08)", touchAction: "none", userSelect: "none" }}
              onPointerDown={toucher} onPointerMove={bouger} onPointerUp={lacher} onPointerCancel={lacher}
              onDoubleClick={() => { if (elSel && elSel.type === "texte") setEdition(elSel.id); }}>
              <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", height: "100%", display: "block" }} aria-label="Création en cours" />
              {guide.v ? <div style={{ position: "absolute", left: largeurVue / 2, top: 0, bottom: 0, width: 1, background: "#E94A06" }} /> : null}
              {guide.h ? <div style={{ position: "absolute", top: (H * echelle) / 2, left: 0, right: 0, height: 1, background: "#E94A06" }} /> : null}
              {zone && !lecture ? <div aria-hidden="true" style={{ position: "absolute", left: `${ZONE[doc.format].g * 100}%`, right: `${ZONE[doc.format].d * 100}%`, top: `${ZONE[doc.format].h * 100}%`, bottom: `${ZONE[doc.format].b * 100}%`, border: "1.5px dashed rgba(255,180,138,0.75)", borderRadius: 4, pointerEvents: "none" }} /> : null}
              {elSel && !lecture ? (
                <div style={{ position: "absolute", left: elSel.x * echelle, top: elSel.y * echelle, width: elSel.w * echelle, height: elSel.h * echelle, border: "2px solid #60A5FA", pointerEvents: "none" }}>
                  <div style={{ position: "absolute", right: -9, bottom: -9, width: 18, height: 18, background: "#FFFFFF", border: "2px solid #2563EB", borderRadius: 4 }} />
                </div>
              ) : null}
              {edition && elSel && elSel.id === edition ? (
                <textarea autoFocus defaultValue={elSel.texte} onBlur={(e) => { majEl(elSel.id, { texte: e.target.value }); setEdition(null); }} onPointerDown={(e) => e.stopPropagation()}
                  style={{ position: "absolute", left: elSel.x * echelle, top: elSel.y * echelle, width: Math.max(120, elSel.w * echelle), minHeight: Math.max(40, elSel.h * echelle), fontSize: Math.max(12, (elSel.police ?? 40) * echelle), fontWeight: elSel.graisse ?? 800, fontFamily: POLICE.famille, lineHeight: elSel.interligne ?? 1.1, textAlign: elSel.align ?? "left", background: "rgba(255,255,255,.92)", color: "#0A0A0A", border: "2px solid #2563EB", padding: 4, resize: "both" }} />
              ) : null}
            </div>
            <div className="row" style={{ gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <label className="row tv-studio-gris" style={{ gap: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <input type="checkbox" checked={zone} onChange={(e) => setZone(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#E94A06" }} />
                Zone sûre
              </label>
              <span className="tv-studio-gris" style={{ fontSize: 12 }}>Glisser pour déplacer · poignée pour redimensionner · double-clic pour écrire</span>
            </div>
            <div className="tv-pellicule" aria-label="Pages">
              {minis.map((id, i) => <Miniature key={id} page={doc.pages[i]} format={doc.format} images={images.current} version={version} actif={i === pageIdx} onClick={() => { setPageIdx(i); setSel(null); }} numero={i + 1} largeur={64} />)}
              <button type="button" className="tv-pellicule-plus" aria-label="Ajouter une page (copie de la page en cours)" onClick={ajouterPage}>+</button>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="tv-verre-btn petit" aria-label="Déplacer la page vers la gauche" onClick={() => deplacerPage(-1)}><Trait d="M15 18l-6-6 6-6" size={14} stroke={2.2} /></button>
              <span className="tv-studio-gris" style={{ fontSize: 12 }}>Page {pageIdx + 1} / {doc.pages.length}</span>
              <button type="button" className="tv-verre-btn petit" aria-label="Déplacer la page vers la droite" onClick={() => deplacerPage(1)}><Trait d="M9 18l6-6-6-6" size={14} stroke={2.2} /></button>
              <button type="button" className="tv-verre-btn petit" aria-label="Supprimer la page" disabled={doc.pages.length < 2} onClick={supprimerPage}><Trait d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" size={14} stroke={2} /></button>
            </div>
          </div>

          {/* Droite : rendu dans le fil, lisibilité, propriétés, export */}
          <aside className="tv-studio-droite">
            <section className="tv-carte-side" aria-labelledby="t-fil">
              <div className="row" style={{ alignItems: "baseline" }}><h2 id="t-fil" className="tv-h2" style={{ fontSize: 16, flex: 1 }}>Dans le fil Facebook</h2><span className="tv-gris" style={{ fontSize: 11 }}>téléphone</span></div>
              <div className="tv-telephone">
                <div className="ecran">
                  <span className="barre" />
                  <span className="post-fantome" />
                  <div className="post">
                    <span className="row" style={{ gap: 6, padding: 6 }}><span style={{ width: 16, height: 16, borderRadius: 8, background: "#0A2A66" }} /><span style={{ fontSize: 9, fontWeight: 700 }}>TUVOA Tech Media</span></span>
                    <span style={{ display: "block", padding: "0 6px 6px", fontSize: 8, lineHeight: 1.35, color: "#050505" }}>{(legende || "Le texte du post apparaît ici.").slice(0, 70)}{legende.length > 70 ? "… " : " "}<span style={{ color: "#65676B" }}>Voir plus</span></span>
                    <Miniature page={page} format={doc.format} images={images.current} version={version} actif={false} onClick={() => undefined} numero={pageIdx + 1} largeur={168} />
                  </div>
                  <span className="post-fantome" />
                </div>
              </div>
            </section>
            {(() => {
              const pts = controler(doc);
              const bons = pts.filter((x) => x.ok).length;
              const note = Math.round((bons / Math.max(1, pts.length)) * 100);
              return (
                <section className="tv-carte-side" aria-labelledby="t-qualite">
                  <div className="row" style={{ gap: 12 }}>
                    <span role="img" aria-label={`Note de lisibilité ${note} sur 100`} className="tv-note" style={{ background: `conic-gradient(${note >= 80 ? "#22C55E" : "#E94A06"} 0 ${note}%, #EDF1F7 ${note}% 100%)` }}><span>{note}</span></span>
                    <span style={{ display: "flex", flexDirection: "column" }}><h2 id="t-qualite" className="tv-h2" style={{ fontSize: 16 }}>Note de lisibilité</h2><span className="tv-gris" style={{ fontSize: 12 }}>sur téléphone, dans le fil</span></span>
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {pts.map((x) => (
                      <li key={x.texte} className="row" style={{ gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.4 }}>
                        <span style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: x.ok ? "#16A34A" : "#E94A06" }}><Trait d={x.ok ? "M20 6L9 17l-5-5" : "M12 8v5M12 17h.01"} size={11} stroke={3.2} /></span>
                        {!x.ok && (x.el || x.page !== undefined) ? (
                          <button type="button" className="btn link" style={{ fontSize: 13, color: "#9A3412", fontWeight: 600, textAlign: "left", padding: 0, minHeight: 0 }} onClick={() => { if (x.page !== undefined) setPageIdx(x.page); setSel(x.el ?? null); }}>{x.texte}</button>
                        ) : <span style={{ color: x.ok ? "#33425C" : "#9A3412", fontWeight: x.ok ? 400 : 600 }}>{x.texte}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })()}
            <section className="tv-carte-side" aria-labelledby="t-charte">
              <h2 id="t-charte" className="tv-h2" style={{ fontSize: 16 }}>Charte TUVOA</h2>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {([["#0A2A66", "Nuit"], ["#2563EB", "Bleu"], ["#6E9BFF", "Bleu clair"], ["#E94A06", "Orange"], ["#F2EFE8", "Crème"], ["#FFFFFF", "Blanc"]] as const).map(([c, n]) => (
                  <button key={c} type="button" title={elSel ? `Appliquer ${n}` : n} aria-label={elSel ? `Appliquer la couleur ${n} à l'élément` : `Couleur ${n}`} disabled={!elSel}
                    onClick={() => elSel && majEl(elSel.id, elSel.type === "texte" || elSel.type === "icone" || elSel.type === "rayons" ? { couleur: c } : { fond: c })}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 10, color: "#5B6B86", background: "none", border: 0, padding: 0, cursor: elSel ? "pointer" : "default" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: c, border: "1px solid #E3E9F3" }} />{n}
                  </button>
                ))}
              </div>
              <span className="tv-gris" style={{ fontSize: 12 }}>Montserrat pour les titres, Inter pour les textes. {elSel ? "Cliquez une couleur pour l'appliquer à l'élément choisi." : "Choisissez un élément pour lui appliquer une couleur."}</span>
              <button type="button" className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => { const els = elementsLogo(Math.round(FORMATS[doc.format].w * ZONE[doc.format].g) + 8, Math.round(FORMATS[doc.format].h * ZONE[doc.format].h) + 8, true); changer((d) => { d.pages[pageIdx].elements.push(...els); return d; }); }}>Ajouter le logo TUVOA</button>
            </section>
            {elSel ? (
              <section className="card" style={{ gap: 10 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <p className="section-title">{elSel.nom ?? elSel.type}</p>
                  <div className="row" style={{ gap: 4 }}>{btn("Devant", () => ordre(1))}{btn("Derrière", () => ordre(-1))}{btn("Dupliquer", dupliquer)}{btn("Supprimer", supprimer)}</div>
                </div>
                <div className="grid2">{num("X", elSel.x, (v) => majEl(elSel.id, { x: v }))}{num("Y", elSel.y, (v) => majEl(elSel.id, { y: v }))}{num("Largeur", elSel.w, (v) => majEl(elSel.id, { w: v }))}{num("Hauteur", elSel.h, (v) => majEl(elSel.id, { h: v }))}{num("Rotation (°)", elSel.rot, (v) => majEl(elSel.id, { rot: v }))}{num("Opacité (0-1)", elSel.opacite, (v) => majEl(elSel.id, { opacite: Math.max(0, Math.min(1, v)) }), 0.05)}</div>

                {elSel.type === "texte" ? (
                  <>
                    <label className="field">Texte<textarea rows={3} value={elSel.texte ?? ""} onChange={(e) => majEl(elSel.id, { texte: e.target.value })} /></label>
                    <div className="grid2">
                      {num("Taille", elSel.police ?? 60, (v) => majEl(elSel.id, { police: v }))}
                      <label className="field">Graisse<select value={elSel.graisse ?? 800} onChange={(e) => majEl(elSel.id, { graisse: Number(e.target.value) as El["graisse"] })}><option value={500}>Normal</option><option value={600}>Demi-gras</option><option value={700}>Gras</option><option value={800}>Extra-gras</option></select></label>
                      <label className="field">Alignement<select value={elSel.align ?? "left"} onChange={(e) => majEl(elSel.id, { align: e.target.value as El["align"] })}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></label>
                      {num("Interligne", elSel.interligne ?? 1.1, (v) => majEl(elSel.id, { interligne: v }), 0.05)}
                      {num("Espacement", elSel.espacement ?? 0, (v) => majEl(elSel.id, { espacement: v }))}
                      <label className="field">Majuscules<select value={elSel.majuscules ? "1" : "0"} onChange={(e) => majEl(elSel.id, { majuscules: e.target.value === "1" })}><option value="0">Non</option><option value="1">Oui</option></select></label>
                    </div>
                    {couleur("Couleur du texte", elSel.couleur, (c) => majEl(elSel.id, { couleur: c }))}
                    {couleur("Fond (pastille)", elSel.fond, (c) => majEl(elSel.id, { fond: c || undefined }))}
                    <div className="grid2">{num("Arrondi", elSel.rayon ?? 0, (v) => majEl(elSel.id, { rayon: v }))}{num("Marge", elSel.marge ?? 0, (v) => majEl(elSel.id, { marge: v }))}</div>
                  </>
                ) : null}

                {elSel.type === "image" ? (
                  <>
                    <ImageField label="Photo" hint="Importe-la depuis ton téléphone pour pouvoir exporter." value={elSel.src ?? ""} onChange={(v) => majEl(elSel.id, { src: v })} />
                    <div className="grid2">
                      <label className="field">Cadrage<select value={elSel.ajustement ?? "cover"} onChange={(e) => majEl(elSel.id, { ajustement: e.target.value as El["ajustement"] })}><option value="cover">Remplir</option><option value="contain">Entière</option></select></label>
                      {num("Arrondi", elSel.rayon ?? 0, (v) => majEl(elSel.id, { rayon: v }))}
                    </div>
                  </>
                ) : null}

                {elSel.type === "forme" || elSel.type === "icone" ? (
                  <>
                    {elSel.type === "forme" ? <label className="field">Forme<select value={elSel.forme ?? "rect"} onChange={(e) => majEl(elSel.id, { forme: e.target.value as El["forme"] })}><option value="rect">Rectangle</option><option value="cercle">Cercle</option></select></label> : null}
                    {elSel.type === "icone" ? <label className="field">Icône<select value={elSel.icone ?? "ia"} onChange={(e) => majEl(elSel.id, { icone: e.target.value })}>{Object.entries(ICONES).map(([k, v]) => <option key={k} value={k}>{v.nom}</option>)}</select></label> : null}
                    {couleur("Fond", elSel.fond, (c) => majEl(elSel.id, { fond: c }))}
                    {elSel.type === "icone" ? couleur("Couleur de l'icône", elSel.couleur, (c) => majEl(elSel.id, { couleur: c })) : null}
                    {num("Arrondi", elSel.rayon ?? 0, (v) => majEl(elSel.id, { rayon: v }))}
                  </>
                ) : null}

                {elSel.type === "rayons" ? couleur("Couleur des rayons", elSel.couleur, (c) => majEl(elSel.id, { couleur: c })) : null}

                {elSel.type === "carte" && elSel.carte ? (
                  <>
                    <div className="grid2">
                      <label className="field">Titre<input type="text" value={elSel.carte.titre} onChange={(e) => majEl(elSel.id, { carte: { ...elSel.carte!, titre: e.target.value } })} /></label>
                      <label className="field">État<input type="text" value={elSel.carte.etat} onChange={(e) => majEl(elSel.id, { carte: { ...elSel.carte!, etat: e.target.value } })} /></label>
                    </div>
                    <label className="field">Texte<input type="text" value={elSel.carte.texte} onChange={(e) => majEl(elSel.id, { carte: { ...elSel.carte!, texte: e.target.value } })} /></label>
                    <div className="grid2">
                      <label className="field">Bouton<input type="text" value={elSel.carte.bouton} onChange={(e) => majEl(elSel.id, { carte: { ...elSel.carte!, bouton: e.target.value } })} /></label>
                      <label className="field">Icône<select value={elSel.carte.icone} onChange={(e) => majEl(elSel.id, { carte: { ...elSel.carte!, icone: e.target.value } })}>{Object.entries(ICONES).map(([k, v]) => <option key={k} value={k}>{v.nom}</option>)}</select></label>
                    </div>
                    {couleur("Couleur de l'icône", elSel.carte.couleur, (c) => majEl(elSel.id, { carte: { ...elSel.carte!, couleur: c } }))}
                  </>
                ) : null}

                <label className="field">Ombre / lueur<select value={elSel.ombre ?? "aucune"} onChange={(e) => majEl(elSel.id, { ombre: e.target.value as Ombre })}>{OMBRES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>

                <p className="label" style={{ marginTop: 6 }}>Animation (vidéo)</p>
                <div className="grid2">
                  <label className="field">Entrée<select value={elSel.anim.entree} onChange={(e) => majEl(elSel.id, { anim: { ...elSel.anim, entree: e.target.value as Entree } })}>{ENTREES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  <label className="field">En boucle<select value={elSel.anim.boucle} onChange={(e) => majEl(elSel.id, { anim: { ...elSel.anim, boucle: e.target.value as Boucle } })}>{BOUCLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  {num("Départ (s)", elSel.anim.delai, (v) => majEl(elSel.id, { anim: { ...elSel.anim, delai: Math.max(0, v) } }), 0.1)}
                  {num("Durée (s)", elSel.anim.duree, (v) => majEl(elSel.id, { anim: { ...elSel.anim, duree: Math.max(0.1, v) } }), 0.1)}
                </div>
                {btn("Retirer l'animation", () => majEl(elSel.id, { anim: { ...ANIM_FIXE } }))}
              </section>
            ) : (
              <section className="card" style={{ gap: 10 }}>
                <p className="section-title">Page {pageIdx + 1}</p>
                <label className="field">Format<select value={doc.format} onChange={(e) => changer((d) => ({ ...d, format: e.target.value as Format }))}>{Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v.nom} ({v.w} × {v.h})</option>)}</select></label>
                {couleur("Fond de la page", page.fond, (c) => majPage({ fond: c }))}
                <p className="muted" style={{ fontSize: 13 }}>Dégradés : « lin:#0B1633,#2563EB,160 » (linéaire) ou « rad:#FFD45A,#F2B21B,#4A2204 » (radial).</p>
                {doc.sequence ? (
                  <>
                    {num("Durée de cette scène (s)", page.duree ?? doc.duree, (v) => majPage({ duree: Math.max(1, Math.min(30, v)) }), 0.1)}
                    <p className="muted" style={{ fontSize: 13 }}>Vidéo en {doc.pages.length} scènes · {Math.round(dureeTotale(doc))} s au total{doc.audio ? " · avec voix off" : ""}. « Lecture » joue toute la séquence.</p>
                  </>
                ) : num("Durée de la vidéo (s)", doc.duree, (v) => changer((d) => ({ ...d, duree: Math.max(2, Math.min(60, v)) })), 1)}
                <p className="muted" style={{ fontSize: 13 }}>Clique sur un élément du visuel pour le modifier.</p>
              </section>
            )}

            <section className="card" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 12, alignItems: "center" }}>
                <Voa humeur={busy === "rediger" ? "parle" : envoye ? "fete" : "veille"} taille={56} decor />
                <p className="section-title" style={{ flex: 1 }}>VOA écrit les textes</p>
              </div>
              <label className="field">Sujet ou occasion<input type="text" value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Ex. bon week-end et prudence en ligne" /></label>
              {actus.length ? (
                <label className="field">Ou partir d'une actu publiée
                  <select value="" onChange={(e) => e.target.value && setSujet(e.target.value)}>
                    <option value="">Choisir une actu…</option>
                    {actus.map((t) => <option key={t} value={t}>{t.length > 80 ? `${t.slice(0, 79)}…` : t}</option>)}
                  </select>
                </label>
              ) : null}
              <button type="button" className="btn primary" disabled={!!busy} onClick={rediger}>{busy === "rediger" ? "VOA écrit…" : "Réécrire tous les textes avec VOA"}</button>
            </section>

            <section id="exporter" className="card" style={{ gap: 10, scrollMarginTop: 16 }}>
              <p className="section-title">Exporter et publier</p>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {btn(busy === "png" ? "…" : "PNG de la page", () => exporterPNG(false))}
                {doc.pages.length > 1 ? btn("PNG de toutes les pages", () => exporterPNG(true)) : null}
                {btn(busy === "video" ? "Enregistrement…" : `Vidéo (${Math.round(dureeTotale(doc))} s)`, exporterVideo)}
              </div>
              <label className="field">Texte du post<textarea rows={4} value={legende} onChange={(e) => setLegende(e.target.value)} placeholder="VOA le propose quand elle réécrit les textes." /></label>
              <div className="grid2">
                <label className="field">Publier en<select value={enVideo ? "video" : "image"} onChange={(e) => setEnVideo(e.target.value === "video")}><option value="image">{doc.pages.length > 1 ? `Carrousel (${doc.pages.length} images)` : "Image"}</option><option value="video">Vidéo animée</option></select></label>
                <label className="field">Programmer (facultatif)<input type="datetime-local" value={quand} onChange={(e) => setQuand(e.target.value)} /></label>
              </div>
              <button type="button" className="btn primary" disabled={!!busy} onClick={envoyer}>{busy === "envoyer" ? "Envoi…" : quand ? "Programmer sur Facebook" : "Envoyer au calendrier (à valider)"}</button>
              {envoye ? <p className="notice vert">C&apos;est dans le calendrier. <Link href={`/editeur?id=${envoye}`}>Ouvrir le post</Link></p> : null}
            </section>
          </aside>
        </div>
        {doc.genre === "video" || doc.sequence ? (
          <section className="tv-studio-panneau" aria-labelledby="t-video" style={{ marginTop: 16 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="tv-studio-lire" aria-label={lecture ? "Arrêter" : "Lire"} onClick={() => setLecture(!lecture)}><Trait d={lecture ? "M6 4h4v16H6zM14 4h4v16h-4z" : "M7 4l13 8-13 8z"} size={16} stroke={2} /></button>
              <h2 id="t-video" className="tv-studio-h2" style={{ flex: 1 }}>En vidéo · {Math.round(dureeTotale(doc) * 10) / 10} s{doc.audio ? " · avec voix off" : ""}</h2>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <span className="tv-studio-gris" style={{ width: 64, fontSize: 11, fontWeight: 700 }}>{doc.sequence ? "Scènes" : "Page"}</span>
              <div className="tv-piste">
                {(doc.sequence ? doc.pages : [page]).map((p, i) => (
                  <button key={p.id} type="button" aria-pressed={doc.sequence ? i === pageIdx : true} onClick={() => { if (doc.sequence) { setPageIdx(i); setSel(null); } }} style={{ flex: `${doc.sequence ? p.duree ?? doc.duree : doc.duree} 1 0` }}>
                    {doc.sequence ? `${i + 1}` : "Animation"}<span>{Math.round((doc.sequence ? p.duree ?? doc.duree : doc.duree) * 10) / 10} s</span>
                  </button>
                ))}
              </div>
            </div>
            {doc.audio ? (
              <div className="row" style={{ gap: 10 }}>
                <span className="tv-studio-gris" style={{ width: 64, fontSize: 11, fontWeight: 700 }}>Voix off</span>
                <audio src={doc.audio} controls style={{ flex: 1, height: 34 }} />
              </div>
            ) : null}
            <span className="tv-studio-gris" style={{ fontSize: 12 }}>Chaque page est une scène ; réglez la durée de la scène choisie dans le panneau de droite.</span>
          </section>
        ) : null}
      </main>
      )}
    </div>
  );
}

function Miniature({ page, format, images, version, actif, onClick, numero, largeur = 110, anime = false, survol = false, duree = 8, charger }: { page: Page; format: Format; images: Map<string, HTMLImageElement>; version: number; actif: boolean; onClick: () => void; numero: number; largeur?: number; anime?: boolean; survol?: boolean; duree?: number; charger?: (src?: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dessus, setDessus] = useState(false);
  const { w, h } = FORMATS[format];
  useEffect(() => { if (charger) for (const e of page.elements) if (e.type === "image") charger(e.src); }, [page, charger]);
  useEffect(() => {
    const c = ref.current; const ctx = c?.getContext("2d"); if (!c || !ctx) return;
    const peindre = (t: number) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.scale(c.width / w, c.height / h); dessinerPage(ctx, page, format, t, images); };
    const joue = anime && (!survol || dessus);
    if (!joue) { peindre(Infinity); return; }
    let raf = 0; const t0 = performance.now();
    const boucle = () => { peindre(((performance.now() - t0) / 1000) % duree); raf = requestAnimationFrame(boucle); };
    raf = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(raf);
  }, [page, format, images, version, w, h, anime, survol, dessus, duree]);
  const largeurPx = Math.round(largeur * 2);
  return (
    <span role="button" tabIndex={-1} onClick={onClick} onMouseEnter={() => setDessus(true)} onMouseLeave={() => setDessus(false)} aria-label={`Page ${numero}`} aria-current={actif ? "true" : undefined}
      style={{ display: "block", padding: 0, border: actif ? "3px solid var(--bleu)" : "1px solid #CBD5E1", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#fff", width: largeur, flexShrink: 0 }}>
      <canvas ref={ref} width={largeurPx} height={Math.round((largeurPx * h) / w)} style={{ width: "100%", display: "block" }} />
    </span>
  );
}
