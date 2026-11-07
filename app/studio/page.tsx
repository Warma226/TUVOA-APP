"use client";
// Studio de VOA : éditeur visuel (façon Canva) pour les posts, carrousels et vidéos animées.
// Glisser-déposer, poignée de redimensionnement, double-clic pour écrire, propriétés, animations, pages, export PNG/vidéo,
// et envoi au calendrier. VOA peut réécrire tous les textes d'un modèle à partir d'un sujet.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/BottomNav";
import { ImageField } from "@/components/ImageField";
import Voa from "@/components/Voa";
import { montserrat } from "@/lib/studio-font";
import {
  ANIM_FIXE, FORMATS, ICONES, POLICE, dessinerPage, dessinerSequence, dureeTotale, nouveau, uid,
  type Boucle, type Doc, type El, type Entree, type Format, type Genre, type Ombre, type Page,
} from "@/lib/creation";
import { GALERIE, GENRES, type Maquette } from "@/lib/modeles";

const CLE_BROUILLON = "tuvoa-studio-brouillon";
const ENTREES: [Entree, string][] = [["aucune", "Aucune"], ["fondu", "Fondu"], ["glisser-haut", "Glisse du bas"], ["glisser-bas", "Glisse du haut"], ["glisser-gauche", "Glisse de la droite"], ["glisser-droite", "Glisse de la gauche"], ["zoom", "Zoom"], ["pop", "Pop (rebond)"], ["machine", "Machine à écrire"]];
const BOUCLES: [Boucle, string][] = [["aucune", "Aucune"], ["flotter", "Flotter"], ["pulser", "Pulser"], ["balancer", "Balancer"], ["tourner", "Tourner"], ["defiler", "Défiler (bandeau)"], ["clignoter", "Clignoter"], ["trembler", "Trembler"]];
const OMBRES: [Ombre, string][] = [["aucune", "Aucune"], ["douce", "Douce"], ["forte", "Forte"], ["neon", "Néon bleu"], ["verre", "Verre"]];
const NUANCIER = ["#FFFFFF", "#0A0A0A", "#2563EB", "#6E9BFF", "#0A2A66", "#E94A06", "#F2B21B", "#DCE6FF", "#F3F4F6"];

type Glisse = { mode: "deplacer" | "redim"; id: string; x0: number; y0: number; el0: El } | null;

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T; }

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
      <TopBar title="Studio de VOA" back="/communaute" wide />
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
      <main className="page sub wide" style={{ paddingTop: 4, maxWidth: 1400 }}>
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {msg ? <p className="notice" role="status">{msg}</p> : null}

        {/* Barre d'outils */}
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {btn("← Nouveau", () => setEtape("accueil"))}
          {btn("Changer de maquette", () => { setGenre(doc.genre ?? "visuel"); setEtape("galerie"); }, { actif: true })}
          {btn("+ Texte", () => ajouter(nouveau.texte()))}
          {btn("+ Pastille", () => ajouter(nouveau.pastille()))}
          {btn("+ Photo", () => ajouter(nouveau.image({ w: 600, h: 750, rayon: 24 })))}
          {btn("+ Forme", () => ajouter(nouveau.forme()))}
          {btn("+ Carte", () => ajouter(nouveau.carte()))}
          {btn("+ Icône", () => ajouter(nouveau.icone()))}
          {btn("+ Rayons", () => { const r = nouveau.rayons(); changer((d) => { d.pages[pageIdx].elements.unshift(r); return d; }); })}
          <span style={{ flex: 1 }} />
          {btn("Annuler", annuler, { off: !passe.length, titre: "Ctrl+Z" })}
          {btn("Rétablir", retablir, { off: !futur.length, titre: "Ctrl+Maj+Z" })}
          {btn(lecture ? "■ Arrêter" : "▶ Lecture", () => setLecture(!lecture), { actif: lecture })}
        </div>

        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-start", gap: 20 }}>
          {/* Pages */}
          <aside className="stack" style={{ flex: "0 0 120px", gap: 8 }}>
            <p className="label">Pages</p>
            {minis.map((id, i) => <Miniature key={id} page={doc.pages[i]} format={doc.format} images={images.current} version={version} actif={i === pageIdx} onClick={() => { setPageIdx(i); setSel(null); }} numero={i + 1} />)}
            {btn("+ Page", ajouterPage, { titre: "Duplique la page en cours" })}
            <div className="row" style={{ gap: 4 }}>{btn("↑", () => deplacerPage(-1))}{btn("↓", () => deplacerPage(1))}{btn("✕", supprimerPage, { off: doc.pages.length < 2 })}</div>
          </aside>

          {/* Canvas */}
          <div ref={boiteRef} style={{ flex: "1 1 420px", minWidth: 280, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", width: largeurVue, height: H * echelle, boxShadow: "0 10px 40px rgba(0,0,0,.25)", touchAction: "none", userSelect: "none" }}
              onPointerDown={toucher} onPointerMove={bouger} onPointerUp={lacher} onPointerCancel={lacher}
              onDoubleClick={() => { if (elSel && elSel.type === "texte") setEdition(elSel.id); }}>
              <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", height: "100%", display: "block" }} aria-label="Création en cours" />
              {guide.v ? <div style={{ position: "absolute", left: largeurVue / 2, top: 0, bottom: 0, width: 1, background: "#E94A06" }} /> : null}
              {guide.h ? <div style={{ position: "absolute", top: (H * echelle) / 2, left: 0, right: 0, height: 1, background: "#E94A06" }} /> : null}
              {elSel && !lecture ? (
                <div style={{ position: "absolute", left: elSel.x * echelle, top: elSel.y * echelle, width: elSel.w * echelle, height: elSel.h * echelle, border: "2px solid #2563EB", pointerEvents: "none" }}>
                  <div style={{ position: "absolute", right: -9, bottom: -9, width: 18, height: 18, background: "#FFFFFF", border: "2px solid #2563EB", borderRadius: 4 }} />
                </div>
              ) : null}
              {edition && elSel && elSel.id === edition ? (
                <textarea autoFocus defaultValue={elSel.texte} onBlur={(e) => { majEl(elSel.id, { texte: e.target.value }); setEdition(null); }} onPointerDown={(e) => e.stopPropagation()}
                  style={{ position: "absolute", left: elSel.x * echelle, top: elSel.y * echelle, width: Math.max(120, elSel.w * echelle), minHeight: Math.max(40, elSel.h * echelle), fontSize: Math.max(12, (elSel.police ?? 40) * echelle), fontWeight: elSel.graisse ?? 800, fontFamily: POLICE.famille, lineHeight: elSel.interligne ?? 1.1, textAlign: elSel.align ?? "left", background: "rgba(255,255,255,.92)", color: "#0A0A0A", border: "2px solid #2563EB", padding: 4, resize: "both" }} />
              ) : null}
            </div>
            <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>Glisse pour déplacer · poignée en bas à droite pour redimensionner (Maj : garder les proportions, Alt : agrandir le texte) · double-clic pour écrire · flèches pour ajuster</p>
          </div>

          {/* Propriétés */}
          <aside className="stack" style={{ flex: "1 1 320px", minWidth: 0, gap: 12 }}>
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
              <button type="button" className="btn primary" disabled={!!busy} onClick={rediger}>{busy === "rediger" ? "VOA écrit…" : "Réécrire tous les textes avec VOA"}</button>
            </section>

            <section className="card" style={{ gap: 10 }}>
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
