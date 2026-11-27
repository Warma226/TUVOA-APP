// Discussion libre avec TUVOA sur Telegram : on écrit en français, l'assistant comprend, répond et agit.
// Il peut préparer un brouillon (jamais publié sans le bouton « Publier »), donner le point du jour, les stats,
// les prochains posts, et couper ou relancer le pilote automatique.
import { aiJson, generatePost } from "./claude";
import { db, emptyPost, getPost, getSettings, savePost } from "./store";
import { allSources, allTriggers, isOn } from "./config";
import { fetchArticle, fetchVeille } from "./veille";
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

// ─── Ce que l'assistant peut consulter ───────────────────────────────
type Outil = "veille" | "site" | "posts" | "publies" | "commentaires";
const coupe = (t: string | null | undefined, n: number) => (t ?? "").replace(/\s+/g, " ").trim().slice(0, n);

async function lireVeille(q: string): Promise<string> {
  const st = await getSettings();
  const sources = allSources(st.customSources).filter((x) => isOn(st.sourcesEnabled, x.id, x.enabledByDefault));
  const triggers = allTriggers(st.triggers).filter((t) => isOn(st.triggersEnabled, t.id, t.enabledByDefault));
  const { items } = await fetchVeille(sources, triggers);
  const mots = q.toLowerCase().split(/\s+/).filter((m) => m.length > 3);
  const l = items.filter((it) => !mots.length || mots.some((m) => `${it.title} ${it.summary}`.toLowerCase().includes(m)));
  return (l.length ? l : items).sort((a, b) => b.score - a.score).slice(0, 12)
    .map((it) => `- ${coupe(it.title, 140)} (${it.sourceName}${it.publishedAt ? `, ${it.publishedAt.slice(0, 10)}` : ""}) — ${coupe(it.summary, 220)} [lien: ${it.url}]`).join("\n") || "(veille vide)";
}
async function lireSite(q: string): Promise<string> {
  const base = (process.env.WP_URL ?? "").replace(/\/$/, "");
  if (!base) return "(site non relié)";
  const u = `${base}/wp-json/wp/v2/posts?per_page=10&_fields=title,link,date,excerpt${q ? `&search=${encodeURIComponent(q)}` : ""}`;
  const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!r.ok) return `(site injoignable : ${r.status})`;
  const l = (await r.json()) as { title: { rendered: string }; link: string; date: string; excerpt: { rendered: string } }[];
  const net = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#8217;|&rsquo;/g, "’").replace(/&nbsp;|&#160;/g, " ").replace(/&[a-z#0-9]+;/g, "");
  return l.map((a) => `- ${coupe(net(a.title.rendered), 140)} (${a.date.slice(0, 10)}) — ${coupe(net(a.excerpt.rendered), 200)} [${a.link}]`).join("\n") || "(aucun article trouvé)";
}
async function lirePosts(publies: boolean, q: string): Promise<string> {
  let r = db().from("posts").select("id,title,status,rubrique,scheduled_at,results").order(publies ? "scheduled_at" : "created_at", { ascending: false }).limit(15);
  r = publies ? r.eq("status", "publie") : r.in("status", ["a_valider", "brouillon", "planifie", "erreur"]);
  if (q) r = r.ilike("title", `%${q.slice(0, 60)}%`);
  const { data } = await r;
  return ((data ?? []) as { id: string; title: string | null; status: string; rubrique: string; scheduled_at: string | null }[])
    .map((p) => `- [${p.id.slice(0, 8)}] ${p.status} · ${p.rubrique}${p.scheduled_at ? ` · ${p.scheduled_at.slice(0, 16).replace("T", " ")}` : ""} : ${coupe(p.title, 110)}`).join("\n") || "(rien)";
}
async function lireCommentaires(): Promise<string> {
  const { data } = await db().from("cm_journal").select("created_at,canal,auteur,texte,action,traite,ton").order("created_at", { ascending: false }).limit(20);
  return ((data ?? []) as { created_at: string; canal: string; auteur: string | null; texte: string | null; action: string; traite: boolean; ton: string | null }[])
    .map((c) => `- ${c.created_at.slice(5, 16).replace("T", " ")} · ${c.canal} · ${c.auteur ?? "?"}${c.ton ? ` (${c.ton})` : ""} : « ${coupe(c.texte, 160)} » → ${c.action}${c.traite ? "" : " [à traiter]"}`).join("\n") || "(aucun)";
}
async function consulter(outils: Outil[], q: string): Promise<string> {
  const blocs = await Promise.all(outils.slice(0, 3).map(async (o) => {
    try {
      const t = o === "veille" ? await lireVeille(q) : o === "site" ? await lireSite(q) : o === "posts" ? await lirePosts(false, q) : o === "publies" ? await lirePosts(true, q) : await lireCommentaires();
      return `### ${o}\n${t}`;
    } catch (e) { return `### ${o}\n(indisponible : ${(e as Error).message.slice(0, 100)})`; }
  }));
  return blocs.join("\n\n");
}

type Decision = { reponse: string; action?: "aucune" | "brouillon" | "brief" | "stats" | "prochains" | "pause" | "reprendre" | "publier"; sujet?: string; url?: string; id?: string };

export async function discuter(texte: string, chat: string) {
  await tg("sendChatAction", { chat_id: chat, action: "typing" }).catch(() => null);
  const hist = await memoire();
  const fil = hist.map((h) => `${h.r === "u" ? "Elle" : "Toi"} : ${h.t}`).join("\n") || "(début)";
  // 1) De quoi a-t-il besoin pour répondre ?
  let donnees = "";
  try {
    const choix = await aiJson<{ outils?: Outil[]; recherche?: string }>(
      `Tu prépares la réponse de l'assistant TUVOA. Choisis ce qu'il faut consulter (0 à 3 éléments) parmi :
"veille" (actualités tech récentes des sources suivies), "site" (articles publiés sur le site TUVOA), "posts" (brouillons, posts à valider, programmés ou en erreur), "publies" (posts déjà publiés), "commentaires" (commentaires et messages reçus sur la Page Facebook).
Donne aussi des mots-clés de recherche courts si utile.`,
      `Historique :\n${fil}\n\nMessage : ${texte}\n\nJSON : {"outils": [...], "recherche": "..."}`,
      200,
    );
    const outils = (choix.outils ?? []).filter((o): o is Outil => ["veille", "site", "posts", "publies", "commentaires"].includes(o));
    if (outils.length) donnees = await consulter(outils, (choix.recherche ?? "").trim());
  } catch { /* on répond sans données */ }
  let d: Decision;
  try {
    d = await aiJson<Decision>(
      `Tu es l'assistant de TUVOA Tech Media (média tech, Burkina Faso), sur Telegram. Tu parles à l'administratrice, en français, ton direct et professionnel, réponses courtes.
Tu peux déclencher UNE action :
- "brouillon" : préparer un post sur un sujet (mets le sujet précis dans "sujet" ; s'il s'agit d'un article de la veille ou du site, mets aussi son lien dans "url") ;
- "brief" (le point du jour), "stats" (bilan 7 jours), "prochains" (posts programmés) ;
- "pause" / "reprendre" : couper ou relancer le pilote automatique (seulement si c'est clairement demandé) ;
- "publier" : publier un brouillon existant (mets son identifiant court dans "id") — seulement si elle le demande explicitement ;
- "aucune" : simple réponse.
Tu as accès aux données de la plateforme ci-dessous (veille, site, posts, commentaires) : appuie-toi uniquement dessus pour les faits, cite les titres et donne les liens utiles. N'invente jamais de chiffres ni de faits ; si l'information n'y est pas, dis-le. Si une demande est floue, pose une question courte.
Posts en attente ou programmés :
${await contexte()}
${donnees ? `\nDonnées consultées :\n${donnees}` : ""}`,
      `Historique récent :\n${fil}\n\nMessage : ${texte}\n\nRéponds en JSON : {"reponse": "...", "action": "...", "sujet": "...", "url": "...", "id": "..."}`,
      1200,
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
        if (d.sujet) { if (d.reponse) await tg("sendMessage", { chat_id: chat, text: d.reponse }); await retenir([...hist, { r: "u", t: texte }, { r: "a", t: d.reponse }]); return void (await brouillon(d.sujet, chat, d.url)); }
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

async function brouillon(sujet: string, chat: string, url?: string) {
  await tg("sendChatAction", { chat_id: chat, action: "typing" }).catch(() => null);
  const article = url && /^https?:\/\//.test(url) ? await fetchArticle(url).catch(() => null) : null;
  const g = await generatePost(article ? { rubrique: "actu", idea: sujet, format: "resume", sourceUrl: url, articleTitle: sujet, articleText: article.text } : { rubrique: "actu", idea: sujet });
  const post = emptyPost({
    rubrique: "actu", idea: sujet, title: g.wp_title || g.visuel_titre || sujet.slice(0, 90), origin: "manuel",
    platforms: ["facebook", "linkedin"],
    texts: { facebook: g.facebook, linkedin: g.linkedin, tiktok: g.tiktok, wp_title: g.wp_title, wp_body: g.wp_body, wp_excerpt: g.wp_excerpt },
    source_url: article ? url ?? null : null,
    visual: { titre: g.visuel_titre || "Actu tech", texte: g.visuel_texte || sujet, ...(article?.image ? { image: article.image } : {}) },
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
