// Veille : lecture des flux RSS, filtrage selon la ligne éditoriale, regroupement des doublons.
import Parser from "rss-parser";
import { SOURCES, TOPICS, TRIGGERS, GUARDRAILS, type Trigger } from "./config";

export type VeilleItem = {
  id: string;
  url: string;
  title: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  lang: "fr" | "en";
  publishedAt: string | null;
  topics: string[];
  score: number; // pertinence 0-100 (heuristique)
  sameStoryCount: number; // nombre de sources différentes sur le même sujet
  triggers: string[]; // déclencheurs correspondants
  blocked: boolean; // sujet sensible : jamais en automatique
};

const parser = new Parser({ timeout: 12000, headers: { "User-Agent": "TUVOA-Veille/0.1 (+https://www.tuvoa.media)" } });

function clean(text: string | undefined): string {
  return (text ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8230;/g, "…")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
  );
}

function similar(a: string, b: string): boolean {
  const A = words(a);
  const B = words(b);
  if (A.size === 0 || B.size === 0) return false;
  let common = 0;
  A.forEach((w) => {
    if (B.has(w)) common++;
  });
  return common / Math.min(A.size, B.size) >= 0.5;
}

function matchTrigger(t: Trigger, item: { sourceId: string; text: string }): boolean {
  if (!t.sources.includes(item.sourceId)) return false;
  return t.keywords.some((k) => item.text.includes(k.toLowerCase()));
}

export async function fetchVeille(sourcesEnabled: Record<string, boolean>, triggersEnabled?: Record<string, boolean>): Promise<{ items: VeilleItem[]; errors: string[] }> {
  const active = SOURCES.filter((s) => s.feed && sourcesEnabled[s.id]);
  const errors: string[] = [];
  const raw: Omit<VeilleItem, "sameStoryCount">[] = [];

  const results = await Promise.allSettled(active.map((s) => parser.parseURL(s.feed as string).then((feed) => ({ s, feed }))));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      errors.push(`${active[i].name} : flux indisponible`);
      return;
    }
    const { s, feed } = r.value;
    for (const entry of (feed.items ?? []).slice(0, 25)) {
      const url = entry.link ?? "";
      if (!url) continue;
      const title = clean(entry.title);
      const summary = clean(entry.contentSnippet ?? entry.content ?? entry.summary).slice(0, 400);
      const text = ` ${title} ${summary} `.toLowerCase();
      if (s.filterKeywords && !s.filterKeywords.some((k) => text.includes(k))) continue;
      const topics = TOPICS.filter((t) => t.keywords.some((k) => text.includes(k))).map((t) => t.id);
      const triggers = TRIGGERS.filter((t) => (triggersEnabled ? triggersEnabled[t.id] : true) && matchTrigger(t, { sourceId: s.id, text })).map((t) => t.id);
      const blocked = GUARDRAILS.blockedKeywords.some((k) => text.includes(k));
      const ageH = entry.isoDate ? (Date.now() - new Date(entry.isoDate).getTime()) / 3.6e6 : 24;
      let score = 40 + topics.length * 15 + triggers.length * 20 - Math.min(30, Math.max(0, ageH - 6));
      score = Math.max(0, Math.min(100, Math.round(score)));
      raw.push({
        id: url,
        url,
        title,
        summary,
        sourceId: s.id,
        sourceName: s.name,
        lang: s.lang,
        publishedAt: entry.isoDate ?? null,
        topics,
        score,
        triggers,
        blocked,
      });
    }
  });

  // Regroupe les articles qui parlent du même sujet et compte les sources distinctes.
  const items: VeilleItem[] = raw.map((it) => {
    const sources = new Set(raw.filter((o) => similar(o.title, it.title)).map((o) => o.sourceId));
    const count = sources.size;
    return { ...it, sameStoryCount: count, score: Math.min(100, it.score + (count - 1) * 10) };
  });

  items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return { items, errors };
}

// Récupère le texte d'un article pour le résumer (le texte n'est jamais publié tel quel).
export async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TUVOA-Veille/0.1 (+https://www.tuvoa.media)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
    const paragraphs = Array.from(body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => clean(m[1]));
    return paragraphs.filter((p) => p.length > 60).join("\n").slice(0, 12000);
  } catch {
    return "";
  }
}
