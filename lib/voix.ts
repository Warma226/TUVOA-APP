// Voix off de synthèse côté serveur. Le ton est envoyé à part : la voix ne lit que le texte.
import { enregistrerFichier } from "./storage";
import type { StyleVoix } from "./voix-liste";

const TONS: Record<StyleVoix, string> = {
  narration: "Tu es un narrateur de série documentaire francophone. Voix posée et captivante, rythme vif mais clair, petite pause entre les paragraphes, ton grave au moment de la révélation. Lis uniquement le texte fourni, sans rien ajouter.",
  brief: "Tu es la voix d'un flash d'information du soir, en français. Ton chaleureux, souriant et captivant, énergie d'animatrice radio, rythme vivant avec de courtes pauses entre les idées, mise en valeur des chiffres. Lis uniquement le texte fourni, sans rien ajouter.",
  pub: "Tu es la voix d'une publicité courte en français. Ton dynamique, enthousiaste et clair, accroche marquée, rythme rapide mais articulé. Lis uniquement le texte fourni, sans rien ajouter.",
};

// Voix off de synthèse (Google Gemini TTS, offre gratuite sur les modèles récents) → fichier WAV.
// Modèles essayés du plus récent au plus ancien : un modèle sans offre gratuite ou saturé laisse la place au suivant.
export async function synthese(texte: string, voix: string, style: StyleVoix = "narration"): Promise<{ url: string; duree: number }> {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) throw new Error("La voix de synthèse demande une clé GEMINI_API_KEY dans Vercel. En attendant, enregistre ta voix ou importe un fichier audio.");
  const modeles = [process.env.GEMINI_TTS_MODEL, "gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"].filter(Boolean) as string[];
  let derniere = "";
  // Le ton est donné à part (instruction système) : seul le texte des scènes est envoyé à lire, la voix ne prononce jamais la consigne.
  // Si un modèle refuse l'instruction système, on renvoie le texte seul, sans consigne.
  const TON = TONS[style];
  const appel = (m: string, avecTon: boolean) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cle },
    body: JSON.stringify({
      ...(avecTon ? { systemInstruction: { parts: [{ text: TON }] } } : {}),
      contents: [{ role: "user", parts: [{ text: texte }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voix } } } },
    }),
    signal: AbortSignal.timeout(100000),
  });
  for (const m of modeles) {
    let res = await appel(m, true);
    if (res.status === 400) res = await appel(m, false);
    if (!res.ok) { derniere = `${res.status} ${(await res.text()).slice(0, 200)}`; continue; }
    const j = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!part?.data) { derniere = "réponse sans audio"; continue; }
    const pcm = Buffer.from(part.data, "base64");
    const taux = Number(part.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000);
    const wav = enWav(pcm, taux);
    const url = await enregistrerFichier(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer, "audio/wav", "wav");
    return { url, duree: pcm.length / (taux * 2) };
  }
  throw new Error(`Voix de synthèse indisponible (${derniere}). Enregistre ta voix ou importe un fichier audio.`);
}
function enWav(pcm: Buffer, taux: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(taux, 24);
  h.writeUInt32LE(taux * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

