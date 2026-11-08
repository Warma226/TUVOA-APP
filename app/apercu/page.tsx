"use client";
// Aperçu avant publication (écran 8 de la maquette) : rien ne part sans passer par cet écran (sauf autopilote).
import { SourceLogo } from "@/components/SourceLogo";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar, Trait } from "@/components/BottomNav";
import { RUB, creneauLibre } from "@/components/Atelier";
import { PLATFORMS, type Platform } from "@/lib/config";
import { FORMATS, formatFor } from "@/lib/formats";
import { STATUS_LABEL, STATUS_BADGE, PLATFORM_LABEL } from "@/lib/labels";
import { getInfo, listPosts, loadPost, postAction, deletePost, type PostWithVisuals } from "@/lib/client";
import { heureFixe, prochainCreneau } from "@/lib/schedule";

type TextKey = "facebook" | "linkedin" | "tiktok" | "wp_body";
const TEXT_KEY: Record<Platform, TextKey> = { facebook: "facebook", linkedin: "linkedin", tiktok: "tiktok", wordpress: "wp_body" };
const limitOf = (p: Platform) => PLATFORMS.find((x) => x.id === p)?.limit ?? 3000;
const pad = (n: number) => String(n).padStart(2, "0");

function split(d: Date): { date: string; time: string } {
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

function splitLocal(iso: string | null): { date: string; time: string } {
  let d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60000);
  if (!iso) d = new Date(Math.ceil(d.getTime() / (15 * 60000)) * 15 * 60000); // prochain quart d'heure
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

const stripHtml = (html: string) => html.replace(/<\/(p|h\d|li)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();

export default function ApercuPage() {
  return (
    <Suspense fallback={null}>
      <Apercu />
    </Suspense>
  );
}

function Apercu() {
  const q = useSearchParams();
  const router = useRouter();
  const id = q.get("id");
  const [post, setPost] = useState<PostWithVisuals | null>(null);
  const [tab, setTab] = useState<Platform>("facebook");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [demo, setDemo] = useState(false);
  const [creneaux, setCreneaux] = useState<Date[]>([]);

  useEffect(() => {
    getInfo().then((i) => setDemo(i.demo)).catch(() => undefined);
    if (!id) return;
    loadPost(id)
      .then(async (p) => {
        setPost(p);
        let w = splitLocal(p.scheduled_at);
        if (p.status !== "publie") {
          const tous = await listPosts().catch(() => []);
          const autres = tous.filter((x) => x.id !== p.id);
          const out: Date[] = []; let from = new Date();
          for (let i = 0; i < 4; i++) { const c = creneauLibre(autres, p.rubrique, from); if (!c) break; out.push(c); from = new Date(c.getTime() + 1); }
          setCreneaux(out);
        }
        // Rubrique à heure fixe (#CyberBase à 8 h) : on propose le prochain jour libre.
        if (!p.scheduled_at && heureFixe(p.rubrique) !== undefined) {
          const slot = prochainCreneau(await listPosts().catch(() => []), p.rubrique, p.id);
          if (slot) w = split(slot);
        }
        setDate(w.date);
        setTime(w.time);
        if (p.platforms?.length) setTab(p.platforms[0]);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (!id || !post) {
    return (
      <>
        <TopBar title="Aperçu" back="/" />
        <main className="page sub">
          {error ? <p className="notice rouge">{error}</p> : <p className="muted">{id ? "Chargement…" : "Ouvre un post depuis l'accueil pour voir son aperçu."}</p>}
        </main>
      </>
    );
  }

  const current: PostWithVisuals = post;
  const text = current.texts[TEXT_KEY[tab]] ?? "";
  const limit = limitOf(tab);
  const len = text.length;
  const over = len > limit;
  const locked = current.status === "publie";
  const fmt = FORMATS[formatFor(tab, current.rubrique)];
  const when = date && time ? new Date(`${date}T${time}`) : null;
  const heure = (current.status === "planifie" && current.scheduled_at ? new Date(current.scheduled_at) : when)?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  // Visuel généré pour la #Citation (sauf visuel fourni) ; sinon image de l'article ou visuel fourni.
  const ownVisual = !(current.rubrique === "citation" && !current.visual.image);
  const missingImage = ownVisual && !current.visual.image;
  const tooLong = current.platforms.find((p) => (current.texts[TEXT_KEY[p]] ?? "").length > limitOf(p));

  async function run(label: string, fn: () => Promise<PostWithVisuals>): Promise<PostWithVisuals | null> {
    setBusy(label);
    setError("");
    setInfo("");
    try {
      const next = await fn();
      setPost(next);
      return next;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function schedule() {
    if (missingImage) return setError("Ajoute d'abord une image dans l'éditeur.");
    if (tooLong) return setError(`Le texte ${PLATFORM_LABEL[tooLong]} dépasse la limite de caractères. Corrige-le dans l'éditeur.`);
    if (!when || Number.isNaN(when.getTime())) return setError("Choisis une date et une heure.");
    if (when.getTime() < Date.now() - 60000) return setError("Cette date est passée. Choisis une heure à venir ou publie maintenant.");
    const p = await run("schedule", () => postAction("schedule", current, when.toISOString()));
    if (p && demo) setInfo("Planifié. En mode démo, la publication à l'heure prévue démarre une fois Supabase branché : d'ici là, utilise « Publier maintenant ».");
    else if (p) setInfo(`Planifié le ${new Date(p.scheduled_at ?? when).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}.`);
  }

  async function publishNow() {
    if (missingImage) return setError("Ajoute d'abord une image dans l'éditeur.");
    if (tooLong) return setError(`Le texte ${PLATFORM_LABEL[tooLong]} dépasse la limite de caractères. Corrige-le dans l'éditeur.`);
    if (!window.confirm(`Publier maintenant sur ${current.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")} ?`)) return;
    const p = await run("publish", () => postAction("publish", current));
    if (p) setInfo(p.status === "publie" ? "Publié sur tous les canaux." : "Publication terminée avec des erreurs : vois le détail plus bas.");
  }

  async function remove() {
    if (!window.confirm("Supprimer définitivement ce post ?")) return;
    setBusy("delete");
    try {
      await deletePost(current.id);
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  const statut = current.status;
  const planifie = statut === "planifie" && current.scheduled_at ? new Date(current.scheduled_at) : null;
  const dejaPub = statut === "publie";
  const echecs = current.platforms.filter((p) => current.results[p] && !current.results[p]?.ok);
  const rub = RUB[current.rubrique];
  const fullText = tab === "wordpress" ? stripHtml(text) : text;
  const pli = tab === "facebook" ? 125 : tab === "linkedin" ? 210 : 9999;
  const court = fullText.length > pli ? fullText.slice(0, pli).replace(/\s+\S*$/, "") : fullText;
  const dans = (d: Date) => {
    const m = Math.round((d.getTime() - Date.now()) / 60000);
    if (m <= 0) return "imminent";
    return m < 60 ? `dans ${m} min` : m < 1440 ? `dans ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `dans ${Math.round(m / 1440)} j`;
  };
  const jourHeure = (d: Date) => {
    const auj = new Date(); const dem = new Date(Date.now() + 864e5);
    const j = d.toDateString() === auj.toDateString() ? "Aujourd'hui" : d.toDateString() === dem.toDateString() ? "Demain" : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return { j: j.charAt(0).toUpperCase() + j.slice(1), h: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", ":") };
  };
  const canaux = current.platforms.map((p) => PLATFORM_LABEL[p]).join(" et ").replace(/ et (?=.* et )/g, ", ");
  const choisirCreneau = (d: Date) => { const s = split(d); setDate(s.date); setTime(s.time); };
  const auHaut = planifie ?? (dejaPub && current.scheduled_at ? new Date(current.scheduled_at) : when);

  return (
    <div className="tv-page">
      <div className="tv-corps tv-ap" style={{ paddingTop: 20 }}>
        <div className="tv-entete" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/calendrier" className="tv-gris" style={{ textDecoration: "none", fontWeight: 600 }}>← Calendrier</Link>
            <h1 className="tv-titre">Aperçu</h1>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {rub ? <span className="tv-pill" style={{ background: rub.pastille[0], color: rub.pastille[1] }}>{rub.nom.toUpperCase()}</span> : null}
            <span className={`badge ${STATUS_BADGE[statut]}`} style={{ fontSize: 12, padding: "6px 10px" }}>{STATUS_LABEL[statut].toUpperCase()}{planifie ? ` · ${jourHeure(planifie).j.toUpperCase()} ${jourHeure(planifie).h}` : ""}{current.auto ? " · AUTO" : ""}</span>
            {!dejaPub ? <Link href={`/editeur?id=${current.id}`} className="btn"><Trait d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" size={16} />Modifier</Link> : null}
          </div>
        </div>

        <div className="tv-ap-grille">
          <section className="tv-ap-scene" aria-label={`Aperçu ${PLATFORM_LABEL[tab]}`}>
            <div className="tv-ap-onglets" role="tablist" aria-label="Plateforme">
              {current.platforms.map((p) => {
                const r = current.results[p];
                return (
                  <button key={p} type="button" role="tab" aria-selected={tab === p} onClick={() => setTab(p)}>
                    <i data-p={p}>{p === "facebook" ? "f" : p === "linkedin" ? "in" : p === "tiktok" ? "♪" : "W"}</i>
                    {p === "wordpress" ? "Site" : PLATFORM_LABEL[p]}
                    {r ? <b data-ok={r.ok}>{r.ok ? "✓" : "!"}</b> : (current.texts[TEXT_KEY[p]] ?? "").length > limitOf(p) ? <b data-ok="false">!</b> : null}
                  </button>
                );
              })}
            </div>
            {current.platforms.length === 0 ? <p className="notice ambre">Aucune plateforme choisie pour ce post.</p> : null}
            {current.rubrique === "citation" && !current.visual.photo && !current.visual.image && !dejaPub ? (
              <div className="tv-ap-alerte" role="alert">
                <Trait d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" size={20} stroke={2} />
                <span><strong>Citation sans photo.</strong> {planifie ? `Elle ne partira pas à ${jourHeure(planifie).h} tant que la photo de l'auteur n'est pas ajoutée.` : "Ajoutez la photo de l'auteur avant de la programmer."}</span>
                <Link href={`/editeur?id=${current.id}`} className="btn small">Ajouter la photo</Link>
              </div>
            ) : null}
            <div className="tv-ap-contenu">
              <div className="tv-ap-tel">
                <div className="ecran">
                  <div className="barre"><span>{heure ?? "—"}</span><i /><span>5G</span></div>
                  <article className="post">
                    <div className="tete">
                      <span className="av">T</span>
                      <span><strong>TUVOA</strong><small>{tab === "wordpress" ? "Article du site" : `${auHaut ? jourHeure(auHaut).j : "Brouillon"}${heure ? ` à ${heure}` : ""} · 🌐`}</small></span>
                    </div>
                    {tab === "wordpress" ? <strong className="wp-titre">{current.texts.wp_title || "Sans titre"}</strong> : null}
                    {fullText ? <p>{court}{fullText.length > court.length ? <>… <span className="plus">Voir plus</span></> : null}</p> : <p className="tv-gris">Pas encore de texte pour {PLATFORM_LABEL[tab]}.</p>}
                    {current.visuals[tab] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={current.visuals[tab]} alt={`Visuel ${PLATFORM_LABEL[tab]} : ${current.visual.titre}`} style={ownVisual ? undefined : { aspectRatio: `${fmt.w} / ${fmt.h}`, objectFit: "cover" }} />
                    ) : <Link href={`/editeur?id=${current.id}`} className="no-visual">Ajoutez une image dans l&apos;éditeur</Link>}
                    {tab === "facebook" && current.visual.slides && current.visual.slides.length > 1 ? (
                      <div className="hscroll" style={{ gap: 8, padding: 8 }} aria-label="Slides du carrousel">
                        {current.visual.slides.map((u, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={u} src={u} alt={`Slide ${i + 1}`} style={{ width: 110, aspectRatio: "4 / 5", borderRadius: 8, flexShrink: 0, objectFit: "cover" }} />
                        ))}
                      </div>
                    ) : null}
                    {tab !== "wordpress" ? <div className="actions"><span>J&apos;aime</span><span>Commenter</span><span>Partager</span></div> : null}
                  </article>
                </div>
              </div>
              <div className="tv-ap-cote">
                <div className="bloc">
                  <span className="tv-kicker">LE TEXTE COMPLET</span>
                  {tab === "wordpress" ? <strong style={{ fontSize: 15 }}>{current.texts.wp_title}</strong> : null}
                  <div className="texte">{fullText || "—"}</div>
                  <span className="row" style={{ gap: 8, fontSize: 12, fontWeight: 700, color: over ? "#B42318" : "#05603A" }}>
                    <Trait d={over ? "M12 8v5M12 17h.01" : "M20 6L9 17l-5-5"} size={14} stroke={2.6} />
                    {len.toLocaleString("fr-FR")} / {limit.toLocaleString("fr-FR")} caractères{over ? " · trop long" : ""}
                  </span>
                </div>
                {current.visuals[tab] ? (
                  <div className="bloc row" style={{ gap: 12, flexDirection: "row", alignItems: "center" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={current.visuals[tab]} alt="" style={{ width: 54, height: 66, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                    <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <strong style={{ fontSize: 14 }}>Le visuel</strong>
                      <span className="tv-gris" style={{ fontSize: 12 }}>{current.rubrique === "actu" ? "Image de l'article" : ownVisual ? "Visuel fourni" : fmt.label}</span>
                      <span className="row" style={{ gap: 12 }}>
                        <a href={current.visuals[tab]} download target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 800 }}>Télécharger</a>
                        {!dejaPub ? <Link href={`/editeur?id=${current.id}`} style={{ fontSize: 12, fontWeight: 800 }}>Changer</Link> : null}
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="tv-ap-side">
            <section className={`tv-ap-quand${dejaPub ? " pub" : echecs.length ? " err" : ""}`} aria-label="Programmation">
              <span className="tv-kicker">{dejaPub ? "PUBLIÉ" : echecs.length ? "PUBLICATION INCOMPLÈTE" : planifie ? "PROGRAMMÉ" : "PAS ENCORE PROGRAMMÉ"}</span>
              {auHaut && !Number.isNaN(auHaut.getTime()) ? <strong className="grand">{jourHeure(auHaut).j}<br />à {jourHeure(auHaut).h}</strong> : <strong className="grand">Choisissez l&apos;heure</strong>}
              <span className="ligne"><i />{dejaPub ? `Sur ${canaux}` : planifie ? `Part ${dans(planifie)} sur ${canaux}` : `Sur ${canaux || "aucun canal"}`}</span>
              {Object.keys(current.results).length ? (
                <ul>
                  {current.platforms.map((p) => {
                    const r = current.results[p]; if (!r) return null;
                    return <li key={p} data-ok={r.ok}><b>{p === "wordpress" ? "Site" : PLATFORM_LABEL[p]}</b><span>{r.ok ? "publié" : r.detail}</span>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">Voir ↗</a> : null}</li>;
                  })}
                </ul>
              ) : null}
              {echecs.length && !dejaPub ? <button type="button" className="btn small" onClick={publishNow} disabled={Boolean(busy)}>{busy === "publish" ? "Nouvel essai…" : `Réessayer sur ${echecs.map((p) => PLATFORM_LABEL[p]).join(", ")}`}</button> : null}
            </section>

            {error ? <p className="notice rouge" role="alert">{error}</p> : null}
            {info ? <p className="notice" role="status">{info}</p> : null}

            {!locked ? (
              <section className="tv-carte-side" id="heure" aria-labelledby="t-heure">
                <h2 id="t-heure" className="tv-h2" style={{ fontSize: 17 }}>{planifie ? "Changer l'heure" : "Programmer"}</h2>
                {creneaux.length ? (
                  <>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {creneaux.map((c) => {
                        const s = split(c), on = s.date === date && s.time === time;
                        const jh = jourHeure(c);
                        return <button key={c.toISOString()} type="button" className="tv-ap-creneau" aria-pressed={on} onClick={() => choisirCreneau(c)}>{jh.j === "Aujourd'hui" ? jh.h : `${jh.j.split(" ")[0]} ${jh.h}`}</button>;
                      })}
                    </div>
                    <span className="tv-gris" style={{ fontSize: 12 }}>Créneaux libres pour {rub?.nom.toLowerCase() ?? "cette rubrique"}{current.rubrique === "citation" ? " (une toutes les 2 h)" : current.rubrique === "cyberbase" ? ` (chaque jour à ${heureFixe(current.rubrique)} h)` : ""}.</span>
                  </>
                ) : null}
                <div className="row" style={{ gap: 10 }}>
                  <label className="field" style={{ flex: "1 1 0", minWidth: 0 }}>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                  <label className="field" style={{ flex: "0 0 110px", minWidth: 0 }}>Heure<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
                </div>
                <button type="button" className="tv-btn-nuit" style={{ justifyContent: "center" }} onClick={schedule} disabled={Boolean(busy)}>
                  <Trait d="M3 5h18v16H3zM16 3v4M8 3v4M3 10h18" size={16} stroke={2} />{busy === "schedule" ? "UN INSTANT…" : planifie ? "REPLANIFIER" : "VALIDER ET PROGRAMMER"}
                </button>
                <button type="button" className="btn" style={{ justifyContent: "center" }} onClick={publishNow} disabled={Boolean(busy)}><Trait d="M22 2L11 13M22 2l-7 20-4-9-9-4z" size={16} />{busy === "publish" ? "Publication…" : "Publier maintenant"}</button>
              </section>
            ) : (
              <Link href="/creer" className="tv-btn-nuit" style={{ justifyContent: "center" }}>CRÉER UNE AUTRE PUBLICATION</Link>
            )}

            <section className="tv-carte-side" style={{ gap: 10 }}>
              {current.source_url ? (
                <div className="row" style={{ gap: 10 }}>
                  <SourceLogo name={current.source_name ?? "Source"} url={current.source_url} size={36} radius={10} />
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span className="tv-kicker">SOURCE</span><a href={current.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current.source_name ?? current.source_url} ↗</a></span>
                </div>
              ) : null}
              <div className="row" style={{ gap: 8, borderTop: current.source_url ? "1px solid #EDF1F7" : 0, paddingTop: current.source_url ? 10 : 0 }}>
                {planifie ? <button type="button" className="btn small" style={{ flex: 1 }} onClick={() => run("cancel", () => postAction("cancel", current))} disabled={Boolean(busy)}>Annuler la programmation</button> : null}
                <button type="button" className="btn small danger" style={{ flex: 1 }} onClick={remove} disabled={Boolean(busy)}>Supprimer</button>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {!locked ? (
        <div className="tv-ap-barre">
          <span className="row" style={{ gap: 8, fontSize: 13, fontWeight: 700 }}><i style={{ width: 8, height: 8, borderRadius: 4, background: planifie ? "#16A34A" : "#F59E0B" }} />{planifie ? `Programmé ${jourHeure(planifie).j.toLowerCase()} à ${jourHeure(planifie).h} · ${dans(planifie)}` : "Pas encore programmé"}</span>
          <div className="row" style={{ gap: 10 }}>
            <Link href={`/editeur?id=${current.id}`} className="btn" style={{ flex: 1, justifyContent: "center" }}>Modifier</Link>
            <a href="#heure" className="tv-btn-nuit" style={{ flex: 1.4, justifyContent: "center" }}>{planifie ? "Changer l'heure" : "Programmer"}</a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
