import { NextResponse } from "next/server";
import { synthese } from "@/lib/voix";
import { STYLES, VOIX, type StyleVoix } from "@/lib/voix-liste";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST { texte, voix, style } → { url, duree } : voix off de synthèse (brief du soir, narration du Studio).
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { texte?: string; voix?: string; style?: string };
    const texte = (b.texte ?? "").trim().slice(0, 2500);
    if (!texte) return NextResponse.json({ error: "Texte vide." }, { status: 400 });
    const voix = VOIX.some((v) => v.id === b.voix) ? b.voix! : "Charon";
    const style = (STYLES.some(([s]) => s === b.style) ? b.style : "narration") as StyleVoix;
    return NextResponse.json(await synthese(texte, voix, style));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
