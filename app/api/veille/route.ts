import { NextResponse } from "next/server";
import { fetchVeille } from "@/lib/veille";
import { getSettings } from "@/lib/store";
import { SOURCES, TRIGGERS } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/veille[?sources=a,b&triggers=x,y]
// Les paramètres permettent au navigateur d'imposer ses réglages en mode démo.
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const settings = await getSettings();
    const pick = (param: string | null, ids: string[], fallback: Record<string, boolean>) =>
      param === null ? fallback : Object.fromEntries(ids.map((id) => [id, param.split(",").includes(id)]));
    const sources = pick(q.get("sources"), SOURCES.map((s) => s.id), settings.sourcesEnabled);
    const triggers = pick(q.get("triggers"), TRIGGERS.map((t) => t.id), settings.triggersEnabled);
    const { items, errors } = await fetchVeille(sources, triggers);
    return NextResponse.json({ items: items.slice(0, 60), errors, updatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
