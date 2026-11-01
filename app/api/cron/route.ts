// Tâche planifiée (appelée toutes les 15 min par Supabase pg_cron) :
// 1. autopilote : choisit la meilleure actu, la rédige et la planifie ; 2. publie les posts planifiés arrivés à échéance.
import { NextResponse } from "next/server";
import { fetchVeille, fetchArticle, similar } from "@/lib/veille";
import { generatePost, generateRecap, aiConfigured, sameStoryAs } from "@/lib/claude";
import { publishPost, connectionStatus } from "@/lib/publish";
import { GUARDRAILS, TOPICS, allSources, allTriggers, isOn, type Platform } from "@/lib/config";
import { getSettings, filterUnseen, markSeen, savePost, emptyPost, duePosts, countAutoToday, recentAutoPosts, recentPosts, postedUrls, publishedSince, recapExists } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  return header === `Bearer ${secret}` || key === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const log: string[] = [];
  const q = new URL(req.url).searchParams;
  try {
    if (q.get("recap") === "1") return NextResponse.json({ ok: true, log, recap: await weeklyRecap(log, { force: true, dry: q.get("dry") === "1" }) });
    return await run(log, { force: q.get("force") === "1", now: q.get("now") === "1" });
  } catch (e) {
    console.error("cron", e);
    return NextResponse.json({ ok: false, error: (e as Error).message, stack: (e as Error).stack?.split("\n").slice(0, 4), log }, { status: 500 });
  }
}

// force : ignore l'écart entre deux posts et la plage horaire ; now : publie tout de suite (sans délai d'annulation).
async function run(log: string[], opts: { force: boolean; now: boolean } = { force: false, now: false }) {
  const settings = await getSettings();

  // ─── 1. Veille : l'autopilote choisit et publie seul ─────────────
  if (aiConfigured()) {
    const triggers = allTriggers(settings.triggers).filter((t) => isOn(settings.triggersEnabled, t.id, t.enabledByDefault));
    const sources = allSources(settings.customSources).filter((x) => isOn(settings.sourcesEnabled, x.id, x.enabledByDefault));
    const conn = connectionStatus();
    const now = new Date();
    const hour = now.getUTCHours();
    const recent = await recentAutoPosts(48);
    const autoToday = await countAutoToday();
    const last = recent[0] ? new Date(recent[0].created_at).getTime() : 0;
    const pending = recent.some((p) => p.status === "planifie");

    const why =
      !settings.autopilot ? "autopilote coupé (Déclencheurs)"
      : opts.force ? ""
      : hour < GUARDRAILS.autoStartHour || hour >= GUARDRAILS.autoEndHour ? `hors plage horaire (${GUARDRAILS.autoStartHour} h – ${GUARDRAILS.autoEndHour} h)`
      : autoToday >= GUARDRAILS.maxAutoPerDay ? "plafond du jour atteint"
      : pending ? "une publication automatique est déjà en attente"
      : Date.now() - last < GUARDRAILS.minGapMinutes * 60000 ? `prochaine publication dans ${Math.ceil((GUARDRAILS.minGapMinutes * 60000 - (Date.now() - last)) / 60000)} min`
      : "";

    if (why) {
      log.push(`Autopilote en attente : ${why}.`);
    } else {
      const { items, errors } = await fetchVeille(sources, triggers);
      const already = await recentPosts(24 * 14);
      errors.forEach((e) => log.push(e));
      // Actus fraîches (moins de 24 h), sur un thème suivi, sans sujet sensible ni doublon d'un post récent.
      const fresh = items.filter(
        (it) =>
          !it.blocked &&
          (!it.publishedAt || Date.now() - new Date(it.publishedAt).getTime() < 24 * 3.6e6) &&
          (it.triggers.length > 0 || it.topics.some((t) => (TOPICS.find((x) => x.id === t)?.poids ?? 0) > 0)) &&
          it.score >= GUARDRAILS.minAutoScore &&
          !already.some((p) => p.source_url === it.url || similar(p.title ?? "", it.title))
      );
      const unseen = await filterUnseen(fresh.map((c) => c.url));
      const used = await postedUrls(fresh.map((c) => c.url));
      const candidates = fresh.filter((it) => unseen.has(it.url) && !used.has(it.url)).sort((a, b) => b.score - a.score);
      // Titres des 7 derniers jours, pour la vérification « même sujet » par l'IA.
      const weekTitles = already.filter((p) => Date.now() - new Date(p.created_at).getTime() < 7 * 24 * 3.6e6).map((p) => p.title).filter(Boolean);
      let checks = 0;
      if (candidates.length === 0) log.push("Autopilote : aucune actu assez pertinente pour l'instant.");

      let tries = 0;
      for (const item of candidates) {
        if (tries >= GUARDRAILS.maxGenerationsPerRun || checks >= 6) break;
        checks++;
        if (await sameStoryAs(item.title, item.summary, weekTitles)) {
          await markSeen([item.url]);
          log.push(`Ignorée (sujet déjà publié) : ${item.title}`);
          continue;
        }
        tries++;
        const trigger = triggers.find((t) => t.id === item.triggers[0]);
        // Canaux : ceux du déclencheur, sinon Facebook + LinkedIn ; uniquement les comptes connectés.
        const wanted: Platform[] = trigger?.platforms ?? ["facebook", "linkedin", "wordpress"];
        const platforms = wanted.filter((p) => conn[p].configured);
        if (platforms.length === 0) {
          log.push("Autopilote : aucun canal connecté.");
          break;
        }
        try {
          const article = await fetchArticle(item.url);
          const image = article.image || item.image;
          if (!image) {
            // Pas d'image publiable : on passe à l'actu suivante.
            await markSeen([item.url]);
            log.push(`Ignorée (pas d'image) : ${item.title}`);
            continue;
          }
          const articleText = article.text;
          const g = await generatePost({
            rubrique: "actu",
            idea: "",
            format: trigger?.format ?? "resume",
            sourceName: item.sourceName,
            sourceUrl: item.url,
            articleTitle: item.title,
            articleText: articleText || item.summary,
            categorie: TOPICS.find((t) => t.id === item.topics[0])?.label,
          });
          const post = emptyPost({
            rubrique: "actu",
            title: item.title,
            origin: "veille",
            trigger_id: trigger?.id ?? null,
            source_name: item.sourceName,
            source_url: item.url,
            platforms,
            texts: {
              facebook: g.facebook,
              linkedin: g.linkedin,
              tiktok: g.tiktok,
              wp_title: g.wp_title,
              wp_body: g.wp_body,
            },
            visual: { titre: g.visuel_titre || TOPICS.find((t) => t.id === item.topics[0])?.label || "Actu tech", texte: g.visuel_texte || item.title, image },
            status: "planifie",
            auto: true,
            scheduled_at: new Date(Date.now() + (opts.now ? 0 : GUARDRAILS.delayMinutes) * 60000).toISOString(),
          });
          await savePost(post);
          await markSeen([item.url]);
          log.push(`Autopilote : « ${item.title} » publié dans ${opts.now ? 0 : GUARDRAILS.delayMinutes} min (${platforms.join(", ")}).`);
          break; // un seul post par créneau
        } catch (e) {
          // Pas marquée comme vue : l'actu sera retentée au passage suivant.
          log.push(`Erreur sur « ${item.title} » : ${(e as Error).message}`);
        }
      }
    }
  } else {
    log.push("Veille automatique en pause : ajoute GEMINI_API_KEY (gratuit) ou ANTHROPIC_API_KEY dans Vercel.");
  }

  // ─── 1 bis. Récap tech du vendredi ───────────────────────────────
  if (aiConfigured() && settings.autopilot) await weeklyRecap(log, { force: false, dry: false });

  // ─── 2. Publication des posts arrivés à échéance ─────────────────
  for (const post of await duePosts()) {
    const done = await publishPost(post);
    await savePost(done);
    log.push(`${done.status === "publie" ? "Publié" : "Erreur de publication"} : ${post.title || post.visual.titre}`);
  }

  return NextResponse.json({ ok: true, log, at: new Date().toISOString() });
}

// Récap tech de la semaine : le vendredi à partir de 17 h, une seule fois par semaine.
async function weeklyRecap(log: string[], opts: { force: boolean; dry: boolean }) {
  const now = new Date();
  // Lundi 0 h (UTC) de la semaine en cours
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  if (!opts.force && (now.getUTCDay() !== GUARDRAILS.recapDay || now.getUTCHours() < GUARDRAILS.recapHour || now.getUTCHours() >= GUARDRAILS.autoEndHour)) return null;
  if (!opts.dry && (await recapExists(monday.toISOString()))) return null;
  const week = (await publishedSince(monday.toISOString())).filter((p) => p.rubrique === "actu" && p.origin !== "recap");
  if (week.length < (opts.dry ? 1 : GUARDRAILS.recapMinPosts)) {
    log.push(`Récap de la semaine : pas assez d'actus publiées (${week.length}).`);
    return null;
  }
  const conn = connectionStatus();
  const platforms = (["facebook", "linkedin"] as Platform[]).filter((p) => conn[p].configured);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
  const periode = `semaine du ${fmt(monday)} au ${fmt(now)}`;
  try {
    const r = await generateRecap(
      week.map((p) => ({ title: p.title, text: p.texts.facebook || p.texts.linkedin, source: p.source_name })),
      periode
    );
    // Image : celle de l'actu la plus récente qui en a une (sujet de tête de la semaine).
    const image = [...week].reverse().find((p) => p.visual.image)?.visual.image;
    if (opts.dry) return { ...r, image, platforms, posts: week.length };
    if (!image || platforms.length === 0) {
      log.push("Récap de la semaine : pas d'image ou aucun canal connecté.");
      return null;
    }
    const post = emptyPost({
      rubrique: "actu",
      title: `Récap tech · ${periode}`,
      origin: "recap",
      platforms,
      texts: { facebook: r.facebook, linkedin: r.linkedin, tiktok: "Le récap tech de la semaine #RécapTech", wp_title: r.titre, wp_body: "" },
      visual: { titre: "Récap de la semaine", texte: r.titre, image },
      status: "planifie",
      auto: false,
      scheduled_at: new Date(Date.now() + GUARDRAILS.delayMinutes * 60000).toISOString(),
    });
    await savePost(post);
    log.push(`Récap de la semaine planifié (${week.length} actus).`);
    return { ...r, image };
  } catch (e) {
    log.push(`Récap de la semaine : ${(e as Error).message}`);
    return null;
  }
}
