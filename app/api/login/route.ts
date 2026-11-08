import { NextResponse } from "next/server";
import { SESSION_COOKIE, checkPassword, createSession } from "@/lib/session";
import { appareilDe, lireAdmin, membreParContact, ouvrirSession, verifier } from "@/lib/equipe";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

const pause = () => new Promise((r) => setTimeout(r, 800)); // freine les essais en série

// POST { password, contact? } → cookie de session (30 jours). Sans contact : administrateur principal.
export async function POST(req: Request) {
  const { password, contact } = (await req.json().catch(() => ({}))) as { password?: string; contact?: string };
  if (!process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Aucun mot de passe n'est configuré : ajoute APP_PASSWORD dans Vercel." }, { status: 503 });
  }
  if (!password) return NextResponse.json({ error: "Entrez le mot de passe." }, { status: 400 });
  let uid = "admin", role: Role = "admin";
  if (contact?.trim()) {
    const m = await membreParContact(contact).catch(() => null);
    if (!m || m.statut !== "actif" || !verifier(password, m.mdp_hash)) {
      await pause();
      return NextResponse.json({ error: m?.statut === "suspendu" ? "Ce compte est suspendu. Contactez l'administration." : "Identifiant ou mot de passe incorrect." }, { status: 401 });
    }
    uid = m.id; role = m.role;
  } else {
    const admin = await lireAdmin().catch(() => ({}) as { mdp_hash?: string });
    const ok = admin.mdp_hash ? verifier(password, admin.mdp_hash) : checkPassword(password);
    if (!ok) { await pause(); return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 }); }
  }
  const sid = await ouvrirSession(uid, appareilDe(req.headers.get("user-agent") ?? ""));
  const session = await createSession(uid, role, sid);
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, session.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: session.maxAge });
  return res;
}
