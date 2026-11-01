"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { GUARDRAILS, allSources, allTriggers, isOn } from "@/lib/config";
import { PLATFORM_LABEL, FORMAT_LABEL } from "@/lib/labels";
import { getInfo, listPosts, saveSettings } from "@/lib/client";
import type { Settings } from "@/lib/settings";
import type { Post } from "@/lib/store";

export default function Declencheurs() {
  const [s, setS] = useState<Settings | null>(null);
  const [demo, setDemo] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getInfo()
      .then((d) => {
        setS(d.settings);
        setDemo(d.demo);
        return listPosts();
      })
      .then(setPosts)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function save(patch: Partial<Settings>) {
    if (!s) return;
    setS({ ...s, ...patch, triggersEnabled: { ...s.triggersEnabled, ...(patch.triggersEnabled ?? {}) } });
    await saveSettings(patch).catch((e: Error) => setError(e.message));
  }

  const auto = s?.autopilot ?? false;
  const triggers = allTriggers(s?.triggers);
  const sources = allSources(s?.customSources);
  const today = new Date().toDateString();
  const veilleToday = posts.filter((p) => p.origin === "veille" && new Date(p.created_at).toDateString() === today);
  const waiting = posts.filter((p) => p.status === "a_valider").length;

  return (
    <>
      <TopBar
        title="Déclencheurs"
        back="/veille"
        wide
        right={
          <Link href="/declencheurs/modifier" className="icon-btn primary" aria-label="Nouveau déclencheur">
            <Icon name="plus" size={22} stroke={2.2} />
          </Link>
        }
      />
      <main className="page sub wide" style={{ paddingTop: 4 }}>
        <p className="muted">Quand une actu correspond, TUVOA récupère l'article, le résume ou l'explique, prépare le visuel et le post.</p>

        {demo ? (
          <p className="notice ambre">Mode démo : les déclencheurs repèrent les actus dans la Veille, mais la création et la publication automatiques démarrent une fois Supabase branché.</p>
        ) : null}
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}

        <section className="panel" style={{ background: auto ? "var(--bleu)" : "var(--noir)" }} aria-label="Mode de publication">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <p className="small" style={{ fontWeight: 700, letterSpacing: "0.06em", color: "#c9d6ff" }}>MODE GÉNÉRAL</p>
              <p style={{ fontFamily: "var(--font-archivo)", fontWeight: 800, fontSize: 24 }}>{auto ? "Autopilote" : "Manuel"}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={auto}
              aria-label="Autopilote"
              onClick={() => save({ autopilot: !auto })}
              style={{
                width: 88, height: 44, borderRadius: 22, padding: 5, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "space-between", flexDirection: auto ? "row" : "row-reverse",
                background: auto ? "var(--bleu-nuit)" : "#374151", border: `1px solid ${auto ? "#fff" : "#6b7280"}`, color: "#fff", fontWeight: 800,
              }}
            >
              <span style={{ padding: "0 8px", fontSize: 13 }}>{auto ? "ON" : "OFF"}</span>
              <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 16, background: "#fff" }} />
            </button>
          </div>
          <p className="small" style={{ fontSize: 13, lineHeight: 1.5, color: "#e5e7eb" }}>
            {auto
              ? "Les posts détectés partent seuls, après un délai d'annulation, sauf pour les déclencheurs « Toujours manuel » et les sujets sensibles."
              : "Chaque post t'est envoyé en aperçu. Rien n'est publié sans ta validation."}
          </p>
          <p className="small" style={{ lineHeight: 1.5, color: "#e5e7eb", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 10 }}>
            Aujourd'hui : {veilleToday.length} post{veilleToday.length > 1 ? "s" : ""} préparé{veilleToday.length > 1 ? "s" : ""} par la veille, {waiting} en attente de ta validation.
          </p>
        </section>

        {triggers.length === 0 ? <p className="muted">Aucun déclencheur. Ajoute-en un avec le bouton +.</p> : null}

        <div className="cards">
        {triggers.map((t) => {
          const on = isOn(s?.triggersEnabled, t.id, t.enabledByDefault);
          const isAuto = auto && t.mode === "general";
          return (
            <article key={t.id} className="card" style={{ padding: 0, gap: 0 }}>
              <div className="row" style={{ alignItems: "flex-start", padding: "14px 14px 0" }}>
                <Link href={`/declencheurs/modifier?id=${encodeURIComponent(t.id)}`} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
                  <p style={{ fontWeight: 600, fontSize: 16 }}>{t.name}</p>
                  <p className="muted small" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.sources.map((id) => sources.find((x) => x.id === id)?.name).filter(Boolean).join(", ")}
                    {t.keywords.length ? ` · « ${t.keywords.slice(0, 3).join(" », « ")} »` : ""}
                  </p>
                </Link>
                <button type="button" role="switch" aria-checked={on} aria-label={`Activer ${t.name}`} className="switch" onClick={() => save({ triggersEnabled: { [t.id]: !on } })}>
                  <span />
                </button>
              </div>
              <Link href={`/declencheurs/modifier?id=${encodeURIComponent(t.id)}`} className="wrap" style={{ padding: "10px 14px 14px", textDecoration: "none" }} aria-label={`Modifier ${t.name}`}>
                <span className="badge">{FORMAT_LABEL[t.format]}</span>
                <span className="badge bleu">{t.platforms.length === 4 ? "Tous les canaux" : t.platforms.map((p) => PLATFORM_LABEL[p]).join(" · ")}</span>
                <span className={`badge ${isAuto ? "ambre" : "vert"}`}>{t.mode === "manuel" ? "Manuel · aperçu" : isAuto ? "Autopilote" : "Manuel · aperçu"}</span>
              </Link>
            </article>
          );
        })}
        </div>

        <section className="card" style={{ background: "var(--surface-2)", border: 0 }}>
          <h3>Garde-fous de l'autopilote</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: "var(--texte-3)" }}>
            <li>L'app choisit elle-même l'actu la plus pertinente (Afrique, cybersécurité, IA, startups ; les déclencheurs passent en priorité).</li>
            <li>Une publication toutes les {Math.round(GUARDRAILS.minGapMinutes / 60)} h au plus, entre {GUARDRAILS.autoStartHour} h et {GUARDRAILS.autoEndHour} h.</li>
            <li>{GUARDRAILS.delayMinutes} minutes pour annuler avant chaque publication automatique.</li>
            <li>{GUARDRAILS.maxAutoPerDay} publications automatiques par jour au maximum.</li>
            <li>Jamais en automatique : décès, politique, accusations, conflits, justice.</li>
            <li>Les portraits restent toujours en manuel.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
