// Stockage des images importées depuis le téléphone (tes visuels, photos de fond).
// 1. Supabase Storage (seau public « visuels », créé automatiquement) ; 2. sinon la médiathèque WordPress.
import { db, isDemo } from "./store";

const BUCKET = "visuels";
let bucketReady = false;

async function supabaseUpload(bytes: ArrayBuffer, type: string, name: string): Promise<string> {
  const storage = db().storage;
  if (!bucketReady) {
    const { error } = await storage.getBucket(BUCKET);
    if (error) {
      const created = await storage.createBucket(BUCKET, { public: true });
      if (created.error && !/already exists/i.test(created.error.message)) throw new Error(`Stockage Supabase : ${created.error.message}`);
    }
    bucketReady = true;
  }
  const { error } = await storage.from(BUCKET).upload(name, bytes, { contentType: type, upsert: false });
  if (error) throw new Error(`Stockage Supabase : ${error.message}`);
  return storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
}

async function wordpressUpload(bytes: ArrayBuffer, type: string, name: string): Promise<string> {
  const base = (process.env.WP_URL ?? "").replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
  const res = await fetch(`${base}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": type, "Content-Disposition": `attachment; filename="${name.split("/").pop()}"` },
    body: bytes,
  });
  if (!res.ok) throw new Error(`WordPress (image) ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { source_url?: string };
  if (!json.source_url) throw new Error("WordPress n'a pas renvoyé l'adresse de l'image.");
  return json.source_url;
}

export function uploadAvailable(): boolean {
  return !isDemo() || Boolean(process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD);
}

export async function storeImage(bytes: ArrayBuffer, type: string): Promise<string> {
  const ext = type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
  const name = `${new Date().toISOString().slice(0, 7)}/tuvoa-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  if (!isDemo()) return supabaseUpload(bytes, type, name);
  if (process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD) return wordpressUpload(bytes, type, name);
  throw new Error("Pour importer une image, branche Supabase ou WordPress (voir Connexions). En attendant, colle le lien de l'image.");
}
