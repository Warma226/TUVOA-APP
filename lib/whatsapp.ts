// Alertes pour l'administration (brief du soir, problèmes de la plateforme).
// Trois services possibles (le premier configuré est utilisé) :
// - Telegram (officiel, gratuit) : TELEGRAM_BOT_TOKEN (créé avec @BotFather). La discussion est reliée depuis Connexions
//   (bouton « Relier mon Telegram » après avoir écrit /start au bot), ou fixée avec TELEGRAM_CHAT_ID.
// - Green-API (gratuit, offre Developer) : un numéro WhatsApp relié par QR code envoie les messages.
//   Variables : GREENAPI_URL (ex. https://7103.api.greenapi.com), GREENAPI_ID, GREENAPI_TOKEN.
// - CallMeBot (gratuit) : variable CALLMEBOT_KEY.
// Dans les deux cas : WHATSAPP_PHONE = numéro qui reçoit les alertes, au format international (ex. +22670000000).
import { db } from "./store";

const telegram = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);
export const tg = (methode: string, corps?: unknown) =>
  fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${methode}`, {
    method: corps ? "POST" : "GET", headers: corps ? { "Content-Type": "application/json" } : undefined,
    body: corps ? JSON.stringify(corps) : undefined, cache: "no-store", signal: AbortSignal.timeout(20000),
  }).then((r) => r.json() as Promise<{ ok: boolean; description?: string; result?: unknown }>);

export async function chatTelegram(): Promise<string | null> {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID;
  const { data } = await db().from("settings").select("data").eq("id", 9).maybeSingle();
  return ((data?.data as { telegramChat?: string } | null)?.telegramChat) ?? null;
}

// Relie la discussion Telegram : lit le dernier message reçu par le bot (« /start ») et garde son identifiant.
export async function relierTelegram(): Promise<{ ok: boolean; detail: string }> {
  if (!telegram()) return { ok: false, detail: "Ajoutez TELEGRAM_BOT_TOKEN dans Vercel puis redéployez." };
  const r = await tg("getUpdates");
  if (!r.ok) return { ok: false, detail: `Telegram : ${r.description ?? "jeton refusé"}` };
  const maj = (r.result as { message?: { chat: { id: number; first_name?: string } } }[]).filter((u) => u.message).pop();
  if (!maj?.message) return { ok: false, detail: "Aucun message reçu : ouvrez votre bot dans Telegram, appuyez sur « Démarrer » (ou écrivez /start), puis réessayez." };
  const chat = String(maj.message.chat.id);
  const { data } = await db().from("settings").select("data").eq("id", 9).maybeSingle();
  await db().from("settings").upsert({ id: 9, data: { ...((data?.data as object) ?? {}), telegramChat: chat } });
  const t = await tg("sendMessage", { chat_id: chat, text: `✅ TUVOA · Bonjour ${maj.message.chat.first_name ?? ""} ! Vous recevrez ici le brief du soir et les problèmes de la plateforme.` });
  return t.ok ? { ok: true, detail: "Telegram relié : un message de bienvenue vient de partir." } : { ok: false, detail: `Telegram : ${t.description}` };
}

export async function canalAlertes() {
  if (telegram()) return { canal: "telegram" as const, relie: Boolean(await chatTelegram()) };
  return { canal: "whatsapp" as const, relie: whatsappConfigure() };
}

const greenApi = () => Boolean(process.env.GREENAPI_URL && process.env.GREENAPI_ID && process.env.GREENAPI_TOKEN);

export function whatsappConfigure() {
  return telegram() || Boolean(process.env.WHATSAPP_PHONE && (greenApi() || process.env.CALLMEBOT_KEY));
}

export async function whatsapp(texte: string): Promise<{ ok: boolean; detail: string }> {
  if (telegram()) {
    const chat = await chatTelegram();
    if (!chat) return { ok: false, detail: "Telegram pas encore relié : écrivez /start à votre bot puis « Relier mon Telegram » dans Connexions." };
    try {
      const r = await tg("sendMessage", { chat_id: chat, text: texte.replace(/\*([^*\n]+)\*/g, "$1").slice(0, 4000), disable_web_page_preview: true });
      return r.ok ? { ok: true, detail: "Message envoyé." } : { ok: false, detail: `Telegram : ${r.description}` };
    } catch (e) {
      return { ok: false, detail: `Telegram injoignable : ${(e as Error).message}` };
    }
  }
  if (!whatsappConfigure()) return { ok: false, detail: "Ajoutez WHATSAPP_PHONE et les clés Green-API (ou CALLMEBOT_KEY) dans Vercel." };
  if (greenApi()) {
    const base = (process.env.GREENAPI_URL ?? "").replace(/\/+$/, "");
    const chatId = `${(process.env.WHATSAPP_PHONE ?? "").replace(/\D/g, "")}@c.us`;
    try {
      const r = await fetch(`${base}/waInstance${process.env.GREENAPI_ID}/sendMessage/${process.env.GREENAPI_TOKEN}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: texte.slice(0, 4000) }),
        cache: "no-store", signal: AbortSignal.timeout(20000),
      });
      const d = (await r.json().catch(() => ({}))) as { idMessage?: string; message?: string };
      if (r.ok && d.idMessage) return { ok: true, detail: "Message envoyé." };
      return { ok: false, detail: `Green-API : ${d.message ?? r.status}${r.status === 466 ? " (limite de l'offre gratuite : 3 discussions)" : r.status === 401 ? " (identifiants incorrects)" : ""}` };
    } catch (e) {
      return { ok: false, detail: `Green-API injoignable : ${(e as Error).message}` };
    }
  }
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

// Alerte « problème » : un même problème (même clé) n'est renvoyé qu'après `delaiH` heures, pour ne pas inonder la messagerie.
export async function alerte(cle: string, texte: string, delaiH = 6) {
  return envoiUnique(cle, `⚠️ TUVOA · ${texte}`, delaiH);
}

// Envoi « une seule fois » par clé et par période (rapport du lundi, post viral, commentaire négatif…).
export async function envoiUnique(cle: string, texte: string, delaiH = 6) {
  if (!whatsappConfigure()) return;
  try {
    const { data } = await db().from("settings").select("data").eq("id", 9).maybeSingle();
    const tout = (data?.data as { alertes?: Record<string, string> } | null) ?? {};
    const vues = (tout.alertes ?? {}) as Record<string, string>;
    const derniere = vues[cle] ? new Date(vues[cle]).getTime() : 0;
    if (Date.now() - derniere < delaiH * 3.6e6) return;
    const r = await whatsapp(texte);
    if (!r.ok) { console.error("alerte whatsapp", r.detail); return; }
    // On ne garde que les clés des 3 derniers jours
    const garder = Object.fromEntries(Object.entries(vues).filter(([, v]) => Date.now() - new Date(v).getTime() < 72 * 3.6e6));
    await db().from("settings").upsert({ id: 9, data: { ...tout, alertes: { ...garder, [cle]: new Date().toISOString() } } });
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
