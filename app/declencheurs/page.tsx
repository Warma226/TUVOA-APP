"use client";
import { useEffect, useState } from "react";
import { BottomNav, TopBar } from "@/components/BottomNav";
import { TRIGGERS, GUARDRAILS, SOURCES } from "@/lib/config";
import { PLATFORM_LABEL } from "@/lib/labels";

type S = { autopilot: boolean; triggersEnabled: Record<string, boolean> };

export default function Declencheurs() {
  const [s, setS] = useState<S | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setS(d.settings));
  }, []);

  async function save(patch: Partial<S>) {
    if (!s) return;
    setS({ ...s, ...patch, triggersEnabled: { ...s.triggersEnabled, ...(patch.triggersEnabled ?? {}) } });
    await fetch("/api/settings", { method: "POST", body: JSON.stringify(patch) });
  }

  const auto = s?.autopilot ?? false;

  return (
    <>
      <TopBar title="Déclencheurs" back="/veille" />
      <main className="page" style={{ paddingTop: 4 }}>
        <p className="muted">Quand une actu correspond, TUVOA lit l'article, le résume ou l'explique, prépare le visuel et le post.</p>

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
                width: 92, height: 46, borderRadius: 23, padding: 6, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "space-between", flexDirection: auto ? "row" : "row-reverse",
                background: auto ? "var(--bleu-nuit)" : "#374151", border: `1px solid ${auto ? "#fff" : "#6b7280"}`, color: "#fff", fontWeight: 800,
              }}
            >
              <span style={{ padding: "0 8px", fontSize: 13 }}>{auto ? "ON" : "OFF"}</span>
              <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 16, background: "#fff" }} />
            </button>
          </div>
          <p className="small" style={{ lineHeight: 1.5, color: "#e5e7eb" }}>
            {auto
              ? "Les posts détectés partent seuls, après un délai d'annulation, sauf pour les déclencheurs « Toujours manuel » et les sujets sensibles."
              : "Chaque post t'attend dans « À valider ». Rien n'est publié sans ta validation."}
          </p>
        </section>

        {TRIGGERS.map((t) => {
          const on = s?.triggersEnabled[t.id] ?? t.enabledByDefault;
          const isAuto = auto && t.mode === "general";
          return (
            <article key={t.id} className="card">
              <div className="row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>{t.name}</p>
                  <p className="muted small">{t.sources.map((id) => SOURCES.find((x) => x.id === id)?.name).filter(Boolean).join(", ")} · « {t.keywords.slice(0, 3).join(" », « ")} »</p>
                </div>
                <button type="button" role="switch" aria-checked={on} aria-label={`Activer ${t.name}`} className="switch" onClick={() => save({ triggersEnabled: { [t.id]: !on } })}>
                  <span />
                </button>
              </div>
              <div className="wrap">
                <span className="badge">{t.format === "explication" ? "Explication" : t.format === "les-deux" ? "Résumé + explication" : "Résumé"}</span>
                <span className="badge bleu">{t.platforms.map((p) => PLATFORM_LABEL[p]).join(" · ")}</span>
                <span className={`badge ${isAuto ? "ambre" : "vert"}`}>{t.mode === "manuel" ? "Toujours manuel" : isAuto ? "Autopilote" : "Manuel · aperçu"}</span>
              </div>
            </article>
          );
        })}

        <section className="card" style={{ background: "var(--gris-1)", border: 0 }}>
          <h3>Garde-fous de l'autopilote</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: "var(--texte-3)" }}>
            <li>Au moins {GUARDRAILS.minSourcesForAuto} sources différentes sur le même sujet.</li>
            <li>{GUARDRAILS.delayMinutes} minutes pour annuler avant chaque publication automatique.</li>
            <li>{GUARDRAILS.maxAutoPerDay} publications automatiques par jour au maximum.</li>
            <li>Jamais en automatique : décès, politique, accusations, conflits, justice.</li>
            <li>Les portraits restent toujours en manuel.</li>
          </ul>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
