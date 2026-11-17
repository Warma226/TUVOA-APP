// Temps réel Facebook : la Page prévient l'app à chaque commentaire ou mention (webhook « feed »).
// L'app lance aussitôt un passage de VOA (décision et réponse), puis transmet le commentaire sur Telegram.
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { graph, PAGE, cmPassage, auteursWebhook, commentairesWebhook } from "./cm";
import { verifierGrin } from "./telegram-bot";

// Jeton de vérification à saisir dans Meta (Webhooks › Page) : dérivé de l'identifiant de la Page, sans secret à créer.
export const jetonVerification = () => createHash("sha256").update(`tuvoa-fb:${process.env.FB_PAGE_ID ?? ""}`).digest("hex").slice(0, 24);

// Signature X-Hub-Signature-256 (HMAC-SHA256 du corps avec la clé secrète de l'app Meta, FB_APP_SECRET).
// Sans FB_APP_SECRET, l'appel est accepté : il ne fait que réveiller VOA, qui relit tout elle-même chez Facebook.
export function signatureValide(corps: string, entete: string | null): boolean {
  const secret = process.env.FB_APP_SECRET;
  if (!secret) return true;
  if (!entete?.startsWith("sha256=")) return false;
  const attendu = Buffer.from(createHmac("sha256", secret).update(corps).digest("hex"));
  const recu = Buffer.from(entete.slice(7));
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

type Change = { field?: string; value?: { item?: string; verb?: string; comment_id?: string; post_id?: string; parent_id?: string; message?: string; created_time?: number; from?: { id?: string; name?: string } } };
export function concerneVoa(payload: { object?: string; entry?: { changes?: Change[] }[] }): boolean {
  if (payload.object !== "page") return false;
  for (const e of payload.entry ?? []) for (const c of e.changes ?? []) {
    const v = c.value;
    if (v?.comment_id && v.from) auteursWebhook.set(v.comment_id, v.from);
    if (c.field === "feed" && v?.item === "comment" && v.verb === "add" && v.comment_id && v.from?.id !== PAGE())
      commentairesWebhook.set(v.comment_id, { post_id: v.post_id, parent_id: v.parent_id, message: v.message, created_time: v.created_time, from: v.from });
  }
  return (payload.entry ?? []).some((e) => (e.changes ?? []).some((c) =>
    (c.field === "feed" && c.value?.item === "comment" && c.value?.verb === "add" && c.value?.from?.id !== PAGE()) || c.field === "mention"));
}

// Passage de VOA juste après un commentaire. Si un passage est déjà en cours, on réessaie une fois quelques secondes plus tard.
export async function reagir() {
  for (let essai = 0; essai < 3; essai++) {
    const log = await cmPassage();
    if (!log.includes("Passage précédent encore en cours.")) break;
    await new Promise((ok) => setTimeout(ok, 8000));
  }
  await verifierGrin();
}

// Abonne la Page à l'app (nécessite l'autorisation pages_manage_metadata sur le jeton de Page).
export async function abonnerPage(): Promise<{ ok: boolean; detail: string }> {
  try {
    const r = await graph<{ success?: boolean }>(`${PAGE()}/subscribed_apps`, { subscribed_fields: "feed,mention" }, {});
    return r.success ? { ok: true, detail: "Temps réel actif : la Page prévient l'app à chaque commentaire." } : { ok: false, detail: "Facebook n'a pas confirmé l'abonnement." };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, detail: /manage_metadata|permission|#200|#10/i.test(m) ? "Le jeton de Page n'a pas l'autorisation pages_manage_metadata : régénérez-le avec cette autorisation." : m };
  }
}

export async function pageAbonnee(): Promise<boolean> {
  try {
    const r = await graph<{ data?: { subscribed_fields?: string[] }[] }>(`${PAGE()}/subscribed_apps`);
    return (r.data ?? []).some((a) => (a.subscribed_fields ?? []).includes("feed"));
  } catch { return false; }
}
