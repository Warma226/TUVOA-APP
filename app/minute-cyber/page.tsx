"use client";

// La minute cyber : l'assistant qui écrit l'épisode (histoire → révélation → réflexes), le découpe en scènes (storyboard),
// prépare la voix off (voix de VOA, ta voix au micro ou un fichier) et monte la vidéo dans le Studio.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/BottomNav";
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
  const [saison, setSaison] = useState<Proposition[]>([]);
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
  const proposerSaison = () => action("saison", async () => { const d = await api<{ saison: Proposition[] }>({ action: "saison" }); setSaison(d.saison); });
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

  return (
    <div className={montserrat.className}>
      <TopBar title="La minute cyber" back="/studio" wide />
      <main className="page sub wide" style={{ paddingTop: 8, maxWidth: 1400 }}>
        <section className="row" style={{ background: "#0A0A0A", color: "#fff", borderRadius: 18, padding: "20px 24px", gap: 18, flexWrap: "wrap" }}>
          <Voa humeur={busy ? "parle" : "veille"} taille={84} decor />
          <div style={{ flex: "1 1 300px" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "#E94A06" }}>SÉRIE VIDÉO · 60 S MAX</p>
            <h1 style={{ margin: "4px 0", fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>La minute cyber</h1>
            <p style={{ margin: 0, color: "#C7CBD6", lineHeight: 1.5 }}>Une histoire vraie à vivre, la technique révélée à la fin, trois réflexes. VOA écrit, découpe, fait la voix et monte la vidéo.</p>
          </div>
          <form className="row" style={{ flex: "1 1 360px", gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (sujet.trim()) void ecrire(sujet.trim()); }}>
            <input value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Une menace : SIM swap, faux agent mobile money…" style={{ flex: 1, height: 52, borderRadius: 12, border: 0, padding: "0 14px", fontSize: 16 }} />
            <button className="btn primary" disabled={!!busy || !sujet.trim()}>{busy === "script" ? "VOA écrit…" : "Écrire l'épisode"}</button>
          </form>
        </section>
        {error ? <p style={{ color: "#C2410C", fontWeight: 600, margin: 0 }}>{error}</p> : null}
        {info ? <p style={{ color: "#1D4ED8", fontWeight: 600, margin: 0 }}>{info}</p> : null}

        <div className="row" style={{ alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          {/* Colonne : saison et épisodes */}
          <aside className="stack" style={{ flex: "0 1 320px", minWidth: 260, gap: 14 }}>
            <div className="card" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>Saison proposée</strong>
                <button type="button" className="btn small ghost" disabled={!!busy} onClick={proposerSaison}>{busy === "saison" ? "…" : saison.length ? "Renouveler" : "Proposer"}</button>
              </div>
              {saison.length === 0 ? <p className="muted" style={{ margin: 0 }}>VOA te propose 10 épisodes, du plus courant au plus sournois.</p> : null}
              {saison.map((p) => (
                <button key={p.menace + p.titre} type="button" disabled={!!busy} onClick={() => void ecrire(p.menace, `${p.titre}. ${p.pitch}`)}
                  style={{ textAlign: "left", border: "1px solid #E5E7EB", borderRadius: 12, padding: 10, background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#E94A06" }}>{p.menace.toUpperCase()}</span>
                  <strong style={{ fontSize: 15 }}>{p.titre}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>{p.pitch}</span>
                </button>
              ))}
            </div>
            <div className="card" style={{ gap: 8 }}>
              <strong>Mes épisodes</strong>
              {episodes.length === 0 ? <p className="muted" style={{ margin: 0 }}>Aucun épisode pour l&apos;instant.</p> : null}
              {episodes.map((e) => (
                <button key={e.id} type="button" onClick={() => choisir(e)}
                  style={{ textAlign: "left", border: e.id === ep?.id ? "2px solid #2563EB" : "1px solid #E5E7EB", borderRadius: 12, padding: 10, background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Ép. {e.numero ?? "?"} · {e.menace} · {Math.round(dureeEpisode(e))} s{e.audio ? " · voix ✓" : ""}{e.statut === "monte" ? " · monté" : ""}</span>
                  <strong style={{ fontSize: 15 }}>{e.titre}</strong>
                </button>
              ))}
            </div>
          </aside>

          {/* Épisode */}
          {ep ? (
            <section className="stack" style={{ flex: "1 1 600px", minWidth: 0, gap: 16 }}>
              <div className="card" style={{ gap: 12 }}>
                <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
                  <label className="field" style={{ flex: "2 1 260px" }}>Titre de l&apos;épisode<input value={ep.titre} onChange={(e) => maj({ titre: e.target.value })} /></label>
                  <label className="field" style={{ flex: "1 1 160px" }}>Menace<input value={ep.menace} onChange={(e) => maj({ menace: e.target.value })} /></label>
                  <label className="field" style={{ flex: "0 0 90px" }}>Épisode n°<input type="number" value={ep.numero ?? 1} onChange={(e) => maj({ numero: Math.max(1, Number(e.target.value)) })} /></label>
                </div>
                {/* Frise des scènes */}
                <div>
                  <div style={{ display: "flex", height: 26, borderRadius: 8, overflow: "hidden", outline: trop ? "2px solid #C2410C" : undefined }}>
                    {ep.scenes.map((s, i) => <div key={i} title={`${TYPES_SCENE[s.type]} · ${s.duree} s`} style={{ flex: s.duree, background: COULEUR[s.type], borderRight: "2px solid #fff" }} />)}
                    {!trop ? <div style={{ flex: DUREE_MAX - total, background: "#F1F5F9" }} /> : null}
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 700, color: trop ? "#C2410C" : "#334155" }}>
                    {Math.round(total)} s / 60 s · {ep.scenes.length} scènes{ep.audio ? " · durées calées sur la voix off" : " · durées estimées d'après le texte lu"}{trop ? " — trop long, raccourcis la voix" : ""}
                  </p>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className={`btn small ${vue === "script" ? "primary" : "ghost"}`} onClick={() => setVue("script")}>Script</button>
                  <button type="button" className={`btn small ${vue === "storyboard" ? "primary" : "ghost"}`} onClick={() => setVue("storyboard")}>Storyboard</button>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="btn small danger" onClick={supprimer}>Supprimer</button>
                </div>
              </div>

              {vue === "script" ? (
                <div className="stack" style={{ gap: 10 }}>
                  {ep.scenes.map((s, i) => (
                    <div key={i} className="card" style={{ borderLeft: `6px solid ${COULEUR[s.type]}`, gap: 8 }}>
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 15 }}>Scène {i + 1}</strong>
                        <select value={s.type} onChange={(e) => majScene(i, { type: e.target.value as TypeScene })} style={{ height: 38, borderRadius: 8 }}>
                          {Object.entries(TYPES_SCENE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <label className="row" style={{ gap: 4, fontSize: 14 }}>Durée<input type="number" step={0.1} value={s.duree} onChange={(e) => majScene(i, { duree: Math.max(1, Number(e.target.value)) })} style={{ width: 70, height: 38, borderRadius: 8, padding: "0 6px" }} />s</label>
                        <span style={{ flex: 1 }} />
                        <button type="button" className="btn small ghost" onClick={() => deplacer(i, -1)}>↑</button>
                        <button type="button" className="btn small ghost" onClick={() => deplacer(i, 1)}>↓</button>
                        <button type="button" className="btn small ghost" onClick={() => ajouter(i)} title="Ajouter une scène après">+</button>
                        <button type="button" className="btn small ghost" onClick={() => retirer(i)}>✕</button>
                      </div>
                      <label className="field">Voix off<textarea rows={2} value={s.voix} onChange={(e) => majScene(i, { voix: e.target.value }, true)} /></label>
                      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <label className="field" style={{ flex: "1 1 240px" }}>Texte à l&apos;écran<input value={s.ecran} onChange={(e) => majScene(i, { ecran: e.target.value })} /></label>
                        {s.type === "message" || s.type === "appel" ? (
                          <label className="field" style={{ flex: "1 1 240px" }}>{s.type === "message" ? "Message reçu" : "Appelant affiché"}<input value={s.detail ?? ""} onChange={(e) => majScene(i, { detail: e.target.value })} /></label>
                        ) : null}
                      </div>
                      {s.type === "reflexes" ? (
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          {[0, 1, 2].map((k) => (
                            <label key={k} className="field" style={{ flex: "1 1 200px" }}>Réflexe {k + 1}<input value={(s.points ?? ep.reflexes)[k] ?? ""} onChange={(e) => { const p = [...(s.points ?? ep.reflexes)]; p[k] = e.target.value; majScene(i, { points: p }); }} /></label>
                          ))}
                        </div>
                      ) : null}
                      <label className="field" style={{ color: "#64748B" }}>Plan (storyboard)<textarea rows={2} value={s.plan} onChange={(e) => majScene(i, { plan: e.target.value })} /></label>
                    </div>
                  ))}
                  <div className="card" style={{ gap: 8 }}>
                    <strong>La technique révélée</strong>
                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      <label className="field" style={{ flex: "1 1 200px" }}>Nom<input value={ep.technique.nom} onChange={(e) => maj({ technique: { ...ep.technique, nom: e.target.value } })} /></label>
                      <label className="field" style={{ flex: "3 1 360px" }}>Explication<input value={ep.technique.explication} onChange={(e) => maj({ technique: { ...ep.technique, explication: e.target.value } })} /></label>
                    </div>
                    <label className="field">Texte du post Facebook<textarea rows={5} value={ep.legende} onChange={(e) => maj({ legende: e.target.value })} /></label>
                  </div>
                </div>
              ) : (
                <Storyboard ep={ep} doc={doc!} prete={prete} />
              )}

              {/* Voix off */}
              <div className="card" style={{ gap: 12 }}>
                <strong style={{ fontSize: 18 }}>Voix off</strong>
                {ep.audio ? (
                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <audio src={ep.audio} controls style={{ flex: "1 1 300px" }} />
                    <button type="button" className="btn small ghost" onClick={retirerVoix}>Retirer la voix</button>
                  </div>
                ) : <p className="muted" style={{ margin: 0 }}>Sans voix off, la vidéo reste lisible : les textes à l&apos;écran racontent l&apos;histoire.</p>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
                  <div className="card" style={{ gap: 8, background: "#F8FAFC" }}>
                    <strong>La voix de VOA</strong>
                    <select value={voixNom} onChange={(e) => setVoixNom(e.target.value)} style={{ height: 40, borderRadius: 8 }}>{VOIX.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <button type="button" className="btn small primary" disabled={!!busy} onClick={voixVoa}>{busy === "voix" ? "VOA enregistre…" : "Générer la voix"}</button>
                  </div>
                  <div className="card" style={{ gap: 8, background: "#F8FAFC" }}>
                    <strong>Ta voix au micro</strong>
                    <span className="muted" style={{ fontSize: 13 }}>Le texte défile en prompteur pendant que tu lis.</span>
                    {micro === "enregistre"
                      ? <button type="button" className="btn small danger" onClick={arreterMicro}>■ Arrêter l&apos;enregistrement</button>
                      : <button type="button" className="btn small dark" disabled={!!busy} onClick={() => setMicro("pret")}>{busy === "micro" ? "Envoi…" : "Enregistrer ma voix"}</button>}
                  </div>
                  <div className="card" style={{ gap: 8, background: "#F8FAFC" }}>
                    <strong>Un fichier audio</strong>
                    <span className="muted" style={{ fontSize: 13 }}>MP3, M4A, WAV… (enregistré au téléphone par exemple).</span>
                    <label className="btn small ghost" style={{ cursor: "pointer" }}>{busy === "import" ? "Envoi…" : "Importer"}<input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importer(f); e.target.value = ""; }} /></label>
                  </div>
                </div>
              </div>

              {/* Aperçu et montage */}
              <div className="card" style={{ gap: 12 }}>
                <strong style={{ fontSize: 18 }}>Aperçu de la vidéo</strong>
                {doc ? <Apercu doc={doc} prete={prete} /> : null}
                <button type="button" className="btn primary" disabled={!!busy || !doc} onClick={monter}>Monter la vidéo dans le Studio →</button>
                <span className="muted" style={{ fontSize: 13 }}>Dans le Studio : retouche les scènes (photos, couleurs, animations), puis exporte la vidéo ou envoie-la au calendrier avec le texte du post.</span>
              </div>
            </section>
          ) : (
            <section className="card" style={{ flex: "1 1 600px", alignItems: "center", textAlign: "center", padding: 40 }}>
              <Voa humeur="ecoute" taille={120} />
              <strong style={{ fontSize: 22 }}>Premier épisode ?</strong>
              <p className="muted">Tape une menace en haut (par exemple « ingénierie sociale »), ou demande à VOA de proposer une saison.</p>
            </section>
          )}
        </div>
      </main>

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
    <div className="row" style={{ gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
      <canvas ref={ref} width={540} height={960} style={{ width: 270, borderRadius: 14, background: "#000", boxShadow: "0 10px 40px rgba(0,0,0,.25)" }} />
      <button type="button" className="btn small dark" onClick={() => setJoue(!joue)}>{joue ? "■ Arrêter" : `▶ Lire (${Math.round(total)} s)`}</button>
    </div>
  );
}
