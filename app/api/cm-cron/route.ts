import { NextResponse } from "next/server";
import { cmPassage } from "@/lib/cm";
import { alerte } from "@/lib/whatsapp";
import { verifierGrin } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Appelé toutes les 15 min par Supabase pg_cron : passage de l'agent community manager.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const log = await cmPassage();
    try { await verifierGrin(); } catch (e) { log.push(`Telegram : ${(e as Error).message}`); }
    return NextResponse.json({ ok: true, log });
  } catch (e) {
    console.error("cm-cron", e);
    await alerte(`cm:${(e as Error).message.slice(0, 40)}`, `L'agent community manager (Grin) a planté : ${(e as Error).message.slice(0, 200)}`);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
