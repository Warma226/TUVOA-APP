import Link from "next/link";
import type { Post } from "@/lib/store";
import { PLATFORM_LABEL, STATUS_LABEL } from "@/lib/labels";

const STATUS_COLOR: Record<Post["status"], string> = {
  brouillon: "var(--texte-2)",
  a_valider: "var(--ambre-texte)",
  planifie: "var(--bleu)",
  publie: "var(--vert)",
  erreur: "var(--rouge)",
  annule: "var(--texte-2)",
};

// « Aujourd'hui, 18:00 », « Demain, 12:30 », « Lun. 2 nov., 09:00 »
export function formatWhen(iso: string | null): string {
  if (!iso) return "Sans date";
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date())) / 86400000);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Aujourd'hui, ${time}`;
  if (diff === 1) return `Demain, ${time}`;
  if (diff === -1) return `Hier, ${time}`;
  const date = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return `${date.charAt(0).toUpperCase()}${date.slice(1)}, ${time}`;
}

export function postTitle(p: Post): string {
  return p.title || p.visual.titre || p.idea || "Sans titre";
}

export function postHref(p: Post): string {
  return p.status === "brouillon" ? `/editeur?id=${p.id}` : `/apercu?id=${p.id}`;
}

export function PostRow({ post }: { post: Post }) {
  const when = post.status === "publie" ? Object.values(post.results).find((r) => r?.ok)?.at ?? post.scheduled_at : post.scheduled_at;
  return (
    <Link href={postHref(post)} className="card link post-row">
      <span className="thumb" aria-hidden="true" data-rubrique={post.rubrique}>
        <span />
      </span>
      <span className="stack" style={{ gap: 6, minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35 }}>{postTitle(post)}</span>
        <span className="wrap">
          {post.platforms.map((pl) => (
            <span key={pl} className="badge bleu">{PLATFORM_LABEL[pl]}</span>
          ))}
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          {post.status === "brouillon" && !post.scheduled_at ? "Pas encore planifié" : formatWhen(when)} ·{" "}
          <span style={{ color: STATUS_COLOR[post.status], fontWeight: 600 }}>
            {STATUS_LABEL[post.status]}
            {post.auto ? " · auto" : ""}
          </span>
        </span>
      </span>
    </Link>
  );
}
