"use client";
// Vidéos à reprendre : les dernières vidéos tech des chaînes suivies (Micode, France 24…). VOA (Gemini) repère les
// moments forts. La découpe 9:16 n'est ouverte que pour les vidéos CC BY ou les chaînes qui ont donné leur autorisation.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trait } from "@/components/BottomNav";
import { useVoirPlus } from "@/components/VoirPlus";
import type { Chaine, Extrait, Genre, Licence, LigneVideo } from "@/lib/youtube";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const ilya = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3.6e6);
  return h < 1 ? "à l'instant" : h < 24 ? `il y a ${h} h` : h < 48 ? "hier" : `il y a ${Math.round(h / 24)} j`;
};
const COUL = ["#E94A06", "#2563EB", "#7C3AED", "#0E9F8E"];
const GENRES: [string, string][] = [["tout", "Tout"], ["actu", "Actu tech"], ["interview", "Interviews"], ["docu", "Documentaires"]];
const GENRE_NOM: Record<Genre, string> = { actu: "Actu", interview: "Interview", docu: "Documentaire" };
const LIC: Record<Licence, { nom: string; cls: string }> = { cc: { nom: "CC BY", cls: "vert" }, autorisee: { nom: "Autorisée", cls: "vert" }, reservee: { nom: "Droits réservés", cls: "ambre" } };

export default function VideosPage() {
  const [videos, setVideos] = useState<LigneVideo[] | null>(null);
  const [chaines, setChaines] = useState<Chaine[]>([]);
  const [admin, setAdmin] = useState(false);
  const [genre, setGenre] = useState("tout");
  const [chaine, setChaine] = useState("toutes");
  const [gerer, setGerer] = useState(false);
  const [nouvelle, setNouvelle] = useState("");
  const [nouvType, setNouvType] = useState<"tech" | "info" | "interview">("tech");
  const [sel, setSel] = useState<string | null>(null);
  const [ext, setExt] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [info, setInfo] = useState("");
  const [decoupe, setDecoupe] = useState<Extrait | null>(null);
  const [lecture, setLecture] = useState<{ debut: number; fin: number } | null>(null);

  async function charger(maj = false) {
    setBusy(maj ? "maj" : "charge"); setError("");
    try {
      const r = await fetch(`/api/videos${maj ? "?maj=1" : ""}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`);
      setVideos(d.videos); setChaines(d.chaines || []); setAdmin(Boolean(d.admin)); setNote(d.note || "");
      if (!sel && d.videos[0]) setSel(d.videos[0].id);
    } catch (e) { setError((e as Error).message); setVideos([]); } finally { setBusy(""); }
  }
  useEffect(() => { void charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const liste = useMemo(() => (videos ?? []).filter((v) => (genre === "tout" || v.info.genre === genre) && (chaine === "toutes" || v.info.chaineId === chaine)), [videos, genre, chaine]);
  const vListe = useVoirPlus(liste, 8, `${genre}|${chaine}`);
  const presentes = useMemo(() => chaines.filter((c) => c.id && (videos ?? []).some((v) => v.info.chaineId === c.id)), [chaines, videos]);
  const v = (videos ?? []).find((x) => x.id === sel) ?? null;
  const libre = v ? v.licence !== "reservee" : false;
  const extraits = v?.extraits ?? [];
  const e = extraits[ext];

  async function reperer() {
    if (!v) return;
    setBusy("extraits"); setError("");
    try {
      const r = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "extraits", id: v.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`);
      setVideos((xs) => (xs ?? []).map((x) => (x.id === v.id ? { ...x, extraits: d.extraits, statut: "analyse" } : x)));
      setExt(0);
    } catch (x) { setError((x as Error).message); } finally { setBusy(""); }
  }
  async function ecarter(id: string) {
    await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ecarter", id }) }).catch(() => {});
    setVideos((xs) => (xs ?? []).filter((x) => x.id !== id));
    if (sel === id) setSel(null);
  }
  async function actionChaine(action: string, handle: string, extra: Record<string, unknown> = {}) {
    setBusy("chaine"); setError("");
    try {
      const r = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, handle, ...extra }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`);
      if (action === "chaine-ajouter") { setNouvelle(""); setInfo(`Chaîne ajoutée : ${d.chaine.nom}. Lancez « Chercher les nouvelles vidéos ».`); }
      await charger();
    } catch (x) { setError((x as Error).message); } finally { setBusy(""); }
  }
  const lien = (ex: Extrait) => `https://youtu.be/${v?.id}?t=${ex.debut}`;
  const credit = v ? `Source : ${v.info.chaine}${v.licence === "cc" ? " (licence CC BY)" : ""} · youtu.be/${v.id}` : "";
  const idee = (ex: Extrait) => `${ex.titre}.${ex.citation ? ` « ${ex.citation} »` : ""} ${ex.soustitres}\n\nVidéo à citer et à lier : ${credit}`;
  const embed = v ? `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&modestbranding=1${lecture ? `&start=${lecture.debut}&end=${lecture.fin}&autoplay=1` : ""}` : "";

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        <div className="tv-entete" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/veille" className="tv-gris" style={{ textDecoration: "none", fontWeight: 600 }}>← Veille</Link>
            <h1 className="tv-titre">Vidéos à reprendre</h1>
            <span style={{ fontSize: 14, color: "#33425C" }}>Les dernières vidéos tech de vos chaînes suivies ({chaines.filter((c) => c.id).length}). VOA repère les moments chocs des interviews et des documentaires.</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {admin ? <button type="button" className="btn" onClick={() => setGerer((g) => !g)}>{gerer ? "Fermer" : "Chaînes suivies"}</button> : null}
            <button type="button" className="tv-btn-nuit" style={{ height: 44, letterSpacing: 0 }} onClick={() => charger(true)} disabled={Boolean(busy)}><Trait d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" size={16} />{busy === "maj" ? "Recherche…" : "Chercher les nouvelles vidéos"}</button>
          </div>
        </div>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {note ? <p className="notice ambre">{note}</p> : null}
        {info ? <p className="notice vert" role="status">{info}</p> : null}

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {GENRES.map(([k, l]) => <button key={k} type="button" className="tv-chip" aria-selected={genre === k} onClick={() => setGenre(k)}>{l}<small>{k === "tout" ? (videos ?? []).length : (videos ?? []).filter((x) => x.info.genre === k).length}</small></button>)}
          <select className="tv-chip" value={chaine} onChange={(e) => setChaine(e.target.value)} aria-label="Chaîne" style={{ paddingRight: 10 }}>
            <option value="toutes">Toutes les chaînes</option>
            {presentes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>

        {gerer && admin ? (
          <section className="tv-carte" style={{ gap: 12 }}>
            <div className="row" style={{ alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2 className="tv-h2" style={{ flex: 1 }}>Chaînes suivies</h2>
              <span className="tv-gris" style={{ fontSize: 12 }}>« Actu générale » : seuls les sujets tech sont gardés.</span>
            </div>
            <div className="tv-vid-chaines">
              {chaines.map((c) => (
                <div key={c.handle} className="tv-vid-chaine" data-ko={Boolean(c.introuvable)}>
                  <span style={{ flex: 1, minWidth: 0 }}><strong>{c.nom}</strong><small>{c.handle} · {c.type === "info" ? "actu générale" : c.type === "interview" ? "interviews" : "tech"}{c.introuvable ? " · introuvable" : ""}</small></span>
                  <label title="Cochez seulement si la chaîne vous a autorisé par écrit à reprendre ses images"><input type="checkbox" checked={Boolean(c.autorisee)} disabled={busy === "chaine"} onChange={(e) => actionChaine("chaine-autoriser", c.handle, { autorisee: e.target.checked })} /> Autorisation obtenue</label>
                  <button type="button" className="btn link small" disabled={busy === "chaine"} onClick={() => actionChaine("chaine-retirer", c.handle)}>Retirer</button>
                </div>
              ))}
            </div>
            <form className="row" style={{ gap: 8, flexWrap: "wrap" }} onSubmit={(e) => { e.preventDefault(); if (nouvelle.trim()) void actionChaine("chaine-ajouter", nouvelle, { type: nouvType }); }}>
              <input className="tv-vid-input" value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} placeholder="@nomdelachaine ou lien YouTube" aria-label="Chaîne à ajouter" />
              <select className="tv-chip" value={nouvType} onChange={(e) => setNouvType(e.target.value as "tech" | "info" | "interview")} aria-label="Type de chaîne"><option value="tech">Chaîne tech</option><option value="info">Actu générale</option><option value="interview">Interviews de personnalités</option></select>
              <button type="submit" className="btn primary" disabled={busy === "chaine" || !nouvelle.trim()}>Ajouter</button>
            </form>
          </section>
        ) : null}

        <div className="tv-vid">
          <section className="tv-vid-liste" aria-label="Vidéos proposées">
            <span className="tv-kicker" style={{ color: "#5B6B86" }}>30 DERNIERS JOURS · PAR PERTINENCE</span>
            {videos === null ? <p className="tv-gris">Chargement…</p> : liste.length === 0 ? <p className="tv-gris" style={{ fontSize: 13 }}>Aucune vidéo pour ce filtre. Lancez « Chercher les nouvelles vidéos ».</p> : null}
            {vListe.visibles.map((x) => (
              <button key={x.id} type="button" className="tv-vid-carte" aria-pressed={sel === x.id} onClick={() => { setSel(x.id); setExt(0); setLecture(null); }}>
                <span className="mini">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {x.info.miniature ? <img src={x.info.miniature} alt="" /> : null}
                  <b>{mmss(x.info.duree)}</b>
                </span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <strong>{x.info.titre}</strong>
                  <small>{x.info.chaine} · {ilya(x.info.publie)}{x.info.langue && x.info.langue !== "fr" ? ` · ${x.info.langue.toUpperCase()}` : ""}</small>
                  <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    {x.info.genre !== "actu" ? <span className="tv-pill" style={{ background: x.info.genre === "docu" ? "#EDE5FF" : "#FFE8DC", color: x.info.genre === "docu" ? "#5B21B6" : "#B23A00" }}>{GENRE_NOM[x.info.genre]}</span> : null}
                    <span className={`tv-pill ${LIC[x.licence].cls}`}>{LIC[x.licence].nom}</span>
                    {x.extraits?.length ? <span style={{ fontSize: 12, fontWeight: 800, color: "#2563EB" }}>{x.extraits.length} extraits</span> : null}
                    <span style={{ fontSize: 12, color: "#5B6B86" }}>{x.info.vues >= 1000 ? `${Math.round(x.info.vues / 100) / 10} k vues` : `${x.info.vues} vues`}</span>
                  </span>
                </span>
              </button>
            ))}
            {vListe.bouton}
          </section>

          <section className="tv-vid-centre" aria-label="Vidéo choisie">
            {v ? (
              <>
                <div className="tv-carte" style={{ gap: 14 }}>
                  <div className="tv-vid-lecteur">
                    <iframe key={embed} src={embed} title={v.info.titre} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                  </div>
                  <div className="row" style={{ alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ fontFamily: "var(--font-mont)", fontSize: 20, flex: "1 1 300px" }}>{v.info.titre}</strong>
                    <a href={`https://www.youtube.com/channel/${v.info.chaineId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>{v.info.chaine} ↗</a>
                  </div>
                  {extraits.length ? (
                    <>
                      <div className="tv-vid-frise">
                        {extraits.map((x, i) => (
                          <button key={i} type="button" aria-label={`Extrait ${i + 1}`} onClick={() => { setExt(i); setLecture({ debut: x.debut, fin: x.fin }); }} style={{ left: `${(x.debut / v.info.duree) * 100}%`, width: `${Math.max(1.5, ((x.fin - x.debut) / v.info.duree) * 100)}%`, background: i === ext ? COUL[0] : COUL[1] }}><i>{i + 1}</i></button>
                        ))}
                      </div>
                      <div className="row" style={{ justifyContent: "space-between", fontSize: 11, color: "#5B6B86", fontFamily: "ui-monospace, monospace" }}><span>00:00</span><span>{mmss(v.info.duree / 2)}</span><span>{mmss(v.info.duree)}</span></div>
                    </>
                  ) : null}
                  {libre ? (
                    <div className="tv-vid-licence"><Trait d="M20 6L9 17l-5-5" size={18} stroke={2.6} /><span><strong>{v.licence === "cc" ? "Licence Creative Commons (CC BY), vérifiée sur YouTube." : `Autorisation de ${v.info.chaine} enregistrée.`}</strong> Vous pouvez couper et republier en citant la chaîne : VOA ajoute le crédit sur la vidéo et dans le texte.</span></div>
                  ) : (
                    <div className="tv-vid-licence" data-reserve="true"><Trait d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" size={18} stroke={2.2} /><span><strong>Droits réservés par {v.info.chaine}.</strong> Le crédit de la chaîne est incrusté sur chaque extrait coupé. Une réclamation de la chaîne peut faire retirer la vidéo de vos réseaux.</span></div>
                  )}
                </div>

                {!extraits.length ? (
                  <div className="tv-carte" style={{ alignItems: "flex-start", gap: 10 }}>
                    <strong style={{ fontSize: 16 }}>{busy === "extraits" ? "VOA regarde la vidéo…" : v.info.genre === "actu" ? "Les meilleurs extraits, prêts à partager" : "Les moments chocs, prêts à partager"}</strong>
                    <span className="tv-gris" style={{ fontSize: 13 }}>{busy === "extraits" ? "Il note les passages forts et traduit ce qui est dit. Cela prend une à trois minutes : vous pouvez rester sur cette page." : v.info.genre === "actu" ? "En un clic, VOA visionne la vidéo et sélectionne 4 Reels chocs de 1 min maximum, qui démarrent sur la phrase forte, sous-titrés en français." : "En un clic, VOA visionne toute la vidéo et sélectionne 4 Reels chocs de 1 min maximum : révélations, aveux, chiffres qui frappent, phrases à partager."}</span>
                    <div className="row" style={{ gap: 8 }}>
                      <button type="button" className="tv-btn-nuit" onClick={reperer} disabled={Boolean(busy)}>{busy === "extraits" ? "VOA REGARDE LA VIDÉO…" : v.info.genre === "actu" ? "REPÉRER LES EXTRAITS" : "TROUVER LES MOMENTS CHOCS"}</button>
                      <button type="button" className="btn" onClick={() => ecarter(v.id)}>Écarter cette vidéo</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row" style={{ alignItems: "baseline", gap: 10 }}><h2 className="tv-h2" style={{ flex: 1 }}>{extraits.length} {v.info.genre === "actu" ? "extraits repérés" : "moments chocs repérés"} par VOA</h2><button type="button" className="btn link small" onClick={reperer} disabled={Boolean(busy)}>{busy === "extraits" ? "…" : "Relancer"}</button></div>
                    {extraits.map((x, i) => (
                      <div key={i} className="tv-vid-extrait" data-on={i === ext}>
                        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                          <i style={{ background: i === ext ? COUL[0] : COUL[1] }}>{i + 1}</i>
                          <button type="button" className="titre" onClick={() => setExt(i)}>{x.titre}</button>
                          <code>{mmss(x.debut)} → {mmss(x.fin)} · {x.fin - x.debut} s</code>
                        </div>
                        {x.citation ? <blockquote className="tv-vid-citation">« {x.citation} »</blockquote> : null}
                        <span style={{ fontSize: 13, color: "#33425C" }}>{x.pourquoi}</span>
                        {i === ext && x.soustitres ? <div className="st"><b>SOUS-TITRES FR · </b>{x.soustitres}</div> : null}
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="btn small" onClick={() => { setExt(i); setLecture({ debut: x.debut, fin: x.fin }); }}><Trait d="M8 5v14l11-7z" size={14} />Lire</button>
                          <button type="button" className={i === ext ? "tv-btn-nuit" : "btn small"} style={i === ext ? { height: 40, fontSize: 13 } : undefined} onClick={() => { setExt(i); setDecoupe(x); }}><Trait d="M6 2v20M18 2v20M2 12h20" size={14} />Reel choc · 1 min max</button>
                          <Link href={`/creer/actu?idee=${encodeURIComponent(idee(x))}`} className="btn small">Écrire le post</Link>
                          {x.citation ? <button type="button" className="btn small" onClick={() => { void navigator.clipboard?.writeText(`« ${x.citation} » — ${v.info.chaine} (youtu.be/${v.id}?t=${x.debut})`); setInfo("Citation copiée avec sa source."); }}>Copier la citation</button> : null}
                          <button type="button" className="btn small" onClick={() => { void navigator.clipboard?.writeText(lien(x)); setInfo("Lien horodaté copié."); }}>Copier le lien du moment</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : <div className="tv-carte"><span className="tv-gris">Choisissez une vidéo dans la liste.</span></div>}
          </section>

          <aside className="tv-vid-side">
            <section className="tv-carte-side">
              <h2 className="tv-h2" style={{ fontSize: 17 }}>Ce que vous pouvez en faire</h2>
              <ol className="tv-vid-etapes">
                <li><b>1</b><span><strong>Toutes les vidéos</strong> : écrire un post qui raconte et commente le moment, citer une phrase courte avec la source, partager le lien horodaté.</span></li>
                <li><b>2</b><span><strong>Reel choc (1 min max)</strong> : directement depuis YouTube (Chrome sur ordinateur) ou depuis un fichier ; VOA coupe au bon minutage, recadre en vertical, met l&apos;accroche en bandeau orange, incruste les sous-titres, le logo TUVOA et le crédit de la chaîne.</span></li>
                <li><b>3</b><span>Gardez des extraits courts et ajoutez votre commentaire dans le post : c&apos;est ce qui protège le mieux en cas de réclamation.</span></li>
              </ol>
            </section>
            {e ? (
              <section className="tv-carte-side">
                <span className="tv-kicker" style={{ color: "#5B6B86" }}>CRÉDIT AJOUTÉ AUTOMATIQUEMENT</span>
                <span style={{ fontSize: 13, color: "#33425C", lineHeight: 1.45 }}>{credit}</span>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
      {decoupe && v ? <Decoupe videoId={v.id} extrait={decoupe} credit={`Source : ${v.info.chaine}${v.licence === "cc" ? " (CC BY)" : ""}`} titre={decoupe.citation ? `« ${decoupe.citation} »` : decoupe.titre} fermer={() => setDecoupe(null)} /> : null}
    </div>
  );
}

// Reel 9:16 fabriqué dans le navigateur, à partir de deux sources possibles :
// - « YouTube » : la vidéo est lue dans un lecteur YouTube intégré et capturée à l'écran (Chrome sur ordinateur) ;
// - « Fichier » : un fichier vidéo importé.
// L'image est recadrée sur un canvas 1080 × 1920 avec accroche, sous-titres, logo TUVOA, crédit et barre de progression.
type Source = { img: CanvasImageSource; sx: number; sy: number; sw: number; sh: number };
type CropTargetCtor = { fromElement(el: Element): Promise<unknown> };

function Decoupe({ videoId, extrait, credit, titre: titre0, fermer }: { videoId: string; extrait: Extrait; credit: string; titre: string; fermer: () => void }) {
  const [titre, setTitre] = useState(titre0);
  const ecranOk = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices);
  const [mode, setMode] = useState<"youtube" | "fichier">(ecranOk ? "youtube" : "fichier");
  const [fichier, setFichier] = useState<string | null>(null);
  const [debut, setDebut] = useState(extrait.debut);
  const [fin, setFin] = useState(Math.min(extrait.fin, extrait.debut + 60));
  const [st, setSt] = useState(extrait.soustitres);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sortie, setSortie] = useState<{ url: string; ext: string } | null>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const ifr = useRef<HTMLIFrameElement>(null);
  const tYT = useRef(0);
  useEffect(() => () => { if (fichier) URL.revokeObjectURL(fichier); }, [fichier]);

  // Lecteur YouTube : on suit sa position (messages « infoDelivery ») pour caler la découpe.
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  useEffect(() => {
    const ecoute = (e: MessageEvent) => {
      try {
        if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; const t = d?.info?.currentTime; if (typeof t === "number") tYT.current = t; } catch { /* message étranger */ }
    };
    window.addEventListener("message", ecoute);
    return () => window.removeEventListener("message", ecoute);
  }, []);
  const yt = (func: string, args: unknown[] = []) => ifr.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  const ecouterYT = () => ifr.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");

  function preparer() {
    const W = 1080, H = 1920;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const types = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
    const mime = types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    const mots = st.split(/\s+/).filter(Boolean), parBloc = 9;
    const blocs: string[] = []; for (let i = 0; i < mots.length; i += parBloc) blocs.push(mots.slice(i, i + parBloc).join(" "));
    const duree = Math.max(1, fin - debut);
    const dessiner = (src: Source | null, t: number) => {
      if (!ctx) return;
      ctx.fillStyle = "#061A44"; ctx.fillRect(0, 0, W, H);
      let y0 = 560, dh = 608;
      if (src && src.sw > 0 && src.sh > 0) {
        const { img, sx, sy, sw, sh } = src;
        const sFond = Math.max(W / sw, H / sh);
        ctx.globalAlpha = 0.35; ctx.drawImage(img, sx, sy, sw, sh, (W - sw * sFond) / 2, (H - sh * sFond) / 2, sw * sFond, sh * sFond); ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(6,26,68,0.55)"; ctx.fillRect(0, 0, W, H);
        const k = Math.min(W / sw, (H * 0.6) / sh), dw = sw * k; dh = sh * k; y0 = H * 0.32 - dh / 2 + 120;
        ctx.drawImage(img, sx, sy, sw, sh, (W - dw) / 2, y0, dw, dh);
      }
      ctx.font = "900 62px Montserrat, sans-serif"; ctx.textAlign = "center";
      lignes(ctx, titre, W - 200, 3).forEach((l, i) => {
        const w = ctx.measureText(l).width + 44, y = 300 + i * 82;
        ctx.fillStyle = "#E94A06"; ctx.beginPath(); ctx.roundRect((W - w) / 2, y - 60, w, 76, 14); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(l, W / 2, y);
      });
      const p = Math.min(1, Math.max(0, (t - debut) / duree));
      const b = blocs[Math.min(blocs.length - 1, Math.floor(p * blocs.length))];
      if (b) {
        ctx.font = "700 54px Inter, sans-serif";
        const ls = lignes(ctx, b, W - 200, 3), hb = ls.length * 70 + 50, yb = y0 + dh + 90;
        ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.beginPath(); ctx.roundRect(80, yb, W - 160, hb, 28); ctx.fill();
        ctx.fillStyle = "#fff"; ls.forEach((l, i) => ctx.fillText(l, W / 2, yb + 70 + i * 70));
      }
      ctx.fillStyle = "#2563EB"; ctx.beginPath(); ctx.roundRect(70, 90, 150, 150, 38); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "800 38px Montserrat, sans-serif"; ctx.fillText("TUVOA", 145, 175);
      ctx.fillStyle = "#CFDCFF"; ctx.font = "700 15px Montserrat, sans-serif"; ctx.fillText("TECH MEDIA", 145, 205);
      ctx.fillStyle = "#C9D6F2"; ctx.font = "600 30px Inter, sans-serif"; ctx.fillText(credit, W / 2, H - 120);
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(0, H - 14, W, 14);
      ctx.fillStyle = "#E94A06"; ctx.fillRect(0, H - 14, W * p, 14);
    };
    return { c, ctx, mime, duree, dessiner };
  }

  // Enregistre le canvas (+ le son fourni) pendant que « avancer » renvoie la position courante, jusqu'à « fin ».
  async function enregistrer(c: HTMLCanvasElement, mime: string, son: MediaStreamTrack[], demarrer: () => Promise<void> | void, image: () => { src: Source | null; t: number; fini: boolean }, dessiner: (s: Source | null, t: number) => void, duree: number) {
    const flux = c.captureStream(30);
    son.forEach((t) => flux.addTrack(t));
    const rec = new MediaRecorder(flux, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const morceaux: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) morceaux.push(e.data); };
    const arret = new Promise<void>((ok) => { rec.onstop = () => ok(); });
    rec.start(200);
    await demarrer();
    await new Promise<void>((ok) => {
      const pas = () => {
        const f = image();
        dessiner(f.src, f.t);
        setMsg(`Enregistrement… ${Math.min(100, Math.round(((f.t - debut) / duree) * 100))} %`);
        if (f.fini) ok(); else requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
    });
    rec.stop(); await arret;
    const type = mime.split(";")[0];
    setSortie({ url: URL.createObjectURL(new Blob(morceaux, { type })), ext: type === "video/mp4" ? "mp4" : "webm" });
  }

  async function depuisFichier() {
    const v = vid.current; if (!v || !fichier) return;
    const { c, ctx, mime, duree, dessiner } = preparer();
    if (!ctx) return setErr("Canvas indisponible.");
    if (!mime) return setErr("Ce navigateur ne sait pas enregistrer de vidéo. Essayez avec Chrome.");
    v.currentTime = debut; await new Promise((ok) => v.addEventListener("seeked", ok, { once: true }));
    const son = (v as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.().getAudioTracks() ?? [];
    v.muted = false;
    await enregistrer(c, mime, son, () => v.play(), () => ({ src: { img: v, sx: 0, sy: 0, sw: v.videoWidth, sh: v.videoHeight }, t: v.currentTime, fini: v.currentTime >= fin || v.ended }), dessiner, duree);
    v.pause();
  }

  async function depuisYouTube() {
    const el = ifr.current; if (!el) return;
    const { c, ctx, mime, duree, dessiner } = preparer();
    if (!ctx) return setErr("Canvas indisponible.");
    if (!mime) return setErr("Ce navigateur ne sait pas enregistrer de vidéo. Essayez avec Chrome.");
    let ecran: MediaStream;
    try {
      ecran = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: "include" } as DisplayMediaStreamOptions);
    } catch { return setErr("Capture refusée. Cliquez à nouveau et choisissez « Cet onglet », avec « Partager l'audio de l'onglet » activé."); }
    const piste = ecran.getVideoTracks()[0];
    const fermerEcran = () => ecran.getTracks().forEach((t) => t.stop());
    if ((piste.getSettings() as { displaySurface?: string }).displaySurface !== "browser") { fermerEcran(); return setErr("Choisissez « Cet onglet » (pas l'écran entier ni une fenêtre), puis recommencez."); }
    // Recadrage exact sur le lecteur (Chrome) ; sinon, calcul à partir de sa position à l'écran.
    let recadre = false;
    const CT = (window as unknown as { CropTarget?: CropTargetCtor }).CropTarget;
    if (CT) { try { await (piste as MediaStreamTrack & { cropTo(t: unknown): Promise<void> }).cropTo(await CT.fromElement(el)); recadre = true; } catch { /* non pris en charge */ } }
    const cap = document.createElement("video"); cap.muted = true; cap.playsInline = true; cap.srcObject = ecran; await cap.play();
    const zone = (): Source => {
      if (recadre) return { img: cap, sx: 0, sy: 0, sw: cap.videoWidth, sh: cap.videoHeight };
      const r = el.getBoundingClientRect(), k = cap.videoWidth / window.innerWidth;
      return { img: cap, sx: r.left * k, sy: r.top * k, sw: r.width * k, sh: r.height * k };
    };
    try {
      ecouterYT(); yt("pauseVideo"); yt("seekTo", [debut, true]); yt("unMute"); yt("setVolume", [100]);
      await new Promise((ok) => setTimeout(ok, 1200));
      tYT.current = debut;
      const depart = performance.now();
      await enregistrer(c, mime, ecran.getAudioTracks(), () => { yt("playVideo"); }, () => {
        const t = Math.max(tYT.current, debut);
        const ecoule = (performance.now() - depart) / 1000;
        return { src: zone(), t, fini: t >= fin || ecoule > duree + 20 };
      }, dessiner, duree);
      yt("pauseVideo");
      if (!ecran.getAudioTracks().length) setErr("Le Reel est prêt, mais sans le son : à la prochaine capture, activez « Partager l'audio de l'onglet ».");
    } finally { fermerEcran(); }
  }

  async function creer() {
    setErr(""); setSortie(null); setMsg("Préparation…");
    try { if (mode === "youtube") await depuisYouTube(); else await depuisFichier(); }
    catch (x) { setErr((x as Error).message); }
    finally { setMsg(""); }
  }

  const pret = mode === "youtube" ? ecranOk : Boolean(fichier);
  return (
    <div className="tv-vid-modale" role="dialog" aria-modal="true" aria-label="Créer le Reel">
      <div className="boite">
        <div className="row" style={{ gap: 10 }}><h2 className="tv-h2" style={{ flex: 1 }}>Reel choc 9:16 · 1 min max</h2><button type="button" className="btn small" onClick={fermer} disabled={Boolean(msg)}>Fermer</button></div>
        <div className="row" style={{ gap: 8 }} role="tablist">
          <button type="button" role="tab" className="tv-chip" aria-selected={mode === "youtube"} onClick={() => setMode("youtube")} disabled={Boolean(msg)}>Depuis YouTube</button>
          <button type="button" role="tab" className="tv-chip" aria-selected={mode === "fichier"} onClick={() => setMode("fichier")} disabled={Boolean(msg)}>Depuis un fichier</button>
        </div>
        {mode === "youtube" ? (
          <>
            <div className="tv-vid-lecteur">
              {origine ? <iframe ref={ifr} onLoad={ecouterYT} src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&start=${debut}&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&origin=${encodeURIComponent(origine)}`} title="Lecteur YouTube" allow="autoplay; encrypted-media" /> : null}
            </div>
            {ecranOk ? (
              <p className="notice" style={{ margin: 0 }}>Pas besoin de fichier. Au clic sur « Créer le Reel », Chrome demande quoi partager : choisissez <strong>« Cet onglet »</strong> et laissez <strong>« Partager l&apos;audio de l&apos;onglet »</strong> activé. VOA lit l&apos;extrait et l&apos;enregistre en temps réel : ne changez pas d&apos;onglet et ne faites pas défiler la page pendant l&apos;enregistrement.</p>
            ) : (
              <p className="notice ambre" style={{ margin: 0 }}>La capture depuis YouTube fonctionne avec Chrome ou Edge sur ordinateur. Sur téléphone, utilisez « Depuis un fichier ».</p>
            )}
          </>
        ) : !fichier ? (
          <label className="tv-vid-depot">
            <Trait d="M12 16V4M6 10l6-6 6 6M4 20h16" size={26} />
            <strong>Importer le fichier de la vidéo</strong>
            <span>MP4 ou WebM.</span>
            <input type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFichier(URL.createObjectURL(f)); }} />
          </label>
        ) : (
          <video ref={vid} src={fichier} controls playsInline style={{ width: "100%", maxHeight: 260, borderRadius: 14, background: "#000" }} onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).currentTime = debut; }} />
        )}
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: 1 }}>Début (s)<input type="number" min={0} value={debut} onChange={(e) => { const d = Math.max(0, Number(e.target.value)); setDebut(d); if (fin > d + 60) setFin(d + 60); }} /></label>
          <label className="field" style={{ flex: 1 }}>Fin (s)<input type="number" min={debut + 1} max={debut + 60} value={fin} onChange={(e) => setFin(Math.min(debut + 60, Number(e.target.value)))} /></label>
          <span className="tv-pill" style={{ alignSelf: "flex-end", marginBottom: 10 }}>{fin - debut} s / 60 s max</span>
        </div>
        <label className="field">Accroche (en haut du Reel)<input value={titre} maxLength={120} onChange={(e) => setTitre(e.target.value)} /></label>
        <label className="field">Sous-titres en français<textarea rows={3} value={st} onChange={(e) => setSt(e.target.value)} /></label>
        <span className="tv-gris" style={{ fontSize: 12 }}>Crédit incrusté : {credit}</span>
        {err ? <p className="notice rouge">{err}</p> : null}
        {msg ? <p className="notice">{msg}</p> : null}
        {sortie ? (
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <video src={sortie.url} controls style={{ width: 140, borderRadius: 12, background: "#000" }} />
            <a className="tv-btn-nuit" href={sortie.url} download={`TUVOA_reel.${sortie.ext}`}>TÉLÉCHARGER LE REEL</a>
          </div>
        ) : null}
        <button type="button" className="tv-btn-nuit" style={{ justifyContent: "center" }} onClick={creer} disabled={!pret || Boolean(msg) || fin <= debut}>{msg ? "ENREGISTREMENT EN COURS…" : "CRÉER LE REEL"}</button>
        <span className="tv-gris" style={{ fontSize: 12 }}>L&apos;enregistrement se fait en temps réel ({fin - debut} s). Gardez cet onglet ouvert.</span>
      </div>
    </div>
  );
}

function lignes(ctx: CanvasRenderingContext2D, txt: string, max: number, n: number): string[] {
  const out: string[] = []; let cur = "";
  for (const m of txt.split(/\s+/)) {
    const t = cur ? `${cur} ${m}` : m;
    if (ctx.measureText(t).width > max && cur) { out.push(cur); cur = m; if (out.length === n) break; } else cur = t;
  }
  if (cur && out.length < n) out.push(cur);
  return out;
}
