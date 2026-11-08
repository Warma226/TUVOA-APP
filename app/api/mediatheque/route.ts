import { NextResponse } from "next/server";
import { isDemo } from "@/lib/store";
import { CAPACITE, listerFichiers, renommerFichier, supprimerFichiers, usagesFichiers, type Categorie } from "@/lib/mediatheque";

export const dynamic = "force-dynamic";

const CATS: Categorie[] = ["images", "voix", "videos", "documents"];

// GET /api/mediatheque → stockage par catégorie ; ?dossier=images → les fichiers de ce dossier, avec les publications qui les utilisent.
export async function GET(req: Request) {
  if (isDemo()) return NextResponse.json({ error: "La médiathèque demande Supabase (voir Connexions)." }, { status: 400 });
  try {
    const dossier = new URL(req.url).searchParams.get("dossier") as Categorie | "tous" | null;
    const tous = await listerFichiers();
    const categories = Object.fromEntries(CATS.map((c) => {
      const f = tous.filter((x) => x.categorie === c);
      return [c, { n: f.length, taille: f.reduce((s, x) => s + x.taille, 0) }];
    }));
    const utilise = tous.reduce((s, f) => s + f.taille, 0);
    const ouverts = dossier === "tous" ? tous : dossier && CATS.includes(dossier) ? tous.filter((f) => f.categorie === dossier) : [];
    const usages = ouverts.length ? await usagesFichiers().catch(() => new Map()) : new Map();
    return NextResponse.json({
      capacite: CAPACITE, utilise, n: tous.length, categories,
      fichiers: ouverts.map((f) => ({ ...f, usages: usages.get(f.chemin) ?? [] })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST { renommer: chemin, nom } | { supprimer: [chemins] }
export async function POST(req: Request) {
  if (isDemo()) return NextResponse.json({ error: "La médiathèque demande Supabase." }, { status: 400 });
  try {
    const b = (await req.json().catch(() => ({}))) as { renommer?: string; nom?: string; supprimer?: string[] };
    if (b.renommer) return NextResponse.json({ chemin: await renommerFichier(b.renommer, b.nom ?? "") });
    if (Array.isArray(b.supprimer)) return NextResponse.json({ supprimes: await supprimerFichiers(b.supprimer.filter((x) => typeof x === "string").slice(0, 100)) });
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
