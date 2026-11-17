import { NextResponse } from "next/server";
import { cmPassage } from "@/lib/cm";
import { alerte } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Appelé toutes les 15 min par Supabase pg_cron : passage de l'agent community manager.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, log: await cmPassage() });
  } catch (e) {
    console.error("cm-cron", e);
    await alerte(`cm:${(e as Error).message.slice(0, 40)}`, `L'agent community manager (Grin) a planté : ${(e as Error).message.slice(0, 200)}`);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
