"use client";
// Déclencheurs : les règles qui transforment une info de la veille en publication, leurs chiffres,
// un banc d'essai (simulation sur les 48 dernières heures, sans rien publier), les garde-fous réglables et le journal.
import { useVoirPlus } from "@/components/VoirPlus";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NAV_ICONS, Trait } from "@/components/BottomNav";
import { GUARDRAILS, allSources, allTriggers, gardeFous, isOn, type Trigger } from "@/lib/config";
import { PLATFORM_LABEL, FORMAT_LABEL } from "@/lib/labels";
import { getInfo, listPostsEntre, saveSettings } from "@/lib/client";
import type { Settings, Garde } from "@/lib/settings";
import type { Post } from "@/lib/store";
import type { VeilleItem } from "@/lib/veille";

const COULEURS = ["#DC2626", "#2563EB", "#7C3AED", "#0E9F8E", "#E94A06", "#64748B"];
const ETAT: Record<string, [string, string]> = {
  publie: ["Publié", "#16A34A"], planifie: ["Planifié", "#2563EB"], a_valider: ["Aperçu envoyé, à valider", "#2563EB"],
  brouillon: ["Préparé en brouillon", "#9AA8BE"], erreur: ["Erreur de publication", "#E11D2E"], annule: ["Annulé", "#9AA8BE"],
};

export default function Declencheurs() {
  const [s, setS] = useState<Settings | null>(null);
  const [demo, setDemo] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  // Banc d'essai
  const [essaiBase, setEssaiBase] = useState("");
  const [motsCles, setMotsCles] = useState("");
  const [score, setScore] = useState(60);
  const [srcEssai, setSrcEssai] = useState<string[]>([]);
  const [resultat, setResultat] = useState<{ items: VeilleItem[]; ecartes: VeilleItem[] } | null>(null);
  const [test, setTest] = useState(false);
  const [vueRegles, setVueRegles] = useState<"toutes" | "actives" | "pause">("toutes");

  useEffect(() => {
    getInfo()
      .then((d) => {
        setS(d.settings);
        setDemo(d.demo);
        const n = new Date();
        return listPostsEntre(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 6), new Date(n.getTime() + 3 * 864e5));
      })
      .then(setPosts)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function save(patch: Partial<Settings>) {
    if (!s) return;
    setS({ ...s, ...patch, triggersEnabled: { ...s.triggersEnabled, ...(patch.triggersEnabled ?? {}) }, garde: { ...(s.garde ?? {}), ...(patch.garde ?? {}) } });
    await saveSettings(patch).catch((e: Error) => setError(e.message));
  }

  const auto = s?.autopilot ?? false;
  const triggers = allTriggers(s?.triggers);
  const sources = allSources(s?.customSources);
  const gf = gardeFous(s?.garde);
  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d.toDateString(); }), []);
  const stats = (t: Trigger) => {
    const ps = posts.filter((p) => p.trigger_id === t.id);
    return {
      prepares: ps.length,
      publies: ps.filter((p) => p.status === "publie").length,
      attente: ps.filter((p) => ["a_valider", "brouillon", "planifie"].includes(p.status)).length,
      parJour: jours.map((j) => ps.filter((p) => new Date(p.created_at).toDateString() === j).length),
    };
  };
  const actifs = triggers.filter((t) => isOn(s?.triggersEnabled, t.id, t.enabledByDefault));
  const totalSemaine = posts.filter((p) => p.trigger_id).length;
  const journal = posts
    .filter((p) => p.origin === "veille" && Date.now() - new Date(p.created_at).getTime() < 48 * 3.6e6)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 60);

  const vJournal = useVoirPlus(journal);

  function preRemplir(id: string) {
    setEssaiBase(id);
    const t = triggers.find((x) => x.id === id);
    if (!t) return;
    setMotsCles(t.keywords.join(", "));
    setScore(t.minScore);
    setSrcEssai(t.sources);
    setResultat(null);
  }
  async function tester() {
    const mots = motsCles.split(",").map((m) => m.trim()).filter(Boolean);
    if (!mots.length || !srcEssai.length) return setError("Indiquez au moins un mot-clé et une source pour le banc d'essai.");
    setError(""); setTest(true); setResultat(null);
    try {
      const essai: Trigger = { id: "banc-essai", name: "Banc d'essai", sources: srcEssai, keywords: mots, minScore: score, format: "resume", platforms: ["facebook"], mode: "manuel", enabledByDefault: true };
      const r = await fetch("/api/veille", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sources: sources.filter((x) => srcEssai.includes(x.id) && x.feed), triggers: [essai] }) });
      const d = (await r.json()) as { items?: VeilleItem[]; error?: string };
      if (!r.ok) throw new Error(d.error || "Veille indisponible.");
      const touches = (d.items ?? []).filter((i) => i.triggers.includes("banc-essai"));
      setResultat({ items: touches.filter((i) => i.score >= score && !i.blocked), ecartes: touches.filter((i) => i.score < score || i.blocked) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTest(false);
    }
  }
  const champGarde = (cle: keyof Garde, val: number, suffixe: string, min: number, max: number) => (
    <label className="row" style={{ gap: 6 }}>
      <input type="number" min={min} max={max} value={val} onChange={(e) => save({ garde: { [cle]: Number(e.target.value) } as Garde })} style={{ width: 76, height: 38, padding: "0 8px", borderRadius: 10, border: "1px solid #C9D3E3", fontWeight: 800, color: "#0A2A66", textAlign: "center" }} />
      <span style={{ fontSize: 12, color: "#5B6B86" }}>{suffixe}</span>
    </label>
  );

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        <div className="tv-entete" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/veille" className="tv-gris" style={{ textDecoration: "none", fontWeight: 600 }}>← Veille</Link>
            <h1 className="tv-titre">Déclencheurs</h1>
            <span style={{ fontSize: 14, color: "#33425C" }}>Les règles qui transforment une info de la veille en publication, et les garde-fous qui les retiennent.</span>
          </div>
          <div className="tv-pilote-carte">
            <span className={`tv-led${auto ? "" : " off"}`} />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}><strong style={{ fontSize: 14 }}>Pilote automatique</strong><span style={{ fontSize: 12, color: "#C9D6F2" }}>{auto ? "publie seul quand une règle est remplie" : "tout passe par votre validation"}</span></span>
            <button type="button" role="switch" aria-checked={auto} aria-label="Pilote automatique" className={`switch${auto ? " on" : ""}`} onClick={() => save({ autopilot: !auto })} disabled={!s}><span /></button>
          </div>
          <Link href="/declencheurs/modifier" className="tv-btn-nuit"><Trait d={NAV_ICONS.plus} size={16} stroke={2.2} />NOUVEAU DÉCLENCHEUR</Link>
        </div>

        {demo ? <p className="notice ambre">Mode démo : les déclencheurs repèrent les actus dans la Veille, mais la création et la publication automatiques démarrent une fois Supabase branché.</p> : null}
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}

        <div className="tv-veille">
          <div className="tv-veille-main">
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h2 className="tv-h2" style={{ fontSize: 22 }}>Vos règles</h2>
              <span className="tv-gris" style={{ flex: "1 1 220px" }}>{actifs.length} active{actifs.length > 1 ? "s" : ""} sur {triggers.length} · {totalSemaine} publication{totalSemaine > 1 ? "s" : ""} préparée{totalSemaine > 1 ? "s" : ""} en 7 jours</span>
              <div role="tablist" aria-label="Filtrer les règles" className="tv-segments">
                {([["toutes", "Toutes"], ["actives", "Actives"], ["pause", "En pause"]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={vueRegles === k} aria-pressed={vueRegles === k} onClick={() => setVueRegles(k)}>{l}</button>
                ))}
              </div>
            </div>
            {s && triggers.length === 0 ? <p className="tv-gris">Aucun déclencheur. Créez-en un avec « Nouveau déclencheur ».</p> : null}
            <div className="tv-regles-cartes">
              {triggers.map((t, i) => {
                const on = isOn(s?.triggersEnabled, t.id, t.enabledByDefault);
                if ((vueRegles === "actives" && !on) || (vueRegles === "pause" && on)) return null;
                const st = stats(t);
                const max = Math.max(1, ...st.parJour);
                const c = COULEURS[i % COULEURS.length];
                const enAuto = auto && t.mode === "general";
                const noms = t.sources.map((id) => sources.find((x) => x.id === id)?.name).filter(Boolean).join(", ");
                return (
                  <article key={t.id} className="tv-regle-carte" data-off={!on}>
                    <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                      <span className="ico" style={{ background: `linear-gradient(145deg, ${c}, #0A2A66)` }}><Trait d={NAV_ICONS.eclair} size={20} stroke={2} /></span>
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                        <strong style={{ fontFamily: "var(--font-mont)", fontSize: 16 }}>{t.name}</strong>
                        <span style={{ fontSize: 12, color: "#5B6B86" }}>{t.keywords.length ? `« ${t.keywords.slice(0, 4).join(" », « ")} »${t.keywords.length > 4 ? "…" : ""}` : "Aucun mot-clé"}</span>
                        <span style={{ fontSize: 12, color: "#5B6B86" }}>Sources : {noms || "aucune"}</span>
                      </span>
                      <button type="button" role="switch" aria-checked={on} aria-label={`Activer ${t.name}`} className={`switch${on ? " on" : ""}`} onClick={() => save({ triggersEnabled: { [t.id]: !on } })}><span /></button>
                    </div>
                    <div className="chiffres">
                      <span><strong>{st.prepares}</strong><small>préparées · 7 j</small></span>
                      <span><strong style={{ color: "#16A34A" }}>{st.publies}</strong><small>publiées</small></span>
                      <span><strong style={{ color: "#2563EB" }}>{st.attente}</strong><small>en attente</small></span>
                      <span style={{ flex: 1 }} />
                      <span aria-hidden="true" className="spark">{st.parJour.map((v, k) => <i key={k} style={{ height: Math.max(3, Math.round((v / max) * 28)), background: c }} />)}</span>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", fontSize: 12, alignItems: "center" }}>
                      <span className="tv-pill" style={enAuto ? { background: "#D9F7E6", color: "#05603A" } : { background: "#FFE8DC", color: "#9A3412" }}>{t.mode === "manuel" ? "Toujours manuel" : enAuto ? "Automatique" : "Manuel (pilote coupé)"}</span>
                      <span className="tv-pill bleu">{t.platforms.length === 4 ? "Tous les canaux" : t.platforms.map((p) => PLATFORM_LABEL[p]).join(" · ")}</span>
                      <span className="tv-pill">{FORMAT_LABEL[t.format]} · pertinence ≥ {t.minScore}</span>
                      <span style={{ flex: 1 }} />
                      <Link href={`/declencheurs/modifier?id=${encodeURIComponent(t.id)}`} style={{ fontWeight: 700, textDecoration: "none" }}>Modifier</Link>
                      <a href="#banc" onClick={() => preRemplir(t.id)} style={{ fontWeight: 700, textDecoration: "none" }}>Tester</a>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Banc d'essai */}
            <section id="banc" className="tv-carte" aria-labelledby="t-banc">
              <div className="row" style={{ alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
                <h2 id="t-banc" className="tv-h2" style={{ flex: 1 }}>Banc d'essai</h2>
                <span className="tv-gris" style={{ fontSize: 13 }}>Testez une règle sur les infos des 48 dernières heures, sans rien publier.</span>
              </div>
              <div className="tv-grille2">
                <label className="field">Partir d'une règle
                  <select value={essaiBase} onChange={(e) => preRemplir(e.target.value)}>
                    <option value="">Nouvelle règle</option>
                    {triggers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label className="field">Pertinence minimale : {score}<input type="range" min={30} max={95} value={score} onChange={(e) => setScore(Number(e.target.value))} /></label>
              </div>
              <label className="field">Mots-clés (séparés par des virgules)<input type="text" value={motsCles} onChange={(e) => setMotsCles(e.target.value)} placeholder="zero-day, faille critique, CVE" /></label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Sources</span>
                <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                  {sources.filter((x) => x.feed).map((x) => (
                    <button key={x.id} type="button" className="tv-chip" aria-selected={srcEssai.includes(x.id)} onClick={() => setSrcEssai(srcEssai.includes(x.id) ? srcEssai.filter((y) => y !== x.id) : [...srcEssai, x.id])}>{x.name}</button>
                  ))}
                </div>
              </div>
              <button type="button" className="tv-btn-nuit" style={{ alignSelf: "flex-start" }} onClick={tester} disabled={test}>{test ? "LECTURE DES SOURCES…" : "LANCER L'ESSAI"}</button>
              {resultat ? (
                <div className="tv-source" style={{ flexDirection: "column", gap: 0 }}>
                  <strong style={{ fontSize: 15, paddingBottom: 6 }}>{resultat.items.length ? `${resultat.items.length} publication${resultat.items.length > 1 ? "s auraient été déclenchées" : " aurait été déclenchée"}` : "Aucune publication n'aurait été déclenchée"}{resultat.ecartes.length ? ` · ${resultat.ecartes.length} article${resultat.ecartes.length > 1 ? "s" : ""} écarté${resultat.ecartes.length > 1 ? "s" : ""}` : ""}</strong>
                  {[...resultat.items.map((i) => [i, true] as const), ...resultat.ecartes.map((i) => [i, false] as const)].slice(0, 12).map(([i, ok]) => (
                    <div key={i.id} className="row" style={{ gap: 10, padding: "10px 0", borderTop: "1px solid #EDF1F7" }}>
                      <span className="tv-pill" style={ok ? { background: "#D9F7E6", color: "#05603A" } : {}}>{i.score}</span>
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <a href={i.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35, color: "#0B1A33", textDecoration: "none" }}>{i.title}</a>
                        <span style={{ fontSize: 11, color: "#5B6B86" }}>{i.sourceName}</span>
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: ok ? "#05603A" : "#5B6B86" }}>{ok ? "Retenu" : i.blocked ? "Sujet sensible" : "Pertinence trop basse"}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <aside className="tv-veille-side">
            <section className="tv-carte-side" aria-labelledby="t-garde">
              <h2 id="t-garde" className="tv-h2" style={{ fontSize: 18 }}>Garde-fous</h2>
              <span className="tv-gris" style={{ fontSize: 13 }}>Ils passent avant toutes les règles. Les portraits restent toujours en manuel.</span>
              {s ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {([
                    ["Heures de publication automatique", <span key="h" className="row" style={{ gap: 6 }}>{champGarde("debut", gf.debut, "h à", 0, 23)}{champGarde("fin", gf.fin, "h", 1, 24)}</span>],
                    ["Plafond quotidien", champGarde("maxParJour", gf.maxParJour, "posts / jour", 1, 60)],
                    ["Écart minimum entre deux posts", champGarde("ecart", gf.ecart, "min", 10, 240)],
                    ["Pertinence minimale en automatique", champGarde("scoreMin", gf.scoreMin, "/ 100", 30, 95)],
                  ] as const).map(([t, ctrl]) => (
                    <div key={t} className="row" style={{ gap: 12, padding: "12px 0", borderTop: "1px solid #EDF1F7", flexWrap: "wrap" }}>
                      <strong style={{ flex: "1 1 150px", fontSize: 14 }}>{t}</strong>{ctrl}
                    </div>
                  ))}
                  <div style={{ padding: "12px 0", borderTop: "1px solid #EDF1F7", display: "flex", flexDirection: "column", gap: 6 }}>
                    <strong style={{ fontSize: 14 }}>Toujours actifs</strong>
                    <span style={{ fontSize: 12, color: "#5B6B86", lineHeight: 1.5 }}>Anti-doublon : un même sujet n'est publié qu'une fois, quelle que soit la source. {GUARDRAILS.delayMinutes} minutes pour annuler avant chaque publication automatique. Jamais en automatique : décès, politique, accusations, conflits, justice.</span>
                  </div>
                </div>
              ) : <span className="tv-gris">…</span>}
            </section>

            <section className="tv-carte-side" aria-labelledby="t-journal">
              <h2 id="t-journal" className="tv-h2" style={{ fontSize: 18 }}>Préparé par la veille · 48 h</h2>
              {journal.length === 0 ? <span className="tv-gris" style={{ fontSize: 13 }}>Rien préparé ces 48 dernières heures.</span> : null}
              <ol className="tv-fil">
                {vJournal.visibles.map((p) => {
                  const t = triggers.find((x) => x.id === p.trigger_id);
                  const e = ETAT[p.status] ?? [p.status, "#9AA8BE"];
                  return (
                    <li key={p.id}>
                      <span className="h">{new Date(p.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="trait" style={{ background: e[1] }} />
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <Link href={p.status === "brouillon" ? `/editeur?id=${p.id}` : `/apercu?id=${p.id}`} style={{ fontSize: 13, fontWeight: 700, color: "#0B1A33", textDecoration: "none", lineHeight: 1.35 }}>{p.title || p.idea}</Link>
                        <span style={{ fontSize: 12, color: "#5B6B86" }}>{t ? t.name : "Choix du pilote automatique"} · {e[0]}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              {vJournal.bouton}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
