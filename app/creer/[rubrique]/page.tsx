"use client";
// Ateliers de création : une interface dédiée par rubrique (Actualité, Citation, #CyberBase, Portrait).
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ImageField } from "@/components/ImageField";
import { SourceLogo } from "@/components/SourceLogo";
import { Trait } from "@/components/BottomNav";
import {
  AtelierEntete, ApercuFacebook, BarreActions, Canaux, Carte, ChoixQuand, Controle, Jauge, RUB,
  creneauLibre, dateLongue, heureCourte, versLocal, type Etape, type Quand,
} from "@/components/Atelier";
import { draftWithoutAI, type Generated, type GenerateInput } from "@/lib/claude";
import type { RubriqueId, Platform } from "@/lib/config";
import type { Post } from "@/lib/store";
import { listPosts, postAction, savePost, visuelsDe } from "@/lib/client";

const RUBS: RubriqueId[] = ["actu", "citation", "cyberbase", "portrait"];
const DEFAUT: Record<RubriqueId, Platform[]> = {
  actu: ["facebook", "linkedin", "wordpress"],
  citation: ["facebook", "linkedin"],
  cyberbase: ["facebook", "linkedin", "wordpress"],
  portrait: ["facebook", "linkedin", "wordpress"],
};
const VERSIONS = ["DIRECTE", "PÉDAGOGIQUE", "QUESTION"];

function avecAccroche(text: string, hook?: string): string {
  if (!hook || text.startsWith(hook)) return text;
  return `${hook}\n\n${text}`;
}
function useDiffere<T>(v: T, ms = 700): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}
const montantSansFcfa = (t: string) => /(\$|dollars?|euros?|€|milliards? de|millions? de)/i.test(t) && !/FCFA/i.test(t);

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Atelier />
    </Suspense>
  );
}

function Atelier() {
  const params = useParams<{ rubrique: string }>();
  const rub = (RUBS.includes(params.rubrique as RubriqueId) ? params.rubrique : null) as RubriqueId | null;
  if (!rub) {
    return (
      <div className="tv-page"><div className="tv-corps" style={{ paddingTop: 24 }}>
        <p className="notice ambre">Cette rubrique n'existe pas. <Link href="/creer">Revenir au choix des rubriques</Link></p>
      </div></div>
    );
  }
  return <AtelierRubrique key={rub} rub={rub} />;
}

function AtelierRubrique({ rub }: { rub: RubriqueId }) {
  const router = useRouter();
  const q = useSearchParams();
  // Depuis la veille (Actualité uniquement)
  const sourceUrl = rub === "actu" ? q.get("src") : null;
  const sourceName = rub === "actu" ? q.get("source") : null;
  const articleTitle = rub === "actu" ? q.get("titre") ?? "" : "";
  const articleSummary = rub === "actu" ? q.get("resume") ?? "" : "";
  const categorie = q.get("theme") ?? undefined;

  const [posts, setPosts] = useState<Post[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>(DEFAUT[rub]);
  const [gen, setGen] = useState<Generated | null>(null);
  const [picked, setPicked] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [quand, setQuand] = useState<Quand>(rub === "portrait" ? "brouillon" : "libre");
  const [custom, setCustom] = useState("");

  // Champs
  const [idea, setIdea] = useState(() => q.get("idee") ?? "");
  const [photo, setPhoto] = useState(() => q.get("image") ?? "");
  const [citTexte, setCitTexte] = useState("");
  const [auteur, setAuteur] = useState("");
  const [fonction, setFonction] = useState("");
  const [contexte, setContexte] = useState("");
  const [srcName, setSrcName] = useState("");
  const [srcUrl, setSrcUrl] = useState("");
  const [droitPhoto, setDroitPhoto] = useState(false);
  const [nom, setNom] = useState("");
  const [specialite, setSpecialite] = useState("");
  const [infos, setInfos] = useState("");
  const [accord, setAccord] = useState({ photo: false, infos: false, relecture: false });

  useEffect(() => {
    listPosts().then(setPosts).catch(() => {});
  }, []);

  const libre = useMemo(() => creneauLibre(posts, rub), [posts, rub]);
  useEffect(() => {
    if (libre && !custom) setCustom(versLocal(libre));
  }, [libre, custom]);

  const srcNameFinal = rub === "actu" ? sourceName : rub === "citation" ? srcName.trim() || null : null;
  const srcUrlFinal = rub === "actu" ? sourceUrl : rub === "citation" ? srcUrl.trim() || null : null;
  const entree: GenerateInput = {
    rubrique: rub, idea, sourceUrl: srcUrlFinal, sourceName: srcNameFinal, articleTitle, articleSummary, categorie,
    portrait: rub === "portrait" ? { nom, specialite, infos } : undefined,
    citation: rub === "citation" ? { texte: citTexte.trim(), auteur: auteur.trim(), fonction: fonction.trim(), contexte: contexte.trim() } : undefined,
  };

  function valider(pourPublier: boolean): string {
    if (platforms.length === 0) return "Choisissez au moins un canal.";
    if (rub === "citation") {
      if (!citTexte.trim() || !auteur.trim() || !fonction.trim()) return "Indiquez la citation exacte, son auteur et sa fonction.";
      if (!srcNameFinal) return "Indiquez la source de la citation (média, discours, compte officiel).";
      if (pourPublier && !photo.trim()) return "Ajoutez la photo de l'auteur : sans elle, la citation ne part pas.";
      if (pourPublier && !droitPhoto) return "Confirmez que TUVOA a le droit d'utiliser cette photo.";
    } else if (rub === "portrait") {
      if (!nom.trim() || !specialite.trim()) return "Indiquez le nom et la spécialité de l'expert.";
      if (pourPublier && !(accord.photo && accord.infos && accord.relecture)) return "Les trois accords de la personne sont obligatoires avant de planifier.";
    } else if (!idea.trim() && !sourceUrl) {
      return rub === "cyberbase" ? "Indiquez la notion à expliquer." : "Écrivez votre idée ou partez d'une actu de la veille.";
    }
    return "";
  }

  async function generer() {
    const v = valider(false);
    setError(v);
    if (v) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/generate", { method: "POST", body: JSON.stringify({ mode: "post", ...entree }) });
      const d = await res.json().catch(() => ({ error: "Le serveur n'a pas répondu à temps. Réessayez." }));
      if (!res.ok || !d.generated) throw new Error(d.error || "Aucun texte reçu. Réessayez.");
      setGen(d.generated);
      if (d.image && !photo.trim() && rub === "actu") setPhoto(d.image);
      setNotice(d.notice ?? "");
      setPicked(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Depuis la veille : l'IA rédige tout de suite.
  const lance = useRef(false);
  useEffect(() => {
    if (sourceUrl && !lance.current) {
      lance.current = true;
      void generer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl]);

  const g: Generated | null = gen ?? (idea.trim() || sourceUrl || (rub === "citation" && citTexte.trim()) || (rub === "portrait" && nom.trim()) ? draftWithoutAI(entree) : null);
  const accroche = gen && picked > 0 ? gen.variantes[picked] : undefined;
  const texteFb = g ? avecAccroche(g.facebook, accroche) : "";

  function construire(): Partial<Post> {
    const cit = rub === "citation";
    return {
      rubrique: rub,
      idea,
      title: cit ? `${auteur.trim()} : « ${citTexte.replace(/\*\*/g, "").trim().slice(0, 80)} »` : articleTitle || g?.wp_title || g?.visuel_titre || (rub === "portrait" ? nom : idea),
      source_name: srcNameFinal,
      source_url: srcUrlFinal,
      origin: sourceUrl ? "veille" : "manuel",
      platforms,
      status: "brouillon",
      texts: g
        ? { facebook: texteFb, linkedin: g.linkedin, tiktok: g.tiktok, wp_title: g.wp_title, wp_body: g.wp_body }
        : { facebook: idea, linkedin: idea, tiktok: idea.slice(0, 150), wp_title: idea, wp_body: idea ? `<p>${idea}</p>` : "" },
      visual: cit
        ? { titre: auteur.trim(), texte: citTexte.trim(), nom: auteur.trim(), specialite: fonction.trim(), photo: photo.trim() || undefined }
        : {
            titre: rub === "portrait" ? nom : g?.visuel_titre || idea,
            texte: rub === "portrait" ? specialite : g?.visuel_texte || "",
            nom: rub === "portrait" ? nom : undefined,
            specialite: rub === "portrait" ? specialite : undefined,
            image: photo.trim() || undefined,
          },
    };
  }

  async function enregistrer(mode: "brouillon" | "editeur" | "planifier") {
    const v = valider(mode === "planifier");
    setError(v);
    if (v) return;
    let at: string | undefined;
    if (mode === "planifier") {
      if (quand === "libre") at = libre?.toISOString();
      else if (quand === "choisir") at = custom ? new Date(custom).toISOString() : undefined;
      else if (quand === "maintenant") at = new Date().toISOString();
      if (quand === "brouillon") mode = "brouillon";
      else if (!at) return setError("Choisissez une date de publication.");
    }
    setBusy(true);
    try {
      const saved = await savePost(construire());
      if (mode === "planifier") {
        await postAction("schedule", saved, at);
        router.push("/calendrier");
      } else router.push(mode === "editeur" ? `/editeur?id=${saved.id}` : "/calendrier?filtre=brouillon");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const cible = quand === "libre" ? libre : quand === "choisir" && custom ? new Date(custom) : quand === "maintenant" ? new Date() : null;
  const nomsCanaux = platforms.map((p) => ({ facebook: "Facebook", linkedin: "LinkedIn", wordpress: "le site", tiktok: "TikTok" })[p]).join(", ");
  const resume = `${nomsCanaux || "Aucun canal"} · ${quand === "brouillon" ? "en brouillon" : cible ? dateLongue(cible).toLowerCase() : "date à choisir"}`;
  const planifier = quand === "maintenant" ? "PUBLIER" : quand === "brouillon" ? "ENREGISTRER" : cible ? `PLANIFIER · ${heureCourte(cible)}` : "PLANIFIER";

  // Aperçu du visuel
  const citDiff = useDiffere(`${citTexte}|${auteur}|${fonction}|${photo}|${srcName}`);
  const [visuelCitation, setVisuelCitation] = useState("");
  useEffect(() => {
    if (rub !== "citation") return;
    const [t, a, f, ph, s] = citDiff.split("|");
    if (!t.trim()) return setVisuelCitation("");
    let vivant = true;
    visuelsDe({ rubrique: "citation", platforms: ["facebook"], visual: { titre: a, texte: t, nom: a, specialite: f, photo: ph || undefined }, source_name: s || null })
      .then((v) => vivant && setVisuelCitation(v.facebook ?? ""))
      .catch(() => {});
    return () => { vivant = false; };
  }, [citDiff, rub]);
  const imageApercu = rub === "citation" ? visuelCitation : photo;

  const commun = { busy, error, notice };

  // ─── Contenu propre à chaque rubrique ───
  let etapes: Etape[] = [];
  let formulaire: React.ReactNode = null;
  let controles: [string, boolean][] = [];
  let canauxDetails: Partial<Record<Platform, string>> = {};
  let noteQuand = "";
  let libreTitre = "Prochain créneau libre";
  let optionsQuand: Quand[] = ["libre", "maintenant", "choisir"];

  const blocAccroches = gen ? (
    <div role="radiogroup" aria-label="Accroche" className="tv-choix" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      {gen.variantes.map((v, i) => (
        <button key={i} type="button" role="radio" aria-checked={picked === i} onClick={() => setPicked(i)}>
          <span className="row" style={{ gap: 8 }}><span className="radio" /><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#5B6B86" }}>{VERSIONS[i] ?? `VERSION ${i + 1}`}</span><span style={{ marginLeft: "auto", fontSize: 12, color: v.length > 125 ? "#B45309" : "#5B6B86" }}>{v.length} car.</span></span>
          <span style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 600, color: "#0B1A33" }}>{v}</span>
        </button>
      ))}
    </div>
  ) : null;
  const boutonIA = (label: string) => (
    <button type="button" className={gen ? "btn small" : "btn small dark"} onClick={generer} disabled={busy}>
      <Trait d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" size={16} stroke={2} />
      {busy ? "Rédaction…" : gen ? "Trois autres versions" : label}
    </button>
  );

  if (rub === "actu") {
    etapes = [
      { id: "sujet", l: "Sujet", etat: idea.trim() || sourceUrl ? "fait" : "cours" },
      { id: "accroche", l: "Accroche", etat: gen ? "fait" : idea.trim() || sourceUrl ? "cours" : "" },
      { id: "diffusion", l: "Diffusion", etat: gen ? "cours" : "" },
    ];
    canauxDetails = { facebook: "Idéal ≤ 477 car. · pli à 125", linkedin: "Idéal 1 200 – 2 400 car.", wordpress: "Article ≥ 300 mots · titre ≤ 60", tiktok: "Légende 50 – 150 · vidéo requise" };
    noteQuand = "VOA garde 30 minutes d'écart avec les autres publications.";
    formulaire = (
      <>
        <Carte id="sujet" titre="1 · Le sujet">
          {sourceUrl ? (
            <div className="tv-source">
              <SourceLogo name={sourceName ?? "Source"} url={sourceUrl} size={52} radius={14} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="row" style={{ gap: 8, flexWrap: "wrap", fontSize: 12, color: "#5B6B86" }}><span className="tv-pill bleu">DEPUIS LA VEILLE</span><strong style={{ color: "#33425C" }}>{sourceName}</strong>{categorie ? `· ${categorie}` : ""}</span>
                <strong style={{ fontFamily: "var(--font-mont)", fontSize: 17, lineHeight: 1.3 }}>{articleTitle}</strong>
                <span className="row" style={{ gap: 14, fontSize: 13, fontWeight: 600 }}><a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Lire la source</a><Link href="/veille" style={{ textDecoration: "none" }}>Changer d'actu</Link></span>
              </div>
            </div>
          ) : (
            <p className="tv-gris" style={{ fontSize: 13 }}>Partez d'une actu de la <Link href="/veille">veille</Link>, ou écrivez votre idée ci-dessous.</p>
          )}
          <label className="field">{sourceUrl ? "Votre angle (facultatif)" : "Votre idée"}
            <textarea rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={sourceUrl ? "Ce que l'IA doit mettre en avant pour le public de TUVOA" : "Comment repérer une arnaque au mobile money"} />
          </label>
        </Carte>
        <Carte id="accroche" titre="2 · Choisissez l'accroche" extra={boutonIA("Rédiger avec l'IA")}>
          {busy && !gen ? <p className="tv-gris" role="status">L'IA rédige Facebook, LinkedIn, TikTok et l'article, en français…</p> : null}
          {blocAccroches ?? (busy ? null : <p className="tv-gris" style={{ fontSize: 13 }}>L'IA propose trois accroches : directe, pédagogique et question.</p>)}
          {gen ? <span className="tv-gris" style={{ fontSize: 13 }}>Le reste du texte est rédigé pour chaque canal : vous le retouchez dans l'éditeur.</span> : null}
        </Carte>
        <Carte id="diffusion" titre="3 · Visuel, canaux et heure">
          <ImageField label="Image de l'article" hint="Récupérée automatiquement depuis l'article. Vous pouvez la remplacer." value={photo} onChange={setPhoto} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Canaux</span>
            <Canaux value={platforms} onChange={setPlatforms} details={canauxDetails} />
          </div>
          <ChoixQuand value={quand} onChange={setQuand} libre={libre} custom={custom} setCustom={setCustom} note={noteQuand} />
        </Carte>
      </>
    );
    controles = [
      [srcNameFinal ? `Source citée : ${srcNameFinal}` : "Pas de source : précisez d'où vient l'info", Boolean(srcNameFinal) || Boolean(idea.trim())],
      ["Montants convertis en FCFA", !montantSansFcfa(texteFb)],
      [accroche || gen?.variantes[0] ? `Accroche de ${(accroche ?? gen?.variantes[0] ?? "").length} car. (visible avant « Voir plus » sous 125)` : "Accroche à choisir", Boolean(gen) && (accroche ?? gen?.variantes[0] ?? "").length <= 125],
      [`Facebook : ${texteFb.length} car. (idéal ≤ 477)`, texteFb.length > 0 && texteFb.length <= 477],
      ["Visuel prêt", Boolean(imageApercu)],
    ];
  } else if (rub === "citation") {
    etapes = [
      { id: "citation", l: "La citation", etat: citTexte.trim() && srcName.trim() ? "fait" : "cours" },
      { id: "auteur", l: "L'auteur", etat: auteur.trim() && fonction.trim() && photo ? "fait" : citTexte.trim() ? "cours" : "" },
      { id: "diffusion", l: "Diffusion", etat: auteur.trim() && photo ? "cours" : "" },
    ];
    canauxDetails = { facebook: "Visuel + légende courte, 40 à 80 car.", linkedin: "Visuel + contexte, 300 à 600 car." };
    libreTitre = "Prochain créneau citation";
    noteQuand = "Les citations partent toutes les 2 h, de 8 h à 22 h : VOA prend le premier créneau libre.";
    const lg = citTexte.replace(/\*\*/g, "").trim().length;
    formulaire = (
      <>
        <Carte id="citation" titre="1 · La citation, mot pour mot" extra={<span className="tv-pill" style={{ background: "#EDE7FF", color: "#5B21B6" }}>Vérifiable ou rien</span>}>
          <label className="field">La phrase exacte
            <span className="tv-gris" style={{ fontWeight: 400, fontSize: 13 }}>Sans guillemets, sans retouche. Entourez de deux étoiles les **mots** à mettre en bleu sur le visuel.</span>
            <textarea rows={4} value={citTexte} onChange={(e) => setCitTexte(e.target.value)} style={{ fontFamily: "var(--font-mont)", fontWeight: 600, fontSize: 17 }} placeholder="La phrase exacte, telle qu'elle a été dite ou écrite." />
          </label>
          <div className="row" style={{ gap: 12, fontSize: 12, fontWeight: 600, color: "#5B6B86" }}>
            <span>{lg} car.</span><span style={{ flex: 1 }}><Jauge n={lg} ideal={[40, 180]} max={300} /></span><span>Idéal : moins de 180 pour rester lisible</span>
          </div>
          <div className="tv-grille2">
            <label className="field">Source<input type="text" value={srcName} onChange={(e) => setSrcName(e.target.value)} placeholder="Média, discours, compte officiel" /></label>
            <label className="field">Lien de la source<input type="url" value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} placeholder="https://…" /></label>
          </div>
          <label className="field">Contexte (facultatif)<input type="text" value={contexte} onChange={(e) => setContexte(e.target.value)} placeholder="Où et quand la phrase a été prononcée" /></label>
        </Carte>
        <Carte id="auteur" titre="2 · L'auteur">
          <div className="tv-grille2">
            <label className="field">Nom<input type="text" value={auteur} onChange={(e) => setAuteur(e.target.value)} placeholder="Prénom Nom" /></label>
            <label className="field">Fonction<input type="text" value={fonction} onChange={(e) => setFonction(e.target.value)} placeholder="Fonction, organisation" /></label>
          </div>
          <ImageField label="Photo de l'auteur" hint="Une photo dont TUVOA a le droit d'usage. Le visuel se met à jour dans l'aperçu." value={photo} onChange={setPhoto} />
          <label className="tv-accord">
            <input type="checkbox" checked={droitPhoto} onChange={(e) => setDroitPhoto(e.target.checked)} />
            <span><strong>TUVOA a le droit d'utiliser cette photo</strong><br /><span style={{ color: "#9A3412", fontSize: 13 }}>Fournie par la personne, son service de presse, ou libre de droits. Sans photo, la citation ne part pas.</span></span>
          </label>
        </Carte>
        <Carte id="diffusion" titre="3 · Diffusion" extra={boutonIA("Rédiger la légende")}>
          {blocAccroches}
          <Canaux value={platforms} onChange={setPlatforms} details={canauxDetails} offerts={["facebook", "linkedin"]} />
          <ChoixQuand value={quand} onChange={setQuand} libre={libre} libreTitre={libreTitre} custom={custom} setCustom={setCustom} note={noteQuand} />
        </Carte>
      </>
    );
    controles = [
      ["Citation mot pour mot, sans retouche", lg > 0],
      [srcName.trim() ? `Source nommée : ${srcName.trim()}${srcUrl.trim() ? ", lien fourni" : ""}` : "Source à indiquer", Boolean(srcName.trim())],
      [`${lg} caractères (lisible sous 180)`, lg > 0 && lg <= 180],
      [photo ? "Photo de l'auteur ajoutée" : "Photo de l'auteur manquante", Boolean(photo)],
      [droitPhoto ? "Droit d'utiliser la photo confirmé" : "Droit d'utiliser la photo à confirmer", droitPhoto],
    ];
  } else if (rub === "cyberbase") {
    const depuis = Date.now() - 30 * 864e5;
    const traitees = posts.filter((p) => p.rubrique === "cyberbase" && p.status !== "annule" && new Date(p.scheduled_at ?? p.created_at).getTime() > depuis).map((p) => (p.visual?.titre || p.idea || p.title).trim()).filter(Boolean);
    const doublon = idea.trim() && traitees.some((t) => t.toLowerCase().includes(idea.trim().toLowerCase()) || idea.trim().toLowerCase().includes(t.toLowerCase()));
    const IDEES = ["Rançongiciel", "VPN", "Mot de passe fort", "Sauvegarde 3-2-1", "Faux SMS bancaires", "Authentification à deux facteurs", "Hameçonnage par QR code"].filter((x) => !traitees.some((t) => t.toLowerCase().includes(x.toLowerCase())));
    etapes = [
      { id: "notion", l: "Notion", etat: idea.trim() ? "fait" : "cours" },
      { id: "explication", l: "Explication", etat: gen ? "fait" : idea.trim() ? "cours" : "" },
      { id: "diffusion", l: "Diffusion", etat: gen ? "cours" : "" },
    ];
    canauxDetails = { facebook: "Visuel + 300 car.", linkedin: "Visuel + 600 car.", wordpress: "Fiche glossaire · 250 mots" };
    libreTitre = "Prochain jour sans #CyberBase";
    noteQuand = "#CyberBase sort chaque jour à heure fixe : VOA prend le premier jour encore vide.";
    formulaire = (
      <>
        <Carte id="notion" titre="1 · La notion du jour">
          <label className="field">Notion à expliquer<input type="text" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Authentification à deux facteurs" style={{ fontFamily: "var(--font-mont)", fontWeight: 700, fontSize: 17 }} /></label>
          {IDEES.length ? (
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <span className="tv-gris" style={{ fontSize: 13 }}>Idées :</span>
              {IDEES.slice(0, 6).map((x) => <button key={x} type="button" className="tv-chip" style={{ height: 36 }} onClick={() => setIdea(x)}>{x}</button>)}
            </div>
          ) : null}
          <div className="tv-source" style={{ flexDirection: "column", gap: 6, fontSize: 13 }}>
            <strong>Déjà traitées ces 30 derniers jours</strong>
            <span className="tv-gris" style={{ fontSize: 13 }}>{traitees.length ? traitees.slice(0, 12).join(" · ") : "Aucune pour l'instant."}</span>
            {idea.trim() ? <span style={{ color: doublon ? "#B45309" : "#05603A", fontWeight: 600 }}>{doublon ? "Cette notion ressemble à une notion déjà traitée." : "Pas de doublon pour cette notion."}</span> : null}
          </div>
        </Carte>
        <Carte id="explication" titre="2 · L'explication" extra={boutonIA("Rédiger avec l'IA")}>
          <span className="tv-gris" style={{ fontSize: 13 }}>Écrite pour quelqu'un qui n'est pas du métier : c'est quoi, pourquoi ça compte, le bon réflexe.</span>
          {busy && !gen ? <p className="tv-gris" role="status">L'IA explique la notion…</p> : null}
          {blocAccroches}
          <ImageField label="Votre visuel #CyberBase" hint="Le visuel que vous avez créé (fond crème #CyberBase). Vous pouvez aussi l'ajouter dans l'éditeur." value={photo} onChange={setPhoto} />
        </Carte>
        <Carte id="diffusion" titre="3 · Diffusion">
          <Canaux value={platforms} onChange={setPlatforms} details={canauxDetails} offerts={["facebook", "linkedin", "wordpress"]} />
          <ChoixQuand value={quand} onChange={setQuand} libre={libre} libreTitre={libreTitre} custom={custom} setCustom={setCustom} note={noteQuand} options={["libre", "choisir"]} />
        </Carte>
      </>
    );
    controles = [
      [doublon ? "Notion déjà traitée récemment" : "Notion jamais traitée ces 30 derniers jours", Boolean(idea.trim()) && !doublon],
      [gen ? "Explication rédigée" : "Explication à rédiger", Boolean(gen)],
      [photo ? "Visuel ajouté" : "Visuel #CyberBase à ajouter", Boolean(photo)],
      [libre ? `Créneau libre : ${dateLongue(libre).toLowerCase()}` : "Aucun créneau libre trouvé", Boolean(libre)],
    ];
  } else {
    const tousAccords = accord.photo && accord.infos && accord.relecture;
    etapes = [
      { id: "expert", l: "L'expert", etat: nom.trim() && specialite.trim() ? "fait" : "cours" },
      { id: "parcours", l: "Parcours", etat: infos.trim() ? "fait" : nom.trim() ? "cours" : "" },
      { id: "accord", l: "Accord", etat: tousAccords ? "fait" : infos.trim() ? "cours" : "" },
      { id: "diffusion", l: "Diffusion", etat: tousAccords ? "cours" : "" },
    ];
    canauxDetails = { facebook: "Visuel + 400 car.", linkedin: "Portrait long, 1 200 à 2 000 car.", wordpress: "Article portrait · 500 mots" };
    noteQuand = "Le portrait part une fois que la personne a relu son texte.";
    formulaire = (
      <>
        <Carte id="expert" titre="1 · L'expert">
          <div className="tv-grille2">
            <label className="field">Nom<input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom Nom" /></label>
            <label className="field">Spécialité<input type="text" value={specialite} onChange={(e) => setSpecialite(e.target.value)} placeholder="Expert en investigation numérique et en IA" /></label>
          </div>
          <ImageField label="Photo portrait" hint="Fournie par la personne." value={photo} onChange={setPhoto} />
        </Carte>
        <Carte id="parcours" titre="2 · Son parcours, ses mots" extra={boutonIA("Rédiger le portrait")}>
          <label className="field">Ce que la personne vous a transmis
            <span className="tv-gris" style={{ fontWeight: 400, fontSize: 13 }}>Son message, sa bio ou vos notes d'entretien : l'IA en tire le portrait sans rien inventer.</span>
            <textarea rows={6} value={infos} onChange={(e) => setInfos(e.target.value)} placeholder="Parcours, réalisations, projets en cours…" />
          </label>
          {busy && !gen ? <p className="tv-gris" role="status">L'IA rédige le portrait…</p> : null}
          {blocAccroches}
        </Carte>
        <Carte id="accord" titre="3 · Son accord" ton="orange" extra={<span style={{ fontSize: 13, color: "#9A3412", fontWeight: 600 }}>Rien ne part sans les trois.</span>}>
          {([["photo", "La photo", "La personne a fourni sa photo ou accepte celle-ci."], ["infos", "Les informations", "Parcours, projets et liens viennent d'elle."], ["relecture", "La relecture", "Elle a relu le texte, ou le relira avant la sortie."]] as const).map(([k, t, d]) => (
            <label key={k} className="tv-accord blanc">
              <input type="checkbox" checked={accord[k]} onChange={(e) => setAccord({ ...accord, [k]: e.target.checked })} />
              <span><strong>{t}</strong><br /><span className="tv-gris" style={{ fontSize: 13 }}>{d}</span></span>
            </label>
          ))}
        </Carte>
        <Carte id="diffusion" titre="4 · Diffusion">
          <Canaux value={platforms} onChange={setPlatforms} details={canauxDetails} offerts={["facebook", "linkedin", "wordpress"]} />
          <ChoixQuand value={quand} onChange={setQuand} libre={libre} custom={custom} setCustom={setCustom} note={noteQuand} options={["brouillon", "libre", "choisir"]} />
        </Carte>
      </>
    );
    controles = [
      ["Nom et spécialité renseignés", Boolean(nom.trim() && specialite.trim())],
      [photo ? "Photo fournie" : "Photo à ajouter", Boolean(photo)],
      ["Accord : photo, infos, relecture", tousAccords],
      ["Aucune information inventée : tout vient de la personne", Boolean(infos.trim())],
    ];
  }

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        <AtelierEntete rub={rub} etapes={etapes} />
        {commun.error ? <p className="notice rouge" role="alert">{commun.error}</p> : null}
        {commun.notice ? <p className="notice ambre" role="status">{commun.notice}</p> : null}
        <div className="tv-atelier">
          <div className="tv-atelier-form">{formulaire}</div>
          <aside className="tv-atelier-side" aria-label="Aperçu et contrôle">
            <section className="tv-carte-side" aria-labelledby="t-apercu">
              <div className="row"><h2 id="t-apercu" className="tv-h2" style={{ fontSize: 18, flex: 1 }}>Aperçu</h2><span className="tv-gris" style={{ fontSize: 12 }}>Facebook · téléphone</span></div>
              <ApercuFacebook
                texte={texteFb}
                image={imageApercu || undefined}
                quand={quand === "brouillon" ? "Brouillon" : cible ? `Planifié · ${dateLongue(cible).toLowerCase()}` : "Brouillon"}
                vide={rub === "citation" ? "La légende apparaîtra ici." : "Le texte apparaîtra ici après la rédaction."}
              />
              {texteFb ? <span className="tv-gris" style={{ fontSize: 12 }}>Le texte est coupé vers 125 caractères sur téléphone : l'essentiel doit tenir avant « Voir plus ».</span> : null}
            </section>
            <Controle items={controles} />
          </aside>
        </div>
      </div>
      <BarreActions
        resume={resume}
        busy={busy}
        onBrouillon={() => enregistrer("brouillon")}
        onEditeur={() => enregistrer("editeur")}
        onPlanifier={() => enregistrer("planifier")}
        planifier={planifier}
      />
    </div>
  );
}
