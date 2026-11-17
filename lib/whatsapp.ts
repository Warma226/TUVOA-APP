// Alertes WhatsApp pour l'administration (brief du soir, problèmes de la plateforme), via CallMeBot :
// service gratuit qui envoie des messages texte sur le WhatsApp de la personne qui l'a activé.
// Variables Vercel : WHATSAPP_PHONE (numéro au format international, ex. +22670000000) et CALLMEBOT_KEY.
import { db } from "./store";

export function whatsappConfigure() {
  return Boolean(process.env.WHATSAPP_PHONE && process.env.CALLMEBOT_KEY);
}

export async function whatsapp(texte: string): Promise<{ ok: boolean; detail: string }> {
  if (!whatsappConfigure()) return { ok: false, detail: "Ajoutez WHATSAPP_PHONE et CALLMEBOT_KEY dans Vercel." };
  const u = new URL("https://api.callmebot.com/whatsapp.php");
  u.searchParams.set("phone", (process.env.WHATSAPP_PHONE ?? "").replace(/[^\d+]/g, ""));
  u.searchParams.set("text", texte.slice(0, 1500));
  u.searchParams.set("apikey", process.env.CALLMEBOT_KEY ?? "");
  try {
    const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    const corps = (await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const ok = r.ok && !/error|invalid|not (been )?activated|apikey/i.test(corps.slice(0, 300));
    return { ok, detail: ok ? "Message envoyé." : `CallMeBot : ${corps.slice(0, 160) || r.status}` };
  } catch (e) {
    return { ok: false, detail: `CallMeBot injoignable : ${(e as Error).message}` };
  }
}

// Alerte « problème » : un même problème (même clé) n'est renvoyé qu'après `delaiH` heures, pour ne pas inonder WhatsApp.
export async function alerte(cle: string, texte: string, delaiH = 6) {
  if (!whatsappConfigure()) return;
  try {
    const { data } = await db().from("settings").select("data").eq("id", 9).maybeSingle();
    const vues = ((data?.data as { alertes?: Record<string, string> } | null)?.alertes ?? {}) as Record<string, string>;
    const derniere = vues[cle] ? new Date(vues[cle]).getTime() : 0;
    if (Date.now() - derniere < delaiH * 3.6e6) return;
    const r = await whatsapp(`⚠️ TUVOA · ${texte}`);
    if (!r.ok) { console.error("alerte whatsapp", r.detail); return; }
    // On ne garde que les clés des 3 derniers jours
    const garder = Object.fromEntries(Object.entries(vues).filter(([, v]) => Date.now() - new Date(v).getTime() < 72 * 3.6e6));
    await db().from("settings").upsert({ id: 9, data: { alertes: { ...garder, [cle]: new Date().toISOString() } } });
  } catch (e) {
    console.error("alerte", (e as Error).message);
  }
}

// Traduit une erreur technique de publication en une phrase claire, avec la marche à suivre.
export function expliquer(plateforme: string, detail: string): { cle: string; texte: string } {
  const d = detail.toLowerCase();
  const nom = { facebook: "Facebook", linkedin: "LinkedIn", wordpress: "le site", tiktok: "TikTok" }[plateforme] ?? plateforme;
  if (plateforme === "facebook" && /session has been invalidated|access token|expired|oauth|#190/.test(d))
    return { cle: "fb-jeton", texte: "Facebook refuse le jeton de la Page : les posts ne partent plus sur Facebook. Il faut générer un nouveau jeton (Explorateur de l'API Graph) et le remplacer dans Vercel (FB_PAGE_TOKEN)." };
  if (plateforme === "facebook" && /permission|#200|#10\b/.test(d))
    return { cle: "fb-droits", texte: `Facebook refuse la publication faute d'autorisation : ${detail.slice(0, 160)}` };
  if (plateforme === "linkedin" && /make/.test(d))
    return { cle: "li-make", texte: "LinkedIn : Make ne répond pas. Vérifiez que le scénario Make est activé." };
  return { cle: `${plateforme}:${d.replace(/[^a-z]/g, "").slice(0, 40)}`, texte: `Échec de publication sur ${nom} : ${detail.slice(0, 200)}` };
}
