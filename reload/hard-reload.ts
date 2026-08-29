import { buildAutoLoadUrl } from "../boot/auto-load.ts";
import { resolveAutoLoadSaveId } from "../boot/auto-load-save.ts";

export const HARD_RELOAD_KEY = "__devToolsHardReload";

export type HardReloadKind = "worker" | "patches";

export type HardReloadReason = {
  modId: string;
  kind: HardReloadKind;
  at: number;
};

export type HardReloadState = {
  reasons: HardReloadReason[];
};

type HardReloadGlobals = typeof globalThis & {
  [HARD_RELOAD_KEY]?: HardReloadState;
};

export function fileLabel(kind: HardReloadKind): string {
  return kind === "worker" ? "worker.js" : "patches.json";
}

export function hardReloadToastMessage(modId: string, kind: HardReloadKind): string {
  return `Restart the game (F5): ${modId} ${fileLabel(kind)} changed. Save reload is not enough.`;
}

export function recordHardReload(
  reason: HardReloadReason,
  globals: typeof globalThis = globalThis,
): HardReloadState {
  const g = globals as HardReloadGlobals;
  const prev = g[HARD_RELOAD_KEY];
  const reasons = Array.isArray(prev?.reasons) ? [...prev.reasons, reason] : [reason];
  const next = { reasons };
  g[HARD_RELOAD_KEY] = next;
  return next;
}

type ToastApi = {
  ui: {
    toast: (message: string, options?: Record<string, unknown>) => void;
  };
};

export function notifyHardReload(
  api: ToastApi,
  modId: string,
  kind: HardReloadKind,
  now = Date.now(),
): void {
  recordHardReload({ modId, kind, at: now });
  api.ui.toast(hardReloadToastMessage(modId, kind), {
    variant: "danger",
    duration: false,
    cooldownKey: `dev-tools.hard-reload.${modId}.${kind}`,
    cooldown: 2000,
  });
}

/**
 * Steam caches `worker.js` and `patches.json` at process start. Chromium
 * `?db_load=` may re-fetch HTTP files; that is not Steam behavior. Keep off.
 */
export const AUTO_SAVE_RELOAD_ON_HARD_RELOAD = false;

/** Navigate to `?db_load=` when a save id exists and auto-nav is on. */
export function tryNavigateSaveReload(
  saveId: string | null,
  options?: {
    assign?: (url: string) => void;
    enabled?: boolean;
    href?: string;
  },
): boolean {
  const enabled = options?.enabled ?? AUTO_SAVE_RELOAD_ON_HARD_RELOAD;
  if (!enabled || !saveId) return false;
  const href = options?.href ?? (typeof location === "undefined" ? "http://local/" : location.href);
  const assign =
    options?.assign ??
    ((url: string) => {
      location.assign(url);
    });
  assign(buildAutoLoadUrl(saveId, href).toString());
  return true;
}

export function tryHardReloadSaveNav(api: SandkitApi): boolean {
  if (!AUTO_SAVE_RELOAD_ON_HARD_RELOAD) return false;
  return tryNavigateSaveReload(resolveAutoLoadSaveId(api));
}
