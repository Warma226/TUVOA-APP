import { NextResponse } from "next/server";
import { fetchVeille } from "@/lib/veille";
import { getSettings } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const settings = await getSettings();
    const { items, errors } = await fetchVeille(settings.sourcesEnabled, settings.triggersEnabled);
    return NextResponse.json({ items: items.slice(0, 60), errors, updatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
