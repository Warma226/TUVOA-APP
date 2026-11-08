"use client";
// Médiathèque : le stockage présenté comme sous Windows (lecteur, répartition, dossiers).
// Les fichiers ne s'affichent qu'à l'ouverture d'un dossier ou d'une catégorie.
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NAV_ICONS, Trait } from "@/components/BottomNav";
import { useVoirPlus } from "@/components/VoirPlus";
import { CATS, Disque, Dossiers, Repartition, taille, type CatId, type Stockage } from "@/components/Tableau";

type Fichier = { nom: string; chemin: string; url: string; taille: number; type: string; date: string; categorie: CatId; usages?: { id: string; titre: string; status: string }[] };
type Tri = "recent" | "ancien" | "lourd" | "nom";
type Reponse = Stockage & { fichiers: Fichier[]; error?: string };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Mediatheque />
    </Suspense>
  );
}

function Mediatheque() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("dossier");
  const [ouvert, setOuvert] = useState<CatId | "tous" | null>(initial === "tous" || CATS.some((c) => c.id === initial) ? (initial as CatId | "tous") : null);
  const [data, setData] = useState<Reponse | null>(null);
  const [error, setError] = useState("");
  const [charge, setCharge] = useState(false);
  const [envoi, setEnvoi] = useState("");
  const [copie, setCopie] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const charger = useCallback((c: CatId | "tous" | null) => {
    setCharge(true);
    fetch(`/api/mediatheque${c ? `?dossier=${c}` : ""}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({ error: `Erreur du serveur (${r.status}).` }))) as Reponse;
        if (j.error) throw new Error(j.error);
        setData(j);
        setError("");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setCharge(false));
  }, []);
  useEffect(() => charger(ouvert), [ouvert, charger]);

  function ouvrir(c: CatId | "tous" | null) {
    if (c === "tous") setTri("lourd");
    setOuvert(c);
    router.replace(c ? `/mediatheque?dossier=${c}` : "/mediatheque", { scroll: false });
  }

  async function importer(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    try {
      let i = 0;
      for (const f of Array.from(files)) {
        i++;
        setEnvoi(`Envoi ${i}/${files.length} : ${f.name}`);
        const type = f.type || "application/octet-stream";
        if (!/^(image|audio|video)\//.test(type)) throw new Error(`« ${f.name} » : seuls les images, sons et vidéos sont acceptés.`);
        const ext = f.name.split(".").pop() ?? "";
        const r = await fetch("/api/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ext }) });
        const s = (await r.json()) as { signedUrl?: string; error?: string };
        if (!s.signedUrl) throw new Error(s.error ?? "Lien d'envoi indisponible.");
        const up = await fetch(s.signedUrl, { method: "PUT", headers: { "Content-Type": type }, body: f });
        if (!up.ok) throw new Error(`Envoi de « ${f.name} » refusé (${up.status}).`);
      }
      charger(ouvert);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnvoi("");
      if (input.current) input.current.value = "";
    }
  }

  async function copier(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(url);
      setTimeout(() => setCopie(""), 2000);
    } catch {
      window.prompt("Copie le lien :", url);
    }
  }

  const cat = ouvert === "tous" ? { id: "tous", dossier: "Tous les fichiers, du plus lourd au plus léger" } : CATS.find((c) => c.id === ouvert);
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState<Tri>("recent");
  const [inutilises, setInutilises] = useState(false);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [renomme, setRenomme] = useState<{ chemin: string; nom: string } | null>(null);
  const [action, setAction] = useState("");
  const tous = data?.fichiers ?? [];
  const fichiers = tous
    .filter((f) => !recherche.trim() || f.nom.toLowerCase().includes(recherche.trim().toLowerCase()))
    .filter((f) => !inutilises || !(f.usages ?? []).length)
    .sort((a, b) => (tri === "recent" ? b.date.localeCompare(a.date) : tri === "ancien" ? a.date.localeCompare(b.date) : tri === "lourd" ? b.taille - a.taille : a.nom.localeCompare(b.nom)));
  const vF = useVoirPlus(fichiers, 20, `${ouvert}|${recherche}|${tri}|${inutilises}`);
  const enCours = (f: Fichier) => (f.usages ?? []).filter((u) => ["planifie", "a_valider"].includes(u.status));
  const inutilisesTous = tous.filter((f) => !(f.usages ?? []).length);
  const recuperable = inutilisesTous.reduce((t, f) => t + f.taille, 0);

  async function poster(body: unknown) {
    const r = await fetch("/api/mediatheque", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`);
    return d;
  }
  async function telecharger(f: Fichier) {
    try {
      const b = await (await fetch(f.url)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = f.nom;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch {
      window.open(f.url, "_blank", "noopener");
    }
  }
  async function renommer() {
    if (!renomme) return;
    setAction("renommer"); setError("");
    try { await poster({ renommer: renomme.chemin, nom: renomme.nom }); setRenomme(null); charger(ouvert); }
    catch (e) { setError((e as Error).message); } finally { setAction(""); }
  }
  async function supprimer(liste: Fichier[]) {
    if (!liste.length) return;
    const bloques = liste.filter((f) => enCours(f).length);
    if (bloques.length) return setError(`« ${bloques[0].nom} » sert à une publication planifiée : retirez-le d'abord de cette publication, ou annulez-la.`);
    const publies = liste.filter((f) => (f.usages ?? []).length).length;
    const msg = `Supprimer définitivement ${liste.length > 1 ? `ces ${liste.length} fichiers` : `« ${liste[0].nom} »`} ?${publies ? `\n${publies} fichier${publies > 1 ? "s ont" : " a"} déjà servi à des publications parues : elles restent en ligne, mais l'image ne sera plus disponible ici.` : ""}`;
    if (!window.confirm(msg)) return;
    setAction("supprimer"); setError("");
    try { await poster({ supprimer: liste.map((f) => f.chemin) }); setChoisis(new Set()); charger(ouvert); }
    catch (e) { setError((e as Error).message); } finally { setAction(""); }
  }
  const basculer = (c: string) => { const n = new Set(choisis); if (n.has(c)) n.delete(c); else n.add(c); setChoisis(n); };

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        <div className="tv-entete">
          <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/" className="tv-gris" style={{ textDecoration: "none", fontWeight: 600 }}>← Tableau de bord</Link>
            <h1 className="tv-titre">Médiathèque</h1>
            <span className="tv-gris">Images, voix off et vidéos enregistrées par l'app. Ouvrez un dossier ou une catégorie pour voir ses fichiers.</span>
          </div>
          <input ref={input} type="file" multiple accept="image/*,audio/*,video/*" hidden onChange={(e) => importer(e.target.files)} />
          <button type="button" className="tv-btn-nuit" onClick={() => input.current?.click()} disabled={Boolean(envoi)}>
            <Trait d="M12 16V4M7 9l5-5 5 5M4 20h16" size={18} stroke={2.2} />{envoi ? "ENVOI…" : "IMPORTER"}
          </button>
        </div>

        {envoi ? <p className="notice" role="status">{envoi}</p> : null}
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}

        <section className="tv-verre tv-media" aria-label="Stockage">
          {data ? (
            <>
              <div className="tv-disques">
                <Disque s={data} o={{ onOuvrir: ouvrir, ouvert: ouvert === "tous" ? null : ouvert }} />
                <Repartition s={data} o={{ onOuvrir: ouvrir, ouvert: ouvert === "tous" ? null : ouvert }} />
              </div>
              <Dossiers s={data} o={{ onOuvrir: ouvrir, ouvert: ouvert === "tous" ? null : ouvert }} />
              <div className="tv-liberer">
                <Trait d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" size={22} stroke={2} />
                <span style={{ flex: "1 1 240px" }}><strong>Libérer de l&apos;espace</strong><br /><span className="tv-gris" style={{ fontSize: 13 }}>Tous les fichiers, du plus lourd au plus léger, pour repérer et supprimer ce qui encombre.</span></span>
                <button type="button" className="tv-btn-nuit" style={{ height: 44 }} onClick={() => ouvrir("tous")}>Voir les plus lourds</button>
              </div>
            </>
          ) : <p className="tv-gris">{error ? "Stockage indisponible." : "Lecture du stockage…"}</p>}
        </section>

        {ouvert && cat ? (
          <section className="tv-verre tv-media" aria-labelledby="dossier">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <nav aria-label="Emplacement" style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#5B6B86", minWidth: 0 }}>
                <button type="button" className="btn link" style={{ fontSize: 14 }} onClick={() => ouvrir(null)}>Stockage TUVOA (T:)</button>
                <span aria-hidden="true">›</span>
                <h2 id="dossier" className="tv-h2" style={{ fontSize: 18 }}>{cat.dossier}</h2>
                <span>· {charge ? "…" : `${fichiers.length} élément${fichiers.length > 1 ? "s" : ""}`}</span>
              </nav>
              <button type="button" className="btn small ghost" onClick={() => ouvrir(null)}>Fermer</button>
            </div>
            {ouvert === "tous" && inutilisesTous.length ? (
              <div className="tv-liberer" style={{ background: "#FFF7ED", borderColor: "#FED7AA" }}>
                <span style={{ flex: "1 1 260px", fontSize: 14 }}><strong>{inutilisesTous.length} fichier{inutilisesTous.length > 1 ? "s" : ""} jamais utilisé{inutilisesTous.length > 1 ? "s" : ""}</strong> · {taille(recuperable)} récupérables</span>
                <button type="button" className="btn small" onClick={() => setChoisis(new Set(inutilisesTous.map((f) => f.chemin)))}>Sélectionner les jamais utilisés</button>
              </div>
            ) : null}
            {tous.length ? (
              <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
                <label className="tv-recherche" style={{ flex: "1 1 220px", maxWidth: 320, height: 44 }}>
                  <Trait d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" size={16} stroke={2} />
                  <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un fichier" aria-label="Chercher un fichier" />
                </label>
                <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 600 }}>Trier
                  <select value={tri} onChange={(e) => setTri(e.target.value as Tri)} style={{ height: 44, width: "auto" }}>
                    <option value="recent">Plus récents</option><option value="ancien">Plus anciens</option><option value="lourd">Plus lourds</option><option value="nom">Nom</option>
                  </select>
                </label>
                <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <input type="checkbox" checked={inutilises} onChange={(e) => setInutilises(e.target.checked)} style={{ width: 18, height: 18 }} />Jamais utilisés
                </label>
                <span style={{ flex: 1 }} />
                {choisis.size ? (
                  <>
                    <span className="tv-gris" style={{ fontSize: 13 }}>{choisis.size} choisi{choisis.size > 1 ? "s" : ""} · {taille(tous.filter((f) => choisis.has(f.chemin)).reduce((t, f) => t + f.taille, 0))}</span>
                    <button type="button" className="btn small" onClick={() => setChoisis(new Set())}>Tout désélectionner</button>
                    <button type="button" className="btn small danger" disabled={!!action} onClick={() => supprimer(tous.filter((f) => choisis.has(f.chemin)))}>{action === "supprimer" ? "Suppression…" : "Supprimer la sélection"}</button>
                  </>
                ) : <button type="button" className="btn small" onClick={() => setChoisis(new Set(fichiers.map((f) => f.chemin)))}>Tout sélectionner</button>}
              </div>
            ) : null}
            {charge && !tous.length ? <p className="tv-gris">Ouverture du dossier…</p> : null}
            {!charge && !tous.length ? <p className="tv-gris">Ce dossier est vide.</p> : null}
            {tous.length && !fichiers.length ? <p className="tv-gris">Aucun fichier ne correspond.</p> : null}
            <div className="tv-fichiers">
              {vF.visibles.map((f) => {
                const us = f.usages ?? [];
                const bloque = enCours(f).length > 0;
                return (
                  <div key={f.chemin} className="tv-fichier" data-choisi={choisis.has(f.chemin)}>
                    <label className="tv-fichier-choix" title="Sélectionner">
                      <input type="checkbox" checked={choisis.has(f.chemin)} onChange={() => basculer(f.chemin)} aria-label={`Sélectionner ${f.nom}`} />
                    </label>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="apercu" aria-label={`Ouvrir ${f.nom}`}>
                      {f.categorie === "images" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt="" loading="lazy" />
                      ) : f.categorie === "voix" ? (
                        <span style={{ color: "#7C3AED" }}><Trait d={CATS[1].d} size={40} /></span>
                      ) : f.categorie === "videos" ? (
                        <span style={{ color: "#0E9F8E" }}><Trait d={CATS[2].d} size={40} /></span>
                      ) : (
                        <span style={{ color: "#8A93A6" }}><Trait d={CATS[3].d} size={40} /></span>
                      )}
                    </a>
                    {f.categorie === "voix" ? <audio controls preload="none" src={f.url} style={{ width: "100%", height: 32 }} /> : null}
                    <div className="infos">
                      {renomme?.chemin === f.chemin ? (
                        <form onSubmit={(e) => { e.preventDefault(); void renommer(); }} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <input type="text" value={renomme.nom} onChange={(e) => setRenomme({ ...renomme, nom: e.target.value })} aria-label="Nouveau nom" autoFocus style={{ height: 36, fontSize: 13 }} />
                          <span className="row" style={{ gap: 6 }}>
                            <button type="submit" className="btn small dark" disabled={!!action}>{action === "renommer" ? "…" : "OK"}</button>
                            <button type="button" className="btn small" onClick={() => setRenomme(null)}>Annuler</button>
                          </span>
                        </form>
                      ) : <strong title={f.nom}>{f.nom}</strong>}
                      <span style={{ color: "#5B6B86" }}>{taille(f.taille)}{f.date ? ` · ${new Date(f.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}</span>
                      {us.length ? (
                        <Link href={us[0].status === "brouillon" ? `/editeur?id=${us[0].id}` : `/apercu?id=${us[0].id}`} className="tv-usage" title={us.map((u) => u.titre).join(" · ")}>
                          Utilisé par {us.length} publication{us.length > 1 ? "s" : ""}
                        </Link>
                      ) : <span className="tv-usage libre">Jamais utilisé</span>}
                    </div>
                    <div className="tv-fichier-actions" aria-label={`Actions sur ${f.nom}`}>
                      <button type="button" onClick={() => telecharger(f)}><Trait d="M12 4v12M7 11l5 5 5-5M4 20h16" size={16} stroke={2} />Télécharger</button>
                      <button type="button" onClick={() => copier(f.url)}><Trait d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" size={16} stroke={2} />{copie === f.url ? "Copié" : "Lien"}</button>
                      <button type="button" disabled={us.length > 0} title={us.length ? "Déjà utilisé : renommer casserait le lien des publications" : "Renommer"} onClick={() => setRenomme({ chemin: f.chemin, nom: f.nom.replace(/\.[a-z0-9]{2,5}$/i, "") })}><Trait d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" size={16} stroke={2} />Renommer</button>
                      <button type="button" className="danger" disabled={bloque || !!action} title={bloque ? "Une publication planifiée l'utilise" : "Supprimer définitivement"} onClick={() => supprimer([f])}><Trait d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" size={16} stroke={2} />Supprimer</button>
                      {f.categorie === "images" ? (
                        <label className="utiliser">
                          <span className="sr-only">Utiliser cette image</span>
                          <select value="" onChange={(e) => { if (e.target.value) router.push(`/creer/${e.target.value}?image=${encodeURIComponent(f.url)}`); }}>
                            <option value="">Utiliser pour…</option>
                            <option value="actu">Une actualité</option>
                            <option value="citation">La photo d&apos;une citation</option>
                            <option value="portrait">La photo d&apos;un portrait</option>
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {vF.bouton}
          </section>
        ) : null}

        <p className="tv-gris" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Trait d={NAV_ICONS.media} size={14} /> Capacité estimée sur l'offre gratuite Supabase (1 Go).
        </p>
      </div>
    </div>
  );
}
