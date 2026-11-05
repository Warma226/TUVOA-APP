import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

// GET → retour de TikTok après autorisation : enregistre les jetons puis renvoie vers Connexions.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (msg: string) => NextResponse.redirect(new URL(`/connexions?tiktok=${encodeURIComponent(msg)}`, url.origin));
  if (url.searchParams.get("error")) return back(url.searchParams.get("error_description") || "Autorisation refusée.");
  const state = (await cookies()).get("tiktok_state")?.value;
  if (!state || state !== url.searchParams.get("state")) return back("Lien expiré : recommence la connexion.");
  try {
    await exchangeCode(url.searchParams.get("code") ?? "");
    return back("ok");
  } catch (e) {
    return back((e as Error).message);
  }
}
