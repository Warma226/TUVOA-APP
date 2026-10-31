"use client";
// Création ou modification d'un déclencheur (écran 5 de la maquette).
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { PLATFORMS, allSources, allTriggers, type Platform, type Trigger, type TriggerFormat, type TriggerImage, type TriggerMode } from "@/lib/config";
import { getInfo, saveSettings } from "@/lib/client";
import type { Settings } from "@/lib/settings";

const FORMATS: { id: TriggerFormat; label: string }[] = [
  { id: "resume", label: "Résumé" },
  { id: "explication", label: "Explication" },
  { id: "les-deux", label: "Les deux" },
];

const IMAGES: { id: TriggerImage; titre: string; texte: string; dispo: boolean }[] = [
  { id: "visuel", titre: "Visuel TUVOA généré", texte: "Titre de l'actu sur le gabarit de la charte. Recommandé, sans risque de droits.", dispo: true },
  { id: "presse", titre: "Image officielle de presse", texte: "Prise dans l'espace presse de la marque, avec le crédit affiché.", dispo: false },
  { id: "banque", titre: "Banque d'images libre", texte: "Photo libre de droits choisie selon le sujet, avec l'auteur crédité.", dispo: false },
];

const MODES: { id: TriggerMode; titre: string; texte: string }[] = [
  { id: "manuel", titre: "Toujours manuel", texte: "Même quand l'autopilote est sur ON, ce déclencheur t'envoie l'aperçu avant de publier." },
  { id: "general", titre: "Suivre le mode général", texte: "Manuel quand le bouton est sur OFF, publication automatique quand il est sur ON." },
];

function blank(): Trigger {
  return { id: "", name: "", sources: [], keywords: [], minScore: 70, format: "resume", platforms: ["facebook", "linkedin"], mode: "manuel", image: "visuel", enabledByDefault: true };
}

function slug(name: string): string {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "declencheur";
  return `${base}-${Date.now().toString(36)}`;
}

export default function ModifierPage() {
  return (
    <Suspense fallback={null}>
      <Modifier />
    </Suspense>
  );
}

function Modifier() {
  const q = useSearchParams();
  const router = useRouter();
  const id = q.get("id");
  const [s, setS] = useState<Settings | null>(null);
  const [t, setT] = useState<Trigger | null>(null);
  const [kw, setKw] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getInfo()
      .then((d) => {
        setS(d.settings);
        const found = id ? allTriggers(d.settings.triggers).find((x) => x.id === id) : null;
        if (id && !found) setError("Ce déclencheur n'existe plus.");
        setT(found ? { image: "visuel", ...found } : blank());
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (!t || !s) {
    return (
      <>
        <TopBar title="Déclencheur" back="/declencheurs" />
        <main className="page sub">{error ? <p className="notice rouge">{error}</p> : <p className="muted">Chargement…</p>}</main>
      </>
    );
  }

  const trig: Trigger = t;
  const sources = allSources(s.customSources);
  const others = sources.filter((x) => !trig.sources.includes(x.id) && x.feed);
  const set = (patch: Partial<Trigger>) => setT({ ...trig, ...patch });
  const togglePlatform = (p: Platform) => set({ platforms: trig.platforms.includes(p) ? trig.platforms.filter((x) => x !== p) : [...trig.platforms, p] });

  function addKeyword() {
    const parts = kw.split(",").map((k) => k.trim().toLowerCase()).filter((k) => k && !trig.keywords.includes(k));
    if (parts.length) set({ keywords: [...trig.keywords, ...parts] });
    setKw("");
  }

  async function persist(list: Trigger[], enabledPatch?: Record<string, boolean>) {
    setBusy(true);
    setError("");
    try {
      await saveSettings({ triggers: list, ...(enabledPatch ? { triggersEnabled: enabledPatch } : {}) });
      router.push("/declencheurs");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function save() {
    if (!trig.name.trim()) return setError("Donne un nom au déclencheur.");
    if (trig.sources.length === 0) return setError("Choisis au moins une source à surveiller.");
    if (trig.keywords.length === 0) return setError("Ajoute au moins un mot-clé.");
    if (trig.platforms.length === 0) return setError("Choisis au moins un canal.");
    const current = allTriggers(s?.triggers);
    const next: Trigger = { ...trig, name: trig.name.trim(), id: trig.id || slug(trig.name) };
    const list = trig.id ? current.map((x) => (x.id === trig.id ? next : x)) : [...current, next];
    persist(list, trig.id ? undefined : { [next.id]: true });
  }

  function remove() {
    if (!window.confirm(`Supprimer le déclencheur « ${trig.name} » ?`)) return;
    persist(allTriggers(s?.triggers).filter((x) => x.id !== trig.id));
  }

  return (
    <>
      <TopBar title={trig.id ? "Déclencheur" : "Nouveau déclencheur"} back="/declencheurs" />
      <main className="page sub" style={{ paddingTop: 4, gap: 22 }}>
        <label className="field">
          Nom
          <input type="text" value={trig.name} onChange={(e) => set({ name: e.target.value })} placeholder="Faille de sécurité critique" />
        </label>

        <section className="stack" style={{ gap: 12 }}>
          <h2 className="section-title">1 · Quand déclencher</h2>
          <div className="stack" style={{ gap: 8 }}>
            <p className="label">Sources surveillées</p>
            <div className="wrap" style={{ gap: 8 }}>
              {trig.sources.map((sid) => (
                <span key={sid} className="tag bleu">
                  {sources.find((x) => x.id === sid)?.name ?? sid}
                  <button type="button" aria-label={`Retirer ${sources.find((x) => x.id === sid)?.name ?? sid}`} onClick={() => set({ sources: trig.sources.filter((x) => x !== sid) })}>
                    <Icon name="croix" size={14} stroke={2} />
                  </button>
                </span>
              ))}
              {others.length && !addingSource ? (
                <button type="button" className="tag add" onClick={() => setAddingSource(true)}>+ Ajouter</button>
              ) : null}
            </div>
            {addingSource ? (
              <div className="wrap" style={{ gap: 8 }} role="group" aria-label="Sources disponibles">
                {others.map((x) => (
                  <button key={x.id} type="button" className="tag add" style={{ borderStyle: "solid" }} onClick={() => { set({ sources: [...trig.sources, x.id] }); setAddingSource(false); }}>
                    + {x.name}
                  </button>
                ))}
                <button type="button" className="btn link small" onClick={() => setAddingSource(false)}>Fermer</button>
              </div>
            ) : null}
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <p className="label" id="kw-label">Mots-clés</p>
            <div className="wrap" style={{ gap: 8 }}>
              {trig.keywords.map((k) => (
                <span key={k} className="tag">
                  {k}
                  <button type="button" aria-label={`Retirer ${k}`} onClick={() => set({ keywords: trig.keywords.filter((x) => x !== k) })}>
                    <Icon name="croix" size={14} stroke={2} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="tag-input"
                aria-labelledby="kw-label"
                placeholder="+ mot-clé"
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                onBlur={addKeyword}
              />
            </div>
          </div>

          <div className="stack" style={{ gap: 4 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label className="label" htmlFor="score">Pertinence minimale</label>
              <span style={{ color: "var(--bleu)", fontWeight: 700, fontSize: 14 }}>{trig.minScore} / 100</span>
            </div>
            <input id="score" type="range" min={0} max={100} step={5} value={trig.minScore} onChange={(e) => set({ minScore: Number(e.target.value) })} />
          </div>
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="section-title">2 · Que faire de l'article</h2>
          <div className="grid3" role="radiogroup" aria-label="Que faire de l'article">
            {FORMATS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={trig.format === f.id} className="seg" onClick={() => set({ format: f.id })}>
                {f.label}
              </button>
            ))}
          </div>
          <p className="muted small">Le texte est toujours reformulé dans le ton TUVOA, avec la source citée et le lien vers l'article.</p>
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="section-title">3 · Image jointe</h2>
          <div className="stack" role="radiogroup" aria-label="Image jointe">
            {IMAGES.map((im) => (
              <button
                key={im.id}
                type="button"
                role="radio"
                aria-checked={(trig.image ?? "visuel") === im.id}
                aria-disabled={!im.dispo}
                className="option"
                style={!im.dispo ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                onClick={() => im.dispo && set({ image: im.id })}
              >
                <span className="row" style={{ justifyContent: "space-between", width: "100%" }}>
                  <span style={{ fontWeight: 600 }}>{im.titre}</span>
                  {!im.dispo ? <span className="badge">Bientôt</span> : null}
                </span>
                <span className="muted small">{im.texte}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="section-title">4 · Canaux</h2>
          <div className="grid2">
            {PLATFORMS.map((p) => (
              <button key={p.id} type="button" aria-pressed={trig.platforms.includes(p.id)} className="toggle-card" onClick={() => togglePlatform(p.id)}>
                <span>{p.label}</span>
                <Icon name={trig.platforms.includes(p.id) ? "check" : "plus"} size={16} stroke={2} />
              </button>
            ))}
          </div>
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="section-title">5 · Publication</h2>
          <div className="stack" role="radiogroup" aria-label="Publication">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={trig.mode === m.id} className="option" onClick={() => set({ mode: m.id })}>
                <span style={{ fontWeight: 600 }}>{m.titre}</span>
                <span className="muted small">{m.texte}</span>
              </button>
            ))}
          </div>
        </section>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
      </main>
      <div className="actionbar">
        <div className="btn-row">
          {trig.id ? (
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>Supprimer</button>
          ) : (
            <button type="button" className="btn" onClick={() => router.push("/declencheurs")} disabled={busy}>Annuler</button>
          )}
          <button type="button" className="btn primary" style={{ flex: 2 }} onClick={save} disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </>
  );
}
