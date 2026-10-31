"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { TOPICS, allSources, allTriggers, isOn, type Trigger } from "@/lib/config";
import type { VeilleItem } from "@/lib/veille";
import { getInfo } from "@/lib/client";

function ilYa(iso: string | null, now: number): string {
  if (!iso) return "";
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} jour${j > 1 ? "s" : ""}`;
}

// Étiquette principale d'une actu, comme dans la maquette.
function etiquette(it: VeilleItem): { label: string; tone: string } {
  if (it.blocked) return { label: "Sujet sensible", tone: "rouge" };
  if (it.score >= 85) return { label: "Urgent", tone: "rouge" };
  if (it.sameStoryCount > 1) return { label: "Tendance", tone: "bleu" };
  const ageH = it.publishedAt ? (Date.now() - new Date(it.publishedAt).getTime()) / 3.6e6 : 99;
  if (ageH < 3) return { label: "Nouveau", tone: "vert" };
  return { label: `Pertinence ${it.score}`, tone: "" };
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
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const shown = useMemo(
    () => (items ?? []).filter((i) => !hidden.has(i.id) && (topic === "tout" || i.topics.includes(topic))),
    [items, topic, hidden]
  );

  return (
    <>
      <header className="topbar" style={{ alignItems: "flex-start", paddingTop: 20 }}>
        <div style={{ minWidth: 0 }}>
          <h1>Veille tech</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            <Link href="/sources" style={{ fontWeight: 600 }}>
              {nbSources === null ? "Sources" : `${nbSources} source${nbSources > 1 ? "s" : ""} suivie${nbSources > 1 ? "s" : ""}`}
            </Link>
            {updatedAt ? ` · mise à jour ${ilYa(updatedAt, now)}` : ""}
            {" · "}
            <button type="button" className="btn link" style={{ fontSize: 13, fontWeight: 600 }} onClick={load}>Actualiser</button>
          </p>
        </div>
        <Link href="/declencheurs" className="btn small ghost" style={{ flexShrink: 0 }}>
          <Icon name="eclair" size={18} />
          Déclencheurs
        </Link>
      </header>
      <main className="page" style={{ paddingTop: 8 }}>
        <div className="hscroll" role="tablist" aria-label="Thèmes">
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
          const theme = TOPICS.find((t) => t.id === it.topics[0])?.label;
          if (theme) params.set("theme", theme);
          const e = etiquette(it);
          return (
            <article key={it.id} className="card" style={{ gap: 10, padding: 16 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="muted small">
                  {it.sourceName}
                  {it.publishedAt ? ` · ${ilYa(it.publishedAt, now)}` : ""}
                </span>
                <span className={`badge ${e.tone}`}>{e.label}</span>
              </div>
              <h3 style={{ fontSize: 17, lineHeight: 1.3 }}>
                <a href={it.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{it.title}</a>
              </h3>
              {it.summary ? <p className="small" style={{ fontSize: 14, color: "var(--texte-3)", lineHeight: 1.5 }}>{it.summary.slice(0, 200)}{it.summary.length > 200 ? "…" : ""}</p> : null}
              {it.lang === "en" || it.triggers.length || it.sameStoryCount > 1 ? (
                <div className="wrap">
                  {it.triggers.map((t) => (
                    <span key={t} className="badge bleu">⚡ {triggers.find((x) => x.id === t)?.name ?? t}</span>
                  ))}
                  {it.sameStoryCount > 1 ? <span className="badge vert">{it.sameStoryCount} sources</span> : null}
                  {it.lang === "en" ? <span className="badge">Anglais · sera traduit</span> : null}
                </div>
              ) : null}
              <div className="btn-row" style={{ marginTop: 2 }}>
                <Link href={`/creer?${params.toString()}`} className="btn small primary" style={{ flex: 2 }}>
                  <Icon name="etincelle" size={16} />
                  Créer un post
                </Link>
                <button type="button" className="btn small" onClick={() => setHidden(new Set(hidden).add(it.id))}>Ignorer</button>
              </div>
            </article>
          );
        })}
      </main>
      <BottomNav />
    </>
  );
}
