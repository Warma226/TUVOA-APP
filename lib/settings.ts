// Réglages de l'app (sans dépendance serveur : utilisable dans le navigateur).
import { SOURCES, TRIGGERS, type Source, type Trigger } from "./config";

export type Settings = {
  autopilot: boolean;
  triggersEnabled: Record<string, boolean>;
  sourcesEnabled: Record<string, boolean>;
  // null = déclencheurs par défaut (lib/config.ts) ; sinon la liste modifiée dans l'app
  triggers: Trigger[] | null;
  customSources: Source[];
};

export const DEFAULT_SETTINGS: Settings = {
  autopilot: false,
  triggersEnabled: Object.fromEntries(TRIGGERS.map((t) => [t.id, t.enabledByDefault])),
  sourcesEnabled: Object.fromEntries(SOURCES.map((s) => [s.id, s.enabledByDefault])),
  triggers: null,
  customSources: [],
};

// Fusionne des réglages partiels (base, navigateur ou requête) avec les valeurs par défaut.
export function mergeSettings(base: Partial<Settings>, patch: Partial<Settings> = {}): Settings {
  return {
    autopilot: typeof patch.autopilot === "boolean" ? patch.autopilot : base.autopilot ?? DEFAULT_SETTINGS.autopilot,
    triggersEnabled: { ...DEFAULT_SETTINGS.triggersEnabled, ...(base.triggersEnabled ?? {}), ...(patch.triggersEnabled ?? {}) },
    sourcesEnabled: { ...DEFAULT_SETTINGS.sourcesEnabled, ...(base.sourcesEnabled ?? {}), ...(patch.sourcesEnabled ?? {}) },
    triggers: patch.triggers !== undefined ? patch.triggers : base.triggers ?? null,
    customSources: patch.customSources !== undefined ? patch.customSources : base.customSources ?? [],
  };
}
