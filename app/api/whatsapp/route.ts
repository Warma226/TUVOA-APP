import { NextResponse } from "next/server";
import { canalAlertes, relierTelegram, whatsapp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// GET → canal d'alertes (Telegram ou WhatsApp) et état. POST { action: "relier" } → relie Telegram ; sinon message de test.
export async function GET() {
  return NextResponse.json(await canalAlertes());
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  const r = b.action === "relier"
    ? await relierTelegram()
    : await whatsapp("✅ TUVOA · Les alertes sont actives. Vous recevrez ici le brief du soir et les problèmes de la plateforme.");
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
