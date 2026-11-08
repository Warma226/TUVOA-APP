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

// Publications qui utilisent chaque fichier (image d'article, photo de citation ou de portrait).
export async function usagesFichiers(): Promise<Map<string, { id: string; titre: string; status: string }[]>> {
  const { data } = await db().from("posts").select("id,title,idea,status,image:visual->>image,photo:visual->>photo").neq("status", "annule").order("created_at", { ascending: false }).limit(3000);
  const out = new Map<string, { id: string; titre: string; status: string }[]>();
  for (const p of (data ?? []) as { id: string; title: string | null; idea: string | null; status: string; image: string | null; photo: string | null }[]) {
    for (const u of [p.image, p.photo]) {
      const m = u ? /\/visuels\/(.+?)(\?|$)/.exec(u) : null;
      if (!m) continue;
      const chemin = decodeURIComponent(m[1]);
      out.set(chemin, [...(out.get(chemin) ?? []), { id: p.id, titre: p.title || p.idea || "Publication", status: p.status }]);
    }
  }
  return out;
}

export async function renommerFichier(chemin: string, nom: string): Promise<string> {
  const propre = nom.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  if (!propre) throw new Error("Nom de fichier invalide.");
  const ext = /\.[a-z0-9]{2,5}$/i.exec(chemin)?.[0] ?? "";
  const final = propre.toLowerCase().endsWith(ext.toLowerCase()) ? propre : `${propre}${ext}`;
  const dossier = chemin.includes("/") ? chemin.slice(0, chemin.lastIndexOf("/") + 1) : "";
  const cible = `${dossier}${final}`;
  if (cible === chemin) return chemin;
  const { error } = await db().storage.from(BUCKET).move(chemin, cible);
  if (error) throw new Error(`Renommage impossible : ${error.message}`);
  return cible;
}

export async function supprimerFichiers(chemins: string[]): Promise<number> {
  if (!chemins.length) return 0;
  const { data, error } = await db().storage.from(BUCKET).remove(chemins);
  if (error) throw new Error(`Suppression impossible : ${error.message}`);
  return data?.length ?? 0;
}
