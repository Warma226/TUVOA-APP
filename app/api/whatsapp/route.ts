import { NextResponse } from "next/server";
import { whatsapp, whatsappConfigure } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// GET → les alertes WhatsApp sont-elles configurées ? POST → envoie un message de test (administration).
export async function GET() {
  return NextResponse.json({ configure: whatsappConfigure() });
}

export async function POST() {
  const r = await whatsapp("✅ TUVOA · Les alertes WhatsApp sont actives. Vous recevrez ici le brief du soir et les problèmes de la plateforme.");
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
