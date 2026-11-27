import { NextResponse } from "next/server";
import { abonnerPage, jetonVerification, pageAbonnee } from "@/lib/fb-temps-reel";
import { chargerJetonFb } from "@/lib/fb-jeton";

export const dynamic = "force-dynamic";

// GET → état du temps réel et réglages à saisir dans Meta. POST → abonne la Page à l'app (administration).
export async function GET(req: Request) {
  await chargerJetonFb();
  const origine = new URL(req.url).origin;
  return NextResponse.json({ actif: await pageAbonnee(), url: `${origine}/api/fb-webhook`, jeton: jetonVerification(), signature: Boolean(process.env.FB_APP_SECRET) });
}

export async function POST() {
  await chargerJetonFb();
  const r = await abonnerPage();
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
