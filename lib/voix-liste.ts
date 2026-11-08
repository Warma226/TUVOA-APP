// Voix de synthèse proposées (Gemini TTS) : utilisable côté client comme côté serveur.
export type StyleVoix = "narration" | "brief" | "pub";
export const VOIX: { id: string; nom: string; genre: "f" | "m" }[] = [
  { id: "Charon", nom: "Charon — grave, posée", genre: "m" },
  { id: "Algenib", nom: "Algenib — voix rocailleuse, intense", genre: "m" },
  { id: "Fenrir", nom: "Fenrir — vive, passionnée", genre: "m" },
  { id: "Orus", nom: "Orus — ferme, assurée", genre: "m" },
  { id: "Iapetus", nom: "Iapetus — claire, nette", genre: "m" },
  { id: "Sadaltager", nom: "Sadaltager — experte, pédagogue", genre: "m" },
  { id: "Puck", nom: "Puck — enjouée", genre: "m" },
  { id: "Sulafat", nom: "Sulafat — chaleureuse, captivante", genre: "f" },
  { id: "Kore", nom: "Kore — claire, ferme", genre: "f" },
  { id: "Aoede", nom: "Aoede — légère, chaleureuse", genre: "f" },
  { id: "Despina", nom: "Despina — douce, fluide", genre: "f" },
  { id: "Gacrux", nom: "Gacrux — mûre, posée", genre: "f" },
  { id: "Laomedeia", nom: "Laomedeia — entraînante", genre: "f" },
  { id: "Vindemiatrix", nom: "Vindemiatrix — douce, rassurante", genre: "f" },
];
export const STYLES: [StyleVoix, string][] = [["narration", "Conteur documentaire"], ["brief", "Flash info chaleureux"], ["pub", "Pub dynamique"]];
export const VOIX_BRIEF = "Sulafat";
