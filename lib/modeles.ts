// Galerie d'inspiration du Studio : 10 maquettes par type (visuel, carrousel, vidéo), toutes modifiables.
// Les photos d'exemple (public/studio) se remplacent en un clic dans l'éditeur.
import { anim as A, logo, nouveau, page, uid, type Carte, type Doc, type El, type Genre } from "./creation";

export type Maquette = { id: string; nom: string; idee: string; doc: () => Doc };

const PH = { bras: "/studio/bras.jpg", saut: "/studio/saut.jpg", dos: "/studio/dos.jpg", bureau: "/studio/bureau.jpg" };
const B = "#2563EB", NUIT = "#0A2A66", CIEL = "#6E9BFF", OR = "#E94A06", NOIR = "#0A0A0A", BLANC = "#FFFFFF", JAUNE = "#F2B21B";

// Raccourcis
type O = Partial<El>;
const T = (texte: string, x: number, y: number, w: number, h: number, o: O = {}) => nouveau.texte({ texte, x, y, w, h, ...o });
const Pa = (texte: string, x: number, y: number, w: number, h: number, o: O = {}) => nouveau.pastille({ texte, x, y, w, h, ...o });
const F = (x: number, y: number, w: number, h: number, fond: string, o: O = {}) => nouveau.forme({ x, y, w, h, fond, rayon: 0, ...o });
const I = (src: string, x: number, y: number, w: number, h: number, o: O = {}) => nouveau.image({ src, x, y, w, h, ...o });
const C = (x: number, y: number, w: number, h: number, c: Partial<Carte>, o: O = {}) => nouveau.carte({ x, y, w, h, ...o }, c);
const Ic = (icone: string, x: number, y: number, t: number, fond: string, o: O = {}) => nouveau.icone({ icone, x, y, w: t, h: t, fond, ...o });
const doc = (genre: Genre, format: Doc["format"], duree: number, pages: Doc["pages"]): Doc => ({ genre, format, duree, pages });
const lignesScan = (h: number, n = 14) => Array.from({ length: n }, (_, i) => F(0, Math.round((i * h) / n), 1080, 3, "rgba(255,255,255,0.08)", { nom: "Ligne de balayage" }));

// ════════════════════════════════ VISUELS ═════════════════════════════════
const VISUELS: Maquette[] = [
  {
    id: "v-tete", nom: "Cartes autour de la tête", idee: "La personne au centre, 5 cartes d'appli qui flottent autour de sa tête.",
    doc: () => doc("visuel", "portrait", 8, [page("#0B1633", [
      I(PH.bureau, 0, 0, 1080, 1350, { nom: "Photo" }),
      F(0, 0, 1080, 420, "lin:rgba(11,22,51,0.75),rgba(11,22,51,0),180", { nom: "Ombre du haut" }),
      F(0, 750, 1080, 600, "lin:rgba(0,0,0,0),rgba(0,0,0,0.97),180", { nom: "Ombre du bas" }),
      ...logo(),
      C(380, 40, 320, 214, { titre: "Deux étapes", etat: "Activée", texte: "Votre WhatsApp est protégé par un code PIN.", bouton: "Activer", icone: "bouclier" }, { role: "carte1", anim: A("pop", 0.3, "flotter") }),
      C(40, 190, 310, 214, { titre: "Mise à jour", etat: "Installée", texte: "Téléphone à jour : failles corrigées.", bouton: "Vérifier", icone: "maj", couleur: NUIT }, { role: "carte2", anim: A("pop", 0.48, "flotter") }),
      C(730, 190, 310, 214, { titre: "Mot de passe", etat: "Fort", texte: "Long, unique, jamais partagé.", bouton: "Changer", icone: "cle", couleur: OR }, { role: "carte3", anim: A("pop", 0.66, "flotter") }),
      C(30, 470, 300, 214, { titre: "Sauvegarde", etat: "Faite", texte: "Photos et discussions à l'abri.", bouton: "Lancer", icone: "nuage", couleur: "#1D4ED8" }, { role: "carte4", anim: A("pop", 0.84, "flotter") }),
      C(750, 470, 300, 214, { titre: "Lien suspect", etat: "Évité", texte: "« Vous avez gagné » ? On ne clique pas.", bouton: "Signaler", icone: "lien", couleur: NOIR }, { role: "carte5", anim: A("pop", 1.02, "flotter") }),
      T("Nouvelle semaine", 60, 900, 960, 100, { role: "titre", police: 92, align: "center", anim: A("glisser-haut", 1.2) }),
      Pa("bons réflexes", 160, 1010, 760, 110, { role: "fort", police: 88, fond: `lin:${B},${CIEL},90`, rayon: 12, marge: 6, ombre: "neon", anim: A("pop", 1.45) }),
      T("Activez la vérification en deux étapes sur WhatsApp", 60, 1150, 960, 50, { role: "sous", police: 32, graisse: 600, align: "center", anim: A("fondu", 1.7) }),
      Pa("Voir l'astuce", 360, 1225, 360, 64, { role: "bouton", police: 30, rayon: 12, marge: 10, ombre: "neon", anim: A("pop", 1.95, "pulser") }),
    ])]),
  },
  {
    id: "v-waouh", nom: "Effet waouh", idee: "Rayons de soleil, halo doré, cartes néon : l'annonce qui claque.",
    doc: () => doc("visuel", "portrait", 8, [page("rad:#FFD45A,#F2B21B,#C27210,#4A2204", [
      nouveau.rayons(),
      F(250, 150, 580, 580, "rad:rgba(255,248,215,0.95),rgba(255,240,190,0.4),rgba(255,240,190,0)", { nom: "Halo", forme: "cercle", anim: A("fondu", 0, "pulser", 1) }),
      I(PH.bras, 0, 320, 1080, 1030, { nom: "Photo", anim: A("zoom", 0, "aucune", 1.4) }),
      F(0, 318, 1080, 110, "lin:rgba(232,160,26,1),rgba(232,160,26,0),180", { nom: "Fondu de la photo" }),
      F(0, 750, 1080, 600, "lin:rgba(0,0,0,0),rgba(0,0,0,0.97),180", { nom: "Ombre du bas" }),
      ...logo(),
      C(380, 40, 320, 214, { titre: "Samedi", etat: "Repos", texte: "Le téléphone peut souffler, vous aussi.", bouton: "Profiter", icone: "bulle" }, { role: "carte1", ombre: "neon", anim: A("pop", 0.3, "flotter") }),
      C(40, 190, 310, 214, { titre: "À lire", etat: "4 actus", texte: "La semaine tech, au calme.", bouton: "Lire", icone: "antenne", couleur: NUIT }, { role: "carte2", rot: -3, ombre: "neon", anim: A("pop", 0.48, "balancer") }),
      C(730, 190, 310, 214, { titre: "Lien suspect", etat: "Évité", texte: "« Vous avez gagné » ? Non.", bouton: "Signaler", icone: "lien", couleur: OR }, { role: "carte3", rot: 3, ombre: "neon", anim: A("pop", 0.66, "balancer") }),
      C(30, 470, 300, 214, { titre: "Messenger", etat: "Ouvert", texte: "Une question ? On répond.", bouton: "Écrire", icone: "bulle", couleur: "#1D4ED8" }, { role: "carte4", rot: 2, ombre: "neon", anim: A("pop", 0.84, "flotter") }),
      C(750, 470, 300, 214, { titre: "Lundi 7h", etat: "À suivre", texte: "Une nouvelle semaine d'actu.", bouton: "Rappel", icone: "cal", couleur: NOIR }, { role: "carte5", rot: -2, ombre: "neon", anim: A("pop", 1.02, "flotter") }),
      T("Bon week-end", 60, 900, 960, 100, { role: "titre", police: 96, align: "center", couleur: "lin:#FFFFFF,#FFE6A3,180", ombre: "forte", anim: A("glisser-haut", 1.2) }),
      Pa("prudents en ligne", 90, 1010, 900, 110, { role: "fort", police: 88, fond: `lin:${B},${CIEL},90`, rayon: 12, marge: 6, ombre: "neon", anim: A("pop", 1.45) }),
      T("Déconnectez-vous, mais gardez les bons réflexes", 60, 1150, 960, 50, { role: "sous", police: 32, graisse: 600, align: "center", anim: A("fondu", 1.7) }),
      Pa("Voir nos conseils", 340, 1225, 400, 64, { role: "bouton", police: 30, rayon: 12, marge: 10, ombre: "neon", anim: A("pop", 1.95, "pulser") }),
    ])]),
  },
  {
    id: "v-semaine", nom: "Nouvelle semaine", idee: "Titre XXL en deux couleurs, pastille, étiquettes et barre d'appel.",
    doc: () => doc("visuel", "portrait", 6, [page("#F5F8FF", [
      I(PH.dos, 0, 600, 1080, 750, { nom: "Photo" }),
      F(0, 600, 1080, 260, "lin:#F5F8FF,rgba(245,248,255,0),180", { nom: "Fondu clair" }),
      ...logo(56, 52, false),
      T("Bienvenue dans une", 90, 175, 900, 60, { role: "surtitre", police: 48, graisse: 600, couleur: NOIR, align: "center" }),
      T("NOUVELLE", 40, 245, 1000, 110, { role: "titre", police: 104, couleur: NOIR, align: "center", anim: A("glisser-haut", 0.3) }),
      T("SEMAINE", 40, 345, 1000, 110, { role: "fort", police: 104, couleur: B, align: "center", anim: A("glisser-haut", 0.5) }),
      Pa("Passionnés de tech.", 260, 470, 560, 84, { role: "pastille", anim: A("pop", 0.8) }),
      T("Restez informés, vite et bien, avec TUVOA.", 60, 575, 960, 44, { role: "sous", police: 32, graisse: 600, couleur: NOIR, align: "center" }),
      ...["IA", "Cybersécurité", "Mobile money", "Startups"].map((t, i) => Pa(t, i < 2 ? 50 : 730, 680 + (i % 2) * 82, 300, 62, { role: `etiquette${i + 1}`, police: 28, fond: ["#DCE6FF", B, NUIT, NOIR][i], couleur: i === 0 ? NUIT : BLANC, ombre: "douce", anim: A(i < 2 ? "glisser-droite" : "glisser-gauche", 1.2 + i * 0.12, "flotter") })),
      F(0, 1150, 1080, 220, NOIR, { nom: "Barre du bas", rayon: 44 }),
      T("Toute l'actu tech sur :", 60, 1225, 470, 50, { role: "barre", police: 34, graisse: 600, align: "right" }),
      Pa("warmachinertech.com", 550, 1210, 470, 80, { role: "bouton", police: 34, rayon: 40 }),
    ])]),
  },
  {
    id: "v-arnaque", nom: "Faux SMS, vrai piège", idee: "Un écran verrouillé avec la notification piégée… et le tampon ARNAQUE par-dessus.",
    doc: () => doc("visuel", "portrait", 7, [page(NOIR, [
      I(PH.bureau, 0, 0, 1080, 1350, { nom: "Photo floutée", filtre: "flou" }),
      F(0, 0, 1080, 1350, "rgba(6,11,26,0.45)", { nom: "Voile" }),
      ...logo(),
      T("09:41", 40, 170, 1000, 190, { nom: "Heure", police: 180, graisse: 600, align: "center", anim: A("fondu", 0) }),
      T("Vendredi 6 novembre", 40, 370, 1000, 50, { nom: "Date", police: 36, graisse: 600, align: "center", couleur: "#DCE6FF" }),
      F(90, 470, 900, 230, "rgba(255,255,255,0.92)", { nom: "Notification", rayon: 34, ombre: "douce", anim: A("glisser-bas", 0.5) }),
      Ic("bulle", 125, 505, 64, "#22C55E", { anim: A("glisser-bas", 0.5) }),
      T("SMS · maintenant", 210, 515, 600, 40, { police: 26, graisse: 700, couleur: "#6B7280", anim: A("glisser-bas", 0.5) }),
      T("Votre compte mobile money est suspendu. Réactivez-le ici : http://…", 125, 585, 840, 100, { role: "piege", police: 32, graisse: 700, couleur: NOIR, interligne: 1.2, anim: A("glisser-bas", 0.5) }),
      F(210, 760, 660, 190, "rgba(233,74,6,0.12)", { nom: "Tampon (cadre)", rayon: 20, bordure: OR, epaisseur: 12, rot: -10, anim: A("pop", 1.4, "trembler") }),
      T("ARNAQUE", 210, 790, 660, 140, { role: "tampon", police: 128, align: "center", couleur: OR, rot: -10, anim: A("pop", 1.4, "trembler") }),
      T("Un SMS qui demande un lien ou un code ?", 60, 1000, 960, 130, { role: "titre", police: 50, align: "center", interligne: 1.1 }),
      T("C'est toujours une arnaque. Ne cliquez pas, appelez votre opérateur.", 90, 1130, 900, 100, { role: "sous", police: 34, graisse: 600, align: "center", couleur: "#DCE6FF", interligne: 1.25 }),
      Pa("#CyberActu", 390, 1235, 300, 66, { role: "bouton", police: 32, fond: OR }),
    ])]),
  },
  {
    id: "v-duel", nom: "Le duel", idee: "Écran coupé en deux, gros VS au centre : la question qui fait commenter.",
    doc: () => doc("visuel", "portrait", 6, [page(NOIR, [
      F(0, 0, 540, 1350, `lin:${B},${NUIT},180`, { nom: "Moitié gauche", anim: A("glisser-droite", 0) }),
      F(540, 0, 540, 1350, `lin:${OR},#7A2603,180`, { nom: "Moitié droite", anim: A("glisser-gauche", 0) }),
      ...logo(),
      T("Team quoi ?", 40, 180, 1000, 110, { role: "titre", police: 100, align: "center", anim: A("glisser-bas", 0.3) }),
      Ic("robot", 175, 420, 190, "rgba(255,255,255,0.15)", { rayon: 40, anim: A("pop", 0.6, "flotter") }),
      Ic("ia", 715, 420, 190, "rgba(255,255,255,0.15)", { rayon: 40, anim: A("pop", 0.7, "flotter") }),
      T("iPhone", 0, 690, 400, 110, { role: "choix1", police: 80, align: "center", anim: A("glisser-droite", 0.5) }),
      T("Android", 680, 690, 400, 110, { role: "choix2", police: 80, align: "center", anim: A("glisser-gauche", 0.5) }),
      F(415, 590, 250, 250, BLANC, { nom: "Rond VS", forme: "cercle", ombre: "forte", anim: A("pop", 0.9, "pulser") }),
      T("VS", 415, 650, 250, 130, { nom: "VS", police: 110, align: "center", couleur: NOIR, anim: A("pop", 0.9, "pulser") }),
      T("Et vous, vous êtes de quel côté ?", 60, 960, 960, 70, { role: "sous", police: 46, align: "center" }),
      Pa("Répondez en commentaire", 230, 1080, 620, 84, { role: "bouton", police: 36, fond: BLANC, couleur: NOIR, ombre: "forte", anim: A("pop", 1.3, "pulser") }),
    ])]),
  },
  {
    id: "v-magazine", nom: "Couverture de magazine", idee: "La une d'un magazine tech, avec gros titre de masthead et accroches.",
    doc: () => doc("visuel", "portrait", 6, [page(NOIR, [
      I(PH.bras, 0, 0, 1080, 1350, { nom: "Photo de couverture", filtre: "contraste" }),
      F(0, 0, 1080, 380, "lin:rgba(0,0,0,0.55),rgba(0,0,0,0),180", { nom: "Ombre du haut" }),
      F(0, 900, 1080, 450, "lin:rgba(0,0,0,0),rgba(0,0,0,0.85),180", { nom: "Ombre du bas" }),
      T("TUVOA", 30, 20, 1020, 240, { role: "masthead", police: 250, graisse: 800, align: "center", espacement: -6, anim: A("glisser-bas", 0) }),
      T("TECH MAGAZINE · NOVEMBRE", 40, 255, 1000, 40, { nom: "Sous-masthead", police: 28, graisse: 700, align: "center", espacement: 8 }),
      T("IA : ce qui change pour vous", 50, 420, 420, 130, { role: "accroche1", police: 44, interligne: 1.05, anim: A("glisser-droite", 0.4) }),
      F(50, 560, 120, 8, OR, { nom: "Trait" }),
      T("Mobile money : le guide", 50, 600, 400, 130, { role: "accroche2", police: 44, interligne: 1.05, anim: A("glisser-droite", 0.6) }),
      F(780, 360, 240, 240, OR, { nom: "Badge", forme: "etoile", anim: A("pop", 0.9, "tourner") }),
      T("N°1\nGRATUIT", 780, 425, 240, 120, { nom: "Texte du badge", police: 40, align: "center", interligne: 1.05, rot: 8, anim: A("pop", 0.9) }),
      T("5 pièges à éviter sur WhatsApp", 50, 1040, 980, 150, { role: "titre", police: 74, interligne: 1.02, anim: A("glisser-haut", 1.1) }),
      T("warmachinertech.com", 50, 1230, 600, 50, { role: "bouton", police: 30, graisse: 700, couleur: CIEL }),
      ...Array.from({ length: 14 }, (_, i) => F(830 + i * 14 + (i % 3) * 2, 1215, i % 2 ? 4 : 8, 70, BLANC, { nom: "Code-barres" })),
    ])]),
  },
  {
    id: "v-geant", nom: "Mot géant", idee: "Un mot énorme répété en contour, une photo bichrome et un sticker qui tourne.",
    doc: () => doc("visuel", "portrait", 6, [page("#060B1A", [
      ...[0, 1, 2, 3, 4].map((i) => T("ALERTE", -60 + (i % 2) * 90, 40 + i * 250, 1300, 260, { nom: `Mot géant ${i + 1}`, role: i === 2 ? "titre" : undefined, police: 250, align: "left", couleur: i === 2 ? B : "transparent", contour: i === 2 ? undefined : "rgba(110,155,255,0.6)", epContour: 3, anim: A(i % 2 ? "glisser-gauche" : "glisser-droite", i * 0.1, "aucune", 1) })),
      I(PH.bureau, 190, 300, 700, 820, { nom: "Photo bichrome", rayon: 40, filtre: "duo", teinte: B, ombre: "forte", anim: A("zoom", 0.4) }),
      ...logo(),
      F(760, 960, 260, 260, OR, { nom: "Sticker", forme: "etoile", anim: A("pop", 0.9, "tourner") }),
      T("À LIRE\nVITE", 760, 1030, 260, 120, { nom: "Texte du sticker", police: 44, align: "center", interligne: 1, rot: -8 }),
      T("Votre mot de passe a fuité ? Vérifiez-le.", 60, 1180, 700, 130, { role: "sous", police: 46, interligne: 1.08 }),
    ])]),
  },
  {
    id: "v-recu", nom: "Le reçu de la semaine", idee: "Un ticket de caisse qui « facture » les actus de la semaine.",
    doc: () => doc("visuel", "portrait", 6, [page(`lin:${B},${NUIT},160`, [
      ...logo(),
      F(160, 150, 760, 1120, "#FBFBF8", { nom: "Ticket", rayon: 6, ombre: "forte", rot: -2, anim: A("glisser-haut", 0.1) }),
      T("REÇU DE LA SEMAINE", 200, 210, 680, 60, { role: "titre", police: 50, couleur: NOIR, align: "center", rot: -2 }),
      T("TUVOA Tech Media · Ouagadougou", 200, 280, 680, 40, { nom: "Adresse", police: 24, graisse: 600, couleur: "#6B7280", align: "center", rot: -2 }),
      T("- - - - - - - - - - - - - - - - - - - - -", 200, 340, 680, 40, { nom: "Pointillés", police: 26, couleur: "#9CA3AF", align: "center", rot: -2 }),
      ...["1 × IA générative ........ LUE", "1 × Arnaque SMS ........ ÉVITÉE", "1 × Mobile money ........ COMPRIS", "1 × 5G en Afrique ........ À SUIVRE"].map((l, i) => T(l, 210, 400 + i * 90, 660, 60, { role: `ligne${i + 1}`, police: 30, graisse: 700, couleur: NOIR, rot: -2, anim: A("machine", 0.4 + i * 0.4, "aucune", 0.5) })),
      T("- - - - - - - - - - - - - - - - - - - - -", 200, 770, 680, 40, { nom: "Pointillés", police: 26, couleur: "#9CA3AF", align: "center", rot: -2 }),
      T("TOTAL : 4 actus à ne pas rater", 210, 830, 660, 60, { role: "total", police: 38, couleur: B, rot: -2 }),
      T("Prix : 0 FCFA", 210, 900, 660, 50, { nom: "Prix", police: 32, graisse: 700, couleur: NOIR, rot: -2 }),
      ...Array.from({ length: 22 }, (_, i) => F(300 + i * 22 + (i % 4) * 3, 1010 - i * 0.77, i % 3 ? 6 : 12, 110, NOIR, { nom: "Code-barres", rot: -2 })),
      T("Merci de votre fidélité · warmachinertech.com", 200, 1160, 680, 40, { role: "bouton", police: 24, graisse: 700, couleur: "#374151", align: "center", rot: -2 }),
    ])]),
  },
  {
    id: "v-glitch", nom: "Affiche glitch", idee: "Photo bichrome, lignes de balayage et un titre qui « bugue ».",
    doc: () => doc("visuel", "portrait", 6, [page(NOIR, [
      I(PH.bureau, 0, 0, 1080, 1350, { nom: "Photo bichrome", filtre: "duo", teinte: B }),
      ...lignesScan(1350),
      F(0, 780, 1080, 570, "lin:rgba(0,0,0,0),rgba(0,0,0,0.92),180", { nom: "Ombre du bas" }),
      ...logo(),
      T("BUG ?", 40, 760, 1000, 280, { role: "titre", police: 270, align: "center", glitch: true, anim: A("pop", 0.2, "trembler") }),
      T("Votre téléphone rame ? 3 réflexes pour le relancer.", 90, 1060, 900, 110, { role: "sous", police: 42, interligne: 1.15, align: "center" }),
      Pa("Glissez dans nos actus", 270, 1220, 540, 76, { role: "bouton", police: 32, ombre: "neon" }),
    ])]),
  },
  {
    id: "v-citation", nom: "Citation brutaliste", idee: "D'énormes guillemets, une phrase forte, un portrait rond.",
    doc: () => doc("visuel", "portrait", 6, [page("#F3F4F6", [
      F(0, 0, 1080, 26, B, { nom: "Bande" }),
      ...logo(56, 70, false),
      T("“", 40, 120, 400, 420, { nom: "Guillemets", police: 520, couleur: B, graisse: 800 }),
      T("La technologie ne vaut que si elle sert les gens d'ici.", 70, 470, 940, 420, { role: "titre", police: 84, couleur: NOIR, interligne: 1.05, anim: A("glisser-haut", 0.2) }),
      I(PH.bras, 70, 1010, 220, 220, { nom: "Portrait", rayon: 110, anim: A("pop", 0.6) }),
      T("Prénom Nom", 320, 1050, 700, 60, { role: "auteur", police: 46, couleur: NOIR }),
      T("Fonction, organisation", 320, 1115, 700, 50, { role: "fonction", police: 32, graisse: 600, couleur: "#4B5563" }),
      F(0, 1310, 1080, 40, NOIR, { nom: "Bande du bas" }),
    ])]),
  },
];

// ═══════════════════════════════ CARROUSELS ═══════════════════════════════
const fin = (titre: string, sous: string): Doc["pages"][number] => page(`lin:${B},${NUIT},160`, [
  ...logo(),
  Ic("coeur", 440, 380, 200, "rgba(255,255,255,0.15)", { rayon: 50, anim: A("pop", 0.1, "pulser") }),
  T(titre, 60, 640, 960, 220, { role: "fin", police: 92, align: "center", interligne: 1.02 }),
  T(sous, 90, 880, 900, 100, { role: "finSous", police: 36, graisse: 600, align: "center", couleur: "#DCE6FF" }),
  Pa("Suivez TUVOA", 330, 1060, 420, 84, { role: "bouton", police: 38, fond: BLANC, couleur: B, ombre: "forte" }),
]);
const swipe = (dark = true) => T("Glissez →", 760, 1250, 280, 50, { nom: "Glissez", police: 30, graisse: 700, align: "right", couleur: dark ? "#BFD0FF" : B });

const CARROUSELS: Maquette[] = [
  {
    id: "c-actus", nom: "La semaine en 4 actus", idee: "Une couverture, puis une page par actu avec sa photo.",
    doc: () => {
      const actu = (n: number, cat: string, titre: string, ic: string, ph: string) => page(`lin:#0B1633,#1D3A7A,160`, [
        I(ph, 60, 160, 960, 620, { nom: "Photo de l'actu", rayon: 28, ombre: "forte" }),
        ...logo(60, 52), T(`${n}/4`, 860, 50, 160, 60, { nom: "Numéro", police: 44, align: "right", couleur: CIEL }),
        Ic(ic, 60, 830, 80, B), T(cat, 160, 845, 600, 50, { role: `categorie${n}`, police: 34, graisse: 700, couleur: CIEL, majuscules: true, espacement: 3 }),
        T(titre, 60, 940, 960, 260, { role: `actu${n}`, police: 64, interligne: 1.08 }), swipe(),
      ]);
      return doc("carrousel", "portrait", 6, [
        page("rad:#FFFFFF,#E4ECFF,#BFD0FF", [I(PH.saut, -10, 430, 1100, 920, { nom: "Photo", ajustement: "contain" }), ...logo(56, 52, false),
          T("La semaine tech", 60, 160, 960, 100, { role: "titre", police: 92, couleur: NOIR, align: "center" }), T("en 4 actus", 60, 262, 960, 100, { role: "fort", police: 92, couleur: B, align: "center" }), Pa("Glissez →", 330, 390, 420, 70, { role: "bouton", police: 34 })]),
        actu(1, "Télécoms", "5G en Afrique : les premiers cas d'usage", "antenne", PH.dos), actu(2, "Mobile money", "PI-SPI : payer avec son numéro de téléphone", "argent", PH.saut),
        actu(3, "CyberActu", "Europol frappe un vaste réseau criminel", "bouclier", PH.bureau), actu(4, "Robotique", "Meta prépare Max, un robot humanoïde", "robot", PH.bras),
      ]);
    },
  },
  {
    id: "c-reflexes", nom: "5 réflexes cyber", idee: "Des chiffres géants en contour, un réflexe par page.",
    doc: () => {
      const R = [["Ne partagez jamais vos codes", "Ni votre PIN mobile money, ni le code reçu par SMS. Personne de sérieux ne vous le demandera.", "cle"],
        ["Activez la double vérification", "Sur WhatsApp : Paramètres › Compte › Validation en deux étapes.", "bouclier"],
        ["Méfiez-vous des liens « urgents »", "Un compte « suspendu » ou un « gain » à réclamer : c'est le piège classique.", "lien"],
        ["Mettez à jour votre téléphone", "Les mises à jour corrigent des failles que les pirates connaissent.", "maj"],
        ["Un mot de passe par compte", "Si l'un fuite, les autres restent protégés.", "ia"]];
      return doc("carrousel", "portrait", 6, [
        page(NOIR, [...logo(), T("5", 40, 120, 1000, 700, { nom: "Chiffre géant", police: 760, align: "center", couleur: "transparent", contour: B, epContour: 8 }),
          T("réflexes cyber", 60, 760, 960, 120, { role: "titre", police: 104, align: "center" }), T("à appliquer dès aujourd'hui", 60, 890, 960, 60, { role: "sous", police: 42, graisse: 600, align: "center", couleur: CIEL }), swipe()]),
        ...R.map(([t, x, ic], i) => page(i % 2 ? NUIT : NOIR, [...logo(),
          T(String(i + 1), -20, 140, 600, 600, { nom: "Numéro géant", police: 600, couleur: "transparent", contour: i % 2 ? CIEL : B, epContour: 7 }),
          Ic(ic, 820, 180, 180, B, { rayon: 40, ombre: "neon" }),
          T(t, 60, 720, 960, 230, { role: `reflexe${i + 1}`, police: 74, interligne: 1.05 }),
          T(x, 60, 960, 960, 200, { role: `detail${i + 1}`, police: 38, graisse: 600, couleur: "#DCE6FF", interligne: 1.3 }), swipe()])),
        fin("Gardez ce post", "Et partagez-le à quelqu'un qui en a besoin."),
      ]);
    },
  },
  {
    id: "c-avantapres", nom: "Avant / Après", idee: "Le mauvais réflexe barré en rouge, le bon validé en bleu.",
    doc: () => doc("carrousel", "portrait", 6, [
      page(BLANC, [...logo(56, 52, false), T("AVANT", 60, 260, 960, 220, { role: "titre", police: 210, couleur: OR, align: "center" }), T("APRÈS", 60, 520, 960, 220, { role: "fort", police: 210, couleur: B, align: "center" }), T("Le mot de passe, version pro", 60, 820, 960, 80, { role: "sous", police: 50, couleur: NOIR, align: "center" }), swipe(false)]),
      page("#FFF1EA", [...logo(56, 52, false), Pa("AVANT", 60, 200, 300, 80, { fond: OR, police: 40 }), T("123456", 60, 420, 960, 200, { role: "avant", police: 190, couleur: NOIR, align: "center" }), F(80, 500, 920, 22, OR, { nom: "Barre rouge", rot: -8, rayon: 11, anim: A("glisser-droite", 0.3) }), T("Trouvé en moins d'une seconde.", 60, 760, 960, 120, { role: "avantDetail", police: 56, couleur: NOIR, align: "center" }), swipe(false)]),
      page("#EEF3FF", [...logo(56, 52, false), Pa("APRÈS", 60, 200, 300, 80, { police: 40 }), T("Soleil-Ouaga-2026!", 60, 440, 960, 140, { role: "apres", police: 96, couleur: NOIR, align: "center" }), Ic("check", 440, 620, 200, B, { rayon: 100, ombre: "neon", anim: A("pop", 0.3) }), T("Long, facile à retenir, difficile à deviner.", 60, 880, 960, 140, { role: "apresDetail", police: 52, couleur: NOIR, align: "center" }), swipe(false)]),
      fin("Changez-le aujourd'hui", "Commencez par votre compte mobile money et votre e-mail."),
    ]),
  },
  {
    id: "c-saviez", nom: "Le saviez-vous ?", idee: "Un point d'interrogation géant, puis une anecdote tech par page.",
    doc: () => {
      const F3 = [["1992", "Le premier SMS de l'histoire a été envoyé en 1992. Il disait « Merry Christmas »."], ["1947", "Un vrai insecte coincé dans un ordinateur, en 1947, a popularisé le mot « bug »."], ["1994", "Le QR code a été inventé au Japon en 1994, pour suivre des pièces automobiles."]];
      return doc("carrousel", "portrait", 6, [
        page(`rad:${CIEL},${B},${NUIT}`, [...logo(), F(240, 220, 600, 600, OR, { nom: "Étoile", forme: "etoile", anim: A("pop", 0, "tourner") }), T("?", 240, 260, 600, 520, { nom: "Point d'interrogation", police: 480, align: "center" }), T("Le saviez-vous ?", 60, 920, 960, 120, { role: "titre", police: 104, align: "center" }), swipe()]),
        ...F3.map(([an, txt], i) => page(i % 2 ? NUIT : B, [...logo(), T(an, 40, 220, 1000, 300, { role: `annee${i + 1}`, police: 300, align: "center", couleur: "transparent", contour: BLANC, epContour: 6 }), F(440, 600, 200, 10, OR, { nom: "Trait", rayon: 5 }), T(txt, 80, 680, 920, 400, { role: `anecdote${i + 1}`, police: 60, align: "center", interligne: 1.15 }), swipe()])),
        fin("Une autre anecdote ?", "Dites-nous en commentaire ce que vous aimeriez savoir."),
      ]);
    },
  },
  {
    id: "c-tuto", nom: "Tuto pas à pas", idee: "Un téléphone par page, une étape à la fois.",
    doc: () => {
      const E = [["Ouvrez WhatsApp", "Puis touchez Paramètres."], ["Touchez « Compte »", "Choisissez « Validation en deux étapes »."], ["Touchez « Activer »", "Créez un code PIN à 6 chiffres."], ["Ajoutez un e-mail", "Il servira si vous oubliez votre code."]];
      return doc("carrousel", "portrait", 6, [
        page(`lin:${NUIT},${B},160`, [...logo(), T("TUTO", 60, 230, 960, 120, { nom: "Surtitre", police: 60, align: "center", couleur: CIEL, espacement: 12 }), T("Protégez votre WhatsApp en 1 minute", 60, 360, 960, 360, { role: "titre", police: 96, align: "center", interligne: 1.02 }), Ic("bouclier", 400, 800, 280, "rgba(255,255,255,0.12)", { rayon: 70, ombre: "neon", anim: A("pop", 0.2, "flotter") }), swipe()]),
        ...E.map(([t, x], i) => page("#EEF3FF", [...logo(56, 52, false),
          F(560, 160, 440, 900, NOIR, { nom: "Téléphone", rayon: 64, ombre: "forte" }), F(580, 180, 400, 860, BLANC, { nom: "Écran", rayon: 50 }),
          F(610, 250 + i * 120, 340, 90, "#DCE6FF", { nom: "Zone touchée", rayon: 18, bordure: B, epaisseur: 5, anim: A("pop", 0.3, "pulser") }),
          ...[0, 1, 2, 3, 4].map((k) => F(630, 270 + k * 120, k === i ? 0 : 300, k === i ? 0 : 50, "#F3F4F6", { nom: "Ligne de l'écran", rayon: 12 })),
          T(String(i + 1), 60, 220, 300, 300, { nom: "Étape", police: 300, couleur: B }),
          T(t, 60, 600, 470, 220, { role: `etape${i + 1}`, police: 60, couleur: NOIR, interligne: 1.05 }),
          T(x, 60, 840, 470, 200, { role: `detail${i + 1}`, police: 36, graisse: 600, couleur: "#374151", interligne: 1.3 }), swipe(false)])),
        fin("C'est activé !", "Votre compte est bien mieux protégé."),
      ]);
    },
  },
  {
    id: "c-lexique", nom: "Le lexique tech", idee: "Un mot par page, défini simplement, façon dictionnaire.",
    doc: () => {
      const M = [["Phishing", "nom masculin", "Faux message qui imite une banque ou un service pour voler vos codes."], ["2FA", "abréviation", "Double vérification : un mot de passe et un code reçu à part."], ["Cloud", "nom masculin", "Stocker ses fichiers sur des serveurs en ligne plutôt que sur son téléphone."]];
      return doc("carrousel", "portrait", 6, [
        page("#FBFBF8", [...logo(56, 52, false), T("LE", 60, 300, 960, 120, { nom: "Surtitre", police: 90, couleur: B, align: "center" }), T("LEXIQUE TECH", 60, 420, 960, 140, { role: "titre", police: 120, couleur: NOIR, align: "center" }), T("3 mots expliqués simplement", 60, 600, 960, 60, { role: "sous", police: 42, graisse: 600, couleur: "#4B5563", align: "center" }), swipe(false)]),
        ...M.map(([mot, gram, def], i) => page("#FBFBF8", [...logo(56, 52, false), T(mot, 60, 330, 960, 170, { role: `mot${i + 1}`, police: 160, couleur: NOIR }), T(gram, 60, 520, 960, 50, { nom: "Grammaire", police: 36, graisse: 600, couleur: B }), F(60, 600, 140, 10, OR, { nom: "Trait" }), T(def, 60, 650, 960, 360, { role: `definition${i + 1}`, police: 58, graisse: 600, couleur: NOIR, interligne: 1.2 }), T(`${i + 1}/3`, 820, 1250, 200, 50, { nom: "Page", police: 32, couleur: "#9CA3AF", align: "right" })])),
        fin("Un mot à expliquer ?", "Proposez-le en commentaire : on l'ajoute au lexique #CyberBase."),
      ]);
    },
  },
  {
    id: "c-top", nom: "Le classement", idee: "Du n°5 au n°1, avec un podium et un suspense jusqu'au bout.",
    doc: () => doc("carrousel", "portrait", 6, [
      page(NOIR, [...logo(), F(140, 820, 260, 300, "#1D4ED8", { nom: "Podium 2" }), F(410, 720, 260, 400, B, { nom: "Podium 1" }), F(680, 900, 260, 220, NUIT, { nom: "Podium 3" }), T("TOP 5", 60, 200, 960, 220, { role: "titre", police: 220, align: "center", couleur: JAUNE }), T("[Votre thème : applis, astuces…]", 60, 450, 960, 120, { role: "sous", police: 48, align: "center" }), swipe()]),
      ...[5, 4, 3, 2, 1].map((n) => page(n === 1 ? `rad:${JAUNE},#C27210,#4A2204` : NUIT, [...logo(), T(`N°${n}`, 60, 220, 960, 300, { nom: "Rang", police: 280, align: "center", couleur: n === 1 ? BLANC : JAUNE }), T(`[Élément n°${n}]`, 60, 600, 960, 140, { role: `element${n}`, police: 86, align: "center" }), T("[Pourquoi il est là, en une phrase]", 90, 780, 900, 160, { role: `pourquoi${n}`, police: 40, graisse: 600, align: "center", couleur: "#DCE6FF" }), swipe()])),
      fin("D'accord avec ce classement ?", "Votre n°1 à vous, en commentaire."),
    ]),
  },
  {
    id: "c-bd", nom: "L'arnaque en 4 cases", idee: "Une mini-BD : bulles, onomatopées et le bon réflexe à la fin.",
    doc: () => {
      const cases = [["BIP !", "Vous recevez un SMS : « Votre compte est bloqué »."], ["CLIC ?", "Le lien ouvre une page qui ressemble à votre opérateur."], ["OUPS…", "On vous demande votre code. Votre compte se vide."], ["STOP !", "Le bon réflexe : ne cliquez pas, appelez votre opérateur."]];
      return doc("carrousel", "portrait", 6, [
        page(JAUNE, [...logo(56, 52, false), F(60, 180, 960, 960, BLANC, { nom: "Case", rayon: 10, bordure: NOIR, epaisseur: 10 }), T("L'ARNAQUE", 100, 300, 880, 160, { role: "titre", police: 150, couleur: NOIR, align: "center" }), T("EN 4 CASES", 100, 480, 880, 120, { role: "fort", police: 110, couleur: OR, align: "center" }), F(320, 700, 440, 300, OR, { nom: "Explosion", forme: "etoile" }), T("BD", 320, 770, 440, 160, { nom: "BD", police: 140, couleur: BLANC, align: "center" }), swipe(false)]),
        ...cases.map(([cri, txt], i) => page(i === 3 ? B : JAUNE, [...logo(56, 52, i !== 3 ? false : true),
          F(60, 180, 960, 760, BLANC, { nom: "Case", rayon: 10, bordure: NOIR, epaisseur: 10 }),
          I([PH.bureau, PH.dos, PH.bras, PH.saut][i], 80, 200, 920, 720, { nom: "Image de la case", rayon: 4, filtre: i === 2 ? "nb" : "contraste" }),
          F(560, 220, 420, 260, i === 3 ? "#22C55E" : OR, { nom: "Explosion", forme: "etoile", anim: A("pop", 0.2, "trembler") }),
          T(cri, 560, 300, 420, 110, { role: `cri${i + 1}`, police: 90, couleur: BLANC, align: "center", rot: -6, anim: A("pop", 0.2) }),
          F(60, 980, 960, 240, BLANC, { nom: "Bulle", rayon: 30, bordure: NOIR, epaisseur: 8 }),
          T(txt, 100, 1010, 880, 190, { role: `case${i + 1}`, police: 48, couleur: NOIR, interligne: 1.2 }), T(`${i + 1}/4`, 840, 1250, 180, 50, { nom: "Page", police: 32, couleur: i === 3 ? BLANC : NOIR, align: "right" })])),
      ]);
    },
  },
  {
    id: "c-panorama", nom: "Panorama qui se suit", idee: "Une seule grande image coupée en 3 : en glissant, tout se raccorde.",
    doc: () => {
      const largeur = 3240;
      const bande = (k: number) => [
        F(-k * 1080 - 200, 520, largeur + 400, 320, `lin:${B},${CIEL},90`, { nom: "Ruban", rot: -6 }),
        F(-k * 1080 - 200, 880, largeur + 400, 60, OR, { nom: "Ruban fin", rot: -6 }),
        T("LA TECH QUI NOUS RASSEMBLE", -k * 1080 + 90, 580, largeur + 400, 220, { nom: "Texte panoramique", police: 176, rot: -6 }),
        ...[0, 1, 2, 3, 4, 5].map((i) => F(-k * 1080 + 180 + i * 520, 1080 + (i % 2) * 80, 120, 120, i % 2 ? OR : CIEL, { nom: "Point", forme: "cercle" })),
      ];
      return doc("carrousel", "portrait", 6, [
        page(NOIR, [...bande(0), ...logo(), T("Glissez pour voir la suite →", 60, 1240, 960, 50, { nom: "Consigne", police: 32, graisse: 700, couleur: CIEL })]),
        page(NOIR, [...bande(1), T("IA · Cybersécurité · Mobile money · Startups", 60, 220, 960, 140, { role: "sous", police: 52, align: "center", interligne: 1.15 })]),
        page(NOIR, [...bande(2), T("Rejoignez la communauté", 60, 200, 960, 200, { role: "fin", police: 84, align: "center", interligne: 1.02 }), Pa("Suivez TUVOA", 330, 1220, 420, 84, { role: "bouton", police: 38, ombre: "neon" })]),
      ]);
    },
  },
  {
    id: "c-interview", nom: "L'interview", idee: "La personne en couverture, puis une question par page.",
    doc: () => {
      const Q = [["Votre parcours en une phrase ?", "[Sa réponse, en quelques lignes.]"], ["Votre plus grande fierté ?", "[Sa réponse, en quelques lignes.]"], ["Un conseil aux jeunes du Faso ?", "[Sa réponse, en quelques lignes.]"]];
      return doc("carrousel", "portrait", 6, [
        page(NOIR, [I(PH.bras, 0, 0, 1080, 1350, { nom: "Portrait" }), F(0, 750, 1080, 600, "lin:rgba(0,0,0,0),rgba(0,0,0,0.95),180", { nom: "Ombre" }), ...logo(), Pa("PORTRAIT", 60, 820, 300, 70, { police: 34, fond: OR }), T("Prénom Nom", 60, 920, 960, 130, { role: "titre", police: 110 }), T("Fonction, organisation", 60, 1060, 960, 60, { role: "sous", police: 40, graisse: 600, couleur: "#DCE6FF" }), swipe()]),
        ...Q.map(([q, r], i) => page(i % 2 ? NUIT : "#0B1633", [...logo(), I(PH.bras, 820, 40, 200, 200, { nom: "Mini portrait", rayon: 100 }), T("Q", 60, 260, 200, 200, { nom: "Lettre", police: 200, couleur: B }), T(q, 60, 470, 960, 230, { role: `question${i + 1}`, police: 68, interligne: 1.08 }), F(60, 720, 120, 8, OR, { nom: "Trait" }), T(r, 60, 770, 960, 380, { role: `reponse${i + 1}`, police: 44, graisse: 600, couleur: "#DCE6FF", interligne: 1.3 }), swipe()])),
        fin("Une personne à découvrir ?", "Proposez-nous un portrait en message privé."),
      ]);
    },
  },
];

// ════════════════════════════════ VIDÉOS ═══════════════════════════════════
const V = (id: string, nom: string, idee: string, duree: number, fond: string, els: () => El[]): Maquette => ({ id, nom, idee, doc: () => doc("video", "story", duree, [page(fond, els())]) });
const logoS = () => logo(70, 90);

const VIDEOS: Maquette[] = [
  V("r-actu", "Actu du jour", "Titre qui glisse, photo qui flotte, carte qui surgit.", 8, `rad:#3B6CF0,#1D3A9E,#060B1A`, () => [
    nouveau.rayons({ x: -410, y: -200, couleur: "rgba(200,220,255,0.25)" }),
    I(PH.bras, 90, 560, 900, 1000, { nom: "Photo", rayon: 40, ombre: "forte", anim: A("zoom", 0.2, "flotter", 1) }), ...logoS(),
    T("L'actu tech du jour", 70, 250, 940, 60, { role: "surtitre", police: 44, graisse: 600, couleur: "#BFD0FF", anim: A("fondu", 0.1) }),
    T("Le titre qui arrête le pouce", 70, 320, 940, 220, { role: "titre", police: 96, interligne: 1.02, anim: A("glisser-haut", 0.3) }),
    C(560, 1450, 440, 214, { titre: "À retenir", etat: "Important", texte: "Une info clé en une phrase.", bouton: "Lire", icone: "ia" }, { role: "carte1", anim: A("pop", 1.4, "flotter") }),
    Pa("Suivez TUVOA", 290, 1740, 500, 90, { role: "bouton", police: 40, ombre: "neon", anim: A("pop", 2, "pulser") }),
  ]),
  V("r-machine", "Machine à écrire", "Le titre se tape lettre par lettre, curseur qui clignote.", 9, NOIR, () => [
    ...logoS(),
    T("Ce SMS peut vider votre compte en 30 secondes.", 70, 420, 940, 520, { role: "titre", police: 108, interligne: 1.05, anim: A("machine", 0.3, "aucune", 2.6) }),
    F(70, 960, 40, 110, B, { nom: "Curseur", anim: A("fondu", 0.3, "clignoter", 0.2) }),
    I(PH.bureau, 70, 1120, 940, 560, { nom: "Photo", rayon: 36, filtre: "duo", teinte: B, anim: A("glisser-haut", 3.2, "aucune", 0.9) }),
    Pa("Le bon réflexe en commentaire", 120, 1740, 840, 90, { role: "bouton", police: 38, fond: OR, anim: A("pop", 4.2, "pulser") }),
  ]),
  V("r-notifs", "Notifications qui tombent", "Les messages piégés pleuvent… puis le tampon ARNAQUE.", 9, NOIR, () => [
    I(PH.bureau, 0, 0, 1080, 1920, { nom: "Fond flou", filtre: "flou" }), F(0, 0, 1080, 1920, "rgba(6,11,26,0.5)", { nom: "Voile" }), ...logoS(),
    T("21:47", 40, 230, 1000, 200, { nom: "Heure", police: 190, graisse: 600, align: "center" }),
    ...["Votre colis est bloqué, payez 500 F ici", "Vous avez gagné 1 000 000 F !", "Votre compte mobile money est suspendu", "Envoyez-moi le code reçu par SMS"].map((t, i) => [
      F(80, 520 + i * 230, 920, 200, "rgba(255,255,255,0.93)", { nom: `Notification ${i + 1}`, rayon: 32, ombre: "douce", anim: A("glisser-bas", 0.5 + i * 0.55) }),
      Ic("bulle", 110, 555 + i * 230, 60, ["#22C55E", OR, B, "#22C55E"][i], { anim: A("glisser-bas", 0.5 + i * 0.55) }),
      T(t, 195, 560 + i * 230, 770, 130, { role: `notif${i + 1}`, police: 34, couleur: NOIR, interligne: 1.2, anim: A("glisser-bas", 0.5 + i * 0.55) }),
    ]).flat(),
    F(160, 830, 760, 230, "rgba(233,74,6,0.15)", { nom: "Tampon (cadre)", rayon: 20, bordure: OR, epaisseur: 14, rot: -12, anim: A("pop", 3.1, "trembler") }),
    T("ARNAQUES", 160, 870, 760, 160, { role: "tampon", police: 140, couleur: OR, align: "center", rot: -12, anim: A("pop", 3.1, "trembler") }),
    T("Au moindre doute : ne cliquez pas.", 70, 1520, 940, 160, { role: "titre", police: 66, align: "center", interligne: 1.08, anim: A("glisser-haut", 4) }),
    Pa("#CyberActu", 340, 1740, 400, 90, { role: "bouton", police: 42, fond: OR, anim: A("pop", 4.6, "pulser") }),
  ]),
  V("r-decompte", "Compte à rebours", "3… 2… 1… et l'annonce explose à l'écran.", 7, `rad:${B},${NUIT},#060B1A`, () => [
    nouveau.rayons({ x: -410, y: 10, couleur: "rgba(200,220,255,0.22)" }), ...logoS(),
    ...["3", "2", "1"].map((n, i) => T(n, 0, 560, 1080, 700, { nom: `Chiffre ${n}`, police: 680, align: "center", anim: A("pop", i, "aucune", 0.5, i + 0.95) })),
    F(240, 560, 600, 600, OR, { nom: "Explosion", forme: "etoile", anim: A("pop", 3, "tourner", 0.6) }),
    T("C'est\nparti !", 240, 700, 600, 330, { role: "titre", police: 130, align: "center", interligne: 1, anim: A("pop", 3.1) }),
    T("Le nouveau rendez-vous tech de TUVOA", 70, 1300, 940, 220, { role: "sous", police: 64, align: "center", interligne: 1.1, anim: A("glisser-haut", 3.6) }),
    Pa("Activez les notifications", 170, 1700, 740, 96, { role: "bouton", police: 40, fond: BLANC, couleur: B, anim: A("pop", 4.2, "pulser") }),
  ]),
  V("r-glitch", "Glitch intro", "Écran qui bugue, titre qui tremble : effet « breaking news ».", 8, NOIR, () => [
    I(PH.bureau, 0, 0, 1080, 1920, { nom: "Photo bichrome", filtre: "duo", teinte: B, anim: A("zoom", 0, "aucune", 6) }), ...lignesScan(1920, 20), F(0, 1000, 1080, 920, "lin:rgba(0,0,0,0),rgba(0,0,0,0.95),180", { nom: "Ombre" }), ...logoS(),
    Pa("BREAKING TECH", 70, 980, 560, 90, { role: "surtitre", police: 44, fond: OR, anim: A("pop", 0.2, "clignoter") }),
    T("ALERTE", 40, 1110, 1000, 260, { role: "titre", police: 220, glitch: true, anim: A("pop", 0.5, "trembler") }),
    T("Une faille touche des millions de téléphones. On vous explique.", 70, 1420, 940, 220, { role: "sous", police: 54, interligne: 1.15, anim: A("glisser-haut", 1.4) }),
    Pa("Tout savoir", 70, 1720, 380, 90, { role: "bouton", police: 40, ombre: "neon", anim: A("pop", 2.2, "pulser") }),
  ]),
  V("r-cartes", "Cartes qui volent", "Les cartes surgissent autour de la personne, une à une.", 8, "rad:#FFD45A,#F2B21B,#C27210,#4A2204", () => [
    nouveau.rayons({ x: -410, y: -300 }), I(PH.bras, 0, 520, 1080, 1400, { nom: "Photo", anim: A("zoom", 0, "aucune", 1.4) }), F(0, 515, 1080, 120, "lin:rgba(232,160,26,1),rgba(232,160,26,0),180", { nom: "Fondu" }), F(0, 1150, 1080, 770, "lin:rgba(0,0,0,0),rgba(0,0,0,0.97),180", { nom: "Ombre" }), ...logoS(),
    C(380, 200, 320, 214, { titre: "Samedi", etat: "Repos", texte: "Le téléphone souffle, vous aussi.", bouton: "Profiter", icone: "bulle" }, { role: "carte1", ombre: "neon", anim: A("pop", 0.4, "flotter") }),
    C(40, 400, 320, 214, { titre: "Lien suspect", etat: "Évité", texte: "« Vous avez gagné » ? Non.", bouton: "Signaler", icone: "lien", couleur: OR }, { role: "carte2", rot: -3, ombre: "neon", anim: A("pop", 0.7, "balancer") }),
    C(720, 400, 320, 214, { titre: "Lundi 7h", etat: "À suivre", texte: "Une nouvelle semaine d'actu.", bouton: "Rappel", icone: "cal", couleur: NOIR }, { role: "carte3", rot: 3, ombre: "neon", anim: A("pop", 1, "balancer") }),
    T("Bon week-end", 60, 1380, 960, 120, { role: "titre", police: 110, align: "center", couleur: "lin:#FFFFFF,#FFE6A3,180", ombre: "forte", anim: A("glisser-haut", 1.4) }),
    Pa("prudents en ligne", 120, 1510, 840, 120, { role: "fort", police: 92, fond: `lin:${B},${CIEL},90`, rayon: 14, marge: 6, ombre: "neon", anim: A("pop", 1.8) }),
    Pa("Suivez TUVOA", 330, 1730, 420, 86, { role: "bouton", police: 38, ombre: "neon", anim: A("pop", 2.3, "pulser") }),
  ]),
  V("r-flash", "Flash info défilant", "Bandeaux qui défilent façon chaîne d'info, titre au centre.", 8, NOIR, () => [
    I(PH.dos, 0, 300, 1080, 1100, { nom: "Photo", anim: A("zoom", 0, "aucune", 8) }), F(0, 300, 1080, 1100, "lin:rgba(0,0,0,0.2),rgba(0,0,0,0.75),180", { nom: "Voile" }), ...logoS(),
    F(0, 220, 1080, 80, OR, { nom: "Bandeau du haut" }), T("FLASH TECH • IA • CYBER • MOBILE MONEY • STARTUPS • ", 0, 232, 1080, 70, { role: "bandeau1", police: 44, anim: A("aucune", 0, "defiler") }),
    Pa("EN DIRECT", 70, 1180, 330, 80, { nom: "Direct", police: 38, fond: OR, anim: A("pop", 0.3, "clignoter") }),
    T("Le titre de l'info, en gros et en court", 70, 1290, 940, 260, { role: "titre", police: 88, interligne: 1.05, anim: A("glisser-gauche", 0.6) }),
    F(0, 1620, 1080, 110, B, { nom: "Bandeau du bas" }), T("Toute l'actu tech sur warmachinertech.com • Suivez TUVOA • ", 0, 1640, 1080, 80, { role: "bandeau2", police: 44, anim: A("aucune", 0, "defiler") }),
  ]),
  V("r-kenburns", "Zoom cinéma", "Lent zoom sur la photo, titres qui apparaissent comme au cinéma.", 10, NOIR, () => [
    I(PH.saut, -200, 0, 1480, 1920, { nom: "Photo", anim: A("zoom", 0, "aucune", 10) }), F(0, 0, 1080, 1920, "lin:rgba(0,0,0,0.1),rgba(0,0,0,0.85),180", { nom: "Voile" }),
    F(0, 0, 1080, 170, NOIR, { nom: "Bande cinéma haut" }), F(0, 1750, 1080, 170, NOIR, { nom: "Bande cinéma bas" }), ...logo(70, 56),
    T("CHAPITRE 1", 70, 1100, 940, 60, { nom: "Chapitre", police: 40, graisse: 700, couleur: CIEL, espacement: 10, anim: A("fondu", 1) }),
    T("La jeunesse qui code l'Afrique", 70, 1180, 940, 300, { role: "titre", police: 100, interligne: 1.02, anim: A("fondu", 2, "aucune", 1.4) }),
    T("Une série TUVOA", 70, 1520, 940, 60, { role: "sous", police: 42, graisse: 600, couleur: "#DCE6FF", anim: A("fondu", 3.5) }),
  ]),
  V("r-duel", "Duel animé", "Les deux camps arrivent de chaque côté, le VS tombe au milieu.", 7, NOIR, () => [
    F(0, 0, 540, 1920, `lin:${B},${NUIT},180`, { nom: "Moitié gauche", anim: A("glisser-droite", 0, "aucune", 0.7) }), F(540, 0, 540, 1920, `lin:${OR},#7A2603,180`, { nom: "Moitié droite", anim: A("glisser-gauche", 0, "aucune", 0.7) }), ...logoS(),
    T("Vous êtes plutôt…", 40, 300, 1000, 100, { role: "titre", police: 80, align: "center", anim: A("glisser-bas", 0.5) }),
    T("Facebook", 0, 870, 380, 120, { role: "choix1", police: 72, align: "center", anim: A("glisser-droite", 0.8) }),
    T("TikTok", 700, 870, 380, 120, { role: "choix2", police: 72, align: "center", anim: A("glisser-gauche", 0.8) }),
    F(390, 760, 300, 300, BLANC, { nom: "Rond VS", forme: "cercle", ombre: "forte", anim: A("pop", 1.3, "pulser") }), T("VS", 390, 830, 300, 160, { nom: "VS", police: 130, couleur: NOIR, align: "center", anim: A("pop", 1.3, "pulser") }),
    Pa("Votez en commentaire", 190, 1500, 700, 100, { role: "bouton", police: 44, fond: BLANC, couleur: NOIR, anim: A("pop", 1.9, "pulser") }),
  ]),
  V("r-weekend", "Soleil du week-end", "Rayons qui tournent, soleil qui pulse, badge qui tourne.", 8, "rad:#FFE07A,#F2B21B,#C27210,#4A2204", () => [
    nouveau.rayons({ x: -410, y: -100, couleur: "rgba(255,245,200,0.45)" }), F(290, 620, 500, 500, "rad:#FFFFFF,#FFE9A8,rgba(255,233,168,0)", { nom: "Soleil", forme: "cercle", anim: A("zoom", 0, "pulser", 1.2) }), ...logoS(),
    T("Bon", 60, 300, 960, 200, { role: "titre", police: 200, align: "center", couleur: NUIT, anim: A("glisser-bas", 0.3) }),
    T("week-end", 60, 480, 960, 200, { role: "fort", police: 190, align: "center", couleur: BLANC, ombre: "forte", anim: A("glisser-haut", 0.5) }),
    F(700, 1150, 300, 300, OR, { nom: "Badge", forme: "etoile", anim: A("pop", 1.2, "tourner") }), T("ON SE\nREPOSE", 700, 1240, 300, 130, { nom: "Texte du badge", police: 46, align: "center", interligne: 1, anim: A("pop", 1.2) }),
    T("Et lundi, on revient avec l'actu tech qui compte.", 70, 1500, 940, 200, { role: "sous", police: 56, align: "center", couleur: NUIT, interligne: 1.15, anim: A("fondu", 1.8) }),
    Pa("Suivez TUVOA", 330, 1750, 420, 90, { role: "bouton", police: 40, ombre: "forte", anim: A("pop", 2.4, "pulser") }),
  ]),
];

export const GALERIE: Record<Genre, Maquette[]> = { visuel: VISUELS, carrousel: CARROUSELS, video: VIDEOS };
export const GENRES: { id: Genre; nom: string; sous: string }[] = [
  { id: "visuel", nom: "Visuel", sous: "Une image pour Facebook" },
  { id: "carrousel", nom: "Carrousel", sous: "Plusieurs images à faire défiler" },
  { id: "video", nom: "Vidéo", sous: "Reel, story ou TikTok animé" },
];
export const nouvelId = uid;
