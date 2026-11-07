import { NextResponse } from "next/server";
import { fetchVeille } from "@/lib/veille";
import { getSettings, postsParUrl, urlNette } from "@/lib/store";
import { allSources, allTriggers, isOn, type Source, type Trigger } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function run(sources: Source[], triggers: Trigger[]) {
  try {
    const { items, errors } = await fetchVeille(sources, triggers);
    // Plus de 2 jours : retirée de la veille, publiée ou non.
    const limite = Date.now() - 48 * 3.6e6;
    const fraiches = items.filter((i) => !i.publishedAt || new Date(i.publishedAt).getTime() >= limite).slice(0, 80);
    // Déjà reprise dans une publication TUVOA : on le signale.
    const repris = await postsParUrl(fraiches.map((i) => i.url)).catch(() => new Map());
    for (const i of fraiches) {
      const p = repris.get(urlNette(i.url));
      if (p) i.post = p;
    }
    return NextResponse.json({ items: fraiches, errors, updatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// GET : réglages enregistrés sur le serveur.
export async function GET() {
  const s = await getSettings();
  return run(
    allSources(s.customSources).filter((x) => isOn(s.sourcesEnabled, x.id, x.enabledByDefault)),
    allTriggers(s.triggers).filter((t) => isOn(s.triggersEnabled, t.id, t.enabledByDefault))
  );
}

// POST { sources, triggers } : le navigateur impose ses réglages (mode démo, sources ajoutées).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sources?: Source[]; triggers?: Trigger[] };
  const sources = (Array.isArray(body.sources) ? body.sources : []).filter((s) => typeof s?.feed === "string" && /^https?:\/\//.test(s.feed));
  const triggers = Array.isArray(body.triggers) ? body.triggers : [];
  return run(sources.slice(0, 30), triggers.slice(0, 50));
}
