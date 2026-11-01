// Rédaction des posts avec Claude (API Messages d'Anthropic).
import { STYLE_GUIDE, RUBRIQUES, type RubriqueId, type TriggerFormat } from "./config";
import { convertirTout } from "./devises";

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

// Mise en forme lisible des posts réseaux : paragraphes courts séparés par une ligne vide,
// puis une ligne vide, la source, une ligne vide, les hashtags.
export function formatSocial(text: string): string {
  let t = text.replace(/\r/g, "").trim();
  // Hashtags en fin de texte
  const tagMatch = t.match(/(?:\s*#[\p{L}\p{N}_]+)+\s*$/u);
  let tags = "";
  if (tagMatch) {
    tags = tagMatch[0].trim().split(/\s+/).join(" ");
    t = t.slice(0, tagMatch.index).trim();
  }
  // Mention de la source (où qu'elle soit en fin de texte)
  let source = "";
  const srcMatch = t.match(/(?:^|\s)(\(?\s*(?:Sources?\s*:|Info relayée par)[^\n]*\)?)\s*$/i);
  if (srcMatch && srcMatch.index !== undefined) {
    source = srcMatch[1].replace(/^\(\s*|\s*\)$/g, "").trim().replace(/^Sources?\s*:?\s*/i, "Source : ").replace(/^Info relayée par\s*/i, "Source : ");
    t = t.slice(0, srcMatch.index).trim();
  }
  // Corps : si tout est en un bloc, on regroupe les phrases deux par deux.
  let paras = t.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  if (paras.length === 1) {
    const sentences = paras[0].match(/[^.!?…]+(?:[.!?…]+|$)(?:\s+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [paras[0]];
    if (sentences.length > 2) {
      paras = [];
      // La dernière phrase (la chute) a son propre paragraphe.
      const corps = sentences.slice(0, -1);
      for (let i = 0; i < corps.length; i += 2) paras.push(corps.slice(i, i + 2).join(" "));
      paras.push(sentences[sentences.length - 1]);
    }
  }
  return [paras.join("\n\n"), source, tags].filter(Boolean).join("\n\n");
}

// Vérifie avec l'IA si une actu raconte le même fait qu'un post déjà publié (titres différents, autre langue…).
export async function sameStoryAs(title: string, summary: string, recentTitles: string[]): Promise<boolean> {
  if (recentTitles.length === 0 || !aiConfigured()) return false;
  try {
    const out = await callClaude(
      "Tu compares des actualités. Réponds uniquement en JSON.",
      `Nouvelle actu : « ${title} » — ${summary.slice(0, 300)}\n\nSujets déjà publiés :\n${recentTitles.slice(0, 40).map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nCette nouvelle actu porte-t-elle sur le même fait ou le même événement qu'un des sujets déjà publiés (même s'il est formulé autrement ou dans une autre langue) ? Réponds {"meme_sujet": true} ou {"meme_sujet": false}.`,
      200,
      true
    );
    return extractJson<{ meme_sujet?: boolean }>(out).meme_sujet === true;
  } catch {
    return false;
  }
}

// ─── Récap tech de la semaine ──────────────────────────────────────
export type RecapItem = { title: string; text: string; source: string | null };

export async function generateRecap(items: RecapItem[], periode: string): Promise<{ facebook: string; linkedin: string; titre: string }> {
  const liste = items
    .map((it, i) => `${i + 1}. ${it.title}\n${it.text.replace(/#\S+/g, "").slice(0, 700)}\nSource : ${it.source ?? "?"}`)
    .join("\n\n");
  const out = await callClaude(
    STYLE_GUIDE,
    `Rédige le « Récap tech de la semaine » de TUVOA (${periode}) à partir des posts publiés cette semaine, ci-dessous.
Sélectionne les 5 sujets les plus importants pour le public africain francophone (moins s'il y en a moins), du plus important au moins important.
Ne rien inventer : n'utilise que les informations des posts.

Posts de la semaine :
${liste}

Réponds uniquement avec un objet JSON :
{
  "intro": "une phrase d'introduction sobre",
  "points": ["un point par sujet : une seule phrase factuelle (25 mots maximum), sans puce ni numéro"],
  "chute": "une phrase de chute sobre qui met la semaine en perspective",
  "titre": "titre court du récap (5 mots maximum)"
}
Montants : écris-les sous la forme [[MONTANT:valeur numérique complète:code ISO]] (ex. [[MONTANT:6430000000:USD]]).`,
    2000,
    true
  );
  const g = extractJson<{ intro?: string; points?: string[]; chute?: string; titre?: string }>(out);
  const points = await Promise.all((g.points ?? []).filter(Boolean).slice(0, 5).map((p) => convertirTout(String(p).trim())));
  if (points.length === 0) throw new Error("Récap vide");
  const sources = Array.from(new Set(items.map((i) => i.source).filter(Boolean))).join(", ");
  const corps = [
    "Le récap tech de la semaine",
    await convertirTout(String(g.intro ?? "").trim()),
    points.map((p) => `• ${p}`).join("\n\n"),
    await convertirTout(String(g.chute ?? "").trim()),
    sources ? `Sources : ${sources}` : "",
  ].filter(Boolean);
  return {
    facebook: [...corps, "#RécapTech #ActuTech #TUVOA"].join("\n\n"),
    linkedin: [...corps, "#RécapTech #Tech #Afrique"].join("\n\n"),
    titre: String(g.titre ?? "Récap tech de la semaine"),
  };
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
  parts.push(
    "Montants : écris CHAQUE montant en devise (dollars, euros, etc.) uniquement sous la forme [[MONTANT:valeur numérique complète:code ISO]], par exemple [[MONTANT:6430000000:USD]] pour 6,43 milliards de dollars ou [[MONTANT:1500000:EUR]] pour 1,5 million d'euros. L'application l'écrira en toutes lettres avec sa conversion en FCFA : n'écris jamais toi-même la conversion."
  );
  parts.push(
    "Mise en forme des posts Facebook et LinkedIn (\\n dans le JSON) : paragraphes courts de 1 ou 2 phrases séparés par une ligne vide ; la chute dans son propre paragraphe ; puis une ligne vide et « Source : nom du média » seule sur sa ligne ; puis une ligne vide et les hashtags sur la dernière ligne. Jamais tout le texte en un seul bloc."
  );
  parts.push(`Réponds uniquement avec un objet JSON valide, sans texte autour, de la forme :
{
  "variantes": ["accroche directe", "accroche pédagogique", "accroche sous forme de question"],
  "facebook": "post Facebook complet (résumé factuel, 3 à 5 phrases, chute sobre, 2 à 4 hashtags dont ${rub.hashtag}, source citée)",
  "linkedin": "post LinkedIn complet (ton professionnel, 4 à 6 phrases, chute sobre, 3 hashtags, source citée)",
  "tiktok": "légende TikTok de 150 caractères maximum",
  "wp_title": "titre d'article WordPress",
  "wp_body": "article WordPress en HTML simple (<p>, <h2>, <ul>, <li>, <strong>), 300 à 600 mots, terminé par un paragraphe 'Source :' avec le lien",
  "visuel_titre": "titre court pour le visuel",
  "visuel_texte": "texte court pour le visuel (40 mots maximum)"
}`);

  const text = await callClaude(STYLE_GUIDE, parts.join("\n\n"), 4000, true);
  const g = extractJson<Partial<Generated>>(text);
  // Montants convertis en FCFA au taux du jour (« … dollars, soit environ … FCFA »).
  const cv = (v: unknown) => convertirTout(String(v ?? ""));
  const variantes = Array.isArray(g.variantes) ? await Promise.all(g.variantes.slice(0, 3).map(cv)) : [];
  return {
    variantes,
    facebook: formatSocial(await cv(g.facebook)),
    linkedin: formatSocial(await cv(g.linkedin)),
    tiktok: (await cv(g.tiktok)).slice(0, 150),
    wp_title: await cv(g.wp_title),
    wp_body: await cv(g.wp_body),
    visuel_titre: String(g.visuel_titre ?? ""),
    visuel_texte: await cv(g.visuel_texte),
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
  return convertirTout(out.trim());
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
