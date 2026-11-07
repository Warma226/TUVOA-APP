// Médiathèque : les fichiers du seau Supabase « visuels », classés comme dans l'Explorateur Windows.
import { db } from "./store";

const BUCKET = "visuels";
export const CAPACITE = 1024 * 1024 * 1024; // offre gratuite Supabase : 1 Go de stockage

export type Categorie = "images" | "voix" | "videos" | "documents";
export type Fichier = { nom: string; chemin: string; url: string; taille: number; type: string; date: string; categorie: Categorie };

export function categorieDe(type: string, nom: string): Categorie {
  if (type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif)$/i.test(nom)) return "images";
  if (type.startsWith("audio/") || /\.(wav|mp3|m4a|ogg)$/i.test(nom)) return "voix";
  if (type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(nom)) return "videos";
  return "documents";
}

type Objet = { name: string; id: string | null; created_at?: string; metadata?: { size?: number; mimetype?: string } | null };

export async function listerFichiers(): Promise<Fichier[]> {
  const storage = db().storage.from(BUCKET);
  const out: Fichier[] = [];
  async function parcourir(dossier: string, profondeur: number) {
    for (let offset = 0; offset < 10000; offset += 1000) {
      const { data, error } = await storage.list(dossier, { limit: 1000, offset, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw new Error(`Stockage : ${error.message}`);
      const objets = (data ?? []) as Objet[];
      for (const o of objets) {
        const chemin = dossier ? `${dossier}/${o.name}` : o.name;
        if (!o.id) {
          if (profondeur < 3) await parcourir(chemin, profondeur + 1);
          continue;
        }
        if (o.name === ".emptyFolderPlaceholder") continue;
        const type = o.metadata?.mimetype ?? "";
        out.push({ nom: o.name, chemin, url: storage.getPublicUrl(chemin).data.publicUrl, taille: o.metadata?.size ?? 0, type, date: o.created_at ?? "", categorie: categorieDe(type, o.name) });
      }
      if (objets.length < 1000) break;
    }
  }
  await parcourir("", 0);
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export async function statsStockage() {
  const fichiers = await listerFichiers();
  const cats: Record<Categorie, { n: number; taille: number }> = { images: { n: 0, taille: 0 }, voix: { n: 0, taille: 0 }, videos: { n: 0, taille: 0 }, documents: { n: 0, taille: 0 } };
  for (const f of fichiers) { cats[f.categorie].n++; cats[f.categorie].taille += f.taille; }
  const utilise = fichiers.reduce((s, f) => s + f.taille, 0);
  return { capacite: CAPACITE, utilise, n: fichiers.length, categories: cats };
}
