import { NextResponse } from "next/server";
import { secretWebhook, traiterMessage } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Webhook Telegram : reçoit les commandes envoyées au bot. Telegram signe chaque appel avec le secret fixé à l'activation.
export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN || req.headers.get("x-telegram-bot-api-secret-token") !== secretWebhook()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const update = await req.json().catch(() => ({}));
  try { await traiterMessage(update); } catch (e) { console.error("telegram", e); }
  return NextResponse.json({ ok: true });
}
