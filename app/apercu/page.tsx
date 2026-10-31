"use client";
// Aperçu avant publication (écran 8 de la maquette) : rien ne part sans passer par cet écran (sauf autopilote).
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/BottomNav";
import { PLATFORMS, type Platform } from "@/lib/config";
import { FORMATS, formatFor } from "@/lib/formats";
import { STATUS_LABEL, STATUS_BADGE, PLATFORM_LABEL } from "@/lib/labels";
import { getInfo, listPosts, loadPost, postAction, deletePost, type PostWithVisuals } from "@/lib/client";
import { heureFixe, prochainCreneau } from "@/lib/schedule";

type TextKey = "facebook" | "linkedin" | "tiktok" | "wp_body";
const TEXT_KEY: Record<Platform, TextKey> = { facebook: "facebook", linkedin: "linkedin", tiktok: "tiktok", wordpress: "wp_body" };
const limitOf = (p: Platform) => PLATFORMS.find((x) => x.id === p)?.limit ?? 3000;
const pad = (n: number) => String(n).padStart(2, "0");

function split(d: Date): { date: string; time: string } {
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

function splitLocal(iso: string | null): { date: string; time: string } {
  let d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60000);
  if (!iso) d = new Date(Math.ceil(d.getTime() / (15 * 60000)) * 15 * 60000); // prochain quart d'heure
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

const stripHtml = (html: string) => html.replace(/<\/(p|h\d|li)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();

export default function ApercuPage() {
  return (
    <Suspense fallback={null}>
      <Apercu />
    </Suspense>
  );
}

function Apercu() {
  const q = useSearchParams();
  const router = useRouter();
  const id = q.get("id");
  const [post, setPost] = useState<PostWithVisuals | null>(null);
  const [tab, setTab] = useState<Platform>("facebook");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    getInfo().then((i) => setDemo(i.demo)).catch(() => undefined);
    if (!id) return;
    loadPost(id)
      .then(async (p) => {
        setPost(p);
        let w = splitLocal(p.scheduled_at);
        // Rubrique à heure fixe (#CyberBase à 8 h) : on propose le prochain jour libre.
        if (!p.scheduled_at && heureFixe(p.rubrique) !== undefined) {
          const slot = prochainCreneau(await listPosts().catch(() => []), p.rubrique, p.id);
          if (slot) w = split(slot);
        }
        setDate(w.date);
        setTime(w.time);
        if (p.platforms?.length) setTab(p.platforms[0]);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (!id || !post) {
    return (
      <>
        <TopBar title="Aperçu" back="/" />
        <main className="page sub">
          {error ? <p className="notice rouge">{error}</p> : <p className="muted">{id ? "Chargement…" : "Ouvre un post depuis l'accueil pour voir son aperçu."}</p>}
        </main>
      </>
    );
  }

  const current: PostWithVisuals = post;
  const text = current.texts[TEXT_KEY[tab]] ?? "";
  const limit = limitOf(tab);
  const len = text.length;
  const over = len > limit;
  const locked = current.status === "publie";
  const fmt = FORMATS[formatFor(tab, current.rubrique)];
  const when = date && time ? new Date(`${date}T${time}`) : null;
  const heure = (current.status === "planifie" && current.scheduled_at ? new Date(current.scheduled_at) : when)?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const tooLong = current.platforms.find((p) => (current.texts[TEXT_KEY[p]] ?? "").length > limitOf(p));

  async function run(label: string, fn: () => Promise<PostWithVisuals>): Promise<PostWithVisuals | null> {
    setBusy(label);
    setError("");
    setInfo("");
    try {
      const next = await fn();
      setPost(next);
      return next;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function schedule() {
    if (tooLong) return setError(`Le texte ${PLATFORM_LABEL[tooLong]} dépasse la limite de caractères. Corrige-le dans l'éditeur.`);
    if (!when || Number.isNaN(when.getTime())) return setError("Choisis une date et une heure.");
    if (when.getTime() < Date.now() - 60000) return setError("Cette date est passée. Choisis une heure à venir ou publie maintenant.");
    const p = await run("schedule", () => postAction("schedule", current, when.toISOString()));
    if (p && demo) setInfo("Planifié. En mode démo, la publication à l'heure prévue démarre une fois Supabase branché : d'ici là, utilise « Publier maintenant ».");
    else if (p) setInfo(`Planifié le ${new Date(p.scheduled_at ?? when).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}.`);
  }

  async function publishNow() {
    if (tooLong) return setError(`Le texte ${PLATFORM_LABEL[tooLong]} dépasse la limite de caractères. Corrige-le dans l'éditeur.`);
    if (!window.confirm(`Publier maintenant sur ${current.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")} ?`)) return;
    const p = await run("publish", () => postAction("publish", current));
    if (p) setInfo(p.status === "publie" ? "Publié sur tous les canaux." : "Publication terminée avec des erreurs : vois le détail plus bas.");
  }

  async function remove() {
    if (!window.confirm("Supprimer définitivement ce post ?")) return;
    setBusy("delete");
    try {
      await deletePost(current.id);
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  return (
    <>
      <TopBar
        title="Aperçu"
        back="/"
        right={<span className={`badge ${STATUS_BADGE[current.status]}`} style={{ fontSize: 12, padding: "5px 9px" }}>{STATUS_LABEL[current.status]}{current.auto ? " · auto" : ""}</span>}
      />
      <main className="page sub" style={{ paddingTop: 8, gap: 0 }}>
        <div className="grid4" role="tablist" aria-label="Plateforme" style={{ gridTemplateColumns: `repeat(${Math.max(1, current.platforms.length)}, minmax(0, 1fr))`, marginBottom: 16 }}>
          {current.platforms.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={tab === p} className="seg" style={{ fontSize: 13 }} onClick={() => setTab(p)}>
              {PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>

        {current.platforms.length === 0 ? <p className="notice ambre">Aucune plateforme choisie pour ce post.</p> : null}

        <section className="preview-zone" aria-label={`Aperçu ${PLATFORM_LABEL[tab]}`}>
          <article className="social-card">
            <div className="head">
              <span className="avatar" aria-hidden="true"><span /></span>
              <span>
                <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>TUVOA</span>
                <span className="muted" style={{ display: "block", fontSize: 12 }}>
                  {tab === "wordpress" ? "Article WordPress" : `Publication ${PLATFORM_LABEL[tab]}`}
                  {heure ? ` · ${heure}` : ""}
                </span>
              </span>
            </div>
            {tab === "wordpress" ? (
              <div className="body">
                <strong style={{ display: "block", fontSize: 16, marginBottom: 6 }}>{current.texts.wp_title || "Sans titre"}</strong>
                {stripHtml(text).slice(0, 400)}
                {stripHtml(text).length > 400 ? "…" : ""}
              </div>
            ) : (
              <div className="body">{text || <span className="muted">Pas encore de texte pour {PLATFORM_LABEL[tab]}.</span>}</div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.visuals[tab]} alt={`Visuel ${PLATFORM_LABEL[tab]} : ${current.visual.titre}`} style={{ aspectRatio: `${fmt.w} / ${fmt.h}` }} />
          </article>
          <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
            <span className="muted">Format {fmt.label.charAt(0).toLowerCase() + fmt.label.slice(1)}</span>
            <span style={{ fontWeight: 600, color: over ? "var(--rouge)" : "var(--vert)" }}>
              {len.toLocaleString("fr-FR")} / {limit.toLocaleString("fr-FR")} caractères
            </span>
          </div>
        </section>

        <div className="stack" style={{ marginTop: 16 }}>
          {current.source_url ? (
            <p className="muted small">
              Source : <a href={current.source_url} target="_blank" rel="noopener noreferrer">{current.source_name ?? current.source_url}</a>
            </p>
          ) : null}

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
            <div className="btn-row">
              <button type="button" className="btn small ghost" onClick={publishNow} disabled={Boolean(busy)}>
                {busy === "publish" ? "Publication…" : "Publier maintenant"}
              </button>
              {current.status === "planifie" ? (
                <button type="button" className="btn small ghost" onClick={() => run("cancel", () => postAction("cancel", current))} disabled={Boolean(busy)}>
                  Annuler la planification
                </button>
              ) : null}
            </div>
          ) : (
            <Link href="/creer" className="btn primary">Créer un autre post</Link>
          )}
          <button type="button" className="btn link small" style={{ color: "var(--rouge)", alignSelf: "center", height: 44 }} onClick={remove} disabled={Boolean(busy)}>
            Supprimer ce post
          </button>
        </div>
      </main>

      {!locked ? (
        <div className="actionbar">
          <div className="grid2" style={{ gap: 10 }}>
            <label className="field" style={{ fontSize: 12, fontWeight: 500, color: "var(--texte-2)", gap: 4 }}>
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field" style={{ fontSize: 12, fontWeight: 500, color: "var(--texte-2)", gap: 4 }}>
              Heure
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          {heureFixe(current.rubrique) !== undefined ? (
            <p className="muted small" style={{ marginTop: -4 }}>
              #CyberBase : une notion chaque jour à {heureFixe(current.rubrique)} h. Le prochain jour libre est proposé.
            </p>
          ) : null}
          <div className="btn-row">
            <Link href={`/editeur?id=${current.id}`} className="btn">Modifier</Link>
            <button type="button" className="btn primary" style={{ flex: 2 }} onClick={schedule} disabled={Boolean(busy)}>
              {busy === "schedule" ? "…" : current.status === "planifie" ? "Replanifier" : "Valider et planifier"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
