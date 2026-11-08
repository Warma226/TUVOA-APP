// Protège toute l'application : sans session valide, on est envoyé vers l'écran de connexion (/acces).
// Chaque membre de l'équipe n'ouvre que les pages et les actions de son rôle (lib/roles).
// Exceptions : l'écran de connexion, l'invitation, la tâche planifiée (clé CRON_SECRET) et les visuels signés.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { apiAutorisee, pageAutorisee } from "@/lib/roles";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|api/cron|api/cm-cron|api/visuel|api/login|api/vitrine|api/invitation|invitation|studio/|recap/|cyberbase/|citations/|wp/|api/wp-categories|api/media|cgu|confidentialite|tiktok).*)"],
};

// Sessions encore ouvertes (déconnexion d'un appareil, membre suspendu ou retiré) : vérifié en base, gardé 60 s.
const vues = new Map<string, { ok: boolean; at: number }>();
async function sessionOuverte(sid: string): Promise<boolean> {
  const c = vues.get(sid);
  if (c && Date.now() - c.at < 60000) return c.ok;
  const url = process.env.SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return true;
  try {
    const r = await fetch(`${url}/rest/v1/sessions?id=eq.${encodeURIComponent(sid)}&select=id`, { headers: { apikey: cle, Authorization: `Bearer ${cle}` }, cache: "no-store" });
    const ok = r.ok ? ((await r.json()) as unknown[]).length > 0 : true;
    vues.set(sid, { ok, at: Date.now() });
    if (vues.size > 500) vues.clear();
    return ok;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!process.env.APP_PASSWORD) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Configure APP_PASSWORD dans Vercel pour ouvrir TUVOA.", { status: 503 });
    }
    return NextResponse.next();
  }
  let s = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (s?.sid && !(await sessionOuverte(s.sid))) s = null;
  if (pathname === "/acces") return s ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  if (!s) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Session expirée : recharge la page et reconnecte-toi." }, { status: 401 });
    const url = new URL("/acces", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(url);
    if (req.cookies.get(SESSION_COOKIE)) res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  if (pathname.startsWith("/api/")) {
    if (!apiAutorisee(s.role, pathname, req.method)) return NextResponse.json({ error: "Cette action est réservée à un autre rôle de l'équipe." }, { status: 403 });
  } else if (!pageAutorisee(s.role, pathname)) {
    return NextResponse.redirect(new URL("/compte?refus=1", req.url));
  }
  // Identité transmise aux routes (les en-têtes envoyés par le navigateur sont écrasés).
  const h = new Headers(req.headers);
  h.set("x-tuvoa-uid", s.uid);
  h.set("x-tuvoa-role", s.role);
  h.set("x-tuvoa-sid", s.sid ?? "");
  return NextResponse.next({ request: { headers: h } });
}
