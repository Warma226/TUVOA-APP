// Session de connexion : un cookie signé (HMAC-SHA256), lisible par le middleware (Edge) et les routes (Node).
// Changer APP_PASSWORD (ou APP_SECRET) déconnecte tous les appareils.
export const SESSION_COOKIE = "tuvoa_session";
export const SESSION_DAYS = 30;
import type { Role } from "./roles";
export type Session = { uid: string; role: Role; sid: string | null; exp: number };

function secret(): string {
  return process.env.APP_SECRET || process.env.APP_PASSWORD || "";
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Cookie : 2.<exp>.<sid>.<uid>.<role>.<signature>. Chaque connexion a sa session en base (sid), fermable à distance.
export async function createSession(uid = "admin", role: Role = "admin", sid = ""): Promise<{ value: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 24 * 3600;
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const sig = await hmac(`tuvoa2:${exp}:${sid}:${uid}:${role}`);
  return { value: `2.${exp}.${sid || "-"}.${uid}.${role}.${sig}`, maxAge };
}

export async function readSession(value: string | undefined): Promise<Session | null> {
  if (!value || !secret()) return null;
  const parts = value.split(".");
  if (parts.length !== 6 || parts[0] !== "2") return null;
  const [, exp, sidRaw, uid, role, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return null;
  const sid = sidRaw === "-" ? "" : sidRaw;
  if (!sameText(sig, await hmac(`tuvoa2:${exp}:${sid}:${uid}:${role}`))) return null;
  return { uid, role: role as Role, sid: sid || null, exp: Number(exp) };
}

export async function verifySession(value: string | undefined): Promise<boolean> {
  return Boolean(await readSession(value));
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  return Boolean(expected) && sameText(input, expected);
}

// Adresse de retour après connexion : seulement un chemin interne.
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/acces") ? next : "/";
}
