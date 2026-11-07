"use client";
// Veille : sujet du jour, flux trié par pertinence, avis de VOA, sources qui comptent et garde-fous.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Voa from "@/components/Voa";
import { NAV_ICONS, Trait } from "@/components/BottomNav";
import { TOPICS, allSources, allTriggers, isOn, type Trigger } from "@/lib/config";
import type { VeilleItem } from "@/lib/veille";
import { getInfo } from "@/lib/client";

const COUL: Record<string, string> = { tout: "#0A2A66", burkina: "#E94A06", afrique: "#0E9F8E", cyber: "#DC2626", ia: "#7C3AED", crypto: "#D97706", startups: "#2563EB", reseaux: "#DB2777", evenements: "#4338CA", robotique: "#0891B2", smartphones: "#64748B" };
const BARRES = ["#2563EB", "#0E9F8E", "#E94A06", "#7C3AED", "#8A93A6"];

function ilYa(iso: string | null, now: number): string {
  if (!iso) return "";
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? "hier" : `il y a ${j} jours`;
}

// Étiquette principale d'une actu.
function etiquette(it: VeilleItem): { label: string; tone: string } {
  if (it.blocked) return { label: "Sujet sensible", tone: "orange" };
  if (it.score >= 85) return { label: "Urgent", tone: "rouge" };
  if (it.sameStoryCount > 1) return { label: "Tendance", tone: "bleu" };
  const ageH = it.publishedAt ? (Date.now() - new Date(it.publishedAt).getTime()) / 3.6e6 : 99;
  if (ageH < 3) return { label: "Nouveau", tone: "vert" };
  return { label: `Pertinence ${it.score}`, tone: "" };
}
const initiales = (s: string) => s.split(/[\s’'-]+/).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w)).slice(0, 3).map((w) => w[0].toUpperCase()).join("") || "?";
const themeDe = (it: VeilleItem) => TOPICS.find((t) => t.id === it.topics[0]);
function lienCreer(it: VeilleItem) {
  const params = new URLSearchParams({ src: it.url, source: it.sourceName, titre: it.title, resume: it.summary.slice(0, 400) });
  const theme = themeDe(it)?.label;
  if (theme) params.set("theme", theme);
  return `/creer?${params.toString()}`;
}

export default function Veille() {
  const [items, setItems] = useState<VeilleItem[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [topic, setTopic] = useState("tout");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [nbSources, setNbSources] = useState<number | null>(null);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [q, setQ] = useState("");
  const [compte, setCompte] = useState<{ autopilot: boolean; sources: { nom: string; n: number }[] } | null>(null);

  function load() {
    setItems(null);
    getInfo()
      .then((info) => {
        const s = info.settings;
        const sources = allSources(s.customSources).filter((x) => x.feed && isOn(s.sourcesEnabled, x.id, x.enabledByDefault));
        const trig = allTriggers(s.triggers).filter((t) => isOn(s.triggersEnabled, t.id, t.enabledByDefault));
        setNbSources(sources.length);
        setTriggers(trig);
        return fetch("/api/veille", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sources, triggers: trig }),
          cache: "no-store",
        });
      })
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setErrors(d.errors ?? (d.error ? [d.error] : []));
        setUpdatedAt(d.updatedAt ?? "");
        setNow(Date.now());
      })
      .catch(() => {
        setItems([]);
        setErrors(["Veille indisponible pour le moment. Réessaie avec « Actualiser »."]);
      });
  }
  useEffect(load, []);
  useEffect(() => {
    fetch("/api/tableau?leger=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && !d.error && !d.demo && setCompte({ autopilot: Boolean(d.autopilot), sources: d.sources ?? [] }))
      .catch(() => {});
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const visibles = useMemo(() => (items ?? []).filter((i) => !hidden.has(i.id)), [items, hidden]);
  const parTheme = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of visibles) for (const t of i.topics) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [visibles]);
  const recherche = q.trim().toLowerCase();
  const shown = useMemo(
    () => visibles.filter((i) => (topic === "tout" || i.topics.includes(topic)) && (!recherche || `${i.title} ${i.summary} ${i.sourceName}`.toLowerCase().includes(recherche))),
    [visibles, topic, recherche]
  );
  // Sujet du jour : l'actu reprise par le plus de sources, sinon la plus pertinente (hors sujets sensibles).
  const sujet = useMemo(() => {
    const ok = shown.filter((i) => !i.blocked);
    if (!ok.length) return null;
    return [...ok].sort((a, b) => b.sameStoryCount - a.sameStoryCount || b.score - a.score)[0];
  }, [shown]);
  const flux = shown.filter((i) => i.id !== sujet?.id);
  const sensibles = visibles.filter((i) => i.blocked).length;
  const themesActifs = TOPICS.filter((t) => parTheme.get(t.id));

  const avis = !items
    ? "Je parcours les sources…"
    : !sujet
      ? "Rien de marquant pour l'instant. Je relance la collecte dès que vous le voulez."
      : sujet.sameStoryCount > 1
        ? `${sujet.sameStoryCount} sources parlent de ce sujet : c'est le sujet du jour. Je vous prépare le post ?`
        : `« ${sujet.title.slice(0, 70)}${sujet.title.length > 70 ? "…" : ""} » est le plus pertinent pour TUVOA. Je vous prépare le post ?`;
  const maxSrc = Math.max(1, ...(compte?.sources ?? []).map((s) => s.n));

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        {/* En-tête */}
        <div className="tv-entete" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/" className="tv-gris tv-desk" style={{ textDecoration: "none", fontWeight: 600 }}>← Tableau de bord</Link>
            <h1 className="tv-titre">Veille</h1>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#33425C", flexWrap: "wrap" }}>
              <span className={`tv-led${items === null ? " off" : ""}`} />
              {nbSources === null ? "Lecture des sources…" : `${nbSources} source${nbSources > 1 ? "s" : ""} suivie${nbSources > 1 ? "s" : ""}`}
              {updatedAt ? ` · mise à jour ${ilYa(updatedAt, now)}` : ""}
            </span>
          </div>
          <label className="tv-recherche" style={{ flex: "1 1 260px", maxWidth: 340 }}>
            <Trait d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" size={18} stroke={2} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un sujet, un mot-clé…" aria-label="Chercher dans la veille" />
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="tv-rond" style={{ width: "auto", padding: "0 18px", borderRadius: 16, gap: 8, fontSize: 14, fontWeight: 700 }} onClick={load} disabled={items === null}>
              <Trait d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" size={18} stroke={2} />{items === null ? "Lecture…" : "Actualiser"}
            </button>
            <Link href="/sources" className="tv-btn-nuit" style={{ height: 48, padding: "0 20px", letterSpacing: 0 }}>Gérer les sources</Link>
          </div>
        </div>

        {/* Thèmes */}
        <div className="hscroll" role="tablist" aria-label="Thèmes" style={{ paddingBottom: 4 }}>
          {[{ id: "tout", label: "Tout" }, ...themesActifs].map((t) => (
            <button key={t.id} type="button" role="tab" className="tv-chip" aria-selected={topic === t.id} onClick={() => setTopic(t.id)}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: topic === t.id ? "#fff" : COUL[t.id] ?? "#64748B" }} />
              {t.label}
              <small>{t.id === "tout" ? visibles.length || "" : parTheme.get(t.id)}</small>
            </button>
          ))}
        </div>

        {errors.map((e) => <p key={e} className="notice ambre">{e}</p>)}

        <div className="tv-veille">
          <div className="tv-veille-main">
            {/* Sujet du jour */}
            {sujet ? (
              <article className="tv-sujet">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", position: "relative" }}>
                  <span className="tv-tag" style={{ background: "#E94A06", color: "#fff", fontSize: 12 }}>SUJET DU JOUR</span>
                  {sujet.topics.length ? <span className="tv-tag" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", letterSpacing: 0, fontWeight: 700, fontSize: 12 }}>{sujet.topics.map((t) => TOPICS.find((x) => x.id === t)?.label).filter(Boolean).slice(0, 2).join(" · ")}</span> : null}
                  <span style={{ fontSize: 13, color: "#C9D6F2" }}>{sujet.sameStoryCount > 1 ? `repris par ${sujet.sameStoryCount} sources` : `pertinence ${sujet.score}`}</span>
                </div>
                <h2><a className="lien" href={sujet.url} target="_blank" rel="noopener noreferrer">{sujet.title}</a></h2>
                {sujet.summary ? <p style={{ fontSize: 15, lineHeight: 1.55, color: "#DCE5F7", maxWidth: 760, position: "relative" }}>{sujet.summary.slice(0, 260)}{sujet.summary.length > 260 ? "…" : ""}</p> : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", position: "relative" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 17, background: "#fff", color: "#0A2A66", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{initiales(sujet.sourceName)}</span>
                  <span style={{ fontSize: 13, color: "#C9D6F2" }}>{sujet.sourceName}{sujet.publishedAt ? ` · ${ilYa(sujet.publishedAt, now)}` : ""}{sujet.lang === "en" ? " · en anglais, sera traduit" : ""}</span>
                  <span style={{ flex: 1 }} />
                  <Link href={lienCreer(sujet)} style={{ height: 46, padding: "0 18px", borderRadius: 14, background: "#fff", color: "#0A2A66", textDecoration: "none", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800 }}>
                    <Trait d={NAV_ICONS.studio} size={16} stroke={2} />Rédiger le post
                  </Link>
                  <a href={sujet.url} target="_blank" rel="noopener noreferrer" style={{ height: 46, padding: "0 16px", borderRadius: 14, background: "rgba(255,255,255,0.12)", color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", fontSize: 14, fontWeight: 700 }}>Lire la source</a>
                </div>
              </article>
            ) : null}

            {/* Flux */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2 className="tv-h2" style={{ fontSize: 22 }}>Le flux</h2>
              <span className="tv-gris">trié par pertinence pour TUVOA</span>
            </div>
            {items === null ? <p className="tv-gris">Lecture des sources…</p> : null}
            {items && flux.length === 0 ? <p className="tv-gris">{recherche ? "Aucune actu ne correspond à cette recherche." : "Rien d'autre pour ce thème pour l'instant."}</p> : null}
            <div className="tv-flux">
              {flux.map((it) => {
                const e = etiquette(it);
                const th = themeDe(it);
                return (
                  <article key={it.id} className="tv-actu">
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(145deg, ${COUL[th?.id ?? ""] ?? "#2563EB"}, #0A2A66)`, color: "#fff", fontFamily: "var(--font-mont)", fontWeight: 800, fontSize: 13 }}>{initiales(it.sourceName)}</span>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 12, color: "#5B6B86" }}>
                        <span className={`tv-pill ${e.tone}`}>{e.label}</span>
                        <strong style={{ color: "#33425C" }}>{it.sourceName}</strong>
                        {it.publishedAt ? <span>· {ilYa(it.publishedAt, now)}</span> : null}
                        {th ? <span>· {th.label}</span> : null}
                      </div>
                    </div>
                    <h3><a href={it.url} target="_blank" rel="noopener noreferrer">{it.title}</a></h3>
                    {it.summary ? <p style={{ fontSize: 14, color: "#33425C", lineHeight: 1.5 }}>{it.summary.slice(0, 180)}{it.summary.length > 180 ? "…" : ""}</p> : null}
                    {it.lang === "en" || it.triggers.length || it.sameStoryCount > 1 ? (
                      <div className="wrap">
                        {it.triggers.map((t) => <span key={t} className="tv-pill bleu">⚡ {triggers.find((x) => x.id === t)?.name ?? t}</span>)}
                        {it.sameStoryCount > 1 ? <span className="tv-pill vert">{it.sameStoryCount} sources</span> : null}
                        {it.lang === "en" ? <span className="tv-pill">Anglais · sera traduit</span> : null}
                      </div>
                    ) : null}
                    <div className="tv-actions">
                      <Link href={lienCreer(it)} className="btn primary">Rédiger le post</Link>
                      <a href={it.url} target="_blank" rel="noopener noreferrer" className="btn" style={{ background: "#EEF3FF", borderColor: "#EEF3FF", color: "#1D4ED8" }}>Lire la source</a>
                      <button type="button" className="btn" style={{ border: 0, background: "transparent", color: "#5B6B86" }} onClick={() => setHidden(new Set(hidden).add(it.id))}>Masquer</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Colonne droite */}
          <aside className="tv-veille-side">
            <section aria-labelledby="voa-veille" className="tv-carte-side" style={{ background: "#0A2A66", color: "#fff", flexDirection: "row", alignItems: "center", border: 0 }}>
              <span style={{ flexShrink: 0 }}><Voa humeur={items === null ? "ecoute" : "parle"} taille={70} /></span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <h2 id="voa-veille" style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>L'avis de VOA</h2>
                <span style={{ fontSize: 14, lineHeight: 1.45, color: "#DCE5F7" }}>{avis}</span>
                {sujet ? <Link href={lienCreer(sujet)} style={{ fontSize: 13, fontWeight: 700, color: "#FFB48A", textDecoration: "none" }}>Oui, prépare-le →</Link> : null}
              </div>
            </section>

            <section aria-labelledby="src" className="tv-carte-side">
              <h2 id="src" className="tv-h2" style={{ fontSize: 18 }}>Les sources qui comptent</h2>
              <span style={{ fontSize: 13, color: "#5B6B86" }}>Publications des 7 derniers jours, par source</span>
              {compte === null ? <span className="tv-gris">…</span> : compte.sources.length === 0 ? <span className="tv-gris">Pas encore de publication sourcée cette semaine.</span> : null}
              {(compte?.sources ?? []).map((s, i) => (
                <div key={s.nom} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", fontSize: 14, gap: 8 }}><strong style={{ flex: 1, minWidth: 0 }}>{s.nom}</strong><span style={{ color: "#33425C", fontWeight: 700 }}>{s.n}</span></div>
                  <span style={{ height: 8, borderRadius: 4, background: "#EDF1F7", display: "flex" }}><span style={{ width: `${Math.round((s.n / maxSrc) * 100)}%`, borderRadius: 4, background: BARRES[i % BARRES.length] }} /></span>
                </div>
              ))}
              <Link href="/sources" style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Ajouter une source →</Link>
            </section>

            <section aria-labelledby="garde" className="tv-carte-side">
              <h2 id="garde" className="tv-h2" style={{ fontSize: 18 }}>Garde-fous</h2>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: "#33425C" }}>
                Les sujets sensibles sont mis de côté et attendent votre validation{sensibles ? ` (${sensibles} en ce moment)` : ""}. Les lancements de smartphones passent après le reste.
                {compte ? (compte.autopilot ? " Le pilote automatique publie les actus validées par les déclencheurs." : " Pilote automatique en pause : rien ne part sans vous.") : ""}
              </span>
              <Link href="/declencheurs" style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Régler les déclencheurs →</Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
