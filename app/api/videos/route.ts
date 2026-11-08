import { NextResponse } from "next/server";
import { ecarter, lister, rafraichir, reperer, THEMES } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET : vidéos CC BY proposées (rafraîchies si la liste est vide ou si ?maj=1).
export async function GET(req: Request) {
  try {
    const maj = new URL(req.url).searchParams.get("maj") === "1";
    let videos = await lister();
    let note = "";
    if (maj || videos.length === 0) {
      try { await rafraichir(); videos = await lister(); } catch (e) { note = (e as Error).message; }
    }
    return NextResponse.json({ videos, themes: THEMES.map((t) => ({ id: t.id, nom: t.nom })), note, cle: Boolean(process.env.YOUTUBE_API_KEY) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST { action: "extraits" | "ecarter", id }
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string };
    if (!b.id || !/^[\w-]{6,20}$/.test(b.id)) return NextResponse.json({ error: "Vidéo manquante." }, { status: 400 });
    if (b.action === "extraits") return NextResponse.json({ extraits: await reperer(b.id) });
    if (b.action === "ecarter") { await ecarter(b.id); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
