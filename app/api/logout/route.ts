import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { fermerSession, moi } from "@/lib/equipe";

export const dynamic = "force-dynamic";

export async function POST() {
  const m = await moi().catch(() => null);
  if (m?.sid) await fermerSession(m.uid, m.sid).catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
