"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BottomNav, TopBar } from "@/components/BottomNav";
import { RUBRIQUES, PLATFORMS, type Platform, type RubriqueId } from "@/lib/config";
import type { Generated } from "@/lib/claude";

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
          portrait: rubrique === "portrait" ? { nom, specialite, infos } : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setGen(d.generated);
      setPicked(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAndEdit(blank = false) {
    const v = validate();
    setError(v);
    if (v) return;
    setBusy(true);
    const accroche = gen?.variantes[picked];
    const post = {
      rubrique,
      idea,
      title: articleTitle || gen?.visuel_titre || (rubrique === "portrait" ? nom : idea),
      source_name: sourceName,
      source_url: sourceUrl,
      origin: sourceUrl ? "veille" : "manuel",
      platforms,
      status: "brouillon",
      texts: blank || !gen
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
        photo: rubrique === "portrait" && photo ? photo : undefined,
      },
    };
    const res = await fetch("/api/posts", { method: "POST", body: JSON.stringify({ action: "save", post }) });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError(d.error);
    router.push(`/apercu?id=${d.post.id}&edit=1`);
  }

  return (
    <>
      <TopBar title="Nouveau post" back="/" />
      <main className="page" style={{ paddingTop: 4 }}>
        {sourceUrl ? (
          <div className="notice">
            <strong>Depuis la veille</strong> · {sourceName}
            <br />
            {articleTitle}
          </div>
        ) : null}

        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <p id="rub" style={{ fontWeight: 600, fontSize: 14 }}>Rubrique</p>
            <Link href="/rubriques" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Voir les gabarits</Link>
          </div>
          <div className="grid3" role="radiogroup" aria-labelledby="rub">
            {RUBRIQUES.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={rubrique === r.id} className="chip" style={{ height: 44, borderRadius: 10 }} onClick={() => setRubrique(r.id)}>
                {r.id === "actu" ? "Actualité" : r.label}
              </button>
            ))}
          </div>
          <p className="muted small">{RUBRIQUES.find((r) => r.id === rubrique)?.description}</p>
        </div>

        {rubrique === "portrait" ? (
          <div className="stack">
            <label className="field">Nom de l'expert<input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom Nom" /></label>
            <label className="field">Spécialité<input type="text" value={specialite} onChange={(e) => setSpecialite(e.target.value)} placeholder="Expert en investigation numérique et en IA" /></label>
            <label className="field">Lien de la photo (fournie par la personne)<input type="url" value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://…/photo.jpg" /></label>
            <label className="field">Infos fournies par la personne<textarea rows={4} value={infos} onChange={(e) => setInfos(e.target.value)} placeholder="Parcours, projets, réalisations…" /></label>
            <button type="button" role="checkbox" aria-checked={consent} className="option" onClick={() => setConsent(!consent)}>
              <span style={{ fontWeight: 600 }}>{consent ? "☑" : "☐"} La personne a donné son accord</span>
              <span className="muted small">Pour la photo, les infos et la publication. Elle relira le texte avant sa sortie.</span>
            </button>
          </div>
        ) : (
          <label className="field">
            {rubrique === "cyberbase" ? "Notion à expliquer" : sourceUrl ? "Ton angle (facultatif)" : "Ton idée"}
            <textarea rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={rubrique === "cyberbase" ? "Social engineering" : "Les nouveautés d'Android 17 expliquées simplement"} />
          </label>
        )}

        <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
          <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Plateformes</legend>
          <div className="grid2">
            {PLATFORMS.map((p) => (
              <button key={p.id} type="button" aria-pressed={platforms.includes(p.id)} className="toggle-card" onClick={() => togglePlatform(p.id)}>
                <span>{p.label}</span>
                <span aria-hidden="true">{platforms.includes(p.id) ? "✓" : "+"}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}

        <button type="button" className="btn dark" onClick={generate} disabled={busy}>
          {busy && !gen ? "L'IA rédige…" : gen ? "✦ Régénérer avec l'IA" : "✦ Générer avec l'IA"}
        </button>

        {gen ? (
          <section className="stack">
            <h2 style={{ fontSize: 15 }}>Choisis une accroche</h2>
            {gen.variantes.map((v, i) => (
              <button key={i} type="button" role="radio" aria-checked={picked === i} className="option" onClick={() => setPicked(i)}>
                <span className="small" style={{ fontWeight: 700, color: "var(--bleu)" }}>VERSION {i + 1}</span>
                <span style={{ fontSize: 14, lineHeight: 1.45 }}>{v}</span>
              </button>
            ))}
          </section>
        ) : null}

        <div className="btn-row">
          {!gen ? <button type="button" className="btn" onClick={() => saveAndEdit(true)} disabled={busy}>Écrire moi-même</button> : null}
          <button type="button" className="btn primary" style={{ flex: 2 }} onClick={() => saveAndEdit(false)} disabled={busy || !gen}>
            Éditer et voir l'aperçu
          </button>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
