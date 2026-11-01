// Configuration éditoriale de TUVOA : sources, rubriques, déclencheurs, garde-fous.
// Modifie ce fichier pour ajouter une source ou un déclencheur.

export type Platform = "facebook" | "linkedin" | "tiktok" | "wordpress";
export const PLATFORMS: { id: Platform; label: string; limit: number }[] = [
  { id: "facebook", label: "Facebook", limit: 63206 },
  { id: "linkedin", label: "LinkedIn", limit: 3000 },
  { id: "tiktok", label: "TikTok", limit: 150 },
  { id: "wordpress", label: "WordPress", limit: 100000 },
];

export type RubriqueId = "actu" | "cyberbase" | "portrait";
// `heure` : rubrique publiée chaque jour à heure fixe (heure locale du téléphone).
export const RUBRIQUES: { id: RubriqueId; label: string; hashtag: string; description: string; alwaysManual: boolean; heure?: number }[] = [
  { id: "actu", label: "Actualité tech", hashtag: "#ActuTech", description: "Les infos du moment, résumées et sourcées.", alwaysManual: false },
  { id: "cyberbase", label: "CyberBase", hashtag: "#CyberBase", description: "Comprendre les notions basiques de la tech. Une notion chaque jour à 8 h.", alwaysManual: false, heure: 8 },
  { id: "portrait", label: "Portrait", hashtag: "#Portrait", description: "Les experts tech d'ici et d'ailleurs. Accord de la personne obligatoire.", alwaysManual: true },
];

export type Source = {
  id: string;
  name: string;
  domain: string;
  lang: "fr" | "en";
  theme: string;
  feed: string | null;
  enabledByDefault: boolean;
  // Si renseigné, seuls les articles contenant un de ces mots sont gardés.
  filterKeywords?: string[];
  note: string;
};

export const SOURCES: Source[] = [
  {
    id: "thehackernews",
    name: "The Hacker News",
    domain: "thehackernews.com",
    lang: "en",
    theme: "Cybersécurité",
    feed: "https://feeds.feedburner.com/TheHackersNews",
    enabledByDefault: true,
    note: "Résumé traduit en français.",
  },
  {
    id: "frandroid",
    name: "Frandroid",
    domain: "frandroid.com",
    lang: "fr",
    theme: "Smartphones · Tech",
    feed: "https://www.frandroid.com/feed",
    enabledByDefault: true,
    note: "Mobiles, Android, tests produits.",
  },
  {
    id: "techcrunch",
    name: "TechCrunch",
    domain: "techcrunch.com",
    lang: "en",
    theme: "Startups · IA",
    feed: "https://techcrunch.com/feed/",
    enabledByDefault: true,
    note: "Levées de fonds, IA. Résumé traduit.",
  },
  {
    id: "cybersecuritymag",
    name: "Cybersecurity Mag Africa",
    domain: "cybersecuritymag.africa",
    lang: "fr",
    theme: "Cybersécurité Afrique",
    feed: null,
    enabledByDefault: false,
    note: "Le site bloque la lecture automatique : à brancher via un flux RSS ou une newsletter s'ils en proposent.",
  },
  {
    id: "sikafinance",
    name: "Sikafinance",
    domain: "sikafinance.com",
    lang: "fr",
    theme: "Économie Afrique de l'Ouest",
    // Pas de flux RSS public : recherche Google Actualités limitée au site.
    feed: "https://news.google.com/rss/search?q=site:sikafinance.com&hl=fr&gl=FR&ceid=FR:fr",
    enabledByDefault: true,
    filterKeywords: ["télécom", "telecom", "fintech", "numérique", "digital", "mobile money", "orange", "mtn", "moov", "internet", "cyber", "startup", "technolog", "data", "ia "],
    note: "Site financier : seuls les sujets télécoms, fintech et numérique sont gardés.",
  },
];

// `poids` : points de pertinence ajoutés quand le thème est détecté (la veille classe les actus avec).
// Les annonces de nouveaux smartphones intéressent peu le public de TUVOA : elles ne sont pas mises en avant.
export const TOPICS: { id: string; label: string; keywords: string[]; poids: number }[] = [
  { id: "afrique", label: "Afrique & télécoms", poids: 25, keywords: ["afrique", "africa", "african", "sénégal", "senegal", "côte d'ivoire", "ivory coast", "burkina", "mali", "niger", "bénin", "togo", "ghana", "nigeria", "kenya", "cameroun", "uemoa", "cedeao", "orange money", "mobile money", "wave", "mtn", "moov", "airtel", "télécom", "telecom", "opérateur"] },
  { id: "cyber", label: "Cybersécurité", poids: 15, keywords: ["faille", "vulnérabilit", "vulnerability", "malware", "ransomware", "phishing", "arnaque", "scam", "hack", "cve-", "zero-day", "exploit", "cyber", "breach", "fuite"] },
  { id: "ia", label: "IA", poids: 15, keywords: ["intelligence artificielle", " ia ", "ai ", " ai,", "llm", "chatgpt", "openai", "anthropic", "claude", "gemini", "machine learning", "modèle"] },
  { id: "startups", label: "Startups", poids: 15, keywords: ["startup", "start-up", "levée", "raises", "funding", "series a", "series b", "seed", "fintech"] },
  { id: "smartphones", label: "Smartphones", poids: 0, keywords: ["android", "iphone", "ios", "smartphone", "samsung", "galaxy", "pixel", "xiaomi", "tecno", "infinix", "itel"] },
];

export type TriggerFormat = "resume" | "explication" | "les-deux";
export type TriggerMode = "general" | "manuel";
// Image jointe au post : seul le visuel TUVOA généré est branché pour l'instant.
export type TriggerImage = "visuel" | "presse" | "banque";
export type Trigger = {
  id: string;
  name: string;
  sources: string[];
  keywords: string[];
  minScore: number;
  format: TriggerFormat;
  platforms: Platform[];
  mode: TriggerMode; // "manuel" = toujours un aperçu, même en autopilote
  image?: TriggerImage;
  enabledByDefault: boolean;
};

export const TRIGGERS: Trigger[] = [
  {
    id: "faille-critique",
    name: "Faille de sécurité critique",
    sources: ["thehackernews", "cybersecuritymag"],
    keywords: ["critical", "critique", "zero-day", "0-day", "actively exploited", "exploitée", "urgent"],
    minScore: 80,
    format: "explication",
    platforms: ["facebook", "linkedin"],
    mode: "manuel",
    enabledByDefault: true,
  },
  {
    id: "android-ios",
    name: "Nouvelle version Android / iOS",
    sources: ["frandroid", "techcrunch"],
    keywords: ["android 1", "ios 1", "ios 2", "mise à jour", "one ui", "hyperos"],
    minScore: 70,
    format: "resume",
    platforms: ["facebook", "linkedin", "wordpress"],
    mode: "general",
    enabledByDefault: false, // nouveaux smartphones : peu suivis par le public de TUVOA
  },
  {
    id: "ia-modele",
    name: "Lancement d'un modèle d'IA",
    sources: ["techcrunch", "frandroid"],
    keywords: ["launches", "lance", "new model", "nouveau modèle", "releases", "dévoile"],
    minScore: 75,
    format: "explication",
    platforms: ["linkedin", "facebook"],
    mode: "general",
    enabledByDefault: true,
  },
  {
    id: "startup-afrique",
    name: "Levée de fonds startup africaine",
    sources: ["techcrunch", "sikafinance"],
    keywords: ["africa", "afrique", "nigeria", "kenya", "sénégal", "senegal", "côte d'ivoire", "ghana", "burkina"],
    minScore: 70,
    format: "resume",
    platforms: ["linkedin", "wordpress"],
    mode: "general",
    enabledByDefault: false,
  },
];

// Les déclencheurs modifiés dans l'app remplacent la liste par défaut ci-dessus.
export function allTriggers(custom?: Trigger[] | null): Trigger[] {
  return Array.isArray(custom) ? custom : TRIGGERS;
}

// Sources par défaut + sources ajoutées depuis l'app.
export function allSources(custom?: Source[] | null): Source[] {
  const extra = (custom ?? []).filter((c) => !SOURCES.some((s) => s.id === c.id));
  return [...SOURCES, ...extra];
}

export function isOn(map: Record<string, boolean> | undefined, id: string, fallback: boolean): boolean {
  return typeof map?.[id] === "boolean" ? (map[id] as boolean) : fallback;
}

// Garde-fous de l'autopilote
export const GUARDRAILS = {
  // Sujets jamais publiés automatiquement (toujours en aperçu)
  blockedKeywords: [
    "décès", "décédé", "mort", "meurt", "tué", "killed", "dies", "died", "death",
    "élection", "election", "président", "politique", "accusé", "accusation", "arrest", "arrêté",
    "guerre", "war ", "attentat", "terror", "suicide", "procès", "lawsuit", "sues",
  ],
  // Nombre minimal de sources différentes qui parlent du sujet pour publier seul
  minSourcesForAuto: 2,
  // Délai pendant lequel on peut annuler une publication automatique
  delayMinutes: 10,
  // Plafond de publications automatiques par jour
  maxAutoPerDay: 6,
  // Plafond de posts générés par passage de la tâche planifiée (maîtrise des coûts IA)
  maxGenerationsPerRun: 3,
};

// Guide de style donné à l'IA à chaque rédaction
export const STYLE_GUIDE = `
Tu écris pour TUVOA Tech Media, un média tech francophone (site : www.tuvoa.media).
Ligne éditoriale : uniquement la tech, avec en priorité ce qui touche le public africain : cybersécurité et arnaques, mobile money et télécoms, IA, startups et numérique en Afrique.
Les annonces de nouveaux smartphones n'intéressent que si elles concernent l'Afrique (prix, disponibilité, modèles vendus localement) : sinon, reste bref.
Ton : direct, clair, pédagogique, tutoiement. Signature possible en fin de post : « tu vois ? » (sans en abuser).
Public : lecteurs francophones, en particulier en Afrique de l'Ouest ; explique le jargon.
Règles :
- Toujours reformuler avec tes propres mots. Ne jamais recopier l'article (aucune phrase reprise, citation de 15 mots maximum).
- Toujours citer la source (nom du média) et ne rien inventer : si une info n'est pas dans l'article, ne l'écris pas.
- Distinguer clairement ce qui est officiel, une fuite ou une rumeur.
- Pas de sensationnalisme, pas de point d'exclamation en série, 0 à 2 émojis maximum.
- Les chiffres en chiffres, les noms de marques avec leur casse officielle.
`.trim();
