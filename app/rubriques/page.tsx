// Rubriques : chaque rubrique a son gabarit, rendu en direct avec un exemple.
import Link from "next/link";
import { BottomNav, TopBar } from "@/components/BottomNav";
import { RUBRIQUES, type RubriqueId } from "@/lib/config";
import { visualUrl } from "@/lib/visual-url";

export const dynamic = "force-dynamic";

const EXEMPLES: Record<RubriqueId, { titre: string; texte: string; nom?: string; specialite?: string; source?: string }> = {
  actu: { titre: "Android 17 arrive sur les premiers smartphones", texte: "Batterie, sécurité, photos : ce qui change pour toi.", source: "Frandroid" },
  cyberbase: {
    titre: "Social Engineering",
    texte:
      "L'ingénierie sociale est une méthode d'attaque qui exploite la psychologie humaine plutôt que la technologie. Les cybercriminels manipulent leurs cibles pour obtenir des accès ou des informations confidentielles.",
  },
  portrait: { titre: "Nom de l'expert", texte: "Spécialité de l'expert", nom: "Nom de l'expert", specialite: "Spécialité de l'expert" },
};

export default function Rubriques() {
  return (
    <>
      <TopBar title="Rubriques" back="/creer" />
      <main className="page" style={{ paddingTop: 4 }}>
        <p className="muted">Chaque rubrique a son gabarit. L'IA le remplit, tu valides dans l'aperçu.</p>
        {RUBRIQUES.map((r) => {
          const ex = EXEMPLES[r.id];
          const src = visualUrl({ rubrique: r.id, visual: { titre: ex.titre, texte: ex.texte, nom: ex.nom, specialite: ex.specialite }, source_name: ex.source ?? null }, "portrait");
          return (
            <article key={r.id} className="card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="visuel" src={src} alt={`Exemple de visuel ${r.hashtag}`} loading="lazy" />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2>{r.hashtag}</h2>
                <span className={`badge ${r.alwaysManual ? "vert" : "bleu"}`}>{r.alwaysManual ? "Toujours manuel" : "Suit le mode général"}</span>
              </div>
              <p className="small" style={{ color: "var(--texte-3)", lineHeight: 1.5 }}>{r.description}</p>
              <Link href={`/creer?rubrique=${r.id}`} className="btn small primary">Créer un post {r.hashtag}</Link>
            </article>
          );
        })}
      </main>
      <BottomNav />
    </>
  );
}
