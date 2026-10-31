"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BottomNav, TopBar } from "@/components/BottomNav";
import { TOPICS, TRIGGERS } from "@/lib/config";
import type { VeilleItem } from "@/lib/veille";
import { getInfo } from "@/lib/client";

export default function Veille() {
  const [items, setItems] = useState<VeilleItem[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [topic, setTopic] = useState("tout");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [updatedAt, setUpdatedAt] = useState<string>("");

  function load() {
    setItems(null);
    getInfo()
      .then((info) => {
        const on = (m: Record<string, boolean>) => Object.keys(m).filter((k) => m[k]).join(",");
        const q = new URLSearchParams({ sources: on(info.settings.sourcesEnabled), triggers: on(info.settings.triggersEnabled) });
        return fetch(`/api/veille?${q.toString()}`, { cache: "no-store" });
      })
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setErrors(d.errors ?? (d.error ? [d.error] : []));
        setUpdatedAt(d.updatedAt ?? "");
      })
      .catch(() => {
        setItems([]);
        setErrors(["Veille indisponible pour le moment. Réessaie avec « Actualiser »."]);
      });
  }
  useEffect(load, []);

  const shown = useMemo(
    () => (items ?? []).filter((i) => !hidden.has(i.id) && (topic === "tout" || i.topics.includes(topic))),
    [items, topic, hidden]
  );

  return (
    <>
      <TopBar
        title="Veille tech"
        right={
          <Link href="/declencheurs" className="btn small ghost">⚡ Déclencheurs</Link>
        }
      />
      <main className="page" style={{ paddingTop: 4 }}>
        <p className="muted small">
          <Link href="/sources" style={{ fontWeight: 600 }}>Gérer les sources</Link>
          {updatedAt ? ` · mise à jour à ${new Date(updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
          {" · "}
          <button type="button" onClick={load} style={{ border: 0, background: "none", color: "var(--bleu)", fontWeight: 600, padding: 0, cursor: "pointer" }}>Actualiser</button>
        </p>

        <div className="wrap" role="tablist" aria-label="Thèmes">
          {[{ id: "tout", label: "Tout" }, ...TOPICS].map((t) => (
            <button key={t.id} type="button" role="tab" className="chip" aria-selected={topic === t.id} onClick={() => setTopic(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {errors.map((e) => (
          <p key={e} className="notice ambre">{e}</p>
        ))}
        {items === null ? <p className="muted">Lecture des sources…</p> : null}
        {items && shown.length === 0 ? <p className="muted">Rien pour ce thème pour l'instant.</p> : null}

        {shown.map((it) => {
          const params = new URLSearchParams({ src: it.url, source: it.sourceName, titre: it.title, resume: it.summary.slice(0, 400) });
          return (
            <article key={it.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted small">
                  {it.sourceName}
                  {it.publishedAt ? ` · ${new Date(it.publishedAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                </span>
                <span className={`badge ${it.score >= 75 ? "bleu" : ""}`}>Pertinence {it.score}</span>
              </div>
              <h3 style={{ lineHeight: 1.3 }}>{it.title}</h3>
              {it.summary ? <p className="small" style={{ color: "var(--texte-3)", lineHeight: 1.5 }}>{it.summary.slice(0, 220)}{it.summary.length > 220 ? "…" : ""}</p> : null}
              <div className="wrap">
                {it.lang === "en" ? <span className="badge">Anglais · sera traduit</span> : null}
                {it.sameStoryCount > 1 ? <span className="badge vert">{it.sameStoryCount} sources</span> : null}
                {it.triggers.map((t) => (
                  <span key={t} className="badge bleu">⚡ {TRIGGERS.find((x) => x.id === t)?.name}</span>
                ))}
                {it.blocked ? <span className="badge rouge">Sujet sensible · jamais en auto</span> : null}
              </div>
              <div className="btn-row" style={{ marginTop: 4 }}>
                <Link href={`/creer?${params.toString()}`} className="btn small primary" style={{ flex: 2 }}>Créer un post</Link>
                <button type="button" className="btn small ghost" onClick={() => setHidden(new Set(hidden).add(it.id))}>Ignorer</button>
              </div>
            </article>
          );
        })}
      </main>
      <BottomNav />
    </>
  );
}
