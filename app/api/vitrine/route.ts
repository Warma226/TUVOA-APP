import { NextResponse } from "next/server";
import { db, isDemo } from "@/lib/store";

export const revalidate = 600;

// Public (écran de connexion) : seulement les titres des dernières actus déjà publiées, rien d'autre.
export async function GET() {
  if (isDemo()) return NextResponse.json({ titres: [] });
  try {
    const { data } = await db().from("posts").select("title").eq("status", "publie").eq("rubrique", "actu").not("title", "is", null).order("scheduled_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(8);
    const titres = ((data ?? []) as { title: string | null }[]).map((p) => (p.title ?? "").trim()).filter(Boolean);
    return NextResponse.json({ titres }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ titres: [] });
  }
}
