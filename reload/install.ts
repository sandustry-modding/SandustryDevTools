import { inGame } from "@modkit/utils";
import { discoverWatchedFiles, readModsState, watchKey, type WatchedFile } from "./discover.ts";
import {
  AUTO_SAVE_RELOAD_ON_HARD_RELOAD,
  notifyHardReload,
  tryHardReloadSaveNav,
  type HardReloadKind,
} from "./hard-reload.ts";
import { hotEvalMain } from "./hot-eval.ts";
import { sandkitHostForMod } from "./host.ts";
import { decideReload, fetchMain } from "./poll.ts";
import { applySettledWatch, classifyWatchAction } from "./watch.ts";

const POLL_MS = 500;

function selfMainUrl(api: SandkitApi, selfId: string): string {
  try {
    const url = api.assets.getUrl("main.js");
    if (typeof url === "string" && url.length > 0) return url;
  } catch {
    /* fall through */
  }
  return `sandkit-workshop://${selfId}/main.js`;
}

type FetchResult = {
  file: WatchedFile;
  text: string | null;
};

/**
 * Poll local `main.js` (hot eval), `worker.js`, and `patches.json`.
 * Companion `main.js` is not re-evaled. Worker and patches toast for a process restart.
 */
export function installLocalModReload(api: SandkitApi, selfId: string): () => void {
  const companionMain = selfMainUrl(api, selfId);
  const lastApplied = new Map<string, string>();
  const pending = new Map<string, string>();
  const missingHost = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  async function applyHotEval(modId: string, text: string, key: string): Promise<void> {
    const host = sandkitHostForMod(modId);
    if (!host) {
      if (!missingHost.has(modId)) {
        missingHost.add(modId);
        console.error(`hot reload skipped for ${modId}: missing sandkit host`);
      }
      return;
    }
    missingHost.delete(modId);
    try {
      const generation = await hotEvalMain(modId, text, host);
      lastApplied.set(key, text);
      console.log(`Reloaded ${modId} v${generation}`);
    } catch (error) {
      console.error(`hot reload failed for ${modId}`, error);
    }
  }

  function applyHardReload(modId: string, kind: HardReloadKind, text: string, key: string): void {
    lastApplied.set(key, text);
    notifyHardReload(api, modId, kind);
    console.warn(`hard reload needed: ${modId} ${kind}`);
    if (AUTO_SAVE_RELOAD_ON_HARD_RELOAD && inGame()) tryHardReloadSaveNav(api);
  }

  async function tick(): Promise<void> {
    const files = discoverWatchedFiles(selfId, companionMain, readModsState());
    const fetched: FetchResult[] = await Promise.all(
      files.map(async (file) => ({ file, text: await fetchMain(file.url) })),
    );

    for (const { file, text } of fetched) {
      if (text == null) continue;
      const key = watchKey(file.id, file.kind);

      const decision = decideReload(lastApplied.get(key), pending.get(key), text);
      if (decision === "skip") {
        pending.delete(key);
        continue;
      }
      if (decision === "baseline") {
        lastApplied.set(key, text);
        pending.delete(key);
        continue;
      }
      if (decision === "arm") {
        pending.set(key, text);
        continue;
      }

      pending.delete(key);
      const action = classifyWatchAction(file.kind, file.id === selfId);
      if (action === "skip") {
        lastApplied.set(key, text);
        continue;
      }
      await applySettledWatch(file, selfId, text, {
        hotEval: (id, source) => applyHotEval(id, source, key),
        hardReload: (id, kind) => applyHardReload(id, kind, text, key),
      });
    }
  }

  async function loop(): Promise<void> {
    if (stopped) return;
    try {
      await tick();
    } catch (error) {
      console.error("hot reload poll failed", error);
    }
    if (!stopped) timer = setTimeout(() => void loop(), POLL_MS);
  }

  void loop();

  return () => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}
