"use client";
// Médiathèque : le stockage présenté comme sous Windows (lecteur, répartition, dossiers).
// Les fichiers ne s'affichent qu'à l'ouverture d'un dossier ou d'une catégorie.
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NAV_ICONS, Trait } from "@/components/BottomNav";
import { CATS, Disque, Dossiers, Repartition, taille, type CatId, type Stockage } from "@/components/Tableau";

type Fichier = { nom: string; chemin: string; url: string; taille: number; type: string; date: string; categorie: CatId };
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
  const initial = params.get("dossier") as CatId | null;
  const [ouvert, setOuvert] = useState<CatId | null>(CATS.some((c) => c.id === initial) ? initial : null);
  const [data, setData] = useState<Reponse | null>(null);
  const [error, setError] = useState("");
  const [charge, setCharge] = useState(false);
  const [envoi, setEnvoi] = useState("");
  const [copie, setCopie] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const charger = useCallback((c: CatId | null) => {
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

  function ouvrir(c: CatId | null) {
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

  const cat = CATS.find((c) => c.id === ouvert);
  const fichiers = data?.fichiers ?? [];

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
                <Disque s={data} o={{ onOuvrir: ouvrir, ouvert }} />
                <Repartition s={data} o={{ onOuvrir: ouvrir, ouvert }} />
              </div>
              <Dossiers s={data} o={{ onOuvrir: ouvrir, ouvert }} />
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
            {charge && !fichiers.length ? <p className="tv-gris">Ouverture du dossier…</p> : null}
            {!charge && !fichiers.length ? <p className="tv-gris">Ce dossier est vide.</p> : null}
            <div className="tv-fichiers">
              {fichiers.map((f) => (
                <div key={f.chemin} className="tv-fichier">
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
                    <strong title={f.nom}>{f.nom}</strong>
                    <span style={{ color: "#5B6B86" }}>{taille(f.taille)}{f.date ? ` · ${new Date(f.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}</span>
                    <button type="button" className="btn link" style={{ fontSize: 12, alignSelf: "flex-start" }} onClick={() => copier(f.url)}>
                      {copie === f.url ? "Lien copié" : "Copier le lien"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <p className="tv-gris" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Trait d={NAV_ICONS.media} size={14} /> Capacité estimée sur l'offre gratuite Supabase (1 Go).
        </p>
      </div>
    </div>
  );
}
