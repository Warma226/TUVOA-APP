// Jeton de la Page Facebook TUVOA.
// Il peut venir de Vercel (FB_PAGE_TOKEN) ou, mieux, du bouton « Reconnecter Facebook » (connexions) :
// le jeton est alors enregistré en base (settings, ligne 10) et prend le dessus. Plus besoin de le copier à la main.
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./store";

const LIGNE = 10;
export const FB_APP_ID = () => process.env.FB_APP_ID || "39821919070788379"; // app « TUVOA Publication »
export const FB_CONFIG_ID = () => process.env.FB_CONFIG_ID || "";
export const SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_metadata", "pages_read_user_content", "pages_manage_engagement", "pages_messaging", "business_management"];

type Stocke = { token: string; page: string; nom?: string; maj: string };
let cache: { at: number; v: Stocke | null } | null = null;
const envOrig = { token: process.env.FB_PAGE_TOKEN, page: process.env.FB_PAGE_ID };

// Charge le jeton enregistré et l'applique (remplace FB_PAGE_TOKEN / FB_PAGE_ID pour tout le reste du code).
export async function chargerJetonFb(force = false): Promise<void> {
  if (!force && cache && Date.now() - cache.at < 60000) return;
  try {
    const { data } = await db().from("settings").select("data").eq("id", LIGNE).maybeSingle();
    const v = (data?.data ?? null) as Stocke | null;
    cache = { at: Date.now(), v: v?.token ? v : null };
  } catch {
    cache = { at: Date.now(), v: null };
  }
  appliquer();
}
function appliquer() {
  const v = cache?.v;
  process.env.FB_PAGE_TOKEN = v?.token || envOrig.token || "";
  process.env.FB_PAGE_ID = v?.page || envOrig.page || "";
}
export async function enregistrerJetonFb(v: Omit<Stocke, "maj">) {
  const s: Stocke = { ...v, maj: new Date().toISOString() };
  const { error } = await db().from("settings").upsert({ id: LIGNE, data: s });
  if (error) throw new Error(error.message);
  cache = { at: Date.now(), v: s };
  appliquer();
}
export async function infoJetonFb(): Promise<{ source: "app" | "vercel" | "aucun"; nom?: string; maj?: string }> {
  await chargerJetonFb();
  if (cache?.v) return { source: "app", nom: cache.v.nom, maj: cache.v.maj };
  return { source: envOrig.token ? "vercel" : "aucun" };
}

// État signé pour le retour de Facebook (15 minutes).
const cle = () => process.env.APP_SECRET || process.env.APP_PASSWORD || "tuvoa-dev-secret";
export function etatOAuth(uid: string): string {
  const v = `${uid}.${Date.now() + 15 * 60000}`;
  return `${v}.${createHmac("sha256", cle()).update(`fb-oauth:${v}`).digest("hex").slice(0, 32)}`;
}
export function lireEtatOAuth(e: string | null): string | null {
  const m = /^(.+)\.(\d+)\.([a-f0-9]{32})$/.exec(e ?? "");
  if (!m || Number(m[2]) < Date.now()) return null;
  const attendu = createHmac("sha256", cle()).update(`fb-oauth:${m[1]}.${m[2]}`).digest("hex").slice(0, 32);
  return timingSafeEqual(Buffer.from(m[3]), Buffer.from(attendu)) ? m[1] : null;
}
