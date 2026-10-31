import { NextResponse } from "next/server";
import { SESSION_COOKIE, checkPassword, createSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST { password } → cookie de session (30 jours)
export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Aucun mot de passe n'est configuré : ajoute APP_PASSWORD dans Vercel." }, { status: 503 });
  }
  if (!password || !checkPassword(password)) {
    // Petit délai pour freiner les essais en série.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }
  const session = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}
