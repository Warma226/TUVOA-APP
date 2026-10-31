"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { allSources, isOn, type Source } from "@/lib/config";
import { getInfo, saveSettings } from "@/lib/client";
import type { Settings } from "@/lib/settings";

export default function Sources() {
  const [s, setS] = useState<Settings | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    getInfo()
      .then((d) => setS(d.settings))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function toggle(src: Source) {
    if (!s) return;
    const on = !isOn(s.sourcesEnabled, src.id, src.enabledByDefault);
    setS({ ...s, sourcesEnabled: { ...s.sourcesEnabled, [src.id]: on } });
    await saveSettings({ sourcesEnabled: { [src.id]: on } }).catch((e: Error) => setError(e.message));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!s || !url.trim()) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const d = (await res.json()) as { source?: Source; error?: string };
      if (!res.ok || !d.source) throw new Error(d.error || "Impossible d'ajouter cette source.");
      const src = d.source;
      if (allSources(s.customSources).some((x) => x.id === src.id || x.feed === src.feed)) throw new Error(`${src.name} est déjà dans tes sources.`);
      const customSources = [...s.customSources, src];
      await saveSettings({ customSources, sourcesEnabled: { [src.id]: true } });
      setS({ ...s, customSources, sourcesEnabled: { ...s.sourcesEnabled, [src.id]: true } });
      setUrl("");
      setOk(`${src.name} ajoutée. Ses articles apparaîtront dans la veille.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(src: Source) {
    if (!s) return;
    const customSources = s.customSources.filter((x) => x.id !== src.id);
    setS({ ...s, customSources });
    await saveSettings({ customSources }).catch((e: Error) => setError(e.message));
  }

  return (
    <>
      <TopBar title="Sources" back="/veille" wide />
      <main className="page sub wide" style={{ paddingTop: 8 }}>
        <form className="row" onSubmit={add} style={{ alignItems: "stretch" }}>
          <label className="sr-only" htmlFor="src-url">Adresse du site à suivre</label>
          <input id="src-url" type="url" inputMode="url" placeholder="https://site-tech.com" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <button type="submit" className="btn primary" style={{ height: 48 }} disabled={busy || !s}>
            {busy ? "Recherche…" : "Ajouter"}
          </button>
        </form>
        <p className="muted small" style={{ marginTop: -8 }}>Colle l'adresse d'un site : TUVOA cherche son flux RSS.</p>
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {ok ? <p className="notice" role="status">{ok}</p> : null}

        {s === null && !error ? <p className="muted">Chargement…</p> : null}
        <div className="cards">
        {s
          ? allSources(s.customSources).map((src) => {
              const on = Boolean(src.feed) && isOn(s.sourcesEnabled, src.id, src.enabledByDefault);
              const perso = s.customSources.some((x) => x.id === src.id);
              return (
                <article key={src.id} className="card" style={{ padding: 16 }}>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 16 }}>{src.name}</p>
                      <p className="muted small">{src.domain} · {src.lang === "fr" ? "français" : "anglais"}</p>
                    </div>
                    <button type="button" role="switch" aria-checked={on} aria-label={`Suivre ${src.name}`} className="switch" disabled={!src.feed} onClick={() => toggle(src)}>
                      <span />
                    </button>
                  </div>
                  <div className="wrap">
                    <span className="badge">{src.theme}</span>
                    <span className={`badge ${!src.feed ? "ambre" : src.filterKeywords ? "bleu" : "vert"}`}>{!src.feed ? "À vérifier" : src.filterKeywords ? "Filtrée" : "Flux RSS"}</span>
                  </div>
                  <p className="small" style={{ color: "var(--texte-3)", lineHeight: 1.5 }}>{src.note}</p>
                  {perso ? (
                    <button type="button" className="btn link small" style={{ alignSelf: "flex-start", color: "var(--rouge)", gap: 4 }} onClick={() => remove(src)}>
                      <Icon name="croix" size={14} /> Retirer cette source
                    </button>
                  ) : null}
                </article>
              );
            })
          : null}
        </div>
      </main>
    </>
  );
}
