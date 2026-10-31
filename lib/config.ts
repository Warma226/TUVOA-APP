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
export const RUBRIQUES: { id: RubriqueId; label: string; hashtag: string; description: string; alwaysManual: boolean }[] = [
  { id: "actu", label: "Actualité tech", hashtag: "#ActuTech", description: "Les infos du moment, résumées et sourcées.", alwaysManual: false },
  { id: "cyberbase", label: "CyberBase", hashtag: "#CyberBase", description: "Comprendre les notions basiques de la tech.", alwaysManual: false },
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

export const TOPICS: { id: string; label: string; keywords: string[] }[] = [
  { id: "ia", label: "IA", keywords: ["intelligence artificielle", " ia ", "ai ", " ai,", "llm", "chatgpt", "openai", "anthropic", "claude", "gemini", "machine learning", "modèle"] },
  { id: "smartphones", label: "Smartphones", keywords: ["android", "iphone", "ios", "smartphone", "samsung", "galaxy", "pixel", "xiaomi", "téléphone", "mobile"] },
  { id: "cyber", label: "Cybersécurité", keywords: ["faille", "vulnérabilit", "vulnerability", "malware", "ransomware", "phishing", "hack", "cve-", "zero-day", "exploit", "cyber", "breach", "fuite"] },
  { id: "startups", label: "Startups", keywords: ["startup", "start-up", "levée", "raises", "funding", "series a", "series b", "seed", "fintech", "mobile money"] },
];

export type TriggerFormat = "resume" | "explication" | "les-deux";
export type TriggerMode = "general" | "manuel";
export type Trigger = {
  id: string;
  name: string;
  sources: string[];
  keywords: string[];
  minScore: number;
  format: TriggerFormat;
  platforms: Platform[];
  mode: TriggerMode; // "manuel" = toujours un aperçu, même en autopilote
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
    enabledByDefault: true,
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
Ligne éditoriale : uniquement la tech (IA, smartphones, cybersécurité, startups, télécoms, numérique).
Ton : direct, clair, pédagogique, tutoiement. Signature possible en fin de post : « tu vois ? » (sans en abuser).
Public : lecteurs francophones, en particulier en Afrique de l'Ouest ; explique le jargon.
Règles :
- Toujours reformuler avec tes propres mots. Ne jamais recopier l'article (aucune phrase reprise, citation de 15 mots maximum).
- Toujours citer la source (nom du média) et ne rien inventer : si une info n'est pas dans l'article, ne l'écris pas.
- Distinguer clairement ce qui est officiel, une fuite ou une rumeur.
- Pas de sensationnalisme, pas de point d'exclamation en série, 0 à 2 émojis maximum.
- Les chiffres en chiffres, les noms de marques avec leur casse officielle.
`.trim();
