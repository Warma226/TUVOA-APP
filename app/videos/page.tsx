"use client";
// Vidéos à reprendre : uniquement des vidéos YouTube sous licence Creative Commons (CC BY), réutilisables
// en citant la chaîne. VOA (Gemini) repère les extraits ; la découpe 9:16 se fait ici, à partir du fichier de la vidéo.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trait } from "@/components/BottomNav";
import { useVoirPlus } from "@/components/VoirPlus";
import type { Extrait, LigneVideo } from "@/lib/youtube";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const ilya = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3.6e6);
  return h < 1 ? "à l'instant" : h < 24 ? `il y a ${h} h` : h < 48 ? "hier" : `il y a ${Math.round(h / 24)} j`;
};
const COUL = ["#E94A06", "#2563EB", "#7C3AED", "#0E9F8E"];

export default function VideosPage() {
  const [videos, setVideos] = useState<LigneVideo[] | null>(null);
  const [themes, setThemes] = useState<{ id: string; nom: string }[]>([]);
  const [theme, setTheme] = useState("tout");
  const [langue, setLangue] = useState("toutes");
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
      setVideos(d.videos); setThemes(d.themes); setNote(d.note || "");
      if (!sel && d.videos[0]) setSel(d.videos[0].id);
    } catch (e) { setError((e as Error).message); setVideos([]); } finally { setBusy(""); }
  }
  useEffect(() => { void charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const liste = useMemo(() => (videos ?? []).filter((v) => (theme === "tout" || v.info.theme === theme) && (langue === "toutes" || (langue === "fr" ? v.info.langue === "fr" : v.info.langue !== "fr"))), [videos, theme, langue]);
  const vListe = useVoirPlus(liste, 6, `${theme}|${langue}`);
  const v = (videos ?? []).find((x) => x.id === sel) ?? null;
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
  const lien = (ex: Extrait) => `https://youtu.be/${v?.id}?t=${ex.debut}`;
  const credit = v ? `Source : ${v.info.chaine} (licence CC BY) · youtube.com/watch?v=${v.id}` : "";
  const idee = (ex: Extrait) => `${ex.titre}. ${ex.soustitres}\n\n${credit}`;
  const embed = v ? `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&modestbranding=1${lecture ? `&start=${lecture.debut}&end=${lecture.fin}&autoplay=1` : ""}` : "";

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        <div className="tv-entete" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/veille" className="tv-gris" style={{ textDecoration: "none", fontWeight: 600 }}>← Veille</Link>
            <h1 className="tv-titre">Vidéos à reprendre</h1>
            <span style={{ fontSize: 14, color: "#33425C" }}>Uniquement des vidéos YouTube réutilisables (licence CC BY). VOA repère les passages à couper pour vos réseaux.</span>
          </div>
          <button type="button" className="btn" onClick={() => charger(true)} disabled={Boolean(busy)}><Trait d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" size={16} />{busy === "maj" ? "Recherche…" : "Chercher de nouvelles vidéos"}</button>
        </div>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {note ? <p className="notice ambre">{note}</p> : null}
        {info ? <p className="notice vert" role="status">{info}</p> : null}

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {[{ id: "tout", nom: "Tous les thèmes" }, ...themes].map((t) => <button key={t.id} type="button" className="tv-chip" aria-selected={theme === t.id} onClick={() => setTheme(t.id)}>{t.nom}</button>)}
          <span style={{ width: 12 }} />
          {[["toutes", "Toutes langues"], ["fr", "Français"], ["autres", "Autres (sous-titrées)"]].map(([k, l]) => <button key={k} type="button" className="tv-chip" aria-selected={langue === k} onClick={() => setLangue(k)}>{l}</button>)}
        </div>

        <div className="tv-vid">
          <section className="tv-vid-liste" aria-label="Vidéos proposées">
            <span className="tv-kicker" style={{ color: "#5B6B86" }}>PROPOSÉES · 7 JOURS · PAR PERTINENCE</span>
            {videos === null ? <p className="tv-gris">Chargement…</p> : liste.length === 0 ? <p className="tv-gris" style={{ fontSize: 13 }}>Aucune vidéo réutilisable pour ce filtre. Lancez « Chercher de nouvelles vidéos ».</p> : null}
            {vListe.visibles.map((x) => (
              <button key={x.id} type="button" className="tv-vid-carte" aria-pressed={sel === x.id} onClick={() => { setSel(x.id); setExt(0); setLecture(null); }}>
                <span className="mini">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {x.info.miniature ? <img src={x.info.miniature} alt="" /> : null}
                  <b>{mmss(x.info.duree)}</b>
                </span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <strong>{x.info.titre}</strong>
                  <small>{x.info.chaine} · {(x.info.langue || "?").toUpperCase()} · {ilya(x.info.publie)}</small>
                  <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    <span className="tv-pill vert">CC BY</span>
                    {x.extraits?.length ? <span style={{ fontSize: 12, fontWeight: 800, color: "#2563EB" }}>{x.extraits.length} extraits</span> : null}
                    <span style={{ fontSize: 12, color: "#5B6B86" }}>pertinence {x.pertinence}</span>
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
                  <div className="tv-vid-licence"><Trait d="M20 6L9 17l-5-5" size={18} stroke={2.6} /><span><strong>Licence Creative Commons (CC BY), vérifiée sur YouTube.</strong> Vous pouvez couper et republier en citant la chaîne : VOA ajoute le crédit sur la vidéo et dans le texte.</span></div>
                </div>

                {!extraits.length ? (
                  <div className="tv-carte" style={{ alignItems: "flex-start", gap: 10 }}>
                    <strong style={{ fontSize: 16 }}>VOA n&apos;a pas encore regardé cette vidéo.</strong>
                    <span className="tv-gris" style={{ fontSize: 13 }}>Il repère 3 ou 4 passages de 20 à 45 s qui tiennent seuls, avec les sous-titres en français. Compter une à deux minutes.</span>
                    <div className="row" style={{ gap: 8 }}>
                      <button type="button" className="tv-btn-nuit" onClick={reperer} disabled={Boolean(busy)}>{busy === "extraits" ? "VOA REGARDE LA VIDÉO…" : "REPÉRER LES EXTRAITS"}</button>
                      <button type="button" className="btn" onClick={() => ecarter(v.id)}>Écarter cette vidéo</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row" style={{ alignItems: "baseline", gap: 10 }}><h2 className="tv-h2" style={{ flex: 1 }}>{extraits.length} extraits repérés par VOA</h2><button type="button" className="btn link small" onClick={reperer} disabled={Boolean(busy)}>{busy === "extraits" ? "…" : "Relancer"}</button></div>
                    {extraits.map((x, i) => (
                      <div key={i} className="tv-vid-extrait" data-on={i === ext}>
                        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                          <i style={{ background: i === ext ? COUL[0] : COUL[1] }}>{i + 1}</i>
                          <button type="button" className="titre" onClick={() => setExt(i)}>{x.titre}</button>
                          <code>{mmss(x.debut)} → {mmss(x.fin)} · {x.fin - x.debut} s</code>
                        </div>
                        <span style={{ fontSize: 13, color: "#33425C" }}>{x.pourquoi}</span>
                        {i === ext && x.soustitres ? <div className="st"><b>SOUS-TITRES FR · </b>{x.soustitres}</div> : null}
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="btn small" onClick={() => { setExt(i); setLecture({ debut: x.debut, fin: x.fin }); }}><Trait d="M8 5v14l11-7z" size={14} />Lire</button>
                          <button type="button" className={i === ext ? "tv-btn-nuit" : "btn small"} style={i === ext ? { height: 40, fontSize: 13 } : undefined} onClick={() => { setExt(i); setDecoupe(x); }}><Trait d="M6 2v20M18 2v20M2 12h20" size={14} />Couper en Reel 9:16</button>
                          <Link href={`/creer/actu?idee=${encodeURIComponent(idee(x))}`} className="btn small">Écrire le post</Link>
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
              <h2 className="tv-h2" style={{ fontSize: 17 }}>Comment couper un extrait</h2>
              <ol className="tv-vid-etapes">
                <li><b>1</b><span>Choisissez l&apos;extrait, puis « Couper en Reel 9:16 ».</span></li>
                <li><b>2</b><span>Importez le fichier de la vidéo. YouTube n&apos;autorise pas le téléchargement depuis le site : demandez-le à la chaîne, ou utilisez une copie fournie par son auteur.</span></li>
                <li><b>3</b><span>VOA coupe au bon minutage, recadre en vertical, incruste les sous-titres en français, le logo TUVOA et le crédit de la chaîne.</span></li>
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
      {decoupe && v ? <Decoupe extrait={decoupe} credit={`Source : ${v.info.chaine} (CC BY)`} titre={decoupe.titre} fermer={() => setDecoupe(null)} /> : null}
    </div>
  );
}

// Découpe 9:16 dans le navigateur : la vidéo importée est lue de « debut » à « fin » et enregistrée sur un canvas
// 1080 × 1920 avec sous-titres, logo TUVOA et crédit.
function Decoupe({ extrait, credit, titre, fermer }: { extrait: Extrait; credit: string; titre: string; fermer: () => void }) {
  const [fichier, setFichier] = useState<string | null>(null);
  const [debut, setDebut] = useState(extrait.debut);
  const [fin, setFin] = useState(extrait.fin);
  const [st, setSt] = useState(extrait.soustitres);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sortie, setSortie] = useState<{ url: string; ext: string } | null>(null);
  const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => () => { if (fichier) URL.revokeObjectURL(fichier); }, [fichier]);

  async function couper() {
    const v = vid.current; if (!v || !fichier) return;
    setErr(""); setSortie(null);
    const W = 1080, H = 1920;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d"); if (!ctx) return setErr("Canvas indisponible.");
    const types = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
    const mime = types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    if (!mime) return setErr("Ce navigateur ne sait pas enregistrer de vidéo. Essayez avec Chrome.");
    // Sous-titres découpés en morceaux qui défilent sur la durée de l'extrait
    const mots = st.split(/\s+/).filter(Boolean), parBloc = 9;
    const blocs: string[] = []; for (let i = 0; i < mots.length; i += parBloc) blocs.push(mots.slice(i, i + parBloc).join(" "));
    const duree = Math.max(1, fin - debut);
    const dessiner = () => {
      ctx.fillStyle = "#061A44"; ctx.fillRect(0, 0, W, H);
      const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
      // fond : la vidéo agrandie et assombrie ; devant : la vidéo entière, centrée
      const sFond = Math.max(W / vw, H / vh);
      ctx.globalAlpha = 0.35; ctx.drawImage(v, (W - vw * sFond) / 2, (H - vh * sFond) / 2, vw * sFond, vh * sFond); ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(6,26,68,0.55)"; ctx.fillRect(0, 0, W, H);
      const s = Math.min(W / vw, (H * 0.6) / vh), dw = vw * s, dh = vh * s, y0 = H * 0.32 - dh / 2 + 120;
      ctx.drawImage(v, (W - dw) / 2, y0, dw, dh);
      // titre
      ctx.fillStyle = "#fff"; ctx.font = "800 64px Montserrat, sans-serif"; ctx.textAlign = "center";
      lignes(ctx, titre, W - 160, 2).forEach((l, i) => ctx.fillText(l, W / 2, 330 + i * 76));
      // sous-titre courant
      const k = Math.min(blocs.length - 1, Math.floor(((v.currentTime - debut) / duree) * blocs.length));
      const b = blocs[Math.max(0, k)];
      if (b) {
        ctx.font = "700 54px Inter, sans-serif";
        const ls = lignes(ctx, b, W - 200, 3), hb = ls.length * 70 + 50, yb = y0 + dh + 90;
        ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.beginPath(); ctx.roundRect(80, yb, W - 160, hb, 28); ctx.fill();
        ctx.fillStyle = "#fff"; ls.forEach((l, i) => ctx.fillText(l, W / 2, yb + 70 + i * 70));
      }
      // logo + crédit
      ctx.fillStyle = "#2563EB"; ctx.beginPath(); ctx.roundRect(70, 90, 150, 150, 38); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "800 38px Montserrat, sans-serif"; ctx.fillText("TUVOA", 145, 175);
      ctx.fillStyle = "#CFDCFF"; ctx.font = "700 15px Montserrat, sans-serif"; ctx.fillText("TECH MEDIA", 145, 205);
      ctx.fillStyle = "#C9D6F2"; ctx.font = "600 30px Inter, sans-serif"; ctx.fillText(credit, W / 2, H - 120);
    };
    try {
      v.currentTime = debut; await new Promise((ok) => v.addEventListener("seeked", ok, { once: true }));
      dessiner();
      const flux = c.captureStream(30);
      const son = (v as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
      son?.getAudioTracks().forEach((t) => flux.addTrack(t));
      const rec = new MediaRecorder(flux, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const morceaux: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) morceaux.push(e.data); };
      const fini = new Promise<void>((ok) => { rec.onstop = () => ok(); });
      v.muted = false; rec.start(200); await v.play();
      await new Promise<void>((ok) => {
        const pas = () => {
          dessiner();
          setMsg(`Découpe en cours… ${Math.min(100, Math.round(((v.currentTime - debut) / duree) * 100))} %`);
          if (v.currentTime >= fin || v.ended) ok(); else requestAnimationFrame(pas);
        };
        requestAnimationFrame(pas);
      });
      v.pause(); rec.stop(); await fini; setMsg("");
      const type = mime.split(";")[0];
      setSortie({ url: URL.createObjectURL(new Blob(morceaux, { type })), ext: type === "video/mp4" ? "mp4" : "webm" });
    } catch (x) { setErr((x as Error).message); setMsg(""); }
  }

  return (
    <div className="tv-vid-modale" role="dialog" aria-modal="true" aria-label="Couper l'extrait">
      <div className="boite">
        <div className="row" style={{ gap: 10 }}><h2 className="tv-h2" style={{ flex: 1 }}>Couper en Reel 9:16</h2><button type="button" className="btn small" onClick={fermer}>Fermer</button></div>
        {!fichier ? (
          <label className="tv-vid-depot">
            <Trait d="M12 16V4M6 10l6-6 6 6M4 20h16" size={26} />
            <strong>Importer le fichier de la vidéo</strong>
            <span>MP4 ou WebM fourni par la chaîne (licence CC BY).</span>
            <input type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFichier(URL.createObjectURL(f)); }} />
          </label>
        ) : (
          <video ref={vid} src={fichier} controls playsInline style={{ width: "100%", maxHeight: 260, borderRadius: 14, background: "#000" }} onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).currentTime = debut; }} />
        )}
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: 1 }}>Début (s)<input type="number" min={0} value={debut} onChange={(e) => setDebut(Math.max(0, Number(e.target.value)))} /></label>
          <label className="field" style={{ flex: 1 }}>Fin (s)<input type="number" min={debut + 1} value={fin} onChange={(e) => setFin(Number(e.target.value))} /></label>
          <span className="tv-pill" style={{ alignSelf: "flex-end", marginBottom: 10 }}>{mmss(debut)} → {mmss(fin)}</span>
        </div>
        <label className="field">Sous-titres en français<textarea rows={4} value={st} onChange={(e) => setSt(e.target.value)} /></label>
        <span className="tv-gris" style={{ fontSize: 12 }}>Crédit incrusté : {credit}</span>
        {err ? <p className="notice rouge">{err}</p> : null}
        {msg ? <p className="notice">{msg}</p> : null}
        {sortie ? (
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <video src={sortie.url} controls style={{ width: 140, borderRadius: 12, background: "#000" }} />
            <a className="tv-btn-nuit" href={sortie.url} download={`TUVOA_extrait.${sortie.ext}`}>TÉLÉCHARGER LE REEL</a>
          </div>
        ) : null}
        <button type="button" className="tv-btn-nuit" style={{ justifyContent: "center" }} onClick={couper} disabled={!fichier || Boolean(msg) || fin <= debut}>{msg ? "DÉCOUPE EN COURS…" : "COUPER L'EXTRAIT"}</button>
        <span className="tv-gris" style={{ fontSize: 12 }}>La découpe se fait en temps réel dans votre navigateur ({fin - debut} s). Gardez cet onglet ouvert.</span>
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
