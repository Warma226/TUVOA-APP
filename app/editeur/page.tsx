"use client";
// Éditeur de texte (écran 7 de la maquette) : texte commun, versions par plateforme, assistant IA.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { ImageField } from "@/components/ImageField";
import { PLATFORMS, RUBRIQUES, TOPICS, type Platform } from "@/lib/config";
import { PLATFORM_LABEL } from "@/lib/labels";
import type { Post } from "@/lib/store";
import { loadPost, savePost } from "@/lib/client";

type Tab = "commun" | Platform;
type TextKey = "commun" | "facebook" | "linkedin" | "tiktok" | "wp_body";
const TEXT_KEY: Record<Tab, TextKey> = { commun: "commun", facebook: "facebook", linkedin: "linkedin", tiktok: "tiktok", wordpress: "wp_body" };

const ACTIONS: { id: string; label: string }[] = [
  { id: "raccourcir", label: "Raccourcir" },
  { id: "reformuler", label: "Reformuler" },
  { id: "expliquer", label: "Expliquer simplement" },
  { id: "ton", label: "Ton TUVOA" },
  { id: "traduire", label: "En français" },
];

const limitOf = (p: Platform) => PLATFORMS.find((x) => x.id === p)?.limit ?? 3000;

// Hashtags proposés à partir de la rubrique, des thèmes détectés et des produits cités.
function suggestHashtags(post: Post, text: string): string[] {
  const out: string[] = [];
  const low = ` ${text.toLowerCase()} `;
  const products = text.match(/\b(Android|iOS|iPhone|Galaxy|Pixel|Windows|ChatGPT|Gemini|Claude|WhatsApp)\s?(\d{1,2})?\b/g) ?? [];
  products.forEach((p) => out.push(`#${p.replace(/\s+/g, "")}`));
  const rub = RUBRIQUES.find((r) => r.id === post.rubrique);
  if (rub) out.push(rub.hashtag);
  out.push("#Tech");
  TOPICS.filter((t) => t.poids > 0 && t.keywords.some((k) => low.includes(k))).forEach((t) => out.push(`#${t.label.normalize("NFD").replace(/[^A-Za-z0-9]/g, "")}`));
  out.push("#TUVOA");
  return Array.from(new Set(out)).slice(0, 6);
}

function hasTag(text: string, tag: string): boolean {
  return new RegExp(`(^|\\s)${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$|[.,!?])`, "i").test(text);
}

// Adapte le texte commun à chaque plateforme (sans IA).
function adapt(commun: string, title: string) {
  const tiktok = commun.length <= 150 ? commun : `${commun.slice(0, 149).replace(/\s+\S*$/, "")}…`;
  const paras = commun.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return {
    facebook: commun,
    linkedin: commun,
    tiktok,
    wp_body: paras.map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n"),
    wp_title: title || commun.split("\n")[0].slice(0, 90),
  };
}

export default function EditeurPage() {
  return (
    <Suspense fallback={null}>
      <Editeur />
    </Suspense>
  );
}

function Editeur() {
  const q = useSearchParams();
  const router = useRouter();
  const id = q.get("id");
  const [post, setPost] = useState<Post | null>(null);
  const [initial, setInitial] = useState<Post | null>(null);
  const [tab, setTab] = useState<Tab>("commun");
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const version = useRef(0);
  const latest = useRef<Post | null>(null);

  useEffect(() => {
    if (!id) return;
    loadPost(id)
      .then((p) => {
        const clean: Post = { ...p };
        delete (clean as Partial<typeof p>).visuals;
        const withCommun = { ...clean, texts: { ...clean.texts, commun: clean.texts.commun ?? clean.texts[TEXT_KEY[clean.platforms[0] ?? "facebook"] as "facebook"] ?? "" } };
        setPost(withCommun);
        setInitial(withCommun);
        latest.current = withCommun;
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const flush = useCallback(async (): Promise<boolean> => {
    const p = latest.current;
    if (!p) return false;
    const v = version.current;
    setState("saving");
    try {
      await savePost(p);
      if (version.current === v) setState("saved");
      return true;
    } catch (e) {
      setError((e as Error).message);
      setState("error");
      return false;
    }
  }, []);

  // Enregistrement automatique 1,2 s après la dernière frappe.
  useEffect(() => {
    if (state !== "dirty") return;
    const t = setTimeout(flush, 1200);
    return () => clearTimeout(t);
  }, [state, post, flush]);

  if (!id || !post) {
    return (
      <>
        <TopBar title="Éditeur" back="/" />
        <main className="page sub">
          {error ? <p className="notice rouge">{error}</p> : <p className="muted">{id ? "Chargement…" : "Ouvre un post depuis l'accueil ou crée-en un."}</p>}
        </main>
      </>
    );
  }

  const current: Post = post;
  const locked = current.status === "publie";
  const key = TEXT_KEY[tab];
  const text = (key === "commun" ? current.texts.commun : current.texts[key]) ?? "";
  const limit = tab === "commun" ? Math.min(...current.platforms.filter((p) => p !== "tiktok").map(limitOf), 3000) : limitOf(tab);
  const len = text.length;
  const over = len > limit;
  const near = !over && len > limit * 0.8;
  const tabs: Tab[] = ["commun", ...current.platforms];

  function update(next: Post) {
    version.current++;
    latest.current = next;
    setPost(next);
    setState("dirty");
  }
  const setText = (value: string) => update({ ...current, texts: { ...current.texts, [key]: value } });

  function applyCommun() {
    const c = current.texts.commun ?? "";
    if (!c.trim()) return setError("Écris d'abord le texte commun.");
    const filled = current.platforms.some((p) => (current.texts[TEXT_KEY[p] as "facebook"] ?? "").trim() && current.texts[TEXT_KEY[p] as "facebook"] !== c);
    if (filled && !window.confirm("Remplacer les versions de chaque plateforme par le texte commun ?")) return;
    setError("");
    update({ ...current, texts: { ...current.texts, ...adapt(c, current.texts.wp_title) } });
  }

  const empty = !["facebook", "linkedin", "tiktok", "wp_body", "commun"].some((k) => (current.texts[k as TextKey] ?? "").trim());

  // Brouillon vide (ex. créé avant la rédaction) : l'IA rédige toutes les versions d'un coup.
  async function draftAll() {
    setBusy("tout");
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          mode: "post",
          rubrique: current.rubrique,
          idea: current.idea ?? "",
          sourceUrl: current.source_url,
          sourceName: current.source_name,
          articleTitle: current.title,
          categorie: current.visual.titre || undefined,
        }),
      });
      const d = await res.json().catch(() => ({ error: "Le serveur n'a pas répondu à temps. Réessaie." }));
      if (!res.ok || !d.generated) throw new Error(d.error || "Aucun texte reçu. Réessaie.");
      const g = d.generated;
      const facebook = g.facebook;
      update({
        ...current,
        texts: { ...current.texts, commun: facebook, facebook, linkedin: g.linkedin, tiktok: g.tiktok, wp_title: g.wp_title, wp_body: g.wp_body },
        visual: { ...current.visual, titre: current.visual.titre || g.visuel_titre, texte: current.visual.texte || g.visuel_texte, image: current.visual.image || d.image || undefined },
      });
      if (d.notice) setError(d.notice);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function rewrite(action: string) {
    if (!text.trim()) return setError("Écris d'abord un texte à retravailler.");
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({ mode: "rewrite", action, text, platform: tab === "commun" ? "toutes les plateformes" : PLATFORM_LABEL[tab] }),
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

  function toggleTag(tag: string) {
    if (hasTag(text, tag)) {
      setText(text.replace(new RegExp(`\\s?${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$|[.,!?])`, "i"), "").trimEnd());
    } else {
      const lastLine = text.trimEnd().split("\n").pop() ?? "";
      const sep = !text.trim() ? "" : /^(#\S+\s*)+$/.test(lastLine.trim()) ? " " : "\n\n";
      setText(`${text.trimEnd()}${sep}${tag}`);
    }
  }

  // « Citer la source » : ajoute ou retire la ligne « Source : … » des textes Facebook, LinkedIn et commun.
  const sourceKeys: ("commun" | "facebook" | "linkedin")[] = ["commun", ...current.platforms.filter((p): p is "facebook" | "linkedin" => p === "facebook" || p === "linkedin")];
  const cites = Boolean(current.source_name) && sourceKeys.every((k) => (current.texts[k] ?? "").toLowerCase().includes((current.source_name ?? "").toLowerCase()));
  function toggleSource() {
    const name = current.source_name ?? "";
    const texts = { ...current.texts };
    for (const k of sourceKeys) {
      const t = texts[k] ?? "";
      if (cites) {
        texts[k] = t
          .split("\n")
          .filter((l) => !/^\s*source\s?:/i.test(l) && (!current.source_url || l.trim() !== current.source_url))
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      } else if (!t.toLowerCase().includes(name.toLowerCase())) {
        texts[k] = `${t.trimEnd()}\n\nSource : ${name}${current.source_url ? `\n${current.source_url}` : ""}`.trim();
      }
    }
    update({ ...current, texts });
  }

  async function cancel() {
    const changed = JSON.stringify(initial) !== JSON.stringify(current);
    if (changed) {
      if (!window.confirm("Annuler les modifications faites depuis l'ouverture de l'éditeur ?")) return;
      latest.current = initial;
      version.current++;
      if (!(await flush())) return;
    }
    router.push("/");
  }

  async function preview() {
    if (!(await flush())) return;
    router.push(`/apercu?id=${current.id}`);
  }

  const status =
    state === "saving" ? "Enregistrement…" : state === "dirty" ? "Modifié" : state === "error" ? "Non enregistré" : "Enregistré";

  return (
    <>
      <TopBar
        title="Éditeur"
        back="/"
        right={
          <span role="status" className="row" style={{ gap: 4, fontSize: 13, fontWeight: 600, color: state === "error" ? "var(--rouge)" : state === "saved" ? "var(--vert)" : "var(--texte-2)" }}>
            {state === "saved" ? <Icon name="check" size={16} stroke={2.2} /> : null}
            {status}
          </span>
        }
      />
      <main className="page sub" style={{ paddingTop: 4, gap: 14 }}>
        {locked ? <p className="notice">Ce post est publié : le texte n'est plus modifiable.</p> : null}

        {empty && !locked ? (
          <div className="card" style={{ padding: 16, gap: 10 }}>
            <strong>Ce brouillon est vide</strong>
            <span className="muted small">{busy === "tout" ? "L'IA rédige toutes les versions… (quelques secondes)" : "L'IA peut rédiger toutes les versions (Facebook, LinkedIn, TikTok, article) à partir de l'article."}</span>
            <button type="button" className="btn dark" onClick={draftAll} disabled={Boolean(busy)}>
              <Icon name="etincelle" size={18} />
              {busy === "tout" ? "Rédaction…" : "Rédiger avec l'IA"}
            </button>
          </div>
        ) : null}

        <div className="hscroll" role="tablist" aria-label="Version du texte">
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="chip" onClick={() => setTab(t)}>
              {t === "commun" ? "Commun" : PLATFORM_LABEL[t]}
            </button>
          ))}
        </div>

        {tab === "commun" ? (
          <p className="muted small">Texte de base. Les autres versions en sont adaptées quand tu appuies sur « Appliquer à toutes les plateformes ».</p>
        ) : tab === "tiktok" ? (
          <p className="muted small">Légende courte : {limitOf("tiktok")} caractères au maximum.</p>
        ) : null}

        {tab === "wordpress" ? (
          <label className="field">
            Titre de l'article
            <input type="text" value={current.texts.wp_title} disabled={locked} onChange={(e) => update({ ...current, texts: { ...current.texts, wp_title: e.target.value } })} />
          </label>
        ) : null}

        <div className="editor-box">
          <label className="sr-only" htmlFor="texte">{tab === "commun" ? "Texte commun" : tab === "wordpress" ? "Article (HTML simple : <p>, <h2>, <ul>)" : `Texte ${PLATFORM_LABEL[tab]}`}</label>
          <textarea id="texte" rows={tab === "wordpress" ? 12 : 7} value={text} disabled={locked} onChange={(e) => setText(e.target.value)} />
          <div className="counter" aria-live="polite">
            <div className="bar" aria-hidden="true">
              <div style={{ width: `${Math.min(100, Math.max(len ? 2 : 0, Math.round((len / limit) * 100)))}%`, background: over ? "var(--rouge)" : near ? "var(--orange)" : "var(--bleu)" }} />
            </div>
            <span style={{ color: over ? "var(--rouge)" : undefined }}>
              {len.toLocaleString("fr-FR")} / {limit.toLocaleString("fr-FR")}
            </span>
          </div>
        </div>

        {tab === "commun" && !locked ? (
          <button type="button" className="btn small ghost" onClick={applyCommun}>Appliquer à toutes les plateformes</button>
        ) : null}

        {!locked ? (
          <section className="stack" style={{ gap: 8 }} aria-labelledby="ia">
            <h2 id="ia" className="label">Assistant IA</h2>
            <div className="wrap" style={{ gap: 8 }}>
              {ACTIONS.map((a) => (
                <button key={a.id} type="button" className="chip ia" disabled={Boolean(busy)} onClick={() => rewrite(a.id)}>
                  <Icon name="etincelle" size={14} />
                  {busy === a.id ? "…" : a.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {tab !== "wordpress" && !locked ? (
          <section className="stack" style={{ gap: 8 }} aria-labelledby="tags">
            <h2 id="tags" className="label">Hashtags suggérés</h2>
            <div className="wrap" style={{ gap: 8 }}>
              {suggestHashtags(current, text).map((tag) => (
                <button key={tag} type="button" className="tag bleu" aria-pressed={hasTag(text, tag)} onClick={() => toggleTag(tag)}>
                  {hasTag(text, tag) ? <Icon name="check" size={14} stroke={2.2} /> : null}
                  {tag}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card" style={{ padding: "12px 14px" }} aria-labelledby="ton-visuel">
          <h2 id="ton-visuel" className="label">{current.rubrique === "actu" ? "Image de l'article" : `Ton visuel ${RUBRIQUES.find((r) => r.id === current.rubrique)?.hashtag ?? ""}`}</h2>
          <div style={{ marginTop: 8 }}>
            <ImageField
              label="Image"
              hint={current.rubrique === "actu" ? "Image publiée avec le post (récupérée depuis l'article). Tu peux la remplacer." : "Le visuel que tu as créé (PNG ou JPG, format 4:5 conseillé)."}
              disabled={locked}
              value={current.visual.image ?? ""}
              onChange={(url) => update({ ...current, visual: { ...current.visual, image: url || undefined } })}
            />
          </div>
        </section>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
      </main>
      <div className="actionbar">
        {current.source_name && !locked ? (
          <div className="row card" style={{ padding: "10px 14px", justifyContent: "space-between", flexDirection: "row" }}>
            <span className="small" style={{ fontSize: 13, minWidth: 0 }}>
              <strong id="cite">Citer la source</strong> · {current.source_name}
            </span>
            <button type="button" role="switch" aria-checked={cites} aria-labelledby="cite" className="switch" onClick={toggleSource}>
              <span />
            </button>
          </div>
        ) : null}
        <div className="btn-row">
          <button type="button" className="btn" onClick={cancel} disabled={state === "saving"}>Annuler</button>
          <button type="button" className="btn primary" style={{ flex: 2 }} onClick={preview} disabled={state === "saving"}>
            <Icon name="oeil" size={18} />
            Voir l'aperçu
          </button>
        </div>
      </div>
    </>
  );
}
