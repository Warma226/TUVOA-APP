"use client";
// Calendrier : planning de la semaine rubrique par rubrique, le jour choisi heure par heure, et les créneaux à combler.
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NAV_ICONS, Trait } from "@/components/BottomNav";
import { PostRow, postHref, postTitle } from "@/components/PostRow";
import { RUB, Tuile } from "@/components/Atelier";
import type { Post, PostStatus } from "@/lib/store";
import type { RubriqueId } from "@/lib/config";
import { getInfo, listPosts, listPostsEntre } from "@/lib/client";
import { heureFixe } from "@/lib/schedule";

type Ligne = RubriqueId | "recap";
const LIGNES: { id: Ligne; nom: string; rythme: string; c: [string, string] }[] = [
  { id: "cyberbase", nom: "#CyberBase", rythme: `Chaque jour à ${heureFixe("cyberbase") ?? 7} h`, c: RUB.cyberbase.c },
  { id: "citation", nom: "Citations", rythme: "Toutes les 2 h", c: RUB.citation.c },
  { id: "actu", nom: "Actualités", rythme: "Pilote auto · 6 h – 20 h", c: RUB.actu.c },
  { id: "recap", nom: "Récap du vendredi", rythme: "Chaque vendredi", c: ["#93C5FD", "#0A2A66"] },
  { id: "portrait", nom: "Portrait", rythme: "Sur accord de la personne", c: RUB.portrait.c },
];
const FILTRES: { id: "tout" | PostStatus; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "planifie", label: "Planifiés" },
  { id: "a_valider", label: "À valider" },
  { id: "publie", label: "Publiés" },
  { id: "erreur", label: "À corriger" },
  { id: "brouillon", label: "Brouillons" },
];
const ETAT: Record<string, [string, string, string]> = {
  publie: ["Publié", "#D9F7E6", "#05603A"],
  planifie: ["Planifié", "#E7EEFF", "#1D4ED8"],
  a_valider: ["À valider", "#FEF3E2", "#B54708"],
  erreur: ["À corriger", "#FDE3E6", "#9F1239"],
  brouillon: ["Brouillon", "#EEF2F8", "#33425C"],
  annule: ["Annulé", "#EEF2F8", "#5B6B86"],
};

const cle = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function quand(p: Post): Date | null {
  const iso = p.status === "publie" ? Object.values(p.results ?? {}).find((r) => r?.ok)?.at ?? p.scheduled_at : p.scheduled_at;
  return iso ? new Date(iso) : p.status === "brouillon" ? new Date(p.created_at) : null;
}
const ligneDe = (p: Post): Ligne => (p.origin === "recap" ? "recap" : p.rubrique);
const sansPhoto = (p: Post) => p.rubrique === "citation" && !p.visual?.photo && !p.visual?.image;
const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const pl = (n: number, s: string) => `${n} ${s}${n > 1 ? "s" : ""}`;

export default function CalendrierPage() {
  return (
    <Suspense fallback={null}>
      <Calendrier />
    </Suspense>
  );
}

function Calendrier() {
  const q = useSearchParams();
  const recherche = (q.get("q") ?? "").trim().toLowerCase();
  const filtreInitial = FILTRES.find((f) => f.id === q.get("filtre"))?.id ?? "tout";
  const [vue, setVue] = useState<"semaine" | "liste">(recherche ? "liste" : "semaine");
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]["id"]>(filtreInitial);
  const [decalage, setDecalage] = useState(0);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [recents, setRecents] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const [jour, setJour] = useState(() => cle(new Date()));
  const [ligne, setLigne] = useState<Ligne | null>(null);
  const [auto, setAuto] = useState(false);

  const debut = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1 + decalage * 7);
  }, [decalage]);
  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i)), [debut]);

  useEffect(() => {
    setPosts(null);
    listPostsEntre(debut, new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + 7))
      .then(setPosts)
      .catch((e: Error) => { setError(e.message); setPosts([]); });
  }, [debut]);
  useEffect(() => {
    getInfo().then((i) => setAuto(i.settings.autopilot)).catch(() => {});
    if (recherche) listPosts().then(setRecents).catch(() => {});
  }, [recherche]);

  const tous = useMemo(() => {
    const m = new Map<string, Post>();
    for (const p of [...(posts ?? []), ...(recherche ? recents : [])]) m.set(p.id, p);
    return [...m.values()].filter((p) => p.status !== "annule");
  }, [posts, recents, recherche]);
  const filtres = useMemo(
    () => tous
      .filter((p) => filtre === "tout" || p.status === filtre)
      .filter((p) => !recherche || [p.title, p.idea, p.source_name, p.visual?.nom, p.visual?.titre, p.texts?.facebook].some((t) => (t ?? "").toLowerCase().includes(recherche))),
    [tous, filtre, recherche]
  );
  const parCase = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of filtres) {
      const d = quand(p);
      if (!d) continue;
      const k = `${ligneDe(p)}|${cle(d)}`;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [filtres]);
  const totalJour = (k: string) => filtres.filter((p) => { const d = quand(p); return d && cle(d) === k; }).length;
  const maxJour = Math.max(1, ...jours.map((d) => totalJour(cle(d))));
  const aujK = cle(new Date());
  const passe = (d: Date) => cle(d) < aujK;

  const nbSansPhoto = tous.filter((p) => sansPhoto(p) && ["planifie", "erreur", "a_valider"].includes(p.status)).length;
  const nbErreurs = tous.filter((p) => p.status === "erreur" && !sansPhoto(p)).length;
  const videsCyber = jours.filter((d) => !passe(d) && !(parCase.get(`cyberbase|${cle(d)}`) ?? []).length && tous.every((p) => !(p.rubrique === "cyberbase" && quand(p) && cle(quand(p) as Date) === cle(d))));
  const videsCit = jours.filter((d) => !passe(d) && tous.every((p) => !(p.rubrique === "citation" && ["planifie", "a_valider"].includes(p.status) && quand(p) && cle(quand(p) as Date) === cle(d))));
  const compte = (s: string) => (s === "tout" ? tous.length : tous.filter((p) => p.status === s).length);

  const duJour = filtres
    .filter((p) => { const d = quand(p); return d && cle(d) === jour && (!ligne || ligneDe(p) === ligne); })
    .sort((a, b) => (quand(a)?.getTime() ?? 0) - (quand(b)?.getTime() ?? 0));
  const jourDate = jours.find((d) => cle(d) === jour) ?? new Date(`${jour}T12:00:00`);
  const titreJour = (() => {
    const t = jourDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();

  function puces(l: Ligne, d: Date): React.ReactNode[] {
    const k = cle(d);
    const ps = parCase.get(`${l}|${k}`) ?? [];
    const out: React.ReactNode[] = [];
    const choisir = () => { setJour(k); setLigne(l); };
    const groupe = (statuts: PostStatus[]) => ps.filter((p) => statuts.includes(p.status));
    const pub = groupe(["publie"]), plan = groupe(["planifie", "a_valider"]), err = groupe(["erreur"]), br = groupe(["brouillon"]);
    const fixe = l === "cyberbase" || l === "recap" || l === "portrait";
    const puce = (key: string, txt: string, sorte: string) => <button key={key} type="button" className="tv-puce" data-sorte={sorte} onClick={choisir}><i />{txt}</button>;
    if (pub.length) out.push(puce("p", fixe && pub.length === 1 ? `${hm(quand(pub[0]) as Date)} · publié` : `${pub.length} publié${l === "recap" || l === "cyberbase" ? "" : "e"}${pub.length > 1 ? "s" : ""}`, "pub"));
    if (plan.length) out.push(puce("l", fixe && plan.length === 1 ? `${hm(quand(plan[0]) as Date)} · planifié` : `${plan.length} planifiée${plan.length > 1 ? "s" : ""}`, "plan"));
    const errPhoto = err.filter(sansPhoto).length + plan.filter(sansPhoto).length;
    if (errPhoto) out.push(puce("e", `${errPhoto} sans photo`, "err"));
    const errAutres = err.length - err.filter(sansPhoto).length;
    if (errAutres) out.push(puce("x", pl(errAutres, "erreur"), "err"));
    if (br.length) out.push(puce("b", pl(br.length, "brouillon"), "brouillon"));
    if (!out.length && !passe(d) && filtre === "tout") {
      if (l === "cyberbase") out.push(<Link key="v" href="/creer/cyberbase" className="tv-puce" data-sorte="vide"><i />À créer</Link>);
      else if (l === "citation" && !plan.length) out.push(<Link key="v" href="/creer/citation" className="tv-puce" data-sorte="vide"><i />Aucune · créer</Link>);
      else if (l === "actu" && auto && cle(d) >= aujK) out.push(<span key="v" className="tv-puce" data-sorte="auto"><i />+ veille auto</span>);
    }
    return out;
  }

  const groupesListe = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of filtres) {
      const d = quand(p);
      const k = d ? cle(d) : "sans-date";
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, ps]) => ({ k, ps: ps.sort((a, b) => (quand(a)?.getTime() ?? 0) - (quand(b)?.getTime() ?? 0)) }));
  }, [filtres]);

  const fin = jours[6];
  const plage = `Du ${jours[0].toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })} au ${fin.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`;

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        {/* En-tête */}
        <div className="tv-entete" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/" className="tv-gris tv-desk" style={{ textDecoration: "none", fontWeight: 600 }}>← Tableau de bord</Link>
            <h1 className="tv-titre">Calendrier</h1>
            <span style={{ fontSize: 14, color: "#33425C" }}>{plage} · chaque ligne suit le rythme d'une rubrique</span>
          </div>
          <div role="group" aria-label="Vue" className="tv-segments">
            <button type="button" aria-pressed={vue === "semaine"} onClick={() => setVue("semaine")}>Semaine</button>
            <button type="button" aria-pressed={vue === "liste"} onClick={() => setVue("liste")}>Liste</button>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="tv-rond" aria-label="Semaine précédente" onClick={() => setDecalage(decalage - 1)}><Trait d="M15 18l-6-6 6-6" size={18} stroke={2.2} /></button>
            <button type="button" className="tv-rond" style={{ width: "auto", padding: "0 16px", fontSize: 14, fontWeight: 700 }} onClick={() => { setDecalage(0); setJour(aujK); setLigne(null); }}>Aujourd'hui</button>
            <button type="button" className="tv-rond" aria-label="Semaine suivante" onClick={() => setDecalage(decalage + 1)}><Trait d="M9 18l6-6-6-6" size={18} stroke={2.2} /></button>
          </div>
          <Link href="/creer" className="tv-btn-nuit tv-desk"><Trait d={NAV_ICONS.plus} size={18} stroke={2.2} />NOUVELLE PUBLICATION</Link>
        </div>

        {recherche ? <p className="notice">Recherche : « {q.get("q")} » · <Link href="/calendrier" style={{ fontWeight: 600 }}>Tout afficher</Link></p> : null}
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}

        {/* À régler + filtres */}
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          {nbSansPhoto || nbErreurs || videsCyber.length ? <span className="tv-kicker" style={{ color: "#5B6B86" }}>À RÉGLER</span> : null}
          {nbSansPhoto ? <button type="button" className="tv-regler rouge" onClick={() => setFiltre("tout")}><i /><strong>{nbSansPhoto}</strong> citation{nbSansPhoto > 1 ? "s" : ""} sans photo</button> : null}
          {videsCyber.length ? <Link href="/creer/cyberbase" className="tv-regler orange"><i /><strong>{videsCyber.length}</strong> jour{videsCyber.length > 1 ? "s" : ""} sans #CyberBase</Link> : null}
          {nbErreurs ? <button type="button" className="tv-regler rouge" onClick={() => setFiltre("erreur")}><i /><strong>{nbErreurs}</strong> en erreur</button> : null}
          <span style={{ flex: 1 }} />
          <div className="hscroll" role="tablist" aria-label="Statut" style={{ gap: 6 }}>
            {FILTRES.map((f) => (
              <button key={f.id} type="button" role="tab" className="tv-chip" aria-selected={filtre === f.id} onClick={() => setFiltre(f.id)}>
                {f.label}{posts ? <small>{compte(f.id)}</small> : null}
              </button>
            ))}
          </div>
        </div>

        {/* Jours (téléphone) */}
        <div className="tv-mobile tv-jours-tel" role="group" aria-label="Jours">
          {jours.map((d) => {
            const k = cle(d);
            return (
              <button key={k} type="button" aria-pressed={jour === k} onClick={() => { setJour(k); setLigne(null); }}>
                <span>{d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase()}</span>
                <strong>{d.getDate()}</strong>
                <i data-vide={totalJour(k) === 0} />
              </button>
            );
          })}
        </div>

        {vue === "liste" ? (
          <section className="stack" style={{ gap: 18 }}>
            {posts === null ? <p className="tv-gris">Chargement…</p> : groupesListe.length === 0 ? <p className="tv-gris">Aucune publication pour ce filtre cette semaine.</p> : null}
            {groupesListe.map((g) => (
              <div key={g.k} className="stack">
                <h2 className="label" style={{ color: "#5B6B86" }}>{g.k === "sans-date" ? "Sans date" : new Date(`${g.k}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</h2>
                <div className="cards">{g.ps.map((p) => <PostRow key={p.id} post={p} />)}</div>
              </div>
            ))}
          </section>
        ) : (
          <div className="tv-veille">
            {/* Planning par rubrique (ordinateur) */}
            <section aria-label="Planning de la semaine par rubrique" className="tv-verre tv-desk-b tv-planning" style={{ flex: "999 1 640px", minWidth: 0 }}>
              <div className="tv-grille-semaine">
                <span className="tv-kicker" style={{ color: "#5B6B86", padding: "12px 10px", alignSelf: "end" }}>RUBRIQUE</span>
                {jours.map((d) => {
                  const k = cle(d), n = totalJour(k);
                  return (
                    <button key={k} type="button" className="tv-jour" data-auj={k === aujK} data-passe={passe(d)} aria-pressed={jour === k} onClick={() => { setJour(k); setLigne(null); }}
                      aria-label={`${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}, ${n} publication${n > 1 ? "s" : ""}`}>
                      <span className="wd">{d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase()}</span>
                      <strong>{d.getDate()}</strong>
                      <span className="tot" data-vide={n === 0}>{n ? `${n} ${passe(d) ? "publiées" : k === aujK ? "au total" : "prévues"}` : "rien de prévu"}</span>
                      <span className="barre"><span style={{ width: `${(n / maxJour) * 100}%` }} /></span>
                    </button>
                  );
                })}
                {LIGNES.map((l) => (
                  <div key={l.id} style={{ display: "contents" }}>
                    <div className="tv-ligne-nom">
                      <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `linear-gradient(145deg, ${l.c[0]}, ${l.c[1]})` }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><strong style={{ fontSize: 14 }}>{l.nom}</strong><span style={{ fontSize: 12, color: "#5B6B86" }}>{l.rythme}</span></span>
                    </div>
                    {jours.map((d) => (
                      <div key={cle(d)} className="tv-case" data-auj={cle(d) === aujK} data-choisi={cle(d) === jour && (!ligne || ligne === l.id)}>{puces(l.id, d)}</div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="tv-legende" style={{ fontSize: 12, padding: "12px 10px 0", borderTop: "1px solid rgba(201,211,227,0.5)", marginTop: 8 }}>
                <span><span style={{ width: 8, height: 8, borderRadius: 4, background: "#16A34A" }} />Publié</span>
                <span><span style={{ width: 8, height: 8, borderRadius: 4, background: "#2563EB" }} />Planifié</span>
                <span><span style={{ width: 8, height: 8, borderRadius: 4, background: "#E11D2E" }} />À corriger</span>
                <span><span style={{ width: 18, height: 14, borderRadius: 6, border: "1.5px dashed #E94A06", boxSizing: "border-box" }} />Créneau vide</span>
                <span style={{ flex: 1 }} />
                <span>Cliquez sur une case pour voir le détail du jour.</span>
              </div>
            </section>

            {/* Le jour choisi */}
            <aside className="tv-veille-side" aria-labelledby="t-jour">
              <section className="tv-carte-side">
                <div className="row" style={{ flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                  <h2 id="t-jour" className="tv-h2" style={{ fontSize: 20 }}>{titreJour}</h2>
                  {jour === aujK ? <span className="tv-tag" style={{ background: "#0A2A66", color: "#fff" }}>AUJOURD'HUI</span> : null}
                </div>
                {/* Rythme du jour (téléphone) */}
                <div className="tv-mobile" style={{ flexDirection: "column" }}>
                  {LIGNES.map((l) => {
                    const p = puces(l.id, jourDate);
                    return p.length ? (
                      <div key={l.id} className="row" style={{ gap: 10, padding: "8px 0", borderTop: "1px solid #EDF1F7", flexWrap: "wrap" }}>
                        <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: `linear-gradient(145deg, ${l.c[0]}, ${l.c[1]})` }} />
                        <strong style={{ fontSize: 14, flex: "1 1 110px" }}>{l.nom}</strong>
                        <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>{p}</span>
                      </div>
                    ) : null;
                  })}
                </div>
                {ligne ? <span className="row" style={{ gap: 8, fontSize: 13 }}><span className="tv-pill">{LIGNES.find((x) => x.id === ligne)?.nom}</span><button type="button" className="btn link" style={{ fontSize: 13 }} onClick={() => setLigne(null)}>Toutes les rubriques</button></span> : null}
                <span className="tv-gris" style={{ fontSize: 13 }}>
                  {posts === null ? "Chargement…" : duJour.length ? `${pl(duJour.filter((p) => p.status === "publie").length, "publiée")} · ${duJour.filter((p) => p.status === "erreur").length} à corriger · ${pl(duJour.filter((p) => ["planifie", "a_valider"].includes(p.status)).length, "prévue")}` : "Rien ce jour-là."}
                </span>
                <ol className="tv-fil">
                  {duJour.slice(0, 40).map((p) => {
                    const d = quand(p) as Date;
                    const e = ETAT[p.status] ?? ETAT.brouillon;
                    const photo = sansPhoto(p) && p.status !== "publie";
                    const cta = p.status === "erreur" ? (photo ? "Ajouter la photo" : "Corriger") : ["planifie", "a_valider"].includes(p.status) ? "Ouvrir" : p.status === "brouillon" ? "Reprendre" : "";
                    const lg = ligneDe(p);
                    return (
                      <li key={p.id}>
                        <span className="h">{hm(d)}</span>
                        <span className="trait" data-statut={p.status} />
                        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                          <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                            <span className="tv-pill" style={lg === "recap" ? { background: "#DBE7FF", color: "#0A2A66" } : { background: RUB[lg].pastille[0], color: RUB[lg].pastille[1] }}>{lg === "recap" ? "Récap" : RUB[lg].nom}</span>
                            <span className="tv-pill" style={{ background: e[1], color: e[2] }}>{photo && p.status === "erreur" ? "Sans photo" : e[0]}</span>
                          </span>
                          <Link href={postHref(p)} style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: "#0B1A33", textDecoration: "none" }}>{postTitle(p)}</Link>
                          <span className="row" style={{ gap: 10, fontSize: 12, color: "#5B6B86" }}>
                            {p.platforms.map((x) => ({ facebook: "Facebook", linkedin: "LinkedIn", wordpress: "Site", tiktok: "TikTok" })[x]).join(" · ")}
                            {cta ? <Link href={postHref(p)} style={{ marginLeft: "auto", fontWeight: 700, textDecoration: "none" }}>{cta} →</Link> : null}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>

              {videsCit.length || videsCyber.length ? (
                <section className="tv-voa" aria-labelledby="t-trous" style={{ flex: "none" }}>
                  <span className="tv-kicker" style={{ color: "#FFB48A" }}>CRÉNEAUX À COMBLER</span>
                  <h2 id="t-trous" style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>Cette semaine, des jours restent vides.</h2>
                  {([["citation", "Citations", videsCit], ["cyberbase", "#CyberBase", videsCyber]] as const).map(([r, nom, v]) => v.length ? (
                    <div key={r} className="row" style={{ gap: 12, padding: "10px 12px", borderRadius: 14, background: "rgba(255,255,255,0.08)" }}>
                      <Tuile rub={r} taille={30} />
                      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}><strong style={{ fontSize: 14 }}>{nom}</strong><span style={{ fontSize: 12, color: "#C9D6F2" }}>{v.map((d) => d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }).replace(".", "")).join(", ")}</span></span>
                      <Link href={`/creer/${r}`} style={{ height: 36, padding: "0 12px", borderRadius: 10, background: "#fff", color: "#0A2A66", textDecoration: "none", display: "flex", alignItems: "center", fontSize: 13, fontWeight: 800 }}>Créer</Link>
                    </div>
                  ) : null)}
                </section>
              ) : null}
            </aside>
          </div>
        )}
      </div>
      <Link href="/creer" aria-label="Nouvelle publication" className="tv-fab tv-mobile"><Trait d={NAV_ICONS.plus} size={24} stroke={2.4} /></Link>
    </div>
  );
}
