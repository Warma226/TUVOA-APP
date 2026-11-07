import { NextResponse } from "next/server";
import { isDemo } from "@/lib/store";
import { CAPACITE, listerFichiers, type Categorie } from "@/lib/mediatheque";

export const dynamic = "force-dynamic";

const CATS: Categorie[] = ["images", "voix", "videos", "documents"];

// GET /api/mediatheque → stockage par catégorie ; ?dossier=images → les fichiers de ce dossier.
export async function GET(req: Request) {
  if (isDemo()) return NextResponse.json({ error: "La médiathèque demande Supabase (voir Connexions)." }, { status: 400 });
  try {
    const dossier = new URL(req.url).searchParams.get("dossier") as Categorie | null;
    const tous = await listerFichiers();
    const categories = Object.fromEntries(CATS.map((c) => {
      const f = tous.filter((x) => x.categorie === c);
      return [c, { n: f.length, taille: f.reduce((s, x) => s + x.taille, 0) }];
    }));
    const utilise = tous.reduce((s, f) => s + f.taille, 0);
    return NextResponse.json({
      capacite: CAPACITE, utilise, n: tous.length, categories,
      fichiers: dossier && CATS.includes(dossier) ? tous.filter((f) => f.categorie === dossier) : [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
