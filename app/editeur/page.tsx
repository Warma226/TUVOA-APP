"use client";
// Éditeur de texte (écran 7 de la maquette) : texte commun, versions par plateforme, assistant IA.
import { SourceLogo } from "@/components/SourceLogo";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trait } from "@/components/BottomNav";
import { ApercuFacebook, Jauge, RUB } from "@/components/Atelier";
import { ImageField } from "@/components/ImageField";
import { PLATFORMS, RUBRIQUES, TOPICS, type Platform } from "@/lib/config";
import { PLATFORM_LABEL } from "@/lib/labels";
import type { Post } from "@/lib/store";
import { loadPost, savePost, visuelsDe } from "@/lib/client";

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

// Tailles conseillées par plateforme (zone idéale, pli « Voir plus », échelle de la jauge).
type Taille = { ideal: [number, number]; pli?: number; echelle: number; unite: "car." | "mots"; repere: string; visible: string };
const TAILLES: Record<Tab, Taille> = {
  commun: { ideal: [40, 477], pli: 125, echelle: 800, unite: "car.", repere: "Sert de base aux autres versions", visible: "—" },
  facebook: { ideal: [40, 477], pli: 125, echelle: 800, unite: "car.", repere: "Idéal ≤ 477 · pli à 125", visible: "125 tél. · 477 ordi." },
  linkedin: { ideal: [1200, 2400], pli: 210, echelle: 3000, unite: "car.", repere: "Idéal 1 200 – 2 400 · pli à 210", visible: "≈ 210" },
  tiktok: { ideal: [50, 150], pli: 90, echelle: 400, unite: "car.", repere: "Idéal 50 – 150 · pli vers 90", visible: "≈ 90" },
  wordpress: { ideal: [300, 1000], echelle: 1200, unite: "mots", repere: "Article ≥ 300 mots · titre ≤ 60", visible: "—" },
};
const nbMots = (html: string) => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
function mesure(tab: Tab, texte: string): number {
  return tab === "wordpress" ? nbMots(texte) : texte.length;
}
function verdict(tab: Tab, n: number): [string, boolean] {
  const t = TAILLES[tab];
  if (tab === "commun") return [`${n} car. · le texte de base n'a pas de taille imposée`, true];
  if (!n) return ["Vide", false];
  if (n < t.ideal[0]) return [`${(t.ideal[0] - n).toLocaleString("fr-FR")} ${t.unite} sous la zone idéale`, false];
  if (n > t.ideal[1]) return [tab === "facebook" ? `${n - t.ideal[1]} car. de trop pour être lu en entier sur ordinateur` : `${(n - t.ideal[1]).toLocaleString("fr-FR")} ${t.unite} au-delà de la zone idéale`, false];
  return ["Dans la zone idéale", true];
}
const NOM: Record<Tab, string> = { commun: "Texte commun", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", wordpress: "Site tuvoa.media" };
const ICO: Record<Tab, [string, string]> = { commun: ["≡", "#5B6B86"], facebook: ["F", "#1877F2"], linkedin: ["in", "#0A66C2"], tiktok: ["T", "#0B1A33"], wordpress: ["W", "#0A2A66"] };

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
  const [visuels, setVisuels] = useState<Record<string, string>>({});
  const version = useRef(0);
  const latest = useRef<Post | null>(null);

  useEffect(() => {
    if (!id) return;
    loadPost(id)
      .then((p) => {
        setVisuels(p.visuals ?? {});
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

  // Visuel de l'aperçu : recalculé par le serveur quand le visuel change (citation générée).
  const cleVisuel = post ? JSON.stringify([post.rubrique, post.visual, post.source_name]) : "";
  useEffect(() => {
    if (!post || !cleVisuel) return;
    const t = setTimeout(() => { visuelsDe(post).then(setVisuels).catch(() => {}); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleVisuel]);

  // Enregistrement automatique 1,2 s après la dernière frappe.
  useEffect(() => {
    if (state !== "dirty") return;
    const t = setTimeout(flush, 1200);
    return () => clearTimeout(t);
  }, [state, post, flush]);

  if (!id || !post) {
    return (
      <div className="tv-page"><div className="tv-corps" style={{ paddingTop: 24 }}>
        {error ? <p className="notice rouge">{error}</p> : <p className="tv-gris">{id ? "Chargement…" : "Ouvrez une publication depuis le calendrier, ou créez-en une."}</p>}
      </div></div>
    );
  }

  const current: Post = post;
  const locked = current.status === "publie";
  const key = TEXT_KEY[tab];
  const text = (key === "commun" ? current.texts.commun : current.texts[key]) ?? "";
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
          citation:
            current.rubrique === "citation"
              ? { texte: current.visual.texte, auteur: current.visual.nom ?? current.visual.titre, fonction: current.visual.specialite ?? "", contexte: current.idea ?? "" }
              : undefined,
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

  async function rewrite(action: string, pour: Tab = tab) {
    const k = TEXT_KEY[pour];
    const txt = (k === "commun" ? current.texts.commun : current.texts[k]) ?? "";
    if (!txt.trim()) return setError("Écrivez d'abord un texte à retravailler.");
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          mode: "rewrite", action, text: txt, platform: pour === "commun" ? "toutes les plateformes" : PLATFORM_LABEL[pour],
          cible: action === "ajuster" && pour !== "wordpress" ? { min: TAILLES[pour].ideal[0], max: TAILLES[pour].ideal[1] } : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      update({ ...current, texts: { ...current.texts, [k]: d.text } });
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

  const T = TAILLES[tab];
  const n = mesure(tab, text);
  const [verdictTxt, verdictOk] = verdict(tab, n);
  const accrocheLg = (text.split("\n").find((l) => l.trim()) ?? "").length;
  const commun = current.texts.commun ?? "";
  const apercuImage = visuels[tab === "commun" ? "facebook" : tab] || visuels.facebook || current.visual.image || undefined;
  const titreWp = current.texts.wp_title ?? "";
  const meta = current.texts.wp_excerpt ?? "";
  const pastille = (ok: boolean) => ({ padding: "2px 7px", borderRadius: 7, fontWeight: 800, whiteSpace: "nowrap" as const, background: ok ? "#D9F7E6" : "#FFE8DC", color: ok ? "#05603A" : "#9A3412" });

  // Tableau des tailles et remarques de VOA, pour chaque canal de la publication
  const lignes: { ou: string; visible: string; ideal: string; valeur: string; ok: boolean; tab: Tab; conseil?: string }[] = [];
  for (const p of current.platforms) {
    const k = TEXT_KEY[p];
    const v = mesure(p, (current.texts[k as "facebook"] ?? "") as string);
    const [txt, ok] = verdict(p, v);
    if (p === "wordpress") {
      lignes.push({ ou: "Site · titre", visible: "60", ideal: "≤ 60", valeur: String(titreWp.length), ok: titreWp.length > 0 && titreWp.length <= 60, tab: p, conseil: titreWp.length > 60 ? `Titre de ${titreWp.length} caractères : Google le coupe vers 60.` : undefined });
      lignes.push({ ou: "Site · méta", visible: "≈ 155", ideal: "120 – 160", valeur: meta ? String(meta.length) : "—", ok: meta.length >= 120 && meta.length <= 160, tab: p, conseil: meta && (meta.length < 120 || meta.length > 160) ? `Méta-description de ${meta.length} caractères : visez 120 à 160.` : undefined });
      lignes.push({ ou: "Site · article", visible: "—", ideal: "≥ 300 mots", valeur: `${v} mots`, ok, tab: p, conseil: ok ? undefined : `Article : ${txt.toLowerCase()}.` });
    } else {
      const t = TAILLES[p];
      lignes.push({ ou: NOM[p], visible: t.visible, ideal: `${t.ideal[0].toLocaleString("fr-FR")} – ${t.ideal[1].toLocaleString("fr-FR")}`, valeur: v.toLocaleString("fr-FR"), ok, tab: p, conseil: ok ? undefined : `${NOM[p]} : ${txt.toLowerCase()}.` });
    }
  }
  const remarques = lignes.filter((l) => l.conseil);
  if (current.platforms.includes("linkedin") && !/\?\s*(#\S+\s*)*$/.test((current.texts.linkedin ?? "").trim())) remarques.push({ ou: "LinkedIn", visible: "", ideal: "", valeur: "", ok: false, tab: "linkedin", conseil: "LinkedIn : terminez par une question pour faire réagir." });

  const verrouille = locked;
  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 16 }}>
        {/* Barre du haut */}
        <header className="tv-ed-haut">
          <button type="button" className="tv-rond" aria-label="Retour" onClick={() => router.back()}><Trait d="M15 18l-6-6 6-6" size={20} stroke={2.2} /></button>
          <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="row" style={{ gap: 8, flexWrap: "wrap", fontSize: 12, color: "#5B6B86" }}>
              <span className="tv-pill" style={{ background: RUB[current.rubrique].pastille[0], color: RUB[current.rubrique].pastille[1] }}>{RUB[current.rubrique].nom.toUpperCase()}</span>
              <span className="tv-pill">{{ brouillon: "Brouillon", a_valider: "À valider", planifie: "Planifié", publie: "Publié", erreur: "À corriger", annule: "Annulé" }[current.status]}</span>
              <span role="status" style={{ fontWeight: 600, color: state === "error" ? "#B42318" : state === "saved" ? "#05603A" : "#5B6B86" }}>{status}</span>
            </span>
            <label>
              <span className="sr-only">Titre de la publication</span>
              <input type="text" className="tv-ed-titre" value={current.title ?? ""} disabled={verrouille} onChange={(e) => update({ ...current, title: e.target.value })} placeholder="Titre de la publication" />
            </label>
          </div>
          <button type="button" className="btn" onClick={cancel} disabled={state === "saving"}>Annuler les modifications</button>
          <button type="button" className="tv-btn-nuit" onClick={preview} disabled={state === "saving"}><Trait d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" size={18} stroke={2} />APERÇU ET PLANIFICATION</button>
        </header>

        {verrouille ? <p className="notice">Cette publication est partie : le texte n'est plus modifiable.</p> : null}
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}

        <div className="tv-ed">
          {/* Versions */}
          <nav className="tv-ed-nav" aria-label="Versions du texte">
            <span className="tv-kicker tv-desk" style={{ color: "#5B6B86", padding: "0 6px" }}>VERSIONS</span>
            {tabs.map((t) => {
              const k = TEXT_KEY[t];
              const tx = ((k === "commun" ? current.texts.commun : current.texts[k]) ?? "") as string;
              const v = mesure(t, tx);
              const [, ok] = verdict(t, v);
              const main = t !== "commun" && t !== "wordpress" && tx.trim() !== "" && tx !== commun;
              return (
                <button key={t} type="button" className="tv-version" aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
                  <span className="ico" style={{ background: ICO[t][1] }}>{ICO[t][0]}</span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, textAlign: "left" }}>
                    <strong style={{ fontSize: 14 }}>{NOM[t]}</strong>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t === "commun" ? "#5B6B86" : ok ? "#05603A" : "#B45309" }}>
                      {v.toLocaleString("fr-FR")} {TAILLES[t].unite}{t === "commun" ? " · base" : main ? " · retouché" : ""}
                    </span>
                    {t !== "commun" ? <Jauge n={v} ideal={TAILLES[t].ideal} pli={TAILLES[t].pli} max={TAILLES[t].echelle} unite={TAILLES[t].unite} /> : null}
                  </span>
                </button>
              );
            })}
            {!verrouille ? <button type="button" className="tv-version-action" onClick={applyCommun}>Appliquer le texte commun partout</button> : null}
            {empty && !verrouille ? <button type="button" className="tv-version-action" onClick={draftAll} disabled={Boolean(busy)}>{busy === "tout" ? "Rédaction…" : "Rédiger toutes les versions avec l'IA"}</button> : null}
          </nav>

          {/* Écriture */}
          <section className="tv-ed-centre" aria-labelledby="t-texte">
            <div className="tv-ed-carte">
              <div className="row tv-ed-carte-haut">
                <span className="ico" style={{ background: ICO[tab][1] }}>{ICO[tab][0]}</span>
                <h2 id="t-texte" className="tv-h2" style={{ fontSize: 17, flex: 1 }}>{tab === "wordpress" ? "Article du site" : tab === "commun" ? "Texte commun" : `Texte ${NOM[tab]}`}</h2>
                <span className="tv-gris" style={{ fontSize: 12 }}>{T.repere}</span>
              </div>

              {tab === "wordpress" ? (
                <div style={{ padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                  <label className="field">Titre de l'article <span className="tv-gris" style={{ fontWeight: 400, fontSize: 12 }}>{titreWp.length} / 60 car. · Google coupe au-delà</span>
                    <input type="text" value={titreWp} disabled={verrouille} onChange={(e) => update({ ...current, texts: { ...current.texts, wp_title: e.target.value } })} />
                  </label>
                  <Jauge n={titreWp.length} ideal={[20, 60]} max={100} />
                  <label className="field">Méta-description <span className="tv-gris" style={{ fontWeight: 400, fontSize: 12 }}>{meta.length} car. · idéal 120 à 160</span>
                    <textarea rows={2} value={meta} disabled={verrouille} onChange={(e) => update({ ...current, texts: { ...current.texts, wp_excerpt: e.target.value } })} />
                  </label>
                  <Jauge n={meta.length} ideal={[120, 160]} max={220} />
                </div>
              ) : null}

              <div style={{ padding: "16px 20px 8px" }}>
                <label className="sr-only" htmlFor="texte">{tab === "wordpress" ? "Article (HTML simple : <p>, <h2>, <ul>)" : NOM[tab]}</label>
                <textarea id="texte" className="tv-ed-zone" rows={tab === "wordpress" ? 14 : 10} value={text} disabled={verrouille} onChange={(e) => setText(e.target.value)} />
                {T.pli && tab !== "commun" && text ? (
                  <p className="tv-pli-info" data-ok={accrocheLg <= T.pli}>
                    {accrocheLg <= T.pli ? `L'accroche (${accrocheLg} car.) tient avant « Voir plus », coupé vers ${T.pli} car.` : `L'accroche fait ${accrocheLg} car. : elle sera coupée par « Voir plus » vers ${T.pli} car.`}
                  </p>
                ) : null}
              </div>

              {/* Compteur et taille */}
              <div className="tv-ed-pied">
                <div className="row" style={{ flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                  <strong style={{ fontSize: 14 }}>{n.toLocaleString("fr-FR")} {T.unite}</strong>
                  <span style={{ fontSize: 13, fontWeight: 600, color: verdictOk ? "#05603A" : "#B45309" }}>{verdictTxt}</span>
                  {!verrouille && !verdictOk && tab !== "commun" && tab !== "wordpress" && n > 0 ? (
                    <button type="button" className="tv-mini" style={{ marginLeft: "auto" }} onClick={() => rewrite("ajuster")} disabled={Boolean(busy)}>
                      {busy === "ajuster" ? "…" : `Ramener entre ${T.ideal[0].toLocaleString("fr-FR")} et ${T.ideal[1].toLocaleString("fr-FR")} car.`}
                    </button>
                  ) : null}
                </div>
                {tab !== "commun" ? <Jauge n={n} ideal={T.ideal} pli={T.pli} max={T.echelle} unite={T.unite} /> : null}
                {tab !== "commun" ? (
                  <span className="tv-gris" style={{ fontSize: 12 }}>
                    Zone verte : taille idéale{T.pli ? ` · trait jaune : coupure « Voir plus » vers ${T.pli} car.` : ""}{tab !== "wordpress" ? ` · maximum autorisé : ${limitOf(tab).toLocaleString("fr-FR")} car.` : ""}
                  </span>
                ) : null}

                {!verrouille ? (
                  <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, marginRight: 4 }}>Assistant IA</span>
                    {ACTIONS.map((a) => (
                      <button key={a.id} type="button" className="tv-mini clair" disabled={Boolean(busy)} onClick={() => rewrite(a.id)}>
                        {busy === a.id ? "…" : a.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {tab !== "wordpress" && !verrouille ? (
                  <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, marginRight: 4 }}>Hashtags</span>
                    {suggestHashtags(current, text).map((tag) => (
                      <button key={tag} type="button" className="tv-tagbtn" aria-pressed={hasTag(text, tag)} onClick={() => toggleTag(tag)}>
                        {hasTag(text, tag) ? tag : `+ ${tag}`}
                      </button>
                    ))}
                  </div>
                ) : null}

                {current.source_name && !verrouille ? (
                  <div className="row" style={{ gap: 12 }}>
                    <SourceLogo name={current.source_name ?? "Source"} url={current.source_url} size={30} radius={8} />
                    <span style={{ flex: 1, fontSize: 14 }}><strong id="cite">Citer la source en fin de texte</strong><br /><span className="tv-gris" style={{ fontSize: 12 }}>{current.source_name}</span></span>
                    <button type="button" role="switch" aria-checked={cites} aria-labelledby="cite" className={`switch${cites ? " on" : ""}`} onClick={toggleSource}><span /></button>
                  </div>
                ) : null}
              </div>
            </div>

            {current.rubrique === "citation" ? (
              <section className="tv-carte" aria-labelledby="visuel-citation">
                <h2 id="visuel-citation" className="tv-h2" style={{ fontSize: 17 }}>Visuel #Citation</h2>
                <label className="field">Citation exacte
                  <textarea rows={3} value={current.visual.texte} disabled={verrouille} onChange={(e) => update({ ...current, visual: { ...current.visual, texte: e.target.value } })} />
                </label>
                <span className="tv-gris" style={{ fontSize: 12 }}>Entourez de deux étoiles les **mots** à afficher en bleu.</span>
                <div className="tv-grille2">
                  <label className="field">Auteur<input type="text" value={current.visual.nom ?? ""} disabled={verrouille} onChange={(e) => update({ ...current, visual: { ...current.visual, nom: e.target.value, titre: e.target.value } })} /></label>
                  <label className="field">Fonction<input type="text" value={current.visual.specialite ?? ""} disabled={verrouille} onChange={(e) => update({ ...current, visual: { ...current.visual, specialite: e.target.value } })} /></label>
                </div>
                <ImageField label="Photo de l'auteur" hint="Placée sur le visuel. Une photo dont TUVOA a le droit d'usage." disabled={verrouille} value={current.visual.photo ?? ""} onChange={(url) => update({ ...current, visual: { ...current.visual, photo: url || undefined } })} />
              </section>
            ) : null}

            <section className="tv-carte" aria-labelledby="ton-visuel">
              <h2 id="ton-visuel" className="tv-h2" style={{ fontSize: 17 }}>{current.rubrique === "actu" ? "Image de l'article" : current.rubrique === "citation" ? "Remplacer par votre propre visuel (facultatif)" : `Votre visuel ${RUBRIQUES.find((r) => r.id === current.rubrique)?.hashtag ?? ""}`}</h2>
              <ImageField
                label="Image"
                hint={current.rubrique === "actu" ? "Publiée avec le post (récupérée depuis l'article). Vous pouvez la remplacer." : current.rubrique === "citation" ? "Laissez vide pour publier le visuel généré." : "Le visuel que vous avez créé (PNG ou JPG, format 4:5 conseillé)."}
                disabled={verrouille}
                value={current.visual.image ?? ""}
                onChange={(url) => update({ ...current, visual: { ...current.visual, image: url || undefined } })}
              />
            </section>
          </section>

          {/* Aperçu, tailles, remarques */}
          <aside className="tv-ed-side" aria-label="Aperçu et conseils">
            <section className="tv-carte-side" aria-labelledby="t-apercu">
              <div className="row"><h2 id="t-apercu" className="tv-h2" style={{ fontSize: 17, flex: 1 }}>Aperçu en direct</h2><span className="tv-gris" style={{ fontSize: 12 }}>{tab === "wordpress" ? "Google" : `${tab === "commun" ? "Facebook" : NOM[tab]} · téléphone`}</span></div>
              {tab === "wordpress" ? (
                <div className="tv-google">
                  <span style={{ fontSize: 12, color: "#33425C" }}>tuvoa.media › actualites</span>
                  <strong>{titreWp.length > 60 ? `${titreWp.slice(0, 58).replace(/\s+\S*$/, "")} …` : titreWp || "Titre de l'article"}</strong>
                  <span style={{ fontSize: 13, color: "#33425C", lineHeight: 1.5 }}>{meta ? (meta.length > 158 ? `${meta.slice(0, 155).replace(/\s+\S*$/, "")} …` : meta) : "Ajoutez une méta-description : c'est le texte affiché sous le titre dans Google."}</span>
                </div>
              ) : (
                <ApercuFacebook texte={text} image={tab === "tiktok" ? undefined : apercuImage} pli={T.pli ?? 125} quand={current.scheduled_at ? `Planifié · ${new Date(current.scheduled_at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "Brouillon"} />
              )}
            </section>

            <section className="tv-carte-side" aria-labelledby="t-tailles">
              <h2 id="t-tailles" className="tv-h2" style={{ fontSize: 16 }}>Tailles conseillées</h2>
              <table className="tv-table">
                <thead><tr><th scope="col">Où</th><th scope="col">Visible</th><th scope="col">Idéal</th><th scope="col" style={{ textAlign: "right" }}>Ce post</th></tr></thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.ou}>
                      <th scope="row"><button type="button" className="btn link" style={{ fontSize: 12, color: "#0B1A33", fontWeight: 700 }} onClick={() => setTab(l.tab)}>{l.ou}</button></th>
                      <td>{l.visible}</td><td>{l.ideal}</td>
                      <td style={{ textAlign: "right" }}><span style={pastille(l.ok)}>{l.valeur}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <span className="tv-gris" style={{ fontSize: 11, lineHeight: 1.4 }}>« Visible » : ce qui s'affiche avant « Voir plus », ou avant la coupure dans Google.</span>
            </section>

            {remarques.length && !verrouille ? (
              <section className="tv-voa" aria-labelledby="t-voa" style={{ flex: "none" }}>
                <h2 id="t-voa" style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Les remarques de VOA</h2>
                {remarques.slice(0, 4).map((r, i) => (
                  <div key={i} className="tv-voa-alerte">
                    <span className="tv-tag" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>{r.ou.toUpperCase()}</span>
                    <span style={{ fontSize: 14, lineHeight: 1.45 }}>{r.conseil}</span>
                    <button type="button" style={{ alignSelf: "flex-start", border: 0, background: "none", padding: 0, fontSize: 13, fontWeight: 700, color: "#FFB48A", cursor: "pointer" }} onClick={() => setTab(r.tab)}>Voir cette version →</button>
                  </div>
                ))}
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
