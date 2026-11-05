import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { authorizeUrl, tiktokConfigured } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

// GET → redirige vers TikTok pour autoriser l'app à publier sur le compte TUVOA.
export async function GET() {
  if (!tiktokConfigured()) return new NextResponse("Ajoute d'abord TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET dans Vercel.", { status: 400 });
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("tiktok_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
