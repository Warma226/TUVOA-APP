// Rôles de l'équipe et ce que chacun peut ouvrir. Utilisable par le middleware (Edge) comme par les pages.
export type Role = "admin" | "redacteur" | "cm" | "monteur" | "lecteur";
export const ROLES: Role[] = ["admin", "redacteur", "cm", "monteur", "lecteur"];
export const ROLES_MEMBRES: Role[] = ["redacteur", "cm", "monteur", "lecteur"];
export const ROLE_NOM: Record<Role, string> = { admin: "Administrateur principal", redacteur: "Rédacteur", cm: "Community manager", monteur: "Monteur vidéo", lecteur: "Lecteur" };

export type Zone = "veille" | "creer" | "studio" | "publier" | "calendrier" | "grin" | "admin";
export const ZONE_NOM: Record<Zone, string> = { veille: "Veille", creer: "Créer et éditer", studio: "Studio", publier: "Publier et programmer", calendrier: "Calendrier", grin: "Le Grin", admin: "Médiathèque, connexions, réglages, équipe" };
export const ZONE_DETAIL: Record<Zone, string> = {
  veille: "Lire les infos, reprendre une actu", creer: "Écrire et modifier des posts", studio: "Visuels, carrousels, vidéos, avec vos propres fichiers",
  publier: "Directement, sur tous les canaux", calendrier: "Voir et déplacer les publications", grin: "Commentaires et messages de la Page", admin: "Réservé à l'administrateur principal",
};
// "o" : oui · "l" : lecture seule · "-" : non
export const DROITS: Record<Role, Record<Zone, "o" | "l" | "-">> = {
  admin: { veille: "o", creer: "o", studio: "o", publier: "o", calendrier: "o", grin: "o", admin: "o" },
  redacteur: { veille: "o", creer: "o", studio: "o", publier: "o", calendrier: "o", grin: "o", admin: "-" },
  cm: { veille: "o", creer: "o", studio: "-", publier: "o", calendrier: "o", grin: "o", admin: "-" },
  monteur: { veille: "-", creer: "-", studio: "o", publier: "o", calendrier: "o", grin: "o", admin: "-" },
  lecteur: { veille: "l", creer: "l", studio: "l", publier: "-", calendrier: "l", grin: "l", admin: "-" },
};
export const peut = (role: Role, zone: Zone, ecrire = false) => {
  const d = DROITS[role]?.[zone] ?? "-";
  return ecrire ? d === "o" : d !== "-";
};

// Pages : préfixe → zone (null = ouvert à toute l'équipe)
const PAGES: [string, Zone | null][] = [
  ["/compte", null], ["/apercu", null], ["/calendrier", "calendrier"], ["/veille", "veille"], ["/rubriques", "creer"],
  ["/creer", "creer"], ["/editeur", "creer"], ["/studio", "studio"], ["/minute-cyber", "studio"], ["/communaute", "grin"],
  ["/mediatheque", "admin"], ["/connexions", "admin"], ["/declencheurs", "admin"], ["/sources", "admin"],
];
export function zonePage(path: string): Zone | null | undefined {
  if (path === "/") return null;
  return PAGES.find(([p]) => path === p || path.startsWith(`${p}/`))?.[1];
}
export function pageAutorisee(role: Role, path: string): boolean {
  if (role === "admin") return true;
  const z = zonePage(path);
  if (z === undefined || z === null) return true;
  return peut(role, z);
}

// API : préfixe → zone pour lire et zone pour écrire
const API: [string, Zone | null, Zone | null][] = [
  ["/api/compte", null, null], ["/api/logout", null, null], ["/api/logo", null, null],
  ["/api/settings", null, "admin"], ["/api/tableau", null, "admin"], ["/api/posts", null, "publier"],
  ["/api/veille", "veille", "veille"], ["/api/generate", "creer", "creer"],
  ["/api/upload", null, "publier"], ["/api/upload-url", null, "publier"],
  ["/api/studio", "studio", "studio"], ["/api/minute", "studio", "studio"], ["/api/voix", "studio", "studio"],
  ["/api/cm", "grin", "grin"],
  ["/api/membres", "admin", "admin"], ["/api/mediatheque", "admin", "admin"], ["/api/connexions", "admin", "admin"],
  ["/api/sources", "admin", "admin"], ["/api/tiktok", "admin", "admin"],
];
export function apiAutorisee(role: Role, path: string, methode: string): boolean {
  if (role === "admin") return true;
  const r = API.find(([p]) => path === p || path.startsWith(`${p}/`));
  const ecrire = !["GET", "HEAD", "OPTIONS"].includes(methode.toUpperCase());
  if (!r) return !ecrire || role !== "lecteur";
  const z = ecrire ? r[2] : r[1];
  if (z === null) return !(ecrire && role === "lecteur" && r[0] !== "/api/compte" && r[0] !== "/api/logout");
  return peut(role, z, ecrire);
}

// Barre latérale : liens visibles selon le rôle
export function lienVisible(role: Role, href: string): boolean {
  return pageAutorisee(role, href);
}
