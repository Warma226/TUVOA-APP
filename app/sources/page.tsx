"use client";
import { useEffect, useState } from "react";
import { BottomNav, TopBar } from "@/components/BottomNav";
import { SOURCES } from "@/lib/config";

export default function Sources() {
  const [enabled, setEnabled] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setEnabled(d.settings.sourcesEnabled));
  }, []);

  async function toggle(id: string) {
    if (!enabled) return;
    const next = { ...enabled, [id]: !enabled[id] };
    setEnabled(next);
    await fetch("/api/settings", { method: "POST", body: JSON.stringify({ sourcesEnabled: { [id]: next[id] } }) });
  }

  return (
    <>
      <TopBar title="Sources" back="/veille" />
      <main className="page" style={{ paddingTop: 4 }}>
        <p className="muted">Pour ajouter une source, ajoute-la dans le fichier lib/config.ts du dépôt GitHub (ou demande-le à Claude).</p>
        {SOURCES.map((s) => {
          const on = enabled?.[s.id] ?? s.enabledByDefault;
          return (
            <article key={s.id} className="card">
              <div className="row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>{s.name}</p>
                  <p className="muted small">{s.domain} · {s.lang === "fr" ? "français" : "anglais"}</p>
                </div>
                <button type="button" role="switch" aria-checked={on} aria-label={`Activer ${s.name}`} className="switch" disabled={!s.feed} onClick={() => toggle(s.id)}>
                  <span />
                </button>
              </div>
              <div className="wrap">
                <span className="badge">{s.theme}</span>
                <span className={`badge ${!s.feed ? "ambre" : s.filterKeywords ? "bleu" : "vert"}`}>{!s.feed ? "À vérifier" : s.filterKeywords ? "Filtrée" : "Flux RSS"}</span>
              </div>
              <p className="small" style={{ color: "var(--texte-3)", lineHeight: 1.5 }}>{s.note}</p>
            </article>
          );
        })}
      </main>
      <BottomNav />
    </>
  );
}
