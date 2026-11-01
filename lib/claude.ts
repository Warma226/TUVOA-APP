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
  articleSummary?: string;
  categorie?: string; // thème détecté par la veille (bandeau du visuel #ActuTech)
  // Pour les portraits : infos fournies et validées par la personne
  portrait?: { nom: string; specialite: string; infos: string };
};

export type RewriteAction = "raccourcir" | "reformuler" | "expliquer" | "ton" | "traduire";

// Deux fournisseurs possibles : Claude (ANTHROPIC_API_KEY, payant à l'usage)
// ou Google Gemini (GEMINI_API_KEY, offre gratuite avec quotas). Claude est utilisé s'il est configuré.
export function aiProvider(): "claude" | "gemini" | null {
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}
export function aiConfigured(): boolean {
  return aiProvider() !== null;
}

async function callAnthropic(key: string, system: string, user: string, maxTokens: number): Promise<string> {
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

// Modèles essayés dans l'ordre. Flash donne les textes les plus soignés ; sa réflexion préalable (plus de
// jetons que le texte lui-même) est coupée (thinkingBudget 0) pour répondre en quelques secondes.
// Le modèle « lite », sans réflexion lui aussi, sert de secours rapide, car l'offre
// gratuite renvoie souvent « surchargé » (503) ou « quota atteint » (429) sur un modèle alors qu'un autre répond.
type GeminiTry = { model: string; noThinking?: boolean };
function geminiModels(): GeminiTry[] {
  const list: GeminiTry[] = [
    ...(process.env.GEMINI_MODEL ? [{ model: process.env.GEMINI_MODEL }] : []),
    { model: "gemini-flash-latest", noThinking: true },
    { model: "gemini-flash-lite-latest" },
    { model: "gemini-3.5-flash-lite" },
    { model: "gemini-flash-latest" },
  ];
  return list;
}

async function callGemini(key: string, system: string, user: string, maxTokens: number, json = false): Promise<string> {
  let lastStatus = 0;
  let lastDetail = "";
  for (const { model, noThinking } of geminiModels()) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        // Marge large : les modèles Gemini récents réfléchissent avant de répondre et ces jetons comptent aussi.
        generationConfig: {
          maxOutputTokens: Math.max(maxTokens * 4, 8192),
          temperature: 0.7,
          ...(json ? { responseMimeType: "application/json" } : {}),
          ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      const text = (data.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
      if (text.trim() && (!json || parsable(text))) return text;
      lastStatus = 200;
      lastDetail = text.trim() ? "réponse illisible" : "réponse vide";
      continue;
    }
    lastStatus = res.status;
    lastDetail = (await res.text()).slice(0, 300);
    // Surcharge, quota ou modèle indisponible : on passe au modèle suivant.
    // 400 : réglage non accepté par ce modèle (ex. réflexion coupée) → on essaie le suivant.
    if ([400, 429, 500, 503, 404].includes(res.status)) continue;
    break;
  }
  if (lastStatus === 429) throw new Error("Quota gratuit de Gemini atteint pour le moment : réessaie dans une minute (ou demain si c'est le quota du jour).");
  if (lastStatus === 503 || lastStatus === 500) throw new Error("Gemini est surchargé en ce moment : réessaie dans quelques minutes.");
  throw new Error(`Erreur de l'IA Gemini (${lastStatus}) : ${lastDetail}`);
}

async function callClaude(system: string, user: string, maxTokens = 2500, json = false): Promise<string> {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) return callAnthropic(anthropic, system, user, maxTokens);
  const gemini = process.env.GEMINI_API_KEY;
  if (gemini) return callGemini(gemini, system, user, maxTokens, json);
  throw new Error("Ajoute GEMINI_API_KEY (gratuit) ou ANTHROPIC_API_KEY dans Vercel pour activer la rédaction par l'IA.");
}

// Retours à la ligne bruts dans les chaînes : erreur fréquente des modèles, on les échappe.
function escapeRawNewlines(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      else if (ch === "\n") { out += "\\n"; continue; }
      else if (ch === "\r") continue;
      else if (ch === "\t") { out += "\\t"; continue; }
    } else if (ch === '"') inStr = true;
    out += ch;
  }
  return out;
}

function tryParse<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  const raw = text.slice(start, end + 1);
  for (const candidate of [raw, escapeRawNewlines(raw), escapeRawNewlines(raw).replace(/,\s*([}\]])/g, "$1")]) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* essai suivant */
    }
  }
  return null;
}

function parsable(text: string): boolean {
  return tryParse(text) !== null;
}

function extractJson<T>(text: string): T {
  const v = tryParse<T>(text);
  if (v === null) throw new Error("Réponse de l'IA illisible. Réessaie.");
  return v;
}

export async function generatePost(input: GenerateInput): Promise<Generated> {
  const rub = RUBRIQUES.find((r) => r.id === input.rubrique) ?? RUBRIQUES[0];
  const consignesRubrique: Record<RubriqueId, string> = {
    actu: "Rubrique #ActuTech : résume l'information de façon factuelle (faits, chiffres, contexte, portée), cite la source. visuel_titre = la catégorie en 1 ou 2 mots (Cybersécurité, IA, Smartphones, Startups, Télécoms, Numérique…), visuel_texte = l'info en 1 ou 2 phrases (35 mots maximum).",
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
  if (input.categorie) parts.push(`Thème détecté par la veille : ${input.categorie}`);
  if (input.sourceName) parts.push(`Source à citer : ${input.sourceName}${input.sourceUrl ? ` (${input.sourceUrl})` : ""}`);
  if (input.articleText) parts.push(`Texte de l'article (pour comprendre, ne jamais recopier) :\n"""\n${input.articleText.slice(0, 10000)}\n"""`);
  if (input.portrait) parts.push(`Infos fournies par l'expert : nom ${input.portrait.nom}, spécialité ${input.portrait.specialite}. ${input.portrait.infos}`);
  parts.push("Tous les textes (accroches, posts, article, visuel) doivent être rédigés en français.");
  parts.push(`Réponds uniquement avec un objet JSON valide, sans texte autour, de la forme :
{
  "variantes": ["accroche directe", "accroche pédagogique", "accroche sous forme de question"],
  "facebook": "post Facebook complet (résumé factuel, 3 à 5 phrases, chute sobre, 2 à 4 hashtags dont ${rub.hashtag}, source citée)",
  "linkedin": "post LinkedIn complet (ton professionnel, phrases aérées, 3 hashtags, source citée)",
  "tiktok": "légende TikTok de 150 caractères maximum",
  "wp_title": "titre d'article WordPress",
  "wp_body": "article WordPress en HTML simple (<p>, <h2>, <ul>, <li>, <strong>), 300 à 600 mots, terminé par un paragraphe 'Source :' avec le lien",
  "visuel_titre": "titre court pour le visuel",
  "visuel_texte": "texte court pour le visuel (40 mots maximum)"
}`);

  const text = await callClaude(STYLE_GUIDE, parts.join("\n\n"), 4000, true);
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
    ton: "Réécris ce texte dans le ton TUVOA : neutre, factuel, rigoureux, à la troisième personne, sans tutoiement ni familiarité.",
    traduire: "Réécris ce texte entièrement en bon français (traduis tout passage dans une autre langue), même sens, même ton.",
  };
  const out = await callClaude(
    STYLE_GUIDE,
    `${consignes[action]} Plateforme : ${platform}. Réponds uniquement avec le nouveau texte, sans guillemets ni commentaire.\n\nTexte :\n${text}`,
    1500
  );
  return out.trim();
}

// Brouillon sans IA (quand aucune clé d'IA n'est configurée) : structure prête à compléter,
// construite uniquement à partir du titre, de l'idée et de la source. Rien n'est recopié de l'article.
export function draftWithoutAI(input: GenerateInput): Generated {
  const rub = RUBRIQUES.find((r) => r.id === input.rubrique) ?? RUBRIQUES[0];
  const source = input.sourceName ? `Source : ${input.sourceName}` : "";
  const lien = input.sourceUrl ? `\n${input.sourceUrl}` : "";
  if (input.rubrique === "portrait" && input.portrait) {
    const { nom, specialite, infos } = input.portrait;
    const base = `${nom}, ${specialite}.${infos ? `\n\n${infos}` : ""}`;
    return {
      variantes: [`Portrait : ${nom}`, `${nom}, ${specialite}`, `Qui est ${nom} ?`],
      facebook: `${base}\n\n#Portrait #ExpertsTech #TUVOA`,
      linkedin: `Portrait d'expert : ${base}\n\n#Portrait #ExpertsTech #TUVOA`,
      tiktok: `Portrait : ${nom}, ${specialite}`.slice(0, 150),
      wp_title: `Portrait : ${nom}, ${specialite}`,
      wp_body: `<p>${base.replace(/\n\n/g, "</p><p>")}</p>`,
      visuel_titre: nom,
      visuel_texte: specialite,
    };
  }
  if (input.rubrique === "cyberbase") {
    const notion = (input.idea || "Notion").trim();
    const a_completer = "[Définition en 2 phrases simples, avec un exemple du quotidien.]";
    return {
      variantes: [`${notion} : la notion à connaître`, `${notion}, expliqué simplement`, `C'est quoi, ${notion} ?`],
      facebook: `#CyberBase · ${notion}\n\n${a_completer}\n\n#CyberBase #Tech #TUVOA`,
      linkedin: `#CyberBase · ${notion}\n\n${a_completer}\n\n#CyberBase #Cybersécurité #TUVOA`,
      tiktok: `${notion}, expliqué en 30 secondes #CyberBase`.slice(0, 150),
      wp_title: `${notion} : comprendre la notion simplement`,
      wp_body: `<p>${a_completer}</p>`,
      visuel_titre: notion,
      visuel_texte: a_completer,
    };
  }
  const titre = (input.articleTitle || input.idea || "Actualité tech").trim();
  const angle = input.idea && input.articleTitle ? `\n\n${input.idea}` : "";
  const a_completer = "[Résumé de l’information en 2 ou 3 phrases.]";
  return {
    variantes: [titre, `Ce qu'il faut retenir : ${titre}`, `${titre} : les enjeux`],
    facebook: `${titre}${angle}\n\n${a_completer}\n\n${source}${lien}\n\n${rub.hashtag} #Tech #TUVOA`.trim(),
    linkedin: `${titre}${angle}\n\n${a_completer}\n\n${source}${lien}\n\n${rub.hashtag} #Tech #Innovation`.trim(),
    tiktok: `${titre} ${rub.hashtag}`.slice(0, 150),
    wp_title: titre,
    wp_body: `<p>${a_completer}</p>`,
    visuel_titre: input.categorie || "Actu tech",
    visuel_texte: titre,
  };
}
