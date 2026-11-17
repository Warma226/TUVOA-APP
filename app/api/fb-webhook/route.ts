import { NextResponse, after } from "next/server";
import { concerneVoa, jetonVerification, reagir, signatureValide } from "@/lib/fb-temps-reel";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vérification du webhook par Meta (une fois, à l'enregistrement de l'URL).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === jetonVerification()) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Jeton de vérification incorrect" }, { status: 403 });
}

// Notification de la Page : nouveau commentaire ou mention. On répond tout de suite à Meta, puis VOA travaille.
export async function POST(req: Request) {
  const corps = await req.text();
  if (!signatureValide(corps, req.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  let payload: Parameters<typeof concerneVoa>[0] = {};
  try { payload = JSON.parse(corps); } catch { /* corps illisible */ }
  const resume = ((payload as { entry?: { changes?: { field?: string; value?: { item?: string; verb?: string; message?: string; from?: unknown } }[] }[] }).entry ?? [])
    .flatMap((e) => (e.changes ?? []).map((c) => `${c.field}/${c.value?.item ?? "-"}/${c.value?.verb ?? "-"}${c.value?.message ? " +texte" : ""}${c.value?.from ? " +auteur" : ""}`));
  console.log(`fb-webhook: ${resume.join(", ") || "vide"}`);
  if (concerneVoa(payload)) after(async () => { try { await reagir(); } catch (e) { console.error("fb temps réel", e); } });
  return NextResponse.json({ ok: true });
}
