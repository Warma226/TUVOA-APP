"use client";
// Studio de VOA : créer un visuel « pub » à partir d'un modèle (photo + cartes flottantes + gros titres),
// laisser VOA écrire les textes, puis l'envoyer au calendrier.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/BottomNav";
import { ImageField } from "@/components/ImageField";
import Voa from "@/components/Voa";
import { EXEMPLES, MODELES, type StudioAmbiance, type StudioCarte, type StudioData, type StudioIcone, type StudioModele } from "@/lib/studio";

const LIBELLES: Record<string, string> = {
  surtitre: "Petite phrase au-dessus", titre: "Titre", petit: "Mot en plus petit", fort: "Mots mis en valeur",
  pastille: "Pastille", sous: "Sous-titre", bouton: "Bouton", barre: "Texte de la barre du bas",
};
const ICONES: StudioIcone[] = ["bouclier", "maj", "cle", "nuage", "lien", "bulle", "antenne", "argent", "robot", "coeur", "cal", "ia"];
const NOMS_ICONES: Record<StudioIcone, string> = { bouclier: "Bouclier", maj: "Mise à jour", cle: "Cadenas", nuage: "Nuage", lien: "Lien", bulle: "Message", antenne: "Antenne", argent: "Argent", robot: "Robot", coeur: "Cœur", cal: "Calendrier", ia: "IA" };
const AMBIANCES: { id: StudioAmbiance; nom: string }[] = [{ id: "jaune", nom: "Soleil" }, { id: "bleu", nom: "Bleu TUVOA" }, { id: "noir", nom: "Nuit" }, { id: "clair", nom: "Clair" }];

async function api(body: unknown) {
  const res = await fetch("/api/studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Erreur ${res.status}`);
  return d;
}

export default function Studio() {
  const [data, setData] = useState<StudioData>({ modele: "reflexes", ...EXEMPLES.reflexes });
  const [apercu, setApercu] = useState("");
  const [charge, setCharge] = useState(false);
  const [sujet, setSujet] = useState("");
  const [legende, setLegende] = useState("");
  const [quand, setQuand] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [envoye, setEnvoye] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modele = useMemo(() => MODELES.find((m) => m.id === data.modele) ?? MODELES[1], [data.modele]);

  // Aperçu rafraîchi 0,7 s après la dernière modification
  useEffect(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      api({ action: "apercu", data }).then((d) => { setCharge(true); setApercu(d.url); }).catch((e: Error) => setError(e.message));
    }, 700);
    return () => { if (minuteur.current) clearTimeout(minuteur.current); };
  }, [data]);

  function choisir(id: StudioModele) {
    setEnvoye(null);
    setData((old) => ({ modele: id, photo: old.photo, ...EXEMPLES[id] }));
    if (id === "actus") void remplirArticles();
  }
  const champ = (k: keyof StudioData, v: string) => setData((d) => ({ ...d, [k]: v }));
  const carte = (i: number, patch: Partial<StudioCarte>) => setData((d) => {
    const cartes = [...(d.cartes ?? [])];
    while (cartes.length <= i) cartes.push({ titre: "", texte: "" });
    cartes[i] = { ...cartes[i], ...patch };
    return { ...d, cartes };
  });
  const chip = (i: number, v: string) => setData((d) => { const chips = [...(d.chips ?? [])]; chips[i] = v; return { ...d, chips }; });

  async function remplirArticles() {
    setBusy("articles"); setError("");
    try { const d = await api({ action: "articles" }); setData((old) => ({ ...old, cartes: d.cartes })); }
    catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }
  async function rediger() {
    setBusy("rediger"); setError("");
    try { const d = await api({ action: "rediger", data, sujet }); setData(d.data); if (d.legende) setLegende(d.legende); }
    catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }
  async function envoyer() {
    setBusy("envoyer"); setError("");
    try { const d = await api({ action: "calendrier", data, legende, quand: quand ? new Date(quand).toISOString() : undefined }); setEnvoye(d.id); }
    catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  const nbCartes = modele.cartes;
  return (
    <>
      <TopBar title="Studio de VOA" back="/communaute" wide />
      <main className="page sub wide" style={{ paddingTop: 4 }}>
        <div className="row" style={{ gap: 14, alignItems: "center" }}>
          <Voa humeur={busy === "rediger" ? "parle" : envoye ? "fete" : "veille"} taille={72} />
          <p className="muted" style={{ flex: 1 }}>Choisis un modèle, ajoute ta photo, laisse VOA écrire les textes, puis envoie le visuel au calendrier. L&apos;aperçu se met à jour tout seul.</p>
        </div>
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}

        <section className="stack">
          <p className="section-title">1. Le modèle</p>
          <div className="grid2" role="radiogroup" aria-label="Modèle de visuel">
            {MODELES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={data.modele === m.id} className="card" onClick={() => choisir(m.id)}
                style={{ textAlign: "left", cursor: "pointer", border: data.modele === m.id ? "2px solid var(--bleu)" : undefined, gap: 4 }}>
                <strong style={{ fontSize: 15 }}>{m.nom}</strong>
                <span className="muted" style={{ fontSize: 13 }}>{m.description}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-start", gap: 24 }}>
          <div className="stack" style={{ flex: "1 1 340px", minWidth: 0 }}>
            <p className="section-title">2. La photo</p>
            <ImageField label="Photo" hint="Une photo dont TUVOA a le droit d'usage (la tienne, ton équipe, ou libre de droits). JPG ou PNG." value={data.photo ?? ""} onChange={(v) => champ("photo", v)} />
            {data.modele === "waouh" || data.modele === "ecoute" ? (
              <label className="field">Ambiance
                <select value={data.ambiance ?? (data.modele === "waouh" ? "jaune" : "bleu")} onChange={(e) => champ("ambiance", e.target.value)}>
                  {AMBIANCES.filter((a) => data.modele === "waouh" || a.id === "bleu" || a.id === "noir").map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                </select>
              </label>
            ) : null}

            <p className="section-title">3. Les textes</p>
            <div className="card" style={{ gap: 10 }}>
              <label className="field">Sujet ou occasion (pour VOA)
                <input type="text" value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Ex. bon week-end et prudence en ligne, lancement de la rubrique IA…" />
              </label>
              <button type="button" className="btn primary" disabled={!!busy} onClick={rediger}>{busy === "rediger" ? "VOA écrit…" : "Rédiger avec VOA"}</button>
            </div>
            {modele.champs.map((k) => (
              <label key={k} className="field">{LIBELLES[k] ?? k}
                <input type="text" value={(data[k] as string | undefined) ?? ""} onChange={(e) => champ(k, e.target.value)} />
              </label>
            ))}
            {modele.chips ? (
              <div className="stack" style={{ gap: 8 }}>
                <p className="label">Étiquettes</p>
                <div className="grid2">
                  {Array.from({ length: modele.chips }, (_, i) => <input key={i} type="text" aria-label={`Étiquette ${i + 1}`} value={data.chips?.[i] ?? ""} onChange={(e) => chip(i, e.target.value)} />)}
                </div>
              </div>
            ) : null}
            {nbCartes ? (
              <div className="stack" style={{ gap: 10 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <p className="label">Cartes</p>
                  {data.modele === "actus" ? <button type="button" className="btn small ghost" disabled={!!busy} onClick={remplirArticles}>{busy === "articles" ? "…" : "Derniers articles"}</button> : null}
                </div>
                {Array.from({ length: nbCartes }, (_, i) => {
                  const c = data.cartes?.[i] ?? { titre: "", texte: "" };
                  return (
                    <div key={i} className="card" style={{ gap: 8, padding: 12 }}>
                      <div className="grid2">
                        <input type="text" aria-label={`Carte ${i + 1} : titre`} placeholder="Titre" value={c.titre} onChange={(e) => carte(i, { titre: e.target.value })} />
                        {data.modele !== "ecoute" ? <input type="text" aria-label={`Carte ${i + 1} : état`} placeholder={data.modele === "actus" ? "Jour" : "État (Activée…)"} value={c.etat ?? ""} onChange={(e) => carte(i, { etat: e.target.value })} /> : null}
                      </div>
                      <input type="text" aria-label={`Carte ${i + 1} : texte`} placeholder={data.modele === "ecoute" ? "Heure (Samedi · 23:58)" : "Texte"} value={c.texte} onChange={(e) => carte(i, { texte: e.target.value })} />
                      <div className="grid2">
                        {data.modele === "reflexes" || data.modele === "waouh" ? <input type="text" aria-label={`Carte ${i + 1} : bouton`} placeholder="Bouton" value={c.bouton ?? ""} onChange={(e) => carte(i, { bouton: e.target.value })} /> : null}
                        <select aria-label={`Carte ${i + 1} : icône`} value={c.icone ?? ""} onChange={(e) => carte(i, { icone: (e.target.value || undefined) as StudioIcone | undefined })}>
                          <option value="">Icône automatique</option>
                          {ICONES.map((ic) => <option key={ic} value={ic}>{NOMS_ICONES[ic]}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="stack" style={{ flex: "1 1 380px", minWidth: 0, position: "sticky", top: 12 }}>
            <p className="section-title">Aperçu</p>
            <div className="card" style={{ padding: 0, overflow: "hidden", aspectRatio: "4 / 5", alignItems: "center", justifyContent: "center", background: "#0B1633" }}>
              {apercu ? <img src={apercu} alt="Aperçu du visuel" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: charge ? 1 : 0.5 }} onLoad={() => setCharge(true)} onLoadStart={() => setCharge(false)} /> : <p className="muted">Préparation de l&apos;aperçu…</p>}
            </div>
            {apercu ? <a className="btn ghost" href={apercu} download="TUVOA_visuel.png" target="_blank" rel="noopener noreferrer">Télécharger le PNG</a> : null}

            <p className="section-title">4. La publication</p>
            <label className="field">Texte du post Facebook
              <textarea rows={5} value={legende} onChange={(e) => setLegende(e.target.value)} placeholder="VOA le propose quand tu cliques sur « Rédiger avec VOA »." />
            </label>
            <label className="field">Programmer (facultatif)
              <input type="datetime-local" value={quand} onChange={(e) => setQuand(e.target.value)} />
            </label>
            <button type="button" className="btn primary" disabled={!!busy || !data.photo} onClick={envoyer}>
              {busy === "envoyer" ? "Création du visuel…" : quand ? "Programmer sur Facebook" : "Envoyer au calendrier (à valider)"}
            </button>
            {!data.photo ? <p className="muted" style={{ fontSize: 13 }}>Ajoute une photo pour pouvoir l&apos;envoyer.</p> : null}
            {envoye ? <p className="notice vert">C&apos;est dans le calendrier. <Link href={`/editeur?id=${envoye}`}>Ouvrir dans l&apos;éditeur</Link></p> : null}
          </div>
        </div>
      </main>
    </>
  );
}
