import { NextResponse } from "next/server";
import { canalAlertes, relierTelegram, whatsapp } from "@/lib/whatsapp";
import { activerCommandes, commandesActives } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

// GET → canal d'alertes (Telegram ou WhatsApp), état et commandes Telegram.
// POST { action: "relier" } → relie Telegram ; { action: "commandes" } → active les commandes ; sinon message de test.
export async function GET() {
  const c = await canalAlertes();
  return NextResponse.json({ ...c, commandes: c.canal === "telegram" ? await commandesActives() : false });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  let r: { ok: boolean; detail: string };
  if (b.action === "relier") {
    r = await relierTelegram();
    if (r.ok) await activerCommandes();
  } else if (b.action === "commandes") {
    r = await activerCommandes();
    if (r.ok) await whatsapp("🤖 TUVOA · Les commandes sont actives. Tapez / pour les voir : /brief, /prochains, /stats, /pause, /reprendre.");
  } else {
    r = await whatsapp("✅ TUVOA · Les alertes sont actives. Vous recevrez ici le brief du soir et les problèmes de la plateforme.");
  }
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
