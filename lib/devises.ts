// Conversion des montants en francs CFA (XOF, BCEAO). L'IA écrit les montants sous forme de balise
// [[MONTANT:valeur:DEVISE]] ; ce module les remplace par « 6,43 milliards de dollars, soit environ 3 777 milliards FCFA ».

const EUR_XOF = 655.957; // parité fixe

const NOMS: Record<string, [string, string]> = {
  USD: ["dollar", "dollars"],
  EUR: ["euro", "euros"],
  GBP: ["livre sterling", "livres sterling"],
  CNY: ["yuan", "yuans"],
  JPY: ["yen", "yens"],
  CAD: ["dollar canadien", "dollars canadiens"],
  CHF: ["franc suisse", "francs suisses"],
  NGN: ["naira", "nairas"],
  KES: ["shilling kényan", "shillings kényans"],
  GHS: ["cedi", "cedis"],
  ZAR: ["rand", "rands"],
  MAD: ["dirham", "dirhams"],
  INR: ["roupie", "roupies"],
};

let cache: { at: number; xofPer: Record<string, number> } | null = null;

// Taux du jour : nombre de XOF pour 1 unité de chaque devise.
export async function tauxXof(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < 6 * 3.6e6) return cache.xofPer;
  const xofPer: Record<string, number> = { EUR: EUR_XOF, XOF: 1 };
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/EUR", { signal: AbortSignal.timeout(4000) });
    const d = (await res.json()) as { rates?: Record<string, number> };
    for (const [cur, perEur] of Object.entries(d.rates ?? {})) if (perEur > 0) xofPer[cur] = EUR_XOF / perEur;
  } catch {
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=EUR", { signal: AbortSignal.timeout(4000) });
      const d = (await res.json()) as { rates?: Record<string, number> };
      for (const [cur, perEur] of Object.entries(d.rates ?? {})) if (perEur > 0) xofPer[cur] = EUR_XOF / perEur;
    } catch {
      /* hors ligne : seul l'euro est converti */
    }
  }
  if (Object.keys(xofPer).length > 2) cache = { at: Date.now(), xofPer };
  return xofPer;
}

function groupe(n: string): string {
  const [ent, dec] = n.split(".");
  const e = ent.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${e},${dec}` : e;
}

// 6430000000 → { nombre: "6,43", unite: "milliards" }
function enLettres(n: number): { nombre: string; unite: string } {
  const abs = Math.abs(n);
  let v = n;
  let unite = "";
  if (abs >= 1e9) {
    v = n / 1e9;
    unite = Math.abs(v) >= 2 ? "milliards" : "milliard";
  } else if (abs >= 1e6) {
    v = n / 1e6;
    unite = Math.abs(v) >= 2 ? "millions" : "million";
  }
  const decimales = unite ? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2) : 0;
  const txt = v.toFixed(decimales).replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m));
  return { nombre: groupe(txt.includes(".") ? txt.replace(/0+$/, "") : txt), unite };
}

export function formatMontant(valeur: number, devise: string, taux: Record<string, number>): string {
  const cur = devise.toUpperCase();
  const src = enLettres(valeur);
  const nom = NOMS[cur] ? NOMS[cur][src.unite || Math.abs(valeur) >= 2 ? 1 : 0] : cur;
  const de = /^[aeiouyéè]/i.test(nom) ? "d'" : "de ";
  const original = src.unite ? `${src.nombre} ${src.unite} ${de}${nom}` : `${src.nombre} ${nom}`;
  if (cur === "XOF") return src.unite ? `${src.nombre} ${src.unite} FCFA` : `${src.nombre} FCFA`;
  const t = taux[cur];
  if (!t) return original;
  const x = enLettres(valeur * t);
  // Parité fixe avec l'euro : montant exact ; autres devises : taux du jour, donc « environ ».
  return `${original}, soit ${cur === "EUR" ? "" : "environ "}${x.unite ? `${x.nombre} ${x.unite}` : x.nombre} FCFA`;
}

const BALISE = /\[\[\s*MONTANT\s*:\s*([0-9][0-9.,\s]*)\s*:\s*([A-Za-z]{3})\s*\]\]/g;

// Une incise « , soit environ … FCFA » se referme par une virgule quand la phrase continue.
function fermer(rendu: string, suite: string): string {
  return rendu.includes(", soit ") && /^\s+[\p{L}\d«(]/u.test(suite) ? `${rendu},` : rendu;
}

export function remplacerMontants(texte: string, taux: Record<string, number>): string {
  return texte.replace(BALISE, (m: string, val: string, cur: string, offset: number, all: string) => {
    const n = Number(val.replace(/[\s,]/g, ""));
    return Number.isFinite(n) ? fermer(formatMontant(n, cur, taux), all.slice(offset + m.length)) : val;
  });
}

export function aDesMontants(texte: string): boolean {
  return /\[\[\s*MONTANT/i.test(texte);
}

// Secours si l'IA a écrit un montant en clair : « 2,7 millions de dollars » → « … soit 1 553 millions XOF ».
const CLAIR = /(\d{1,3}(?:[  ]\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(milliards?|millions?)?\s*(?:de\s+|d['’])?(dollars?|euros?)\b(?!\s*[,(]?\s*soit\b)/gi;

export function convertirMontantsEnClair(texte: string, taux: Record<string, number>): string {
  return texte.replace(CLAIR, (m: string, nb: string, unite: string | undefined, dev: string, offset: number, all: string) => {
    const base = Number(nb.replace(/[\s  ]/g, "").replace(",", "."));
    if (!Number.isFinite(base)) return m;
    const mult = !unite ? 1 : unite.toLowerCase().startsWith("milliard") ? 1e9 : 1e6;
    const cur = dev.toLowerCase().startsWith("dollar") ? "USD" : "EUR";
    return fermer(formatMontant(base * mult, cur, taux), all.slice(offset + m.length));
  });
}

// Retire les conversions écrites par l'IA elle-même (souvent fausses) : l'app refait le calcul.
const CONVERSION_IA = /\s*[,(]?\s*soit\s+(?:environ\s+|près de\s+)?[\d  ,.]+\s*(?:milliards?|millions?)?\s*(?:de\s+)?(?:FCFA|F\s?CFA|XOF|francs?\s+CFA)\s*\)?/gi;

export async function convertirTout(texte: string): Promise<string> {
  if (!texte) return texte;
  const taux = await tauxXof();
  return convertirMontantsEnClair(remplacerMontants(texte.replace(CONVERSION_IA, ""), taux), taux);
}
