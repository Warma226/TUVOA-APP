// La minute cyber : épisodes vidéo de 60 s maximum. Une histoire réaliste, puis la technique d'attaque révélée à la fin,
// et les bons réflexes. Ce fichier décrit un épisode et le transforme en vidéo du Studio (une page = une scène).
import { anim as A, logo, nouveau, page, type Doc, type El } from "./creation";

export type TypeScene = "accroche" | "histoire" | "message" | "appel" | "revelation" | "technique" | "reflexes" | "fin";
export type Scene = {
  type: TypeScene;
  voix: string;      // ce que dit la voix off
  ecran: string;     // texte court affiché à l'écran
  plan: string;      // storyboard : ce qu'on voit, l'ambiance
  detail?: string;   // message reçu (SMS, WhatsApp…) ou nom de l'appelant
  points?: string[]; // réflexes (scène « reflexes »)
  duree: number;     // secondes
};
export type Episode = {
  id: string; cree: string; numero?: number;
  sujet: string; titre: string; menace: string;
  scenes: Scene[];
  technique: { nom: string; explication: string };
  reflexes: string[];
  legende: string;
  audio?: string; // voix off (URL)
  statut: "brouillon" | "monte" | "envoye";
};
export type Proposition = { titre: string; menace: string; pitch: string };

export const TYPES_SCENE: Record<TypeScene, string> = {
  accroche: "Accroche", histoire: "Histoire", message: "Message reçu", appel: "Appel reçu",
  revelation: "Révélation", technique: "La technique", reflexes: "Bons réflexes", fin: "Fin",
};

export const DUREE_MAX = 60;
const MOTS_PAR_SECONDE = 2.6; // voix off française posée

export const motsDe = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
// Durée d'une scène d'après son texte lu (au moins 2,5 s pour laisser l'image respirer).
export const dureeLue = (s: Pick<Scene, "voix" | "type">) => Math.max(s.type === "fin" ? 3 : 2.5, Math.round((motsDe(s.voix) / MOTS_PAR_SECONDE + 0.6) * 10) / 10);
export const dureeEpisode = (e: Pick<Episode, "scenes">) => Math.round(e.scenes.reduce((s, x) => s + x.duree, 0) * 10) / 10;
export const scriptVoix = (e: Pick<Episode, "scenes">) => e.scenes.map((s) => s.voix.trim()).filter(Boolean).join("\n\n");

// Recale les durées sur une voix off enregistrée : chaque scène au prorata de son nombre de mots.
export function caler(scenes: Scene[], dureeAudio: number): Scene[] {
  const poids = scenes.map((s) => Math.max(1, motsDe(s.voix)) + 1.5);
  const total = poids.reduce((a, b) => a + b, 0);
  return scenes.map((s, i) => ({ ...s, duree: Math.round(((dureeAudio + 0.8) * poids[i] / total) * 10) / 10 }));
}

// ─── De l'épisode à la vidéo ─────────────────────────────────────────
const B = "#2563EB", NUIT = "#0A2A66", CIEL = "#6E9BFF", OR = "#E94A06", NOIR = "#0A0A0A", BLANC = "#FFFFFF", VERT = "#22C55E";
type O = Partial<El>;
const T = (texte: string, x: number, y: number, w: number, h: number, o: O = {}) => nouveau.texte({ texte, x, y, w, h, ...o });
const Pa = (texte: string, x: number, y: number, w: number, h: number, o: O = {}) => nouveau.pastille({ texte, x, y, w, h, ...o });
const F = (x: number, y: number, w: number, h: number, fond: string, o: O = {}) => nouveau.forme({ x, y, w, h, fond, rayon: 0, ...o });
const Ic = (icone: string, x: number, y: number, t: number, fond: string, o: O = {}) => nouveau.icone({ icone, x, y, w: t, h: t, fond, ...o });
const scan = (n = 22) => Array.from({ length: n }, (_, i) => F(0, Math.round((i * 1920) / n), 1080, 3, "rgba(255,255,255,0.06)", { nom: "Ligne de balayage" }));
// Taille du texte selon sa longueur (le texte doit tenir dans la largeur)
const taille = (t: string, grand: number, petit: number, seuil = 40) => (t.length <= seuil ? grand : Math.max(petit, Math.round(grand * Math.sqrt(seuil / t.length))));
const bandeau = (n?: number) => [
  ...logo(70, 90),
  Pa(n ? `LA MINUTE CYBER · ÉP. ${n}` : "LA MINUTE CYBER", 560, 90, 450, 58, { nom: "Bandeau", police: 24, fond: OR, rayon: 8, marge: 8 }),
];
const ICONE_HISTOIRE = ["bulle", "argent", "antenne", "alerte", "lien", "robot"];

function scene(s: Scene, i: number, e: Episode, n: number) {
  const ecran = s.ecran.trim() || s.voix.split(/[.!?]/)[0];
  switch (s.type) {
    case "accroche":
      return page(NOIR, [
        ...scan(), ...bandeau(e.numero),
        T(ecran, 70, 560, 940, 700, { role: "titre", police: taille(ecran, 120, 76, 30), interligne: 1.04, anim: A("machine", 0.2, "aucune", Math.min(2.2, 0.5 + ecran.length / 30)) }),
        F(70, 1330, 36, 100, B, { nom: "Curseur", anim: A("fondu", 0.2, "clignoter", 0.2) }),
        T(e.titre, 70, 1640, 940, 120, { role: "sous", police: 40, graisse: 600, couleur: CIEL, anim: A("fondu", 1.2) }),
      ]);
    case "message":
    case "appel": {
      const appel = s.type === "appel";
      return page(`rad:#1E2E5C,#0B1633,#05080F`, [
        ...bandeau(e.numero),
        F(140, 300, 800, 1380, "#0F172A", { nom: "Téléphone", rayon: 80, bordure: "#334155", epaisseur: 10, anim: A("glisser-haut", 0, "aucune", 0.7) }),
        T(appel ? "Appel entrant" : "21:47", 140, 400, 800, 120, { nom: "Heure", police: appel ? 54 : 130, graisse: 600, align: "center", anim: A("fondu", 0.3) }),
        ...(appel
          ? [
              F(390, 620, 300, 300, B, { nom: "Avatar", forme: "cercle", anim: A("pop", 0.5, "pulser") }),
              Ic("antenne", 465, 695, 150, "rgba(0,0,0,0)", { anim: A("pop", 0.5) }),
              T(s.detail?.trim() || "Numéro inconnu", 180, 980, 720, 120, { role: "detail", police: 56, align: "center", anim: A("fondu", 0.8) }),
              F(250, 1420, 160, 160, "#EF4444", { nom: "Raccrocher", forme: "cercle" }),
              F(670, 1420, 160, 160, VERT, { nom: "Décrocher", forme: "cercle", anim: A("aucune", 0, "pulser") }),
            ]
          : [
              F(190, 640, 700, 520, "rgba(255,255,255,0.95)", { nom: "Notification", rayon: 36, ombre: "douce", anim: A("glisser-bas", 0.6) }),
              Ic("bulle", 225, 675, 64, VERT, { anim: A("glisser-bas", 0.6) }),
              T("Message", 310, 685, 540, 50, { nom: "Expéditeur", police: 32, couleur: "#475569", graisse: 700, anim: A("glisser-bas", 0.6) }),
              T(s.detail?.trim() || ecran, 225, 760, 630, 380, { role: "detail", police: taille(s.detail ?? ecran, 48, 32, 60), couleur: NOIR, graisse: 600, interligne: 1.2, anim: A("glisser-bas", 0.6) }),
            ]),
        T(ecran, 90, 1720, 900, 160, { role: "titre", police: taille(ecran, 56, 40, 40), align: "center", interligne: 1.1, anim: A("glisser-haut", 1.2) }),
      ]);
    }
    case "revelation":
      return page(`rad:${OR},#9A2F04,#2A0D02`, [
        nouveau.rayons({ x: -410, y: 10, couleur: "rgba(255,220,190,0.22)" }), ...bandeau(e.numero),
        T("C'ÉTAIT…", 70, 560, 940, 140, { nom: "Surtitre", police: 96, align: "center", anim: A("fondu", 0.1) }),
        T(e.technique.nom.toUpperCase(), 40, 760, 1000, 500, { role: "titre", police: taille(e.technique.nom, 150, 84, 14), align: "center", interligne: 1, glitch: true, anim: A("pop", 0.6, "trembler") }),
        T(ecran, 90, 1420, 900, 260, { role: "sous", police: taille(ecran, 52, 38, 50), align: "center", graisse: 700, interligne: 1.12, anim: A("glisser-haut", 1.3) }),
      ]);
    case "technique":
      return page(`rad:#3B6CF0,${NUIT},#060B1A`, [
        ...bandeau(e.numero),
        Pa("COMMENT ÇA MARCHE", 70, 470, 640, 80, { nom: "Surtitre", police: 36, fond: B, anim: A("pop", 0.2) }),
        T(e.technique.nom, 70, 600, 940, 220, { role: "titre", police: taille(e.technique.nom, 96, 64, 18), interligne: 1.02, anim: A("glisser-haut", 0.4) }),
        F(70, 860, 120, 10, OR, { nom: "Trait", anim: A("glisser-droite", 0.7) }),
        T(ecran, 70, 920, 940, 700, { role: "sous", police: taille(ecran, 56, 40, 90), graisse: 600, interligne: 1.2, anim: A("fondu", 0.9) }),
      ]);
    case "reflexes": {
      const pts = (s.points?.length ? s.points : e.reflexes).slice(0, 3);
      return page(NOIR, [
        ...bandeau(e.numero),
        T(ecran || "Les bons réflexes", 70, 380, 940, 200, { role: "titre", police: 84, interligne: 1.02, anim: A("glisser-haut", 0.1) }),
        ...pts.flatMap((p, k) => [
          F(70, 640 + k * 360, 940, 310, "rgba(255,255,255,0.07)", { nom: `Réflexe ${k + 1}`, rayon: 28, bordure: k === 0 ? B : k === 1 ? CIEL : OR, epaisseur: 4, anim: A("glisser-gauche", 0.5 + k * 0.6) }),
          Ic("check", 110, 690 + k * 360, 90, k === 0 ? B : k === 1 ? "#1D4ED8" : OR, { anim: A("pop", 0.6 + k * 0.6) }),
          T(p, 240, 680 + k * 360, 730, 230, { role: `reflexe${k + 1}`, police: taille(p, 46, 34, 50), graisse: 700, interligne: 1.15, anim: A("glisser-gauche", 0.5 + k * 0.6) }),
        ]),
      ]);
    }
    case "fin":
      return page(`rad:#3B6CF0,#1D3A9E,#060B1A`, [
        nouveau.rayons({ x: -410, y: 10, couleur: "rgba(200,220,255,0.2)" }),
        F(415, 520, 250, 250, B, { nom: "Logo (carré)", anim: A("pop", 0.1) }),
        T("TUVOA", 415, 600, 250, 70, { nom: "Logo (sigle)", police: 56, align: "center", anim: A("pop", 0.1) }),
        T("TECH MEDIA", 415, 680, 250, 40, { nom: "Logo (mention)", police: 22, couleur: "#BFD0FF", align: "center", espacement: 3, anim: A("pop", 0.1) }),
        T(ecran || "Partagez pour protéger vos proches.", 70, 880, 940, 300, { role: "titre", police: taille(ecran, 72, 52, 36), align: "center", interligne: 1.08, anim: A("glisser-haut", 0.5) }),
        Pa("LA MINUTE CYBER", 290, 1300, 500, 84, { nom: "Bandeau", police: 36, fond: OR, anim: A("pop", 0.9) }),
        Pa("Abonnez-vous à TUVOA", 220, 1460, 640, 96, { role: "bouton", police: 40, fond: BLANC, couleur: B, anim: A("pop", 1.2, "pulser") }),
      ]);
    default: { // histoire
      const ic = ICONE_HISTOIRE[i % ICONE_HISTOIRE.length];
      const fonds = [`rad:#1E2E5C,#0B1633,#05080F`, `lin:#0B1633,#1D3A9E,160`, `rad:#2A1A4A,#120A24,#05030A`];
      return page(fonds[i % fonds.length], [
        ...scan(14), ...bandeau(e.numero),
        F(340, 420, 400, 400, "rgba(37,99,235,0.18)", { nom: "Halo", forme: "cercle", anim: A("fondu", 0, "pulser", 1) }),
        Ic(ic, 440, 520, 200, B, { rayon: 48, anim: A("pop", 0.2, "flotter") }),
        T(ecran, 70, 960, 940, 620, { role: "titre", police: taille(ecran, 84, 54, 32), align: "center", interligne: 1.08, anim: A("glisser-haut", 0.4) }),
        T(`${i + 1}/${n}`, 70, 1760, 940, 50, { nom: "Compteur", police: 28, couleur: "rgba(255,255,255,0.45)", align: "center" }),
      ]);
    }
  }
}

export function episodeEnVideo(e: Episode): Doc {
  const pages = e.scenes.map((s, i) => ({ ...scene(s, i, e, e.scenes.length), duree: Math.max(1, s.duree) }));
  return { format: "story", genre: "video", sequence: true, duree: 6, pages, audio: e.audio, titre: `La minute cyber — ${e.titre}` };
}
