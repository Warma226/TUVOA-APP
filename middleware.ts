// Protège toute l'application : sans session valide, on est envoyé vers l'écran de connexion (/acces).
// Exceptions : l'écran de connexion lui-même, la tâche planifiée (clé CRON_SECRET) et les visuels signés.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|api/cron|api/visuel|api/login).*)"],
};

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!process.env.APP_PASSWORD) {
    // Sans mot de passe configuré, l'app refuse l'accès en production.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Configure APP_PASSWORD dans Vercel pour ouvrir TUVOA.", { status: 503 });
    }
    return NextResponse.next();
  }
  const ok = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (pathname === "/acces") {
    // Déjà connecté : pas besoin de revoir l'écran de connexion.
    return ok ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Session expirée : recharge la page et reconnecte-toi." }, { status: 401 });
  }
  const url = new URL("/acces", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}
