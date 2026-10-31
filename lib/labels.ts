import type { PostStatus } from "./store";
import type { Platform, TriggerFormat } from "./config";

export const STATUS_LABEL: Record<PostStatus, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  planifie: "Planifié",
  publie: "Publié",
  erreur: "Erreur",
  annule: "Annulé",
};

export const STATUS_BADGE: Record<PostStatus, string> = {
  brouillon: "",
  a_valider: "ambre",
  planifie: "bleu",
  publie: "vert",
  erreur: "rouge",
  annule: "",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  wordpress: "WordPress",
};

export const FORMAT_LABEL: Record<TriggerFormat, string> = {
  resume: "Résumé",
  explication: "Explication",
  "les-deux": "Résumé + explication",
};
