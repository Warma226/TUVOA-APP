// Rédaction des posts avec Claude (API Messages d'Anthropic).
import { STYLE_GUIDE, RUBRIQUES, type RubriqueId, type TriggerFormat } from "./config";

export type Generated = {
  variantes: string[];
  facebook: string;
  linkedin: string;
  tiktok: string;
  wp_title: string;
  wp_body: string;
  visuel_titre: string;
  visuel_texte: string;
};

export type GenerateInput = {
  rubrique: RubriqueId;
  idea: string;
  format?: TriggerFormat;
  sourceName?: string | null;
  sourceUrl?: string | null;
  articleTitle?: string;
  articleText?: string;
  // Pour les portraits : infos fournies et validées par la personne
  portrait?: { nom: string; specialite: string; infos: string };
};

export type RewriteAction = "raccourcir" | "reformuler" | "expliquer" | "ton" | "traduire";

async function callClaude(system: string, user: string, maxTokens = 2500): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Ajoute ANTHROPIC_API_KEY dans Vercel pour activer la rédaction par l'IA.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Erreur de l'IA (${res.status}) : ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
}

function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Réponse de l'IA illisible. Réessaie.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function generatePost(input: GenerateInput): Promise<Generated> {
  const rub = RUBRIQUES.find((r) => r.id === input.rubrique) ?? RUBRIQUES[0];
  const consignesRubrique: Record<RubriqueId, string> = {
    actu: "Rubrique #ActuTech : résume l'actualité, dis pourquoi c'est important pour le lecteur, cite la source.",
    cyberbase:
      "Rubrique #CyberBase (comprendre les notions basiques de la tech) : définis la notion en 2 courts paragraphes, simples et concrets, avec un exemple du quotidien. visuel_titre = le nom de la notion (2 à 4 mots), visuel_texte = la définition (2 paragraphes, 60 mots maximum au total).",
    portrait:
      "Rubrique #Portrait (experts tech) : présente la personne uniquement à partir des infos fournies, sans rien inventer. visuel_titre = son nom, visuel_texte = sa spécialité en une ligne.",
  };
  const format =
    input.format === "explication"
      ? "Privilégie l'explication : ce que ça veut dire concrètement et ce que le lecteur doit faire."
      : input.format === "les-deux"
        ? "Fais un résumé puis une explication simple."
        : "Privilégie un résumé clair.";

  const parts: string[] = [];
  parts.push(`Rubrique : ${rub.label} (${rub.hashtag}).`, consignesRubrique[rub.id], format);
  if (input.idea) parts.push(`Idée ou angle donné par l'éditeur : ${input.idea}`);
  if (input.articleTitle) parts.push(`Titre de l'article source : ${input.articleTitle}`);
  if (input.sourceName) parts.push(`Source à citer : ${input.sourceName}${input.sourceUrl ? ` (${input.sourceUrl})` : ""}`);
  if (input.articleText) parts.push(`Texte de l'article (pour comprendre, ne jamais recopier) :\n"""\n${input.articleText.slice(0, 10000)}\n"""`);
  if (input.portrait) parts.push(`Infos fournies par l'expert : nom ${input.portrait.nom}, spécialité ${input.portrait.specialite}. ${input.portrait.infos}`);
  parts.push(`Réponds uniquement avec un objet JSON valide, sans texte autour, de la forme :
{
  "variantes": ["accroche 1", "accroche 2", "accroche 3"],
  "facebook": "post Facebook complet (ton direct, 2 à 5 phrases, 2 à 4 hashtags dont ${rub.hashtag}, source citée)",
  "linkedin": "post LinkedIn complet (ton professionnel, phrases aérées, 3 hashtags, source citée)",
  "tiktok": "légende TikTok de 150 caractères maximum",
  "wp_title": "titre d'article WordPress",
  "wp_body": "article WordPress en HTML simple (<p>, <h2>, <ul>, <li>, <strong>), 300 à 600 mots, terminé par un paragraphe 'Source :' avec le lien",
  "visuel_titre": "titre court pour le visuel",
  "visuel_texte": "texte court pour le visuel (40 mots maximum)"
}`);

  const text = await callClaude(STYLE_GUIDE, parts.join("\n\n"), 4000);
  const g = extractJson<Partial<Generated>>(text);
  return {
    variantes: Array.isArray(g.variantes) ? g.variantes.slice(0, 3).map(String) : [],
    facebook: String(g.facebook ?? ""),
    linkedin: String(g.linkedin ?? ""),
    tiktok: String(g.tiktok ?? "").slice(0, 150),
    wp_title: String(g.wp_title ?? ""),
    wp_body: String(g.wp_body ?? ""),
    visuel_titre: String(g.visuel_titre ?? ""),
    visuel_texte: String(g.visuel_texte ?? ""),
  };
}

export async function rewrite(action: RewriteAction, text: string, platform: string): Promise<string> {
  const consignes: Record<RewriteAction, string> = {
    raccourcir: "Raccourcis ce texte de moitié en gardant l'essentiel et la source.",
    reformuler: "Reformule ce texte avec une autre accroche, même sens, même longueur.",
    expliquer: "Ajoute une explication très simple de ce que ça change concrètement pour le lecteur.",
    ton: "Réécris ce texte dans le ton TUVOA (direct, tutoiement, clair).",
    traduire: "Traduis ce texte en anglais, même ton.",
  };
  const out = await callClaude(
    STYLE_GUIDE,
    `${consignes[action]} Plateforme : ${platform}. Réponds uniquement avec le nouveau texte, sans guillemets ni commentaire.\n\nTexte :\n${text}`,
    1500
  );
  return out.trim();
}
