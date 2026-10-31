// Tâche planifiée (appelée toutes les 15 min par GitHub Actions) :
// 1. lit la veille et applique les déclencheurs ; 2. publie les posts planifiés arrivés à échéance.
import { NextResponse } from "next/server";
import { fetchVeille, fetchArticleText } from "@/lib/veille";
import { generatePost, aiConfigured } from "@/lib/claude";
import { publishPost } from "@/lib/publish";
import { GUARDRAILS, RUBRIQUES, TOPICS, allSources, allTriggers, isOn } from "@/lib/config";
import { getSettings, filterUnseen, markSeen, savePost, emptyPost, duePosts, countAutoToday } from "@/lib/store";

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
  const settings = await getSettings();

  // ─── 1. Veille et déclencheurs ───────────────────────────────────
  if (aiConfigured()) {
    const triggers = allTriggers(settings.triggers).filter((t) => isOn(settings.triggersEnabled, t.id, t.enabledByDefault));
    const sources = allSources(settings.customSources).filter((x) => isOn(settings.sourcesEnabled, x.id, x.enabledByDefault));
    const { items, errors } = await fetchVeille(sources, triggers);
    errors.forEach((e) => log.push(e));
    const candidates = items.filter((it) => it.triggers.length > 0);
    const unseen = await filterUnseen(candidates.map((c) => c.url));
    let generated = 0;
    let autoToday = await countAutoToday();
    const seenNow: string[] = [];

    for (const item of candidates) {
      if (!unseen.has(item.url)) continue;
      const trigger = triggers.find((t) => t.id === item.triggers[0]);
      if (!trigger || item.score < trigger.minScore) {
        seenNow.push(item.url);
        continue;
      }
      if (generated >= GUARDRAILS.maxGenerationsPerRun) break;
      seenNow.push(item.url);
      try {
        const articleText = await fetchArticleText(item.url);
        const g = await generatePost({
          rubrique: "actu",
          idea: "",
          format: trigger.format,
          sourceName: item.sourceName,
          sourceUrl: item.url,
          articleTitle: item.title,
          articleText: articleText || item.summary,
          categorie: TOPICS.find((t) => t.id === item.topics[0])?.label,
        });
        generated++;

        const rubrique = RUBRIQUES.find((r) => r.id === "actu");
        const canAuto =
          settings.autopilot &&
          trigger.mode === "general" &&
          !rubrique?.alwaysManual &&
          !item.blocked &&
          item.sameStoryCount >= GUARDRAILS.minSourcesForAuto &&
          autoToday < GUARDRAILS.maxAutoPerDay;

        const post = emptyPost({
          rubrique: "actu",
          title: item.title,
          origin: "veille",
          trigger_id: trigger.id,
          source_name: item.sourceName,
          source_url: item.url,
          platforms: trigger.platforms,
          texts: { facebook: g.facebook, linkedin: g.linkedin, tiktok: g.tiktok, wp_title: g.wp_title, wp_body: g.wp_body },
          visual: { titre: g.visuel_titre || item.title, texte: g.visuel_texte },
          status: canAuto ? "planifie" : "a_valider",
          auto: canAuto,
          scheduled_at: canAuto ? new Date(Date.now() + GUARDRAILS.delayMinutes * 60000).toISOString() : null,
        });
        await savePost(post);
        if (canAuto) autoToday++;
        log.push(`${canAuto ? "Autopilote" : "À valider"} : ${item.title}`);
      } catch (e) {
        log.push(`Erreur sur « ${item.title} » : ${(e as Error).message}`);
      }
    }
    await markSeen(seenNow);
  } else {
    log.push("Veille automatique en pause : ajoute GEMINI_API_KEY (gratuit) ou ANTHROPIC_API_KEY dans Vercel.");
  }

  // ─── 2. Publication des posts arrivés à échéance ─────────────────
  for (const post of await duePosts()) {
    const done = await publishPost(post);
    await savePost(done);
    log.push(`${done.status === "publie" ? "Publié" : "Erreur de publication"} : ${post.title || post.visual.titre}`);
  }

  return NextResponse.json({ ok: true, log, at: new Date().toISOString() });
}
