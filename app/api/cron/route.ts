// Tâche planifiée (appelée toutes les 15 min par Supabase pg_cron) :
// 1. autopilote : choisit la meilleure actu, la rédige et la planifie ; 2. publie les posts planifiés arrivés à échéance.
import { NextResponse } from "next/server";
import { fetchVeille, fetchArticleText, similar } from "@/lib/veille";
import { generatePost, aiConfigured } from "@/lib/claude";
import { publishPost, connectionStatus } from "@/lib/publish";
import { GUARDRAILS, TOPICS, allSources, allTriggers, isOn, type Platform } from "@/lib/config";
import { getSettings, filterUnseen, markSeen, savePost, emptyPost, duePosts, countAutoToday, recentAutoPosts } from "@/lib/store";

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
      : hour < GUARDRAILS.autoStartHour || hour >= GUARDRAILS.autoEndHour ? `hors plage horaire (${GUARDRAILS.autoStartHour} h – ${GUARDRAILS.autoEndHour} h)`
      : autoToday >= GUARDRAILS.maxAutoPerDay ? "plafond du jour atteint"
      : pending ? "une publication automatique est déjà en attente"
      : Date.now() - last < GUARDRAILS.minGapMinutes * 60000 ? `prochaine publication dans ${Math.ceil((GUARDRAILS.minGapMinutes * 60000 - (Date.now() - last)) / 60000)} min`
      : "";

    if (why) {
      log.push(`Autopilote en attente : ${why}.`);
    } else {
      const { items, errors } = await fetchVeille(sources, triggers);
      errors.forEach((e) => log.push(e));
      // Actus fraîches (moins de 24 h), sur un thème suivi, sans sujet sensible ni doublon d'un post récent.
      const fresh = items.filter(
        (it) =>
          !it.blocked &&
          (!it.publishedAt || Date.now() - new Date(it.publishedAt).getTime() < 24 * 3.6e6) &&
          (it.triggers.length > 0 || it.topics.some((t) => (TOPICS.find((x) => x.id === t)?.poids ?? 0) > 0)) &&
          it.score >= GUARDRAILS.minAutoScore &&
          !recent.some((p) => p.source_url === it.url || similar(p.title, it.title))
      );
      const unseen = await filterUnseen(fresh.map((c) => c.url));
      const candidates = fresh.filter((it) => unseen.has(it.url)).sort((a, b) => b.score - a.score);
      if (candidates.length === 0) log.push("Autopilote : aucune actu assez pertinente pour l'instant.");

      let tries = 0;
      for (const item of candidates) {
        if (tries >= GUARDRAILS.maxGenerationsPerRun) break;
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
          const articleText = await fetchArticleText(item.url);
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
          const hook = g.variantes[0];
          const post = emptyPost({
            rubrique: "actu",
            title: item.title,
            origin: "veille",
            trigger_id: trigger?.id ?? null,
            source_name: item.sourceName,
            source_url: item.url,
            platforms,
            texts: {
              facebook: hook && !g.facebook.startsWith(hook) ? `${hook}\n\n${g.facebook}` : g.facebook,
              linkedin: g.linkedin,
              tiktok: g.tiktok,
              wp_title: g.wp_title,
              wp_body: g.wp_body,
            },
            visual: { titre: g.visuel_titre || TOPICS.find((t) => t.id === item.topics[0])?.label || "Actu tech", texte: g.visuel_texte || item.title },
            status: "planifie",
            auto: true,
            scheduled_at: new Date(Date.now() + GUARDRAILS.delayMinutes * 60000).toISOString(),
          });
          await savePost(post);
          await markSeen([item.url]);
          log.push(`Autopilote : « ${item.title} » publié dans ${GUARDRAILS.delayMinutes} min (${platforms.join(", ")}).`);
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

  // ─── 2. Publication des posts arrivés à échéance ─────────────────
  for (const post of await duePosts()) {
    const done = await publishPost(post);
    await savePost(done);
    log.push(`${done.status === "publie" ? "Publié" : "Erreur de publication"} : ${post.title || post.visual.titre}`);
  }

  return NextResponse.json({ ok: true, log, at: new Date().toISOString() });
}
