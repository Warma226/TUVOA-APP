"use client";

// La minute cyber : l'assistant qui écrit l'épisode (histoire → révélation → réflexes), le découpe en scènes (storyboard),
// prépare la voix off (voix de VOA, ta voix au micro ou un fichier) et monte la vidéo dans le Studio.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trait } from "@/components/BottomNav";
import { Jauge } from "@/components/Atelier";
import { useVoirPlus } from "@/components/VoirPlus";
import Voa from "@/components/Voa";
import { montserrat } from "@/lib/studio-font";
import { FORMATS, POLICE, dessinerPage, dessinerSequence, dureeTotale, type Doc, type Page } from "@/lib/creation";
import {
  DUREE_MAX, TYPES_SCENE, caler, dureeEpisode, dureeLue, episodeEnVideo, scriptVoix,
  type Episode, type Proposition, type Scene, type TypeScene,
} from "@/lib/minute";

const CLE_BROUILLON = "tuvoa-studio-brouillon";
const CLE_LEGENDE = "tuvoa-studio-legende";
const COULEUR: Record<TypeScene, string> = { accroche: "#0A0A0A", histoire: "#2563EB", message: "#22C55E", appel: "#16A34A", revelation: "#E94A06", technique: "#0A2A66", reflexes: "#6E9BFF", fin: "#94A3B8" };
const VOIX: [string, string][] = [["Charon", "Charon — grave, posée"], ["Fenrir", "Fenrir — intense"], ["Orus", "Orus — ferme"], ["Puck", "Puck — vive"], ["Kore", "Kore — claire (féminine)"], ["Aoede", "Aoede — chaleureuse (féminine)"]];

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch("/api/minute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const brut = await r.text();
  let d: { error?: string } & Record<string, unknown>;
  try { d = JSON.parse(brut); } catch {
    throw new Error(r.status === 504 || /timed out|timeout/i.test(brut) ? "VOA a mis trop de temps à répondre : réessaie dans un instant." : `Le serveur a répondu une erreur (${r.status}). Réessaie dans un instant.`);
  }
  if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`);
  return d as T;
}
const dureeAudio = (src: string) => new Promise<number>((ok, ko) => {
  const a = new Audio(); a.preload = "metadata";
  a.onloadedmetadata = () => {
    if (Number.isFinite(a.duration)) return ok(a.duration);
    // WebM enregistré au micro : durée inconnue tant qu'on n'a pas cherché la fin
    a.currentTime = 1e7; a.ontimeupdate = () => { a.ontimeupdate = null; ok(a.duration); };
  };
  a.onerror = () => ko(new Error("Fichier audio illisible."));
  a.src = src;
});

export default function MinuteCyber() {
  const router = useRouter();
  const [, setSaison] = useState<Proposition[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [ep, setEp] = useState<Episode | null>(null);
  const [sujet, setSujet] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [voixNom, setVoixNom] = useState("Charon");
  const [vue, setVue] = useState<"script" | "storyboard">("script");
  const [prete, setPrete] = useState(false);

  useEffect(() => {
    POLICE.famille = `${montserrat.style.fontFamily}, Montserrat, sans-serif`;
    const f = montserrat.style.fontFamily.split(",")[0].replace(/['"]/g, "");
    Promise.all([600, 700, 800].map((g) => document.fonts.load(`${g} 40px "${f}"`))).finally(() => setPrete(true));
    api<{ saison: Proposition[]; episodes: Episode[] }>({ action: "etat" })
      .then((d) => { setSaison(d.saison); setEpisodes(d.episodes); if (d.episodes[0]) setEp(d.episodes[0]); })
      .catch((e) => setError((e as Error).message));
  }, []);

  // Enregistrement automatique des modifications
  const premier = useRef(true);
  useEffect(() => {
    if (!ep) return;
    if (premier.current) { premier.current = false; return; }
    const t = setTimeout(() => {
      api<{ episodes: Episode[] }>({ action: "sauver", episode: ep }).then((d) => setEpisodes(d.episodes)).catch((e) => setError((e as Error).message));
    }, 1200);
    return () => clearTimeout(t);
  }, [ep]);
  const choisir = (e: Episode) => { premier.current = true; setEp(e); setInfo(""); setError(""); };

  async function action<T>(nom: string, f: () => Promise<T>) {
    setBusy(nom); setError(""); setInfo("");
    try { return await f(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }
  const ecrire = (s: string, pitch?: string) => action("script", async () => {
    const d = await api<{ saison: Proposition[]; episodes: Episode[]; episode: Episode; alerte?: string }>({ action: "script", sujet: s, pitch });
    setSaison(d.saison); setEpisodes(d.episodes); choisir(d.episode); setSujet(""); setVue("script");
    if (d.alerte) setInfo(d.alerte);
  });
  const supprimer = () => ep && confirm(`Supprimer l'épisode « ${ep.titre} » ?`) && action("supprimer", async () => {
    const d = await api<{ episodes: Episode[] }>({ action: "supprimer", id: ep.id });
    setEpisodes(d.episodes); premier.current = true; setEp(d.episodes[0] ?? null);
  });

  // ─── Édition ───────────────────────────────────────────────────
  const maj = (p: Partial<Episode>) => setEp((e) => (e ? { ...e, ...p } : e));
  const majScene = (i: number, p: Partial<Scene>, recalcul = false) => setEp((e) => {
    if (!e) return e;
    const scenes = e.scenes.map((s, k) => (k === i ? { ...s, ...p } : s));
    if (recalcul && !e.audio) scenes[i] = { ...scenes[i], duree: dureeLue(scenes[i]) };
    return { ...e, scenes };
  });
  const deplacer = (i: number, d: number) => setEp((e) => {
    if (!e) return e; const j = i + d; if (j < 0 || j >= e.scenes.length) return e;
    const s = [...e.scenes]; [s[i], s[j]] = [s[j], s[i]]; return { ...e, scenes: s };
  });
  const retirer = (i: number) => setEp((e) => (e && e.scenes.length > 2 ? { ...e, scenes: e.scenes.filter((_, k) => k !== i) } : e));
  const ajouter = (i: number) => setEp((e) => {
    if (!e) return e; const s = [...e.scenes];
    s.splice(i + 1, 0, { type: "histoire", voix: "", ecran: "", plan: "", duree: 3 }); return { ...e, scenes: s };
  });

  // ─── Voix off ──────────────────────────────────────────────────
  async function poserAudio(url: string) {
    const d = await dureeAudio(url);
    setEp((e) => (e ? { ...e, audio: url, scenes: caler(e.scenes, d) } : e));
    setInfo(`Voix off prête (${Math.round(d)} s) : les scènes sont calées dessus.${d > DUREE_MAX ? " Attention, elle dépasse 60 s." : ""}`);
  }
  const voixVoa = () => ep && action("voix", async () => {
    const d = await api<{ url: string }>({ action: "voix", texte: scriptVoix(ep), voix: voixNom });
    await poserAudio(d.url);
  });
  async function envoyerAudio(blob: Blob, ext: string) {
    const r = await fetch("/api/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: blob.type || "audio/webm", ext }) });
    const s = await r.json(); if (!r.ok) throw new Error(s.error || "Envoi impossible.");
    const up = await fetch(s.signedUrl, { method: "PUT", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob });
    if (!up.ok) throw new Error(`Envoi impossible (${up.status}).`);
    await poserAudio(s.publicUrl);
  }
  const importer = (f: File) => action("import", () => envoyerAudio(f, (f.name.split(".").pop() || "mp3").toLowerCase()));
  const retirerVoix = () => setEp((e) => (e ? { ...e, audio: undefined, scenes: e.scenes.map((s) => ({ ...s, duree: dureeLue(s) })) } : e));

  // Micro : prompteur + enregistrement
  const [micro, setMicro] = useState<"" | "pret" | "enregistre">("");
  const rec = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);
  async function demarrerMicro() {
    setError("");
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(flux, type ? { mimeType: type } : undefined);
      morceaux.current = [];
      r.ondataavailable = (e) => { if (e.data.size) morceaux.current.push(e.data); };
      r.onstop = () => {
        flux.getTracks().forEach((t) => t.stop());
        const t = (r.mimeType || "audio/webm").split(";")[0];
        void action("micro", () => envoyerAudio(new Blob(morceaux.current, { type: t }), t.includes("mp4") ? "m4a" : "webm"));
        setMicro("");
      };
      rec.current = r; r.start(250); setMicro("enregistre");
    } catch { setError("Micro inaccessible : autorise-le dans le navigateur."); }
  }
  const arreterMicro = () => rec.current?.state === "recording" && rec.current.stop();

  // ─── Vidéo ─────────────────────────────────────────────────────
  const doc = useMemo(() => (ep ? episodeEnVideo(ep) : null), [ep]);
  function monter() {
    if (!ep || !doc) return;
    try {
      localStorage.setItem(CLE_BROUILLON, JSON.stringify(doc));
      localStorage.setItem(CLE_LEGENDE, ep.legende);
    } catch { setError("Le navigateur bloque l'enregistrement local : impossible d'ouvrir le Studio."); return; }
    maj({ statut: "monte" });
    setTimeout(() => router.push("/studio?reprendre=1"), 300);
  }

  const total = ep ? dureeEpisode(ep) : 0;
  const trop = total > DUREE_MAX;

  const [sel, setSel] = useState(0);
  useEffect(() => { setSel(0); }, [ep?.id]);
  const vEps = useVoirPlus(episodes);
  const sc = ep?.scenes[Math.min(sel, (ep?.scenes.length ?? 1) - 1)];
  const iSel = ep ? Math.min(sel, ep.scenes.length - 1) : 0;
  const etapes: [string, "fait" | "cours" | ""][] = !ep ? [["Sujet", "cours"], ["Script", ""], ["Voix", ""], ["Montage", ""], ["Publication", ""]] : [
    ["Sujet", "fait"], ["Script", "fait"],
    ["Voix", ep.audio ? "fait" : "cours"],
    ["Montage", ep.statut === "monte" || ep.statut === "envoye" ? "fait" : ep.audio ? "cours" : ""],
    ["Publication", ep.statut === "envoye" ? "fait" : ep.statut === "monte" ? "cours" : ""],
  ];
  const gardes: [string, boolean][] = ep ? [
    [trop ? `Durée : ${Math.round(total)} s, au-delà de 60 s` : `Durée sous 60 s : ${Math.round(total)} s`, !trop],
    [ep.titre && ep.menace && ep.titre.toLowerCase().includes(ep.menace.toLowerCase()) ? "Le titre dévoile la technique : gardez la surprise" : "Le titre garde la surprise de la révélation", !(ep.titre && ep.menace && ep.titre.toLowerCase().includes(ep.menace.toLowerCase()))],
    [ep.scenes.some((x) => /\d{6,}|\+\d{3}\s?\d{2}/.test(`${x.detail ?? ""} ${x.ecran}`)) ? "Un vrai numéro apparaît à l'écran : floutez-le" : "Aucun numéro réel à l'écran", !ep.scenes.some((x) => /\d{6,}|\+\d{3}\s?\d{2}/.test(`${x.detail ?? ""} ${x.ecran}`))],
    [ep.scenes.some((x) => x.type === "revelation" || x.type === "technique") ? "La technique est révélée avant les réflexes" : "Ajoutez la scène où la technique est révélée", ep.scenes.some((x) => x.type === "revelation" || x.type === "technique")],
    [`${ep.reflexes.filter((r) => r.trim()).length} réflexe${ep.reflexes.filter((r) => r.trim()).length > 1 ? "s" : ""} (3 attendus)`, ep.reflexes.filter((r) => r.trim()).length >= 3],
    [ep.legende.trim() ? `Texte du post : ${ep.legende.length} car.` : "Texte du post à écrire", Boolean(ep.legende.trim())],
  ] : [];
  const fmt = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("fr-FR")} s`;

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        <div className="tv-entete" style={{ gap: 14 }}>
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <span className="tv-kicker" style={{ color: "#E94A06", letterSpacing: 2 }}>LA MINUTE CYBER · SÉRIE VIDÉO · 60 S MAX</span>
            {ep ? (
              <div className="row" style={{ gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="tv-titre" style={{ color: "#9AA8BE", fontFamily: "var(--font-mont)", fontWeight: 800 }}>Ép. {ep.numero ?? "?"}</span>
                <label style={{ flex: "1 1 260px", minWidth: 0 }}><span className="sr-only">Titre de l&apos;épisode</span>
                  <input className="tv-ed-titre" value={ep.titre} onChange={(e) => maj({ titre: e.target.value })} style={{ fontSize: "clamp(26px, 4vw, 42px)" }} />
                </label>
              </div>
            ) : <h1 className="tv-titre">La minute cyber</h1>}
            <span style={{ fontSize: 14, color: "#33425C" }}>{ep ? `${ep.menace} · ${ep.scenes.length} scènes · ${fmt(total)}${ep.audio ? " · voix prête" : ""}` : "Une histoire à vivre, la technique révélée à la fin, trois réflexes. Un épisode à la fois."}</span>
          </div>
          <ol className="tv-etapes" aria-label="Étapes de l'épisode">
            {etapes.map(([l, e], i) => (
              <li key={l}><span className="tv-etape-fixe" aria-current={e === "cours" ? "step" : undefined} data-etat={e}><span>{e === "fait" ? <Trait d="M20 6L9 17l-5-5" size={14} stroke={3} /> : i + 1}</span>{l}</span></li>
            ))}
          </ol>
        </div>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {info ? <p className="notice" role="status">{info}</p> : null}

        <div className="tv-minute">
          {/* Épisodes */}
          <aside className="tv-minute-eps" aria-labelledby="t-eps">
            <form className="tv-carte-side" onSubmit={(e) => { e.preventDefault(); if (sujet.trim()) void ecrire(sujet.trim()); }}>
              <div className="row" style={{ gap: 10 }}><Voa humeur={busy ? "parle" : "veille"} taille={48} /><strong style={{ fontFamily: "var(--font-mont)", fontSize: 16 }}>Nouvel épisode</strong></div>
              <label className="field" style={{ fontSize: 13 }}>Une menace à raconter<input value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Ex. faux recrutement, QR code piégé" /></label>
              <button className="tv-btn-nuit" style={{ justifyContent: "center" }} disabled={!!busy || !sujet.trim()}>{busy === "script" ? "VOA ÉCRIT…" : "ÉCRIRE L'ÉPISODE"}</button>
            </form>
            <h2 id="t-eps" className="tv-kicker" style={{ color: "#5B6B86", margin: "6px 0 0" }}>MES ÉPISODES</h2>
            <div className="tv-minute-liste">
              {episodes.length === 0 ? <p className="tv-gris" style={{ padding: 10, fontSize: 13 }}>Aucun épisode pour l&apos;instant.</p> : null}
              {vEps.visibles.map((e) => (
                <button key={e.id} type="button" onClick={() => choisir(e)} aria-current={e.id === ep?.id ? "true" : undefined}>
                  <span className="vignette">{e.numero ?? "?"}</span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
                    <strong style={{ fontSize: 14 }}>{e.titre}</strong>
                    <span style={{ fontSize: 12, color: "#5B6B86" }}>{e.menace} · {Math.round(dureeEpisode(e))} s</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: e.statut === "envoye" ? "#16A34A" : e.statut === "monte" ? "#2563EB" : e.audio ? "#0E9F8E" : "#E94A06" }}>{e.statut === "envoye" ? "Envoyé au calendrier" : e.statut === "monte" ? "Monté" : e.audio ? "Voix prête" : "Voix à faire"}</span>
                  </span>
                </button>
              ))}
              {vEps.bouton}
            </div>
          </aside>

          {ep && sc ? (
            <div className="tv-minute-centre">
              {/* La minute */}
              <section className="tv-carte" aria-labelledby="t-minute">
                <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                  <h2 id="t-minute" className="tv-h2" style={{ flex: 1 }}>La minute, scène par scène</h2>
                  <div className="tv-segments">
                    <button type="button" aria-pressed={vue === "script"} onClick={() => setVue("script")}>Scènes</button>
                    <button type="button" aria-pressed={vue === "storyboard"} onClick={() => setVue("storyboard")}>Storyboard</button>
                  </div>
                  <span className="row" style={{ gap: 6, alignItems: "baseline" }}><strong style={{ fontFamily: "var(--font-mont)", fontSize: 26 }}>{fmt(total)}</strong><span style={{ fontSize: 13, fontWeight: 700, color: trop ? "#B42318" : "#05603A" }}>{trop ? `${fmt(total - DUREE_MAX)} de trop` : `il reste ${fmt(DUREE_MAX - total)}`}</span></span>
                </div>
                <div className="tv-regle-60" aria-hidden="true">{[0, 10, 20, 30, 40, 50, 60].map((v) => <span key={v} style={{ left: `${(v / Math.max(DUREE_MAX, total)) * 100}%` }}>{v} s</span>)}</div>
                <div style={{ position: "relative" }}>
                  <div className="tv-scenes" style={{ width: `${(total / Math.max(DUREE_MAX, total)) * 100}%` }}>
                    {ep.scenes.map((x, i) => (
                      <button key={i} type="button" aria-pressed={i === iSel} aria-label={`Scène ${i + 1}, ${TYPES_SCENE[x.type]}, ${fmt(x.duree)}`} onClick={() => setSel(i)}
                        style={{ flex: `${x.duree} 1 0`, background: COULEUR[x.type], ["--c" as string]: COULEUR[x.type] }}>
                        <span className="k">{i + 1} · {TYPES_SCENE[x.type].toUpperCase()}</span>
                        <span className="t">{x.ecran || x.voix.slice(0, 40)}</span>
                      </button>
                    ))}
                  </div>
                  <span className="tv-limite" style={{ left: `${(DUREE_MAX / Math.max(DUREE_MAX, total)) * 100}%` }} />
                </div>
                <span className="tv-gris" style={{ fontSize: 12 }}>{ep.audio ? "Durées calées sur la voix off." : "Durées estimées d'après le texte lu à voix haute."} Cliquez une scène pour l&apos;ouvrir.</span>
              </section>

              {vue === "storyboard" ? <Storyboard ep={ep} doc={doc!} prete={prete} /> : (
                <section className="tv-carte" aria-labelledby="t-scene">
                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <span className="tv-pill" style={{ background: COULEUR[sc.type], color: "#fff" }}>SCÈNE {iSel + 1} · {TYPES_SCENE[sc.type].toUpperCase()}</span>
                    <h2 id="t-scene" className="tv-h2" style={{ fontSize: 18, flex: 1, minWidth: 0 }}>{sc.ecran || "Sans texte à l'écran"}</h2>
                    <button type="button" className="tv-rond" style={{ width: 40, height: 40 }} aria-label="Scène précédente" disabled={iSel === 0} onClick={() => setSel(iSel - 1)}><Trait d="M15 18l-6-6 6-6" size={16} stroke={2.2} /></button>
                    <button type="button" className="tv-rond" style={{ width: 40, height: 40 }} aria-label="Scène suivante" disabled={iSel >= ep.scenes.length - 1} onClick={() => setSel(iSel + 1)}><Trait d="M9 18l6-6-6-6" size={16} stroke={2.2} /></button>
                  </div>
                  <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <label className="field" style={{ flex: "1 1 160px" }}>Rôle<select value={sc.type} onChange={(e) => majScene(iSel, { type: e.target.value as TypeScene })}>{Object.entries(TYPES_SCENE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                        <label className="field" style={{ flex: "0 0 110px" }}>Durée (s)<input type="number" step={0.1} value={sc.duree} onChange={(e) => majScene(iSel, { duree: Math.max(1, Number(e.target.value)) })} /></label>
                      </div>
                      <label className="field">Voix off <span className="tv-gris" style={{ fontWeight: 400, fontSize: 12 }}>{fmt(dureeLue(sc))} à voix haute · {sc.voix.trim().split(/\s+/).filter(Boolean).length} mots</span>
                        <textarea rows={4} value={sc.voix} onChange={(e) => majScene(iSel, { voix: e.target.value }, true)} />
                      </label>
                      <label className="field">Texte à l&apos;écran<input value={sc.ecran} onChange={(e) => majScene(iSel, { ecran: e.target.value })} /></label>
                      {sc.type === "message" || sc.type === "appel" ? (
                        <label className="field">{sc.type === "message" ? "Message reçu" : "Appelant affiché"}<input value={sc.detail ?? ""} onChange={(e) => majScene(iSel, { detail: e.target.value })} /></label>
                      ) : null}
                      {sc.type === "reflexes" ? (
                        <div className="tv-grille2">
                          {[0, 1, 2].map((k) => (
                            <label key={k} className="field">Réflexe {k + 1}<input value={(sc.points ?? ep.reflexes)[k] ?? ""} onChange={(e) => { const pts = [...(sc.points ?? ep.reflexes)]; pts[k] = e.target.value; majScene(iSel, { points: pts }); }} /></label>
                          ))}
                        </div>
                      ) : null}
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="btn small" onClick={() => { deplacer(iSel, -1); setSel(Math.max(0, iSel - 1)); }} disabled={iSel === 0}>← Avancer</button>
                        <button type="button" className="btn small" onClick={() => { deplacer(iSel, 1); setSel(Math.min(ep.scenes.length - 1, iSel + 1)); }} disabled={iSel >= ep.scenes.length - 1}>Reculer →</button>
                        <button type="button" className="btn small" onClick={() => { ajouter(iSel); setSel(iSel + 1); }}>+ Scène après</button>
                        <button type="button" className="btn small danger" onClick={() => { retirer(iSel); setSel(Math.max(0, iSel - 1)); }} disabled={ep.scenes.length <= 2}>Retirer</button>
                      </div>
                    </div>
                    <div style={{ flex: "0 1 230px", minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
                      {doc?.pages[iSel] ? <Rendu page={doc.pages[iSel]} doc={doc} largeur={200} prete={prete} /> : null}
                      <label className="field" style={{ fontSize: 13 }}>Plan<textarea rows={3} value={sc.plan} onChange={(e) => majScene(iSel, { plan: e.target.value })} /></label>
                    </div>
                  </div>
                </section>
              )}

              <section className="tv-carte" aria-labelledby="t-tech">
                <h2 id="t-tech" className="tv-h2" style={{ fontSize: 18 }}>La technique révélée et le post</h2>
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <label className="field" style={{ flex: "1 1 200px" }}>Nom de la technique<input value={ep.technique.nom} onChange={(e) => maj({ technique: { ...ep.technique, nom: e.target.value } })} /></label>
                  <label className="field" style={{ flex: "1 1 160px" }}>Menace<input value={ep.menace} onChange={(e) => maj({ menace: e.target.value })} /></label>
                  <label className="field" style={{ flex: "0 0 100px" }}>Épisode n°<input type="number" value={ep.numero ?? 1} onChange={(e) => maj({ numero: Math.max(1, Number(e.target.value)) })} /></label>
                </div>
                <label className="field">Explication<input value={ep.technique.explication} onChange={(e) => maj({ technique: { ...ep.technique, explication: e.target.value } })} /></label>
                <label className="field">Texte du post Facebook <span className="tv-gris" style={{ fontWeight: 400, fontSize: 12 }}>{ep.legende.length} car. · idéal ≤ 477</span><textarea rows={5} value={ep.legende} onChange={(e) => maj({ legende: e.target.value })} /></label>
                <Jauge n={ep.legende.length} ideal={[40, 477]} pli={125} max={800} />
              </section>

              <div className="tv-veille">
                <section className="tv-carte" aria-labelledby="t-voix" style={{ flex: "1 1 320px", minWidth: 0 }}>
                  <h2 id="t-voix" className="tv-h2" style={{ fontSize: 18 }}>Voix off</h2>
                  {ep.audio ? (
                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      <audio src={ep.audio} controls style={{ flex: "1 1 240px" }} />
                      <button type="button" className="btn small" onClick={retirerVoix}>Retirer la voix</button>
                    </div>
                  ) : <p className="tv-gris" style={{ fontSize: 13 }}>Sans voix off, les textes à l&apos;écran racontent l&apos;histoire.</p>}
                  <div className="tv-voix-choix">
                    <div>
                      <strong>La voix de VOA</strong>
                      <select value={voixNom} onChange={(e) => setVoixNom(e.target.value)} aria-label="Voix">{VOIX.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      <button type="button" className="tv-btn-nuit" style={{ height: 40, justifyContent: "center" }} disabled={!!busy} onClick={voixVoa}>{busy === "voix" ? "VOA ENREGISTRE…" : "GÉNÉRER LA VOIX"}</button>
                    </div>
                    <div>
                      <strong>Ma voix au micro</strong>
                      <span className="tv-gris" style={{ fontSize: 12 }}>Le texte défile en prompteur.</span>
                      {micro === "enregistre"
                        ? <button type="button" className="btn small danger" onClick={arreterMicro}>■ Arrêter</button>
                        : <button type="button" className="btn small" disabled={!!busy} onClick={() => setMicro("pret")}>{busy === "micro" ? "Envoi…" : "Enregistrer ma voix"}</button>}
                    </div>
                    <div>
                      <strong>Un fichier audio</strong>
                      <span className="tv-gris" style={{ fontSize: 12 }}>MP3, M4A, WAV…</span>
                      <label className="btn small" style={{ cursor: "pointer" }}>{busy === "import" ? "Envoi…" : "Importer"}<input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importer(f); e.target.value = ""; }} /></label>
                    </div>
                  </div>
                </section>
                <section className="tv-carte" aria-labelledby="t-gardes" style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <h2 id="t-gardes" className="tv-h2" style={{ fontSize: 18 }}>Garde-fous de l&apos;épisode</h2>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {gardes.map(([t, ok]) => (
                      <li key={t} className="row" style={{ gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.4 }}>
                        <span style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: ok ? "#16A34A" : "#E94A06" }}><Trait d={ok ? "M20 6L9 17l-5-5" : "M12 8v5M12 17h.01"} size={11} stroke={3.2} /></span>
                        <span style={{ color: ok ? "#33425C" : "#9A3412", fontWeight: ok ? 400 : 600 }}>{t}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          ) : (
            <section className="tv-carte" style={{ flex: "999 1 560px", alignItems: "center", textAlign: "center", padding: 40 }}>
              <Voa humeur="ecoute" taille={120} />
              <strong style={{ fontSize: 22 }}>Premier épisode ?</strong>
              <p className="tv-gris">Tapez une menace à gauche (par exemple « ingénierie sociale ») : VOA écrit l&apos;épisode.</p>
            </section>
          )}

          {ep && doc ? (
            <aside className="tv-minute-side" aria-labelledby="t-apercu">
              <section className="tv-voa" style={{ flex: "none", alignItems: "center" }}>
                <h2 id="t-apercu" style={{ alignSelf: "flex-start", fontSize: 16, fontWeight: 800, color: "#fff" }}>Aperçu de l&apos;épisode</h2>
                <Apercu doc={doc} prete={prete} />
                <span style={{ fontSize: 12, color: "#9FB6E8", textAlign: "center" }}>Format 9:16 pour TikTok, les stories et les Reels.</span>
              </section>
              <section className="tv-carte-side">
                <h2 className="tv-h2" style={{ fontSize: 16 }}>Quand l&apos;épisode est prêt</h2>
                <span style={{ fontSize: 13, lineHeight: 1.45, color: "#33425C" }}>Le Studio reprend les scènes : retouchez photos et animations, puis exportez ou envoyez au calendrier avec le texte du post.</span>
                <button type="button" className="tv-btn-nuit" style={{ justifyContent: "center" }} disabled={!!busy || !doc} onClick={monter}>MONTER LA VIDÉO DANS LE STUDIO</button>
                <button type="button" className="btn small danger" style={{ alignSelf: "flex-start" }} onClick={supprimer}>Supprimer l&apos;épisode</button>
              </section>
            </aside>
          ) : null}
        </div>
      </div>

      {/* Prompteur */}
      {ep && micro ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", color: "#fff", zIndex: 50, display: "flex", flexDirection: "column", padding: 24, gap: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong style={{ color: micro === "enregistre" ? "#EF4444" : "#fff" }}>{micro === "enregistre" ? "● Enregistrement en cours" : "Prêt ? Lis le texte calmement, avec une pause entre les scènes."}</strong>
            <div className="row" style={{ gap: 8 }}>
              {micro === "pret" ? <button type="button" className="btn small primary" onClick={demarrerMicro}>● Commencer</button> : <button type="button" className="btn small danger" onClick={arreterMicro}>■ Terminer</button>}
              {micro === "pret" ? <button type="button" className="btn small ghost" style={{ color: "#fff" }} onClick={() => setMicro("")}>Fermer</button> : null}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", fontSize: 34, lineHeight: 1.45, fontWeight: 600, maxWidth: 900, margin: "0 auto" }}>
            {ep.scenes.map((s, i) => <p key={i} style={{ margin: "0 0 28px" }}><span style={{ color: COULEUR[s.type] === "#0A0A0A" ? "#94A3B8" : COULEUR[s.type], fontSize: 16, display: "block" }}>{TYPES_SCENE[s.type]}</span>{s.voix}</p>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Rendu({ page, doc, largeur, prete }: { page: Page; doc: Doc; largeur: number; prete: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { w, h } = FORMATS[doc.format];
  useEffect(() => {
    const c = ref.current; const ctx = c?.getContext("2d"); if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.scale(c.width / w, c.height / h);
    dessinerPage(ctx, page, doc.format, Infinity, new Map());
  }, [page, doc.format, w, h, prete]);
  return <canvas ref={ref} width={largeur * 2} height={Math.round((largeur * 2 * h) / w)} style={{ width: largeur, borderRadius: 10, display: "block" }} />;
}

function Storyboard({ ep, doc, prete }: { ep: Episode; doc: Doc; prete: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
      {ep.scenes.map((s, i) => (
        <div key={i} className="card" style={{ padding: 10, gap: 6 }}>
          {doc.pages[i] ? <Rendu page={doc.pages[i]} doc={doc} largeur={178} prete={prete} /> : null}
          <span style={{ fontSize: 12, fontWeight: 800, color: COULEUR[s.type] === "#0A0A0A" ? "#334155" : COULEUR[s.type] }}>{i + 1}. {TYPES_SCENE[s.type].toUpperCase()} · {s.duree} s</span>
          <span style={{ fontSize: 13, color: "#334155" }}>{s.plan || "—"}</span>
          <span style={{ fontSize: 13, fontStyle: "italic", color: "#64748B" }}>« {s.voix} »</span>
        </div>
      ))}
    </div>
  );
}

function Apercu({ doc, prete }: { doc: Doc; prete: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const son = useRef<HTMLAudioElement | null>(null);
  const [joue, setJoue] = useState(false);
  const total = dureeTotale(doc);
  const { w, h } = FORMATS[doc.format];
  const dessiner = useCallback((t: number) => {
    const c = ref.current; const ctx = c?.getContext("2d"); if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.scale(c.width / w, c.height / h);
    dessinerSequence(ctx, doc, t, new Map());
  }, [doc, w, h]);
  useEffect(() => { if (!joue) dessiner(Math.min(1.5, total)); }, [dessiner, joue, total, prete]);
  useEffect(() => {
    if (!joue) return;
    let raf = 0; const t0 = performance.now();
    if (doc.audio) { son.current = new Audio(doc.audio); void son.current.play().catch(() => undefined); }
    const pas = () => {
      const t = son.current && !son.current.paused ? son.current.currentTime : (performance.now() - t0) / 1000;
      dessiner(Math.min(t, total));
      if (t >= total) { setJoue(false); return; }
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => { cancelAnimationFrame(raf); son.current?.pause(); son.current = null; };
  }, [joue, doc, dessiner, total]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <canvas ref={ref} width={540} height={960} style={{ width: 230, borderRadius: 20, background: "#000", border: "6px solid #000", boxShadow: "0 20px 50px rgba(0,0,0,.5)" }} />
      <button type="button" className="btn small" onClick={() => setJoue(!joue)}>{joue ? "■ Arrêter" : `▶ Lire (${Math.round(total)} s)`}</button>
    </div>
  );
}
