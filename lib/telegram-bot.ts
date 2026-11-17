// Bot Telegram de TUVOA : commandes (/brief, /prochains, /pause, /reprendre, /stats) et alertes supplémentaires
// (post viral, commentaires négatifs du Grin, rapport du lundi). Seule la discussion reliée peut piloter l'app.
import { createHash } from "crypto";
import { db, getSettings, saveSettings } from "./store";
import { graph, PAGE, fbConfigure } from "./cm";
import { chatTelegram, envoiUnique, tg } from "./whatsapp";

const APP = () => (process.env.APP_URL || "https://tuvoa-app.vercel.app").replace(/\/+$/, "");
export const secretWebhook = () => createHash("sha256").update(`tuvoa-tg:${process.env.TELEGRAM_BOT_TOKEN ?? ""}`).digest("hex").slice(0, 48);

const COMMANDES = [
  { command: "brief", description: "Le point de la journée" },
  { command: "prochains", description: "Les 5 prochains posts programmés" },
  { command: "stats", description: "Le bilan des 7 derniers jours" },
  { command: "pause", description: "Couper le pilote automatique" },
  { command: "reprendre", description: "Relancer le pilote automatique" },
  { command: "aide", description: "La liste des commandes" },
];

// Branche le bot sur l'app (réception des commandes) et affiche le menu des commandes dans Telegram.
export async function activerCommandes(): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, detail: "Ajoutez TELEGRAM_BOT_TOKEN dans Vercel." };
  const w = await tg("setWebhook", { url: `${APP()}/api/telegram`, secret_token: secretWebhook(), allowed_updates: ["message"], drop_pending_updates: true });
  if (!w.ok) return { ok: false, detail: `Telegram : ${w.description}` };
  await tg("setMyCommands", { commands: COMMANDES, language_code: "fr" });
  await tg("setMyCommands", { commands: COMMANDES });
  return { ok: true, detail: "Commandes actives : tapez / dans la discussion avec le bot." };
}

export async function commandesActives(): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const r = await tg("getWebhookInfo");
    return Boolean((r.result as { url?: string } | undefined)?.url?.endsWith("/api/telegram"));
  } catch { return false; }
}

const heure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const RUB: Record<string, string> = { actu: "Actu", citation: "Citation", cyberbase: "CyberBase", portrait: "Portrait" };
const debutJour = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

async function abonnes(): Promise<number | null> {
  if (!fbConfigure()) return null;
  try { return (await graph<{ followers_count?: number }>(PAGE(), { fields: "followers_count" })).followers_count ?? null; } catch { return null; }
}

async function brief(): Promise<string> {
  const debut = debutJour();
  const [pub, err, rest, prochain, grin, s, ab] = await Promise.all([
    db().from("posts").select("id", { count: "exact", head: true }).eq("status", "publie").gte("scheduled_at", debut),
    db().from("posts").select("id", { count: "exact", head: true }).eq("status", "erreur").gte("scheduled_at", debut),
    db().from("posts").select("id", { count: "exact", head: true }).eq("status", "planifie").lt("scheduled_at", new Date(new Date(debut).getTime() + 864e5).toISOString()),
    db().from("posts").select("title,rubrique,scheduled_at").eq("status", "planifie").gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(1).maybeSingle(),
    db().from("cm_journal").select("id", { count: "exact", head: true }).eq("traite", false),
    getSettings(),
    abonnes(),
  ]);
  const p = prochain.data as { title: string | null; rubrique: string; scheduled_at: string } | null;
  return [
    `📊 Le point · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}`,
    "",
    `📣 Publiés aujourd'hui : ${pub.count ?? 0}${err.count ? ` · ⚠️ ${err.count} en erreur` : ""}`,
    `🗓️ Encore prévus aujourd'hui : ${rest.count ?? 0}`,
    p ? `⏭️ Prochain : ${heure(p.scheduled_at)} · ${RUB[p.rubrique] ?? p.rubrique} · ${(p.title ?? "").slice(0, 80)}` : "⏭️ Aucun post programmé",
    ab != null ? `👥 Abonnés : ${ab.toLocaleString("fr-FR")}` : "",
    `💬 À traiter dans le Grin : ${grin.count ?? 0}`,
    `🤖 Pilote automatique : ${s.autopilot ? "en marche" : "à l'arrêt (/reprendre pour le relancer)"}`,
  ].filter(Boolean).join("\n");
}

async function prochains(): Promise<string> {
  const { data } = await db().from("posts").select("title,rubrique,scheduled_at,platforms").eq("status", "planifie").gte("scheduled_at", new Date(Date.now() - 15 * 60000).toISOString()).order("scheduled_at").limit(5);
  const l = (data ?? []) as { title: string | null; rubrique: string; scheduled_at: string }[];
  if (!l.length) return "🗓️ Aucun post programmé pour l'instant.";
  return ["🗓️ Les prochains posts", "", ...l.map((p, i) => `${i + 1}. ${heure(p.scheduled_at)} · ${RUB[p.rubrique] ?? p.rubrique}\n   ${(p.title ?? "").slice(0, 90)}`), "", `Calendrier : ${APP()}/calendrier`].join("\n");
}

export async function stats(titre = "📈 Les 7 derniers jours"): Promise<string> {
  const depuis = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ data: posts }, ab, { data: ancien }, { data: rapport }] = await Promise.all([
    db().from("posts").select("rubrique,status").gte("scheduled_at", depuis).lte("scheduled_at", new Date().toISOString()),
    abonnes(),
    db().from("cm_rapports").select("contenu").lte("jour", depuis.slice(0, 10)).order("jour", { ascending: false }).limit(1).maybeSingle(),
    db().from("cm_rapports").select("contenu").order("jour", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const l = (posts ?? []) as { rubrique: string; status: string }[];
  const pub = l.filter((p) => p.status === "publie");
  const par = Object.entries(pub.reduce<Record<string, number>>((a, p) => ((a[p.rubrique] = (a[p.rubrique] ?? 0) + 1), a), {}))
    .sort((a, b) => b[1] - a[1]).map(([r, n]) => `${RUB[r] ?? r} ${n}`).join(" · ");
  const avant = (ancien?.contenu as { abonnes?: number | null } | undefined)?.abonnes ?? null;
  const heures = ((rapport?.contenu as { meilleuresHeures?: string[] } | undefined)?.meilleuresHeures ?? []).join(", ");
  const top = ((rapport?.contenu as { posts?: { texte: string; reactions: number; commentaires: number }[] } | undefined)?.posts ?? [])[0];
  return [
    titre,
    "",
    `📣 Publiés : ${pub.length}${par ? ` (${par})` : ""}`,
    l.some((p) => p.status === "erreur") ? `⚠️ En erreur : ${l.filter((p) => p.status === "erreur").length}` : "✅ Aucune erreur de publication",
    ab != null ? `👥 Abonnés : ${ab.toLocaleString("fr-FR")}${avant != null ? ` (${ab - avant >= 0 ? "+" : ""}${ab - avant} en 7 jours)` : ""}` : "",
    heures ? `⏰ Meilleurs horaires : ${heures}` : "",
    top ? `🔥 Post récent le plus engageant : « ${top.texte.slice(0, 80)} » (${top.reactions} réactions, ${top.commentaires} commentaires)` : "",
    "",
    `Tableau de bord : ${APP()}`,
  ].filter((x, i, t) => x !== "" || t[i - 1] !== "").join("\n");
}

async function pilote(marche: boolean): Promise<string> {
  const s = await getSettings();
  if (s.autopilot === marche) return marche ? "🤖 Le pilote automatique est déjà en marche." : "⏸️ Le pilote automatique est déjà à l'arrêt.";
  await saveSettings({ ...s, autopilot: marche });
  return marche
    ? "▶️ Pilote automatique relancé : la veille reprend et les actus seront de nouveau publiées automatiquement."
    : "⏸️ Pilote automatique coupé : plus aucune actu automatique. Les posts déjà programmés partent quand même (/prochains). Envoyez /reprendre pour le relancer.";
}

const AIDE = [
  "🤖 Commandes TUVOA",
  "",
  "/brief : le point de la journée",
  "/prochains : les 5 prochains posts",
  "/stats : le bilan des 7 derniers jours",
  "/pause : couper le pilote automatique",
  "/reprendre : le relancer",
].join("\n");

// Réception d'un message envoyé au bot (webhook). Seule la discussion reliée est écoutée.
export async function traiterMessage(update: { message?: { chat: { id: number }; text?: string } }) {
  const m = update.message;
  if (!m?.text) return;
  const chat = await chatTelegram();
  if (!chat || String(m.chat.id) !== chat) {
    await tg("sendMessage", { chat_id: m.chat.id, text: "Ce bot est réservé à l'administration de TUVOA." });
    return;
  }
  const cmd = m.text.trim().split(/[\s@]/)[0].toLowerCase();
  let texte: string;
  try {
    texte =
      cmd === "/brief" ? await brief()
      : cmd === "/prochains" ? await prochains()
      : cmd === "/stats" ? await stats()
      : cmd === "/pause" ? await pilote(false)
      : cmd === "/reprendre" ? await pilote(true)
      : AIDE;
  } catch (e) {
    texte = `Désolé, impossible de répondre : ${(e as Error).message.slice(0, 200)}`;
  }
  await tg("sendMessage", { chat_id: chat, text: texte, disable_web_page_preview: true });
}

// ─── Alertes supplémentaires (appelées par la tâche planifiée, toutes les 15 min) ───

// Post viral : un post des 12 dernières heures nettement plus engageant que d'habitude.
export async function verifierViral(log: string[]) {
  if (!fbConfigure()) return;
  type P = { id: string; message?: string; created_time: string; permalink_url?: string; shares?: { count: number }; reactions?: { summary: { total_count: number } }; comments?: { summary: { total_count: number } } };
  const { data } = await graph<{ data: P[] }>(`${PAGE()}/posts`, { fields: "id,message,created_time,permalink_url,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)", limit: "25" });
  const score = (p: P) => (p.reactions?.summary.total_count ?? 0) + 2 * (p.comments?.summary.total_count ?? 0) + 3 * (p.shares?.count ?? 0);
  const recents = data.filter((p) => Date.now() - new Date(p.created_time).getTime() < 12 * 3.6e6);
  const anciens = data.filter((p) => !recents.includes(p)).map(score).sort((a, b) => a - b);
  const mediane = anciens.length ? anciens[Math.floor(anciens.length / 2)] : 0;
  for (const p of recents) {
    const s = score(p);
    if (s < Math.max(20, 3 * mediane)) continue;
    const r = p.reactions?.summary.total_count ?? 0, c = p.comments?.summary.total_count ?? 0, sh = p.shares?.count ?? 0;
    await envoiUnique(`viral:${p.id}`, [
      "🔥 TUVOA · Un post décolle !",
      "",
      `« ${(p.message ?? "").split("\n")[0].slice(0, 120)} »`,
      `${r} réactions · ${c} commentaires · ${sh} partages (${Math.round(s / Math.max(1, mediane))}× plus que d'habitude)`,
      "",
      "Profitez-en : répondez aux commentaires, partagez-le en story ou préparez une suite sur le même sujet.",
      p.permalink_url ?? "",
    ].join("\n"), 24 * 30);
    log.push(`Post viral signalé : ${p.id}`);
  }
}

// Chaque nouveau commentaire, message ou mention de la Page, avec ce que VOA en a fait (lecture seule).
// Les commentaires négatifs non traités sont mis en avant.
const ACTION: Record<string, string> = { repondre: "VOA a répondu", repondu: "VOA a répondu", aimer: "VOA a aimé", aime: "VOA a aimé", masquer: "VOA l'a masqué", masque: "VOA l'a masqué", signaler: "VOA l'a signalé", signale: "VOA l'a signalé", ignorer: "VOA l'a laissé passer", ignore: "VOA l'a laissé passer", erreur: "VOA n'a pas pu agir" };
export async function verifierGrin() {
  const { data } = await db().from("cm_journal").select("id,canal,auteur,texte,lien,action,reponse,ton,traite")
    .in("canal", ["commentaire", "message", "mention"]).gte("created_at", new Date(Date.now() - 45 * 60000).toISOString()).order("created_at", { ascending: true }).limit(15);
  for (const l of (data ?? []) as { id: string; canal: string; auteur: string | null; texte: string | null; lien: string | null; action: string; reponse: string | null; ton: string | null; traite: boolean }[]) {
    const negatif = l.ton === "negatif" && !l.traite;
    const quoi = l.canal === "message" ? "Message privé" : l.canal === "mention" ? "Mention de TUVOA" : "Nouveau commentaire";
    await envoiUnique(`com:${l.id}`, [
      `${negatif ? "😠" : "💬"} ${quoi}${negatif ? " (négatif, à regarder)" : ""}`,
      "",
      `${l.auteur ?? "Quelqu'un"} : « ${(l.texte ?? "").slice(0, 300)} »`,
      "",
      !l.traite ? `⏳ En attente de votre décision dans le Grin${l.reponse ? `\n💡 Réponse proposée par VOA : « ${l.reponse.slice(0, 200)} »` : ""}` : `✅ ${ACTION[l.action] ?? l.action}${l.reponse ? ` : « ${l.reponse.slice(0, 200)} »` : ""}`,
      l.lien ?? `${APP()}/communaute`,
    ].join("\n"), 24 * 7);
  }
}

// Rapport du lundi : le bilan de la semaine, une fois, à partir de 7 h GMT.
export async function rapportLundi() {
  const now = new Date();
  if (now.getUTCDay() !== 1 || now.getUTCHours() < 7) return;
  await envoiUnique(`lundi:${now.toISOString().slice(0, 10)}`, await stats("🗓️ TUVOA · Le bilan de la semaine"), 24 * 6);
}
