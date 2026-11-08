import { NextResponse } from "next/server";
import { db, isDemo } from "@/lib/store";

export const revalidate = 600;

// Public (écran de connexion) : seulement les titres des dernières actus déjà publiées, rien d'autre.
export async function GET() {
  if (isDemo()) return NextResponse.json({ titres: [] });
  try {
    // Titres en français (titre de l'article du site), sans les récaps ni les doublons.
    const { data } = await db().from("posts").select("titre:texts->>wp_title,origin").eq("status", "publie").eq("rubrique", "actu").neq("origin", "recap").order("scheduled_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(20);
    const titres = [...new Set(((data ?? []) as { titre: string | null }[]).map((p) => (p.titre ?? "").trim()).filter((x) => x && !/^récap/i.test(x)))].slice(0, 8);
    return NextResponse.json({ titres }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ titres: [] });
  }
}
