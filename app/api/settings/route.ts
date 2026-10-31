import { NextResponse } from "next/server";
import { getSettings, saveSettings, isDemo, type Settings } from "@/lib/store";
import { connectionStatus } from "@/lib/publish";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    settings,
    demo: isDemo(),
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    connections: connectionStatus(),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Settings>;
  const current = await getSettings();
  const next: Settings = {
    autopilot: typeof body.autopilot === "boolean" ? body.autopilot : current.autopilot,
    triggersEnabled: { ...current.triggersEnabled, ...(body.triggersEnabled ?? {}) },
    sourcesEnabled: { ...current.sourcesEnabled, ...(body.sourcesEnabled ?? {}) },
  };
  return NextResponse.json({ settings: await saveSettings(next) });
}
