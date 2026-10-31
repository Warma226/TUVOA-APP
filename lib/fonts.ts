// Charge Archivo (licence libre SIL OFL) depuis Google Fonts pour le rendu des visuels.
type FontDef = { name: string; data: ArrayBuffer; weight: 300 | 800; style: "normal" };

let cache: FontDef[] | null = null;

async function load(weight: 300 | 800): Promise<ArrayBuffer | null> {
  try {
    // Sans en-tête de navigateur, Google Fonts renvoie un fichier TrueType, lisible par le moteur de rendu.
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Archivo:wght@${weight}`, { cache: "force-cache" })).text();
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url, { cache: "force-cache" })).arrayBuffer();
  } catch {
    return null;
  }
}

export async function archivoFonts(): Promise<FontDef[]> {
  if (cache) return cache;
  const [light, heavy] = await Promise.all([load(300), load(800)]);
  const fonts: FontDef[] = [];
  if (light) fonts.push({ name: "Archivo", data: light, weight: 300, style: "normal" });
  if (heavy) fonts.push({ name: "Archivo", data: heavy, weight: 800, style: "normal" });
  cache = fonts.length ? fonts : null;
  return fonts;
}
