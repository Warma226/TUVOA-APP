"use client";
// Éditeur + aperçu avant publication : rien ne part sans passer par cet écran (sauf autopilote).
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BottomNav, TopBar } from "@/components/BottomNav";
import { PLATFORMS, type Platform } from "@/lib/config";
import { STATUS_LABEL, STATUS_BADGE, PLATFORM_LABEL } from "@/lib/labels";
import type { Post } from "@/lib/store";

type PostWithVisuals = Post & { visuals: Record<string, string> };
type TextKey = "facebook" | "linkedin" | "tiktok" | "wp_body";

const TEXT_KEY: Record<Platform, TextKey> = { facebook: "facebook", linkedin: "linkedin", tiktok: "tiktok", wordpress: "wp_body" };
const ACTIONS: { id: string; label: string }[] = [
  { id: "raccourcir", label: "Raccourcir" },
  { id: "reformuler", label: "Reformuler" },
  { id: "expliquer", label: "Expliquer simplement" },
  { id: "ton", label: "Ton TUVOA" },
  { id: "traduire", label: "Traduire" },
];

export default function ApercuPage() {
  return (
    <Suspense fallback={null}>
      <Apercu />
    </Suspense>
  );
}

function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Apercu() {
  const q = useSearchParams();
  const router = useRouter();
  const id = q.get("id");
  const [post, setPost] = useState<PostWithVisuals | null>(null);
  const [tab, setTab] = useState<Platform>("facebook");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [when, setWhen] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/posts?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setError(d.error);
        setPost(d.post);
        setWhen(toLocalInput(d.post.scheduled_at));
        if (d.post.platforms?.length) setTab(d.post.platforms[0]);
      });
  }, [id]);

  if (!id) {
    return (
      <>
        <TopBar title="Aperçu" back="/" />
        <main className="page">
          <p className="muted">Ouvre un post depuis l'accueil pour voir son aperçu.</p>
        </main>
        <BottomNav />
      </>
    );
  }
  if (!post) {
    return (
      <>
        <TopBar title="Aperçu" back="/" />
        <main className="page">{error ? <p className="notice rouge">{error}</p> : <p className="muted">Chargement…</p>}</main>
        <BottomNav />
      </>
    );
  }

  const current: PostWithVisuals = post;
  const key = TEXT_KEY[tab];
  const text = current.texts[key] ?? "";
  const limit = PLATFORMS.find((p) => p.id === tab)?.limit ?? 3000;
  const len = text.length;
  const over = len > limit;
  const near = !over && len > limit * 0.8;
  const locked = current.status === "publie";

  function update(patch: Partial<Post>) {
    setPost({ ...current, ...patch });
    setDirty(true);
  }
  function setText(value: string) {
    update({ texts: { ...current.texts, [key]: value } });
  }

  async function call(body: Record<string, unknown>, label: string): Promise<PostWithVisuals | null> {
    setBusy(label);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/posts", { method: "POST", body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur");
      if (d.post) {
        setPost(d.post);
        setDirty(false);
      }
      return d.post ?? null;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  }

  const save = () => call({ action: "save", post: current }, "save");

  async function saveIfNeeded(): Promise<boolean> {
    if (!dirty) return true;
    return Boolean(await save());
  }

  async function rewrite(action: string) {
    if (!text.trim()) return setError("Écris d'abord un texte à retravailler.");
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({ mode: "rewrite", action, text, platform: PLATFORM_LABEL[tab] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setText(d.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function schedule() {
    if (over) return setError(`Le texte ${PLATFORM_LABEL[tab]} dépasse la limite de caractères.`);
    if (!when) return setError("Choisis une date et une heure.");
    if (!(await saveIfNeeded())) return;
    const p = await call({ action: "schedule", id: current.id, at: new Date(when).toISOString() }, "schedule");
    if (p) setInfo(`Planifié le ${new Date(p.scheduled_at ?? when).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}.`);
  }

  async function publishNow() {
    const tooLong = current.platforms.find((p) => (current.texts[TEXT_KEY[p]] ?? "").length > (PLATFORMS.find((x) => x.id === p)?.limit ?? 3000));
    if (tooLong) return setError(`Le texte ${PLATFORM_LABEL[tooLong]} dépasse la limite de caractères.`);
    if (!(await saveIfNeeded())) return;
    const p = await call({ action: "publish", id: current.id }, "publish");
    if (p) setInfo(p.status === "publie" ? "Publié sur tous les canaux." : "Publication terminée avec des erreurs : vois le détail plus bas.");
  }

  async function remove() {
    if (!window.confirm("Supprimer définitivement ce post ?")) return;
    setBusy("delete");
    const res = await fetch("/api/posts", { method: "POST", body: JSON.stringify({ action: "delete", id: current.id }) });
    setBusy("");
    if (res.ok) router.push("/");
    else setError("Suppression impossible. Réessaie.");
  }

  return (
    <>
      <TopBar title="Aperçu" back="/" right={<span className={`badge ${STATUS_BADGE[current.status]}`}>{STATUS_LABEL[current.status]}{current.auto ? " · auto" : ""}</span>} />
      <main className="page" style={{ paddingTop: 4 }}>
        {current.source_url ? (
          <p className="muted small">
            Source : <a href={current.source_url} target="_blank" rel="noopener noreferrer">{current.source_name ?? current.source_url}</a>
          </p>
        ) : null}

        <div className="wrap" role="tablist" aria-label="Plateforme">
          {current.platforms.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={tab === p} className="chip" onClick={() => setTab(p)}>
              {PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>

        {current.platforms.length === 0 ? <p className="notice ambre">Aucune plateforme choisie pour ce post.</p> : null}

        <section className="stack" aria-label="Visuel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="visuel" src={current.visuals[tab]} alt={`Visuel ${PLATFORM_LABEL[tab]} : ${current.visual.titre}`} />
          {dirty ? <p className="muted small">Enregistre pour mettre le visuel à jour.</p> : null}
          <label className="field">
            {current.rubrique === "portrait" ? "Nom sur le visuel" : "Titre du visuel"}
            <input
              type="text"
              value={current.rubrique === "portrait" ? current.visual.nom ?? current.visual.titre : current.visual.titre}
              disabled={locked}
              onChange={(e) =>
                update({ visual: current.rubrique === "portrait" ? { ...current.visual, nom: e.target.value, titre: e.target.value } : { ...current.visual, titre: e.target.value } })
              }
            />
          </label>
          <label className="field">
            {current.rubrique === "portrait" ? "Spécialité" : "Texte du visuel"}
            <textarea
              rows={3}
              value={current.rubrique === "portrait" ? current.visual.specialite ?? current.visual.texte : current.visual.texte}
              disabled={locked}
              onChange={(e) =>
                update({ visual: current.rubrique === "portrait" ? { ...current.visual, specialite: e.target.value, texte: e.target.value } : { ...current.visual, texte: e.target.value } })
              }
            />
          </label>
        </section>

        <section className="stack" aria-label="Texte">
          {tab === "wordpress" ? (
            <label className="field">
              Titre de l'article
              <input type="text" value={current.texts.wp_title} disabled={locked} onChange={(e) => update({ texts: { ...current.texts, wp_title: e.target.value } })} />
            </label>
          ) : null}
          <label className="field">
            {tab === "wordpress" ? "Article (HTML simple : <p>, <h2>, <ul>)" : `Texte ${PLATFORM_LABEL[tab]}`}
            <textarea rows={tab === "wordpress" ? 12 : 7} value={text} disabled={locked} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="counter" aria-live="polite">
            <div className="bar" aria-hidden="true">
              <div style={{ width: `${Math.min(100, Math.round((len / limit) * 100))}%`, background: over ? "var(--rouge)" : near ? "var(--orange)" : "var(--bleu)" }} />
            </div>
            <span style={{ color: over ? "var(--rouge)" : undefined }}>
              {len.toLocaleString("fr-FR")} / {limit.toLocaleString("fr-FR")}
            </span>
          </div>
          {!locked ? (
            <div className="wrap" aria-label="Assistant IA">
              {ACTIONS.map((a) => (
                <button key={a.id} type="button" className="chip" disabled={Boolean(busy)} onClick={() => rewrite(a.id)}>
                  {busy === a.id ? "…" : `✦ ${a.label}`}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {Object.keys(current.results).length ? (
          <section className="card" aria-label="Résultats de publication">
            <h3>Publication</h3>
            {current.platforms.map((p) => {
              const r = current.results[p];
              if (!r) return null;
              return (
                <p key={p} className="small" style={{ color: r.ok ? "var(--vert)" : "var(--rouge)", lineHeight: 1.5 }}>
                  <strong>{PLATFORM_LABEL[p]}</strong> : {r.detail}
                  {r.url ? (
                    <>
                      {" · "}
                      <a href={r.url} target="_blank" rel="noopener noreferrer">voir</a>
                    </>
                  ) : null}
                </p>
              );
            })}
          </section>
        ) : null}

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {info ? <p className="notice" role="status">{info}</p> : null}

        {!locked ? (
          <>
            <button type="button" className="btn" onClick={save} disabled={Boolean(busy) || !dirty}>
              {busy === "save" ? "Enregistrement…" : dirty ? "Enregistrer les modifications" : "Enregistré"}
            </button>
            <label className="field">
              Date et heure de publication
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
            <div className="btn-row">
              <button type="button" className="btn" onClick={publishNow} disabled={Boolean(busy)}>
                {busy === "publish" ? "Publication…" : "Publier maintenant"}
              </button>
              <button type="button" className="btn primary" style={{ flex: 2 }} onClick={schedule} disabled={Boolean(busy)}>
                {busy === "schedule" ? "…" : current.status === "planifie" ? "Replanifier" : "Valider et planifier"}
              </button>
            </div>
            {current.status === "planifie" ? (
              <button type="button" className="btn ghost" onClick={() => call({ action: "cancel", id: current.id }, "cancel")} disabled={Boolean(busy)}>
                Annuler la publication prévue
              </button>
            ) : null}
          </>
        ) : (
          <Link href="/creer" className="btn primary">Créer un autre post</Link>
        )}

        <button type="button" className="btn ghost" style={{ color: "var(--rouge)", borderColor: "var(--rouge-pale)" }} onClick={remove} disabled={Boolean(busy)}>
          Supprimer ce post
        </button>
      </main>
      <BottomNav />
    </>
  );
}
