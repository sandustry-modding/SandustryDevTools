/** Query keys that already start a game boot (same list as the game bundle). */
export const BOOT_QUERY_KEYS = [
  "new_game",
  "load",
  "db_load",
  "file_load",
  "custom_map",
  "external_map",
] as const;

/** sessionStorage key — skip auto-load after exit to main menu (page reload). */
export const AUTO_LOAD_SESSION_KEY = "dev-tools.autoLoadDone";

export type AutoLoadContext = {
  search: string;
  autoLoadEnabled: boolean;
  saveId: string | null;
  sessionDone: boolean;
  inGame: boolean;
};

/** True when the page URL already asks the game to boot a world. */
export function isBootQueryActive(search = window.location.search): boolean {
  const params = new URLSearchParams(search);
  return BOOT_QUERY_KEYS.some((key) => params.has(key));
}

/** True when this browser session already ran auto-load. */
export function autoLoadSessionDone(): boolean {
  try {
    return sessionStorage.getItem(AUTO_LOAD_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAutoLoadSessionDone(): void {
  try {
    sessionStorage.setItem(AUTO_LOAD_SESSION_KEY, "1");
  } catch {
    /* sessionStorage can throw in some embeds */
  }
}

/** Build the `?db_load=` URL used by auto-load redirects. */
export function buildAutoLoadUrl(saveId: string, href = window.location.href): URL {
  const url = new URL(href);
  url.search = "";
  url.searchParams.set("db_load", saveId);
  return url;
}

/** Shared gate for late auto-load in `tryAutoLoadSave`. */
export function shouldAutoLoad(ctx: AutoLoadContext): boolean {
  if (ctx.inGame || ctx.sessionDone || !ctx.autoLoadEnabled || !ctx.saveId) return false;
  return !isBootQueryActive(ctx.search);
}
