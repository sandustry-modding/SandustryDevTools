/** Styled DevTools lines for hot-reload polling only. */

type ReloadLogLevel = "log" | "warn" | "error";

const PREFIX = "[dev-tools]";

function badgeCss(level: ReloadLogLevel): string {
  const palette: Record<ReloadLogLevel, { bg: string; fg: string; border: string }> = {
    log: { bg: "#0b1220", fg: "#7dd3fc", border: "#38bdf8" },
    warn: { bg: "#1a1205", fg: "#fbbf24", border: "#f59e0b" },
    error: { bg: "#1f0808", fg: "#fca5a5", border: "#ef4444" },
  };
  const { bg, fg, border } = palette[level];
  return [
    `background:${bg}`,
    `color:${fg}`,
    `border:1px solid ${border}`,
    "padding:1px 7px",
    "border-radius:4px",
    "font-weight:700",
    "font-size:11px",
    "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
    "letter-spacing:0.03em",
  ].join(";");
}

export function reloadLog(level: ReloadLogLevel, ...args: unknown[]): void {
  const native = globalThis.console[level] as (...args: unknown[]) => void;
  native.call(globalThis.console, `%c${PREFIX}`, badgeCss(level), ...args);
}
