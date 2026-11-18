// Tâche planifiée (toutes les heures, Supabase pg_cron) : #CyberBase et #Citation du jour en automatique.
import { NextResponse } from "next/server";
import { rubriquesAuto } from "@/lib/rubriques-auto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const ok = secret && (req.headers.get("authorization") === `Bearer ${secret}` || new URL(req.url).searchParams.get("key") === secret);
  if (!ok) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const log: string[] = [];
  try {
    await rubriquesAuto(log);
  } catch (e) {
    log.push(`Erreur : ${(e as Error).message}`);
  }
  console.log(`rubriques: ${log.join(" · ") || "rien à faire"}`);
  return NextResponse.json({ ok: true, log });
}
