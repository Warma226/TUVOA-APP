import { NextResponse } from "next/server";
import { getSettings, saveSettings, mergeSettings, isDemo, type Settings } from "@/lib/store";
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
  const next: Settings = mergeSettings(current, body);
  return NextResponse.json({ settings: await saveSettings(next) });
}
