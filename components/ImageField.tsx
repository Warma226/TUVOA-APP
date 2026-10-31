"use client";
// Champ image : importer depuis le téléphone ou coller un lien.
import { useRef, useState } from "react";

const MAX_BYTES = 3.8 * 1024 * 1024;

// Réduit les photos trop lourdes avant l'envoi (limite des requêtes Vercel).
async function shrink(file: File): Promise<Blob> {
  // PNG et JPG passent tels quels ; les autres formats (WebP, HEIC…) sont convertis en JPG,
  // car Facebook, LinkedIn et le moteur de visuels ne les lisent pas tous.
  if (file.size <= MAX_BYTES && ["image/png", "image/jpeg"].includes(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, 2160 / Math.max(bitmap.width, bitmap.height));
  for (let q = 0.9; q >= 0.5; q -= 0.1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= MAX_BYTES) return blob;
    scale *= 0.85;
  }
  throw new Error("Image trop lourde, même réduite.");
}

export function ImageField({
  label,
  hint,
  value,
  onChange,
  disabled,
  placeholder = "https://…/visuel.png",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", await shrink(file), file.name);
      const res = await fetch("/api/upload", { method: "POST", body });
      const d = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !d.url) throw new Error(d.error || `Envoi impossible (${res.status}).`);
      onChange(d.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="label">{label}</span>
      {hint ? <span className="muted small" style={{ marginTop: -4 }}>{hint}</span> : null}
      <div className="row" style={{ alignItems: "stretch" }}>
        <button type="button" className="btn small primary" style={{ height: 48, flexShrink: 0 }} disabled={disabled || busy} onClick={() => input.current?.click()}>
          {busy ? "Envoi…" : value ? "Changer l'image" : "Importer une image"}
        </button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        {value ? (
          <button type="button" className="btn small ghost" style={{ height: 48 }} disabled={disabled || busy} onClick={() => onChange("")}>
            Retirer
          </button>
        ) : null}
      </div>
      <input type="url" aria-label={`${label} : lien de l'image`} disabled={disabled} placeholder={`ou colle un lien : ${placeholder}`} value={value} onChange={(e) => onChange(e.target.value.trim())} />
      {error ? <p className="notice rouge" role="alert">{error}</p> : null}
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Aperçu de l'image" style={{ width: 120, aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 8, background: "var(--gris-1)" }} />
      ) : null}
    </div>
  );
}
