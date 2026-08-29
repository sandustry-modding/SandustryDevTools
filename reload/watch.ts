import type { HardReloadKind } from "./hard-reload.ts";
import type { WatchedFile, WatchedKind } from "./discover.ts";

export type WatchAction = "hot-eval" | "hard-reload" | "skip";

export type SettledWatchHandlers = {
  hotEval: (id: string, text: string) => Promise<void>;
  hardReload: (id: string, kind: HardReloadKind) => void;
};

/** Companion `main.js` is not hot-evaled. Worker and patches need a process restart. */
export function classifyWatchAction(kind: WatchedKind, isSelf: boolean): WatchAction {
  if (kind === "main") return isSelf ? "skip" : "hot-eval";
  return "hard-reload";
}

export function applySettledWatch(
  file: WatchedFile,
  selfId: string,
  text: string,
  handlers: SettledWatchHandlers,
): Promise<void> | void {
  const action = classifyWatchAction(file.kind, file.id === selfId);
  if (action === "skip") return;
  if (action === "hot-eval") return handlers.hotEval(file.id, text);
  if (file.kind === "main") return;
  handlers.hardReload(file.id, file.kind);
}
