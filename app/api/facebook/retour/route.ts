// Retour de Facebook : échange le code contre un jeton de Page longue durée et l'enregistre (aucun copier-coller).
import { NextResponse } from "next/server";
import { appUrl } from "@/lib/sign";
import { FB_APP_ID, enregistrerJetonFb, lireEtatOAuth } from "@/lib/fb-jeton";
import { envoiUnique } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
const G = () => `https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || "v21.0"}`;

async function lire<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const d = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!r.ok || d.error) throw new Error(d.error?.message || `Facebook a répondu ${r.status}`);
  return d;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const fin = (p: string) => NextResponse.redirect(`${appUrl()}/connexions?${p}`);
  if (q.get("error")) return fin("fb=annule");
  if (!lireEtatOAuth(q.get("state"))) return fin("fb=expire");
  const secret = process.env.FB_APP_SECRET;
  if (!secret) return fin("fb=config");
  try {
    const redirect = `${appUrl()}/api/facebook/retour`;
    const court = await lire<{ access_token: string }>(`${G()}/oauth/access_token?client_id=${FB_APP_ID()}&redirect_uri=${encodeURIComponent(redirect)}&client_secret=${encodeURIComponent(secret)}&code=${encodeURIComponent(q.get("code") ?? "")}`);
    const long = await lire<{ access_token: string }>(`${G()}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID()}&client_secret=${encodeURIComponent(secret)}&fb_exchange_token=${encodeURIComponent(court.access_token)}`);
    const pages = await lire<{ data: { id: string; name: string; access_token: string }[] }>(`${G()}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(long.access_token)}`);
    const voulue = process.env.FB_PAGE_ID;
    const page = pages.data.find((p) => p.id === voulue) ?? (pages.data.length === 1 ? pages.data[0] : pages.data.find((p) => /tuvoa|warmachiner/i.test(p.name)));
    if (!page) return fin("fb=page");
    await enregistrerJetonFb({ token: page.access_token, page: page.id, nom: page.name });
    // Réabonne la Page aux notifications (commentaires en temps réel).
    await fetch(`${G()}/${page.id}/subscribed_apps`, { method: "POST", body: new URLSearchParams({ subscribed_fields: "feed,messages", access_token: page.access_token }) }).catch(() => null);
    await envoiUnique(`fb-reconnecte-${Date.now()}`, `✅ TUVOA · Facebook est reconnecté (Page « ${page.name} »). TUVOA publie et lit à nouveau les commentaires.`, 0).catch(() => undefined);
    return fin("fb=ok");
  } catch (e) {
    console.error("facebook retour", (e as Error).message);
    return fin(`fb=erreur&detail=${encodeURIComponent((e as Error).message.slice(0, 160))}`);
  }
}
