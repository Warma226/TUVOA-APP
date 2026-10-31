"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { ImageField } from "@/components/ImageField";
import { RUBRIQUES, PLATFORMS, type Platform, type RubriqueId } from "@/lib/config";
import type { Generated } from "@/lib/claude";
import type { Post } from "@/lib/store";
import { savePost } from "@/lib/client";

export default function CreerPage() {
  return (
    <Suspense fallback={null}>
      <Creer />
    </Suspense>
  );
}

function Creer() {
  const router = useRouter();
  const q = useSearchParams();
  const sourceUrl = q.get("src");
  const sourceName = q.get("source");
  const articleTitle = q.get("titre") ?? "";
  const articleSummary = q.get("resume") ?? "";
  const categorie = q.get("theme") ?? undefined;
  const [notice, setNotice] = useState("");

  const initialRubrique = q.get("rubrique");
  const [rubrique, setRubrique] = useState<RubriqueId>(
    initialRubrique === "cyberbase" || initialRubrique === "portrait" ? initialRubrique : "actu"
  );
  const [idea, setIdea] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["facebook", "linkedin", "wordpress"]);
  const [nom, setNom] = useState("");
  const [specialite, setSpecialite] = useState("");
  const [photo, setPhoto] = useState("");
  const [infos, setInfos] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gen, setGen] = useState<Generated | null>(null);
  const [picked, setPicked] = useState(0);

  const togglePlatform = (p: Platform) => setPlatforms(platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p]);

  function validate(): string {
    if (platforms.length === 0) return "Choisis au moins une plateforme.";
    if (rubrique === "portrait") {
      if (!nom.trim() || !specialite.trim()) return "Indique le nom et la spécialité de l'expert.";
      if (!consent) return "Confirme l'accord de la personne avant de continuer.";
    } else if (!idea.trim() && !sourceUrl) {
      return rubrique === "cyberbase" ? "Indique la notion à expliquer." : "Écris ton idée ou pars d'une actu de la veille.";
    }
    return "";
  }

  async function generate() {
    const v = validate();
    setError(v);
    if (v) return;
    setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          mode: "post",
          rubrique,
          idea,
          sourceUrl,
          sourceName,
          articleTitle,
          articleSummary,
          categorie,
          portrait: rubrique === "portrait" ? { nom, specialite, infos } : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setGen(d.generated);
      setNotice(d.notice ?? "");
      setPicked(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAndEdit(draftOnly = false) {
    const v = validate();
    setError(v);
    if (v) return;
    setBusy(true);
    const accroche = gen?.variantes[picked];
    const post: Partial<Post> = {
      rubrique,
      idea,
      title: articleTitle || gen?.visuel_titre || (rubrique === "portrait" ? nom : idea),
      source_name: sourceName,
      source_url: sourceUrl,
      origin: sourceUrl ? "veille" : "manuel",
      platforms,
      status: "brouillon",
      texts: !gen
        ? { facebook: idea, linkedin: idea, tiktok: idea.slice(0, 150), wp_title: idea, wp_body: idea ? `<p>${idea}</p>` : "" }
        : {
            facebook: accroche && !gen.facebook.startsWith(accroche) ? `${accroche}\n\n${gen.facebook}` : gen.facebook,
            linkedin: gen.linkedin,
            tiktok: gen.tiktok,
            wp_title: gen.wp_title,
            wp_body: gen.wp_body,
          },
      visual: {
        titre: rubrique === "portrait" ? nom : gen?.visuel_titre || idea,
        texte: rubrique === "portrait" ? specialite : gen?.visuel_texte || "",
        nom: rubrique === "portrait" ? nom : undefined,
        specialite: rubrique === "portrait" ? specialite : undefined,
        image: rubrique !== "actu" && photo.trim() ? photo.trim() : undefined,
      },
    };
    try {
      const saved = await savePost(post);
      router.push(draftOnly ? "/calendrier?filtre=brouillon" : `/editeur?id=${saved.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const VERSIONS = ["DIRECTE", "PÉDAGOGIQUE", "QUESTION"];

  return (
    <>
      <TopBar title="Nouveau post" back="/" />
      <main className="page sub" style={{ paddingTop: 4 }}>
        {sourceUrl ? (
          <div className="notice">
            <strong>Depuis la veille</strong> · {sourceName}
            <br />
            {articleTitle}
          </div>
        ) : null}

        {rubrique === "portrait" ? null : (
          <label className="field">
            {rubrique === "cyberbase" ? "Notion à expliquer" : sourceUrl ? "Ton angle (facultatif)" : "Ton idée"}
            <textarea rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={rubrique === "cyberbase" ? "Social engineering" : "Les nouveautés d'Android 17 expliquées simplement"} />
          </label>
        )}

        <div className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <p id="rub" className="label">Rubrique</p>
            <Link href="/rubriques" style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Gérer</Link>
          </div>
          <div className="grid3" role="radiogroup" aria-labelledby="rub">
            {RUBRIQUES.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={rubrique === r.id} className="seg" onClick={() => setRubrique(r.id)}>
                {r.id === "actu" ? "Actualité" : r.id === "cyberbase" ? "Cyberbase" : r.label}
              </button>
            ))}
          </div>
          {rubrique !== "actu" ? <p className="muted small">{RUBRIQUES.find((r) => r.id === rubrique)?.description}</p> : null}
        </div>

        {rubrique === "portrait" ? (
          <div className="stack">
            <label className="field">Nom de l'expert<input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom Nom" /></label>
            <label className="field">Spécialité<input type="text" value={specialite} onChange={(e) => setSpecialite(e.target.value)} placeholder="Expert en investigation numérique et en IA" /></label>
            <label className="field">Infos fournies par la personne<textarea rows={4} value={infos} onChange={(e) => setInfos(e.target.value)} placeholder="Parcours, projets, réalisations…" /></label>
            <button type="button" role="checkbox" aria-checked={consent} className="option" onClick={() => setConsent(!consent)}>
              <span style={{ fontWeight: 600 }}>{consent ? "☑" : "☐"} La personne a donné son accord</span>
              <span className="muted small">Pour la photo, les infos et la publication. Elle relira le texte avant sa sortie.</span>
            </button>
          </div>
        ) : null}

        {rubrique !== "actu" ? (
          <ImageField label="Ton visuel" hint="Le visuel que tu as créé. Tu peux aussi l'ajouter plus tard dans l'éditeur." value={photo} onChange={setPhoto} />
        ) : null}

        <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
          <legend className="label" style={{ marginBottom: 8 }}>Plateformes</legend>
          <div className="grid2">
            {PLATFORMS.map((p) => (
              <button key={p.id} type="button" aria-pressed={platforms.includes(p.id)} className="toggle-card" onClick={() => togglePlatform(p.id)}>
                <span>{p.label}</span>
                <Icon name={platforms.includes(p.id) ? "check" : "plus"} size={16} stroke={2} />
              </button>
            ))}
          </div>
        </fieldset>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {notice ? <p className="notice ambre" role="status">{notice}</p> : null}

        <button type="button" className="btn dark" onClick={generate} disabled={busy}>
          <Icon name="etincelle" size={18} />
          {busy && !gen ? "Rédaction…" : gen ? "Régénérer avec l'IA" : "Générer avec l'IA"}
        </button>

        {gen ? (
          <section className="stack" role="radiogroup" aria-labelledby="versions">
            <h2 id="versions" className="label">Choisis une version</h2>
            {gen.variantes.map((v, i) => (
              <button key={i} type="button" role="radio" aria-checked={picked === i} className="option" onClick={() => setPicked(i)}>
                <span className="small" style={{ fontWeight: 700, letterSpacing: "0.04em", color: "var(--bleu)" }}>VERSION {i + 1}{VERSIONS[i] ? ` · ${VERSIONS[i]}` : ""}</span>
                <span style={{ fontSize: 15, lineHeight: 1.45 }}>{v}</span>
              </button>
            ))}
          </section>
        ) : null}
      </main>
      <div className="actionbar">
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => saveAndEdit(true)} disabled={busy}>Brouillon</button>
          <button type="button" className="btn primary" style={{ flex: 2 }} onClick={() => saveAndEdit(false)} disabled={busy}>
            <Icon name="creer" size={18} />
            {gen ? "Éditer le texte" : "Écrire moi-même"}
          </button>
        </div>
      </div>
    </>
  );
}
