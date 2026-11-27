// Discussion libre avec TUVOA sur Telegram : on écrit en français, l'assistant comprend, répond et agit.
// Il peut préparer un brouillon (jamais publié sans le bouton « Publier »), donner le point du jour, les stats,
// les prochains posts, et couper ou relancer le pilote automatique.
import { aiJson, generatePost } from "./claude";
import { db, emptyPost, getPost, savePost } from "./store";
import { tg } from "./whatsapp";
import { brief, pilote, prochains, stats } from "./telegram-bot";

const APP = () => (process.env.APP_URL || "https://tuvoa-app.vercel.app").replace(/\/+$/, "");
const LIGNE = 11; // settings : mémoire courte de la discussion
type Echange = { r: "u" | "a"; t: string };

async function memoire(): Promise<Echange[]> {
  const { data } = await db().from("settings").select("data").eq("id", LIGNE).maybeSingle();
  return ((data?.data as { hist?: Echange[] } | null)?.hist ?? []).slice(-10);
}
async function retenir(h: Echange[]) {
  await db().from("settings").upsert({ id: LIGNE, data: { hist: h.slice(-10) } });
}

async function contexte(): Promise<string> {
  const { data } = await db().from("posts").select("id,title,status,scheduled_at").in("status", ["a_valider", "brouillon", "planifie"]).order("created_at", { ascending: false }).limit(8);
  const l = (data ?? []) as { id: string; title: string | null; status: string; scheduled_at: string | null }[];
  return l.length ? l.map((p) => `- [${p.id.slice(0, 8)}] ${p.status}${p.scheduled_at ? ` (${p.scheduled_at.slice(0, 16).replace("T", " ")})` : ""} : ${(p.title ?? "").slice(0, 80)}`).join("\n") : "(aucun)";
}

type Decision = { reponse: string; action?: "aucune" | "brouillon" | "brief" | "stats" | "prochains" | "pause" | "reprendre" | "publier"; sujet?: string; id?: string };

export async function discuter(texte: string, chat: string) {
  await tg("sendChatAction", { chat_id: chat, action: "typing" }).catch(() => null);
  const hist = await memoire();
  let d: Decision;
  try {
    d = await aiJson<Decision>(
      `Tu es l'assistant de TUVOA Tech Media (média tech, Burkina Faso), sur Telegram. Tu parles à l'administratrice, en français, ton direct et professionnel, réponses courtes.
Tu peux déclencher UNE action :
- "brouillon" : préparer un post sur un sujet (mets le sujet précis dans "sujet") ;
- "brief" (le point du jour), "stats" (bilan 7 jours), "prochains" (posts programmés) ;
- "pause" / "reprendre" : couper ou relancer le pilote automatique (seulement si c'est clairement demandé) ;
- "publier" : publier un brouillon existant (mets son identifiant court dans "id") — seulement si elle le demande explicitement ;
- "aucune" : simple réponse.
N'invente jamais de chiffres ni de faits. Si une demande est floue, pose une question courte.
Posts en attente ou programmés :
${await contexte()}`,
      `Historique récent :\n${hist.map((h) => `${h.r === "u" ? "Elle" : "Toi"} : ${h.t}`).join("\n") || "(début)"}\n\nMessage : ${texte}\n\nRéponds en JSON : {"reponse": "...", "action": "...", "sujet": "...", "id": "..."}`,
      800,
    );
  } catch (e) {
    await tg("sendMessage", { chat_id: chat, text: `Je n'arrive pas à réfléchir pour l'instant (${(e as Error).message.slice(0, 120)}). Les commandes /brief, /stats et /prochains marchent toujours.` });
    return;
  }

  let suite = "";
  try {
    switch (d.action) {
      case "brief": suite = await brief(); break;
      case "stats": suite = await stats(); break;
      case "prochains": suite = await prochains(); break;
      case "pause": suite = await pilote(false); break;
      case "reprendre": suite = await pilote(true); break;
      case "brouillon":
        if (d.sujet) { if (d.reponse) await tg("sendMessage", { chat_id: chat, text: d.reponse }); await retenir([...hist, { r: "u", t: texte }, { r: "a", t: d.reponse }]); return void (await brouillon(d.sujet, chat)); }
        break;
      case "publier": {
        const post = d.id ? await trouver(d.id) : null;
        if (!post) { suite = "Je ne trouve pas ce brouillon. Dites-moi son titre."; break; }
        await tg("sendMessage", { chat_id: chat, text: `${d.reponse || "D'accord."}\n\n« ${post.title} »`, reply_markup: boutons(post.id) });
        await retenir([...hist, { r: "u", t: texte }, { r: "a", t: d.reponse }]);
        return;
      }
    }
  } catch (e) {
    suite = `⚠️ ${(e as Error).message.slice(0, 200)}`;
  }
  const message = [d.reponse, suite].filter(Boolean).join("\n\n") || "D'accord.";
  await tg("sendMessage", { chat_id: chat, text: message.slice(0, 4000), disable_web_page_preview: true });
  await retenir([...hist, { r: "u", t: texte }, { r: "a", t: d.reponse || suite.slice(0, 300) }]);
}

async function trouver(court: string) {
  const { data } = await db().from("posts").select("id").in("status", ["a_valider", "brouillon"]).order("created_at", { ascending: false }).limit(30);
  const id = ((data ?? []) as { id: string }[]).find((p) => p.id.startsWith(court.trim()))?.id;
  return id ? getPost(id) : null;
}

const boutons = (id: string) => ({
  inline_keyboard: [
    [{ text: "✅ Publier maintenant", callback_data: `pub:${id}` }, { text: "🗑 Supprimer", callback_data: `del:${id}` }],
    [{ text: "✏️ Modifier dans TUVOA", url: `${APP()}/editeur?id=${id}` }],
  ],
});

async function brouillon(sujet: string, chat: string) {
  await tg("sendChatAction", { chat_id: chat, action: "typing" }).catch(() => null);
  const g = await generatePost({ rubrique: "actu", idea: sujet });
  const post = emptyPost({
    rubrique: "actu", idea: sujet, title: g.wp_title || g.visuel_titre || sujet.slice(0, 90), origin: "manuel",
    platforms: ["facebook", "linkedin"],
    texts: { facebook: g.facebook, linkedin: g.linkedin, tiktok: g.tiktok, wp_title: g.wp_title, wp_body: g.wp_body, wp_excerpt: g.wp_excerpt },
    visual: { titre: g.visuel_titre || "Actu tech", texte: g.visuel_texte || sujet },
    status: "a_valider", auteur_nom: "Telegram",
  });
  await savePost(post);
  await tg("sendMessage", {
    chat_id: chat,
    text: `📝 Brouillon prêt (à valider)\n\n${g.facebook.slice(0, 3200)}`,
    reply_markup: boutons(post.id),
    disable_web_page_preview: true,
  });
}

export async function traiterBouton(cbId: string, data: string, chat: string, messageId?: number) {
  const [act, id] = data.split(":");
  const post = id ? await getPost(id) : null;
  if (!post) return void (await tg("answerCallbackQuery", { callback_query_id: cbId, text: "Ce brouillon n'existe plus." }));
  if (post.status === "publie" || post.status === "planifie") {
    return void (await tg("answerCallbackQuery", { callback_query_id: cbId, text: "Déjà programmé ou publié." }));
  }
  if (act === "pub") {
    await savePost({ ...post, status: "planifie", scheduled_at: new Date().toISOString() });
    await tg("answerCallbackQuery", { callback_query_id: cbId, text: "Programmé" });
    if (messageId) await tg("editMessageReplyMarkup", { chat_id: chat, message_id: messageId, reply_markup: { inline_keyboard: [] } }).catch(() => null);
    await tg("sendMessage", { chat_id: chat, text: `✅ « ${post.title} » part dans les prochaines minutes sur ${post.platforms.join(", ")}.` });
  } else if (act === "del") {
    await savePost({ ...post, status: "annule" });
    await tg("answerCallbackQuery", { callback_query_id: cbId, text: "Supprimé" });
    if (messageId) await tg("editMessageReplyMarkup", { chat_id: chat, message_id: messageId, reply_markup: { inline_keyboard: [] } }).catch(() => null);
    await tg("sendMessage", { chat_id: chat, text: `🗑 Brouillon « ${post.title} » supprimé.` });
  } else {
    await tg("answerCallbackQuery", { callback_query_id: cbId });
  }
}
