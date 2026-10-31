// Signature HMAC des liens de visuels, pour que seuls les liens générés par TUVOA fonctionnent.
import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  return process.env.APP_SECRET || process.env.APP_PASSWORD || "tuvoa-dev-secret";
}

export function signParams(params: URLSearchParams): string {
  const copy = new URLSearchParams(params);
  copy.delete("sig");
  copy.sort();
  return createHmac("sha256", secret()).update(copy.toString()).digest("hex").slice(0, 32);
}

export function verifyParams(params: URLSearchParams): boolean {
  const sig = params.get("sig") ?? "";
  const expected = signParams(params);
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export function appUrl(): string {
  // Sur Vercel, l'adresse de production est fournie automatiquement : APP_URL devient facultatif.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.APP_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
}
