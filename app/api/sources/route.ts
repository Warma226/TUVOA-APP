import { NextResponse } from "next/server";
import { discoverSource } from "@/lib/veille";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST { url } : cherche le flux RSS du site et renvoie la source prête à enregistrer.
export async function POST(req: Request) {
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url?.trim()) return NextResponse.json({ error: "Indique l'adresse du site." }, { status: 400 });
  try {
    return NextResponse.json({ source: await discoverSource(url) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
