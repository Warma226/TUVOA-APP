// Protège toute l'application par un mot de passe (identifiant : tuvoa).
// Exceptions : la tâche planifiée (clé CRON_SECRET) et les visuels signés.
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron|api/visuel).*)"],
};

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    // Sans mot de passe configuré, l'app refuse l'accès en production.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Configure APP_PASSWORD dans Vercel pour ouvrir TUVOA.", { status: 503 });
    }
    return NextResponse.next();
  }
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const [user, pass] = atob(header.slice(6)).split(":");
      if (user === "tuvoa" && pass === password) return NextResponse.next();
    } catch {
      // en-tête illisible : on redemande
    }
  }
  return new NextResponse("Accès réservé à TUVOA.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="TUVOA", charset="UTF-8"' },
  });
}
