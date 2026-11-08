import { NextResponse } from "next/server";
import { moi } from "@/lib/equipe";
import { ajouterChaine, ecarter, lister, majChaine, rafraichir, reperer } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET : vidéos des chaînes suivies (rafraîchies si la liste est vide ou si ?maj=1).
export async function GET(req: Request) {
  try {
    const maj = new URL(req.url).searchParams.get("maj") === "1";
    let r = await lister();
    let note = "";
    if (maj || r.videos.length === 0) {
      try { await rafraichir(); r = await lister(); } catch (e) { note = (e as Error).message; }
    }
    const { role } = await moi();
    return NextResponse.json({ ...r, note, admin: role === "admin", cle: Boolean(process.env.YOUTUBE_API_KEY) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST { action: "extraits" | "ecarter", id } ou, pour l'administration, { action: "chaine-ajouter" | "chaine-retirer" | "chaine-autoriser", handle, ... }
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string; handle?: string; type?: string; autorisee?: boolean };
    if (b.action?.startsWith("chaine-")) {
      if ((await moi()).role !== "admin") return NextResponse.json({ error: "Réservé à l'administration." }, { status: 403 });
      if (!b.handle) return NextResponse.json({ error: "Chaîne manquante." }, { status: 400 });
      if (b.action === "chaine-ajouter") return NextResponse.json({ chaine: await ajouterChaine(b.handle, b.type === "info" || b.type === "interview" ? b.type : "tech") });
      if (b.action === "chaine-retirer") { await majChaine(b.handle, {}, true); return NextResponse.json({ ok: true }); }
      if (b.action === "chaine-autoriser") { await majChaine(b.handle, { autorisee: Boolean(b.autorisee) }); return NextResponse.json({ ok: true }); }
    }
    if (!b.id || !/^[\w-]{6,20}$/.test(b.id)) return NextResponse.json({ error: "Vidéo manquante." }, { status: 400 });
    if (b.action === "extraits") return NextResponse.json({ extraits: await reperer(b.id) });
    if (b.action === "ecarter") { await ecarter(b.id); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
