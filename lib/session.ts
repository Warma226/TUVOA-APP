// Session de connexion : un cookie signé (HMAC-SHA256), lisible par le middleware (Edge) et les routes (Node).
// Changer APP_PASSWORD (ou APP_SECRET) déconnecte tous les appareils.
export const SESSION_COOKIE = "tuvoa_session";
export const SESSION_DAYS = 30;

function secret(): string {
  return process.env.APP_SECRET || process.env.APP_PASSWORD || "";
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(): Promise<{ value: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 24 * 3600;
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  return { value: `${exp}.${await hmac(`tuvoa:${exp}`)}`, maxAge };
}

export async function verifySession(value: string | undefined): Promise<boolean> {
  if (!value || !secret()) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return sameText(sig, await hmac(`tuvoa:${exp}`));
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  return Boolean(expected) && sameText(input, expected);
}

// Adresse de retour après connexion : seulement un chemin interne.
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/acces") ? next : "/";
}
