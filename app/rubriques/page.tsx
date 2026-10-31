// Rubriques : chaque rubrique a son gabarit, rendu en direct avec un exemple.
import Link from "next/link";
import { TopBar } from "@/components/BottomNav";
import { RUBRIQUES, type RubriqueId } from "@/lib/config";
import { visualUrl } from "@/lib/visual-url";

export const dynamic = "force-dynamic";

const EXEMPLES: Record<RubriqueId, { titre: string; texte: string; nom?: string; specialite?: string; source?: string }> = {
  actu: { titre: "Smartphones", texte: "Android 17 arrive sur les premiers modèles : batterie, sécurité et photos, voici ce qui change pour toi.", source: "Frandroid" },
  cyberbase: {
    titre: "Social Engineering",
    texte:
      "L'ingénierie sociale est une méthode d'attaque qui exploite la psychologie humaine plutôt que la technologie.\n\nLes cybercriminels manipulent leurs cibles pour obtenir des accès ou des informations confidentielles (par exemple, en se faisant passer pour un collègue ou un service légitime).",
  },
  portrait: { titre: "Nom de l'expert", texte: "Spécialité de l'expert", nom: "Nom de l'expert", specialite: "Spécialité de l'expert" },
};

export default function Rubriques() {
  return (
    <>
      <TopBar title="Rubriques" back="/creer" />
      <main className="page sub" style={{ paddingTop: 4 }}>
        <p className="muted">Chaque rubrique a son gabarit, son rythme et ses règles. L'IA remplit le gabarit, tu valides.</p>
        {RUBRIQUES.map((r) => {
          const ex = EXEMPLES[r.id];
          const src = visualUrl({ rubrique: r.id, visual: { titre: ex.titre, texte: ex.texte, nom: ex.nom, specialite: ex.specialite }, source_name: ex.source ?? null }, "portrait");
          return (
            <Link key={r.id} href={`/creer?rubrique=${r.id}`} className="card link" style={{ flexDirection: "row", gap: 14, padding: 12 }} aria-label={`Créer un post ${r.hashtag}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" style={{ width: 112, aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 10, background: "var(--gris-1)", flexShrink: 0 }} />
              <span className="stack" style={{ gap: 6, minWidth: 0, paddingTop: 4 }}>
                <span style={{ fontFamily: "var(--font-archivo)", fontWeight: 800, fontSize: 17 }}>{r.id === "actu" ? r.label : r.hashtag}</span>
                <span className="small" style={{ fontSize: 13, color: "var(--texte-3)", lineHeight: 1.45 }}>{r.description}</span>
                <span className="wrap">
                  <span className="badge">Format 4:5</span>
                  {r.heure !== undefined ? <span className="badge bleu">Chaque jour à {r.heure} h</span> : null}
                  {r.alwaysManual ? <span className="badge vert">Toujours manuel</span> : <span className="badge bleu">Suit le mode général</span>}
                  {r.id === "portrait" ? <span className="badge ambre">Accord de la personne</span> : null}
                </span>
              </span>
            </Link>
          );
        })}
      </main>
    </>
  );
}
