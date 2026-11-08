"use client";
// Créer : choix de la rubrique. Chaque rubrique a son propre atelier (/creer/actu, /creer/citation…).
import { useVoirPlus } from "@/components/VoirPlus";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NAV_ICONS, Trait } from "@/components/BottomNav";
import { RUB, Tuile, creneauLibre, dateLongue } from "@/components/Atelier";
import type { RubriqueId } from "@/lib/config";
import type { Post } from "@/lib/store";
import { listPosts } from "@/lib/client";
import { joursManquants } from "@/lib/schedule";

const DESC: Record<RubriqueId, [string, string]> = {
  actu: ["Une info tech de la veille ou votre idée, résumée en français, montants en FCFA.", "Pilote auto · 6 h – 20 h"],
  citation: ["Une phrase vérifiable d'une voix tech, avec la photo de son auteur.", "Toutes les 2 h"],
  cyberbase: ["Une notion de cybersécurité expliquée simplement, pour tout le monde.", "Chaque jour à heure fixe"],
  portrait: ["Un expert d'ici ou d'ailleurs, raconté avec son accord.", "Sur accord de la personne"],
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Choix />
    </Suspense>
  );
}

function Choix() {
  const router = useRouter();
  const q = useSearchParams();
  const [posts, setPosts] = useState<Post[] | null>(null);

  // Anciens liens (/creer?src=… depuis la veille, /creer?rubrique=…) : on va droit à l'atelier.
  const redirection = q.get("src") ? "actu" : (["actu", "citation", "cyberbase", "portrait"].find((r) => r === q.get("rubrique")) ?? null);
  useEffect(() => {
    if (redirection) {
      const p = new URLSearchParams(q.toString());
      p.delete("rubrique");
      const s = p.toString();
      router.replace(`/creer/${redirection}${s ? `?${s}` : ""}`);
    }
  }, [redirection, q, router]);
  useEffect(() => {
    listPosts().then(setPosts).catch(() => setPosts([]));
  }, []);
  const brouillons = (posts ?? []).filter((p) => p.status === "brouillon").slice(0, 40);
  const vBr = useVoirPlus(brouillons);
  if (redirection) return null;

  const etat = (r: RubriqueId): [string, string] => {
    if (!posts) return ["…", "#5B6B86"];
    const libre = creneauLibre(posts, r);
    if (r === "cyberbase") {
      const manque = joursManquants(posts, "cyberbase").length;
      return manque ? [`${manque} jour${manque > 1 ? "s" : ""} sans notion cette semaine`, "#B45309"] : ["Semaine complète", "#05603A"];
    }
    if (r === "citation") {
      const sansPhoto = posts.filter((p) => p.rubrique === "citation" && ["planifie", "erreur"].includes(p.status) && !p.visual?.photo).length;
      if (sansPhoto) return [`${sansPhoto} citation${sansPhoto > 1 ? "s" : ""} sans photo`, "#B42318"];
      return libre ? [`Prochain créneau : ${dateLongue(libre).toLowerCase()}`, "#1D4ED8"] : ["Grille complète", "#05603A"];
    }
    if (r === "portrait") {
      const n = posts.filter((p) => p.rubrique === "portrait" && ["brouillon", "a_valider"].includes(p.status)).length;
      return n ? [`${n} portrait${n > 1 ? "s" : ""} en cours`, "#1D4ED8"] : ["Aucun portrait en cours", "#5B6B86"];
    }
    const n = posts.filter((p) => p.rubrique === "actu" && p.status === "brouillon").length;
    return n ? [`${n} brouillon${n > 1 ? "s" : ""} en attente`, "#1D4ED8"] : ["Partez d'une actu de la veille", "#5B6B86"];
  };

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        <div className="tv-entete">
          <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/" className="tv-gris tv-desk" style={{ textDecoration: "none", fontWeight: 600 }}>← Tableau de bord</Link>
            <h1 className="tv-titre">Que voulez-vous créer ?</h1>
            <span style={{ fontSize: 15, color: "#33425C" }}>Chaque rubrique a son propre atelier, avec ses règles et son visuel.</span>
          </div>
        </div>

        <div className="tv-hub">
          {(Object.keys(RUB) as RubriqueId[]).map((r) => {
            const [txt, c] = etat(r);
            return (
              <Link key={r} href={`/creer/${r}`} className="tv-hub-carte">
                <Tuile rub={r} taille={88} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  <strong style={{ fontFamily: "var(--font-mont)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>{RUB[r].nom}</strong>
                  <span style={{ fontSize: 15, lineHeight: 1.5, color: "#33425C" }}>{DESC[r][0]}</span>
                  <span className="row" style={{ flexWrap: "wrap", gap: 8, fontSize: 13 }}>
                    <span className="tv-pill">{DESC[r][1]}</span>
                    <span style={{ color: c, fontWeight: 700 }}>{txt}</span>
                  </span>
                  <span style={{ marginTop: 2, fontSize: 14, fontWeight: 800, color: "#2563EB" }}>Ouvrir l'atelier {RUB[r].nom} →</span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="tv-bas">
          <section aria-labelledby="t-autres" style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 id="t-autres" className="tv-h2">Les autres ateliers</h2>
            <div className="row" style={{ flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
              {([["/minute-cyber", "La minute cyber", "Vidéo d'une minute : script, voix, montage", NAV_ICONS.minute], ["/studio", "Studio", "Visuels libres, carrousels, vidéos", NAV_ICONS.studio], ["/calendrier", "Récap du vendredi", "Préparé tout seul chaque vendredi", NAV_ICONS.cal]] as const).map(([href, nom, d, ic]) => (
                <Link key={href} href={href} className="tv-atelier-lien">
                  <span className="ico"><Trait d={ic} size={20} /></span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2 }}><strong style={{ fontSize: 15 }}>{nom}</strong><span className="tv-gris" style={{ fontSize: 13 }}>{d}</span></span>
                </Link>
              ))}
            </div>
          </section>
          <section aria-labelledby="t-br" className="tv-carte-side" style={{ flex: "1 1 340px", minWidth: 0 }}>
            <h2 id="t-br" className="tv-h2" style={{ fontSize: 18 }}>Reprendre un brouillon</h2>
            {posts === null ? <span className="tv-gris">…</span> : brouillons.length === 0 ? <span className="tv-gris" style={{ fontSize: 14 }}>Aucun brouillon en attente.</span> : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {vBr.visibles.map((p) => (
                <Link key={p.id} href={`/editeur?id=${p.id}`} className="row" style={{ gap: 12, padding: "12px 0", borderTop: "1px solid #EDF1F7", textDecoration: "none", color: "#0B1A33" }}>
                  <span className="tv-pill" style={{ background: RUB[p.rubrique].pastille[0], color: RUB[p.rubrique].pastille[1], flexShrink: 0 }}>{RUB[p.rubrique].nom.toUpperCase()}</span>
                  <strong style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title || p.visual?.titre || p.idea || "Sans titre"}</strong>
                </Link>
              ))}
            </div>
            {vBr.bouton}
          </section>
        </div>
      </div>
    </div>
  );
}
