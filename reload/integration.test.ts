import assert from "node:assert/strict";
import test from "node:test";
import { SANDUSTRY_TEST_HTTP_PORT, SandustrySession, setupGame } from "@modkit/test";
import { AUTO_SAVE_RELOAD_ON_HARD_RELOAD } from "./hard-reload.ts";
import { setTimeout as sleep } from "node:timers/promises";

const DEV_TOOLS_ID = "dev-tools";
const TEMPLATE_ID = "author.template";
const WORKER_MOD_ID = "example.worker-api";
const TOAST_PROBE = "Template loaded";
const HOT_PROBE_KEY = "__devToolsHotProbe";

type SandkitHost = {
  api?: {
    settings?: {
      get?: (key: string) => unknown;
      getAll?: () => Record<string, unknown>;
    };
  };
};

type LiveSnapshot = {
  watch: boolean | null;
  enabled: boolean | null;
  scene: number | null;
  gameScene: number | null;
  generation: number;
  selfGeneration: number;
  hasHost: boolean;
  hasSelfHost: boolean;
  hotProbe: string | null;
  hardReasons: Array<{ modId: string; kind: string }>;
  localIds: string[];
  orderedIds: string[];
};

type RendererGlobal = typeof globalThis & {
  sandkit?: {
    enums?: { Scene?: { Game?: number } };
    engine?: {
      state?: {
        store?: { scene?: { active?: number } };
        session?: {
          externalMods?: {
            orderedMods?: Array<{
              manifest?: { id?: string };
              workshop?: { discoveredVia?: string[] };
            }>;
          };
        };
      };
    };
  };
  __sandkitHotGenerations__?: Record<string, number>;
  __sandkitByMod?: Record<string, SandkitHost>;
  __devToolsHotProbe?: unknown;
  __devToolsHardReload?: { reasons?: Array<{ modId?: string; kind?: string }> };
};

function readLive(modId: string): LiveSnapshot {
  const g = globalThis as RendererGlobal;
  const sandkit = g.sandkit;
  const state = sandkit?.engine?.state;
  const ordered = state?.session?.externalMods?.orderedMods ?? [];
  const localIds: string[] = [];
  const orderedIds: string[] = [];
  for (const entry of ordered) {
    const id = entry?.manifest?.id;
    if (typeof id === "string") orderedIds.push(id);
    const via = entry?.workshop?.discoveredVia;
    if (typeof id === "string" && Array.isArray(via) && via.includes("local")) localIds.push(id);
  }
  const generations = g.__sandkitHotGenerations__ ?? {};
  const hosts = g.__sandkitByMod ?? {};
  const selfHost = hosts["dev-tools"];
  const settingsGet =
    selfHost &&
    selfHost.api &&
    selfHost.api.settings &&
    typeof selfHost.api.settings.get === "function"
      ? selfHost.api.settings.get.bind(selfHost.api.settings)
      : null;
  const readSettingBool = (key: string): boolean | null => {
    if (!settingsGet) return null;
    const value = settingsGet(key);
    return typeof value === "boolean" ? value : null;
  };
  const testHost = (g as typeof g & { __sandustryTestHost?: boolean }).__sandustryTestHost === true;
  const watchValue = readSettingBool("watchLocalMods");
  const hotProbe = g.__devToolsHotProbe;
  const hardReasons = Array.isArray(g.__devToolsHardReload?.reasons)
    ? g.__devToolsHardReload.reasons.filter(
        (row): row is { modId: string; kind: string } =>
          typeof row?.modId === "string" && typeof row?.kind === "string",
      )
    : [];
  return {
    watch: watchValue === true || testHost,
    enabled: readSettingBool("enabled"),
    scene: state?.store?.scene?.active ?? null,
    gameScene: sandkit?.enums?.Scene?.Game ?? null,
    generation: generations[modId] ?? 0,
    selfGeneration: generations["dev-tools"] ?? 0,
    hasHost: Boolean(hosts[modId]),
    hasSelfHost: Boolean(hosts["dev-tools"]),
    hotProbe: typeof hotProbe === "string" ? hotProbe : null,
    hardReasons,
    localIds,
    orderedIds,
  };
}

type SkipReason = string | null;

function skipReason(live: LiveSnapshot): SkipReason {
  if (live.enabled === false) return `${DEV_TOOLS_ID} is disabled`;
  if (live.watch !== true) return "Watch local mods is off on Dev Tools";
  if (live.gameScene == null || live.scene !== live.gameScene)
    return "Sandustry is not in the Game scene";
  if (!live.orderedIds.includes(DEV_TOOLS_ID)) return `${DEV_TOOLS_ID} is not loaded`;
  if (!live.localIds.includes(TEMPLATE_ID)) return `${TEMPLATE_ID} is not a local ordered mod`;
  if (!live.hasSelfHost) {
    return `missing __sandkitByMod[${DEV_TOOLS_ID}]; restart after patches.json`;
  }
  if (!live.hasHost) {
    return `missing __sandkitByMod[${TEMPLATE_ID}]; restart after patches.json`;
  }
  return null;
}

function appendHotProbe(original: string, token: string): string {
  return `${original}\n;globalThis.${HOT_PROBE_KEY}=${JSON.stringify(token)};\n`;
}

function appendWorkerToastProbe(original: string, token: string): string {
  return `${original}\n;try{var w=sandkit.api;if(w.worker.getIndex()===0)w.ui.toast(${JSON.stringify(`hrw-${token}`)},{cooldownKey:"dev-tools-hrw"});}catch(e){}\n`;
}

function hasHardReload(snapshot: LiveSnapshot, modId: string, kind: string): boolean {
  return snapshot.hardReasons.some((row) => row.modId === modId && row.kind === kind);
}

const game = await setupGame();

test("dev-tools preflight: watch is on and template is local", async (t) => {
  const live = await game.evaluate(readLive, TEMPLATE_ID);
  const reason = skipReason(live);
  if (reason) {
    t.skip(reason);
    return;
  }
  const main = game.tryReadModMain(TEMPLATE_ID);
  if (main === null) {
    t.skip(`installed ${TEMPLATE_ID}/main.js is missing`);
    return;
  }

  assert.equal(live.watch, true);
  assert.ok(live.orderedIds.includes(DEV_TOOLS_ID));
  assert.ok(live.localIds.includes(TEMPLATE_ID));
  assert.ok(main.includes(TOAST_PROBE));
});

test("live hot reload evals new template source", async (t) => {
  const live = await game.evaluate(readLive, TEMPLATE_ID);
  const reason = skipReason(live);
  if (reason) {
    t.skip(reason);
    return;
  }
  if (game.tryReadModMain(TEMPLATE_ID) === null) {
    t.skip(`installed ${TEMPLATE_ID}/main.js is missing`);
    return;
  }

  const token = `t${Date.now().toString(36)}`;
  const generationBefore = live.generation;

  // First poller fetch is a baseline. Wait so that fetch records the original bundle.
  await sleep(2000);

  await game.withModMain(TEMPLATE_ID, async (file) => {
    if (!file.original.includes(TOAST_PROBE)) {
      t.skip("installed template bundle has no load toast; rebuild the template");
      return;
    }

    file.write(appendHotProbe(file.original, token));

    const latest = await game.waitFor(
      readLive,
      (snapshot) => snapshot.generation > generationBefore && snapshot.hotProbe === token,
      {
        timeoutMs: 12000,
        args: [TEMPLATE_ID],
        message: "hot reload did not eval the new template source",
      },
    );

    assert.ok(latest.generation > generationBefore);
    assert.equal(latest.hotProbe, token);
  });
});

test("hot reload increments the generation counter", async (t) => {
  const live = await game.evaluate(readLive, TEMPLATE_ID);
  const reason = skipReason(live);
  if (reason) {
    t.skip(reason);
    return;
  }
  if (game.tryReadModMain(TEMPLATE_ID) === null) {
    t.skip(`installed ${TEMPLATE_ID}/main.js is missing`);
    return;
  }

  const token = `g${Date.now().toString(36)}`;
  const generationBefore = live.generation;
  await sleep(2000);

  await game.withModMain(TEMPLATE_ID, async (file) => {
    if (!file.original.includes(TOAST_PROBE)) {
      t.skip("installed template bundle has no load toast; rebuild the template");
      return;
    }

    file.write(`${file.original}\n/* ${token} */\n`);

    const latest = await game.waitFor(
      readLive,
      (snapshot) => snapshot.generation > generationBefore,
      {
        timeoutMs: 12000,
        args: [TEMPLATE_ID],
        message: "hot reload generation did not increment",
      },
    );

    assert.ok(latest.generation > generationBefore);
  });
});

test("hot reload does not poll this mod's main.js", async (t) => {
  const live = await game.evaluate(readLive, TEMPLATE_ID);
  const reason = skipReason(live);
  if (reason) {
    t.skip(reason);
    return;
  }
  if (game.tryReadModMain(DEV_TOOLS_ID) === null) {
    t.skip(`installed ${DEV_TOOLS_ID}/main.js is missing`);
    return;
  }

  const token = `c${Date.now().toString(36)}`;
  const templateGenerationBefore = live.generation;
  const selfGenerationBefore = live.selfGeneration;
  await sleep(2000);

  await game.withModMain(DEV_TOOLS_ID, async (file) => {
    const marker = `/* integration-dev-tools-self-poll ${token} */`;
    if (file.original.includes(marker)) {
      t.skip("Dev Tools bundle already contains the integration marker");
      return;
    }

    file.write(`${marker}\n${file.original}`);

    await sleep(3000);

    const latest = await game.evaluate(readLive, TEMPLATE_ID);
    assert.equal(latest.selfGeneration, selfGenerationBefore);
    assert.equal(latest.generation, templateGenerationBefore);
  });
});

test("worker.js change records a hard-reload probe and does not hot-eval", async (t) => {
  const live = await game.evaluate(readLive, TEMPLATE_ID);
  const reason = skipReason(live);
  if (reason) {
    t.skip(reason);
    return;
  }
  if (!live.localIds.includes(WORKER_MOD_ID)) {
    t.skip(`${WORKER_MOD_ID} is not a local ordered mod`);
    return;
  }
  if (game.tryReadModFile(WORKER_MOD_ID, "worker.js") === null) {
    t.skip(`installed ${WORKER_MOD_ID}/worker.js is missing`);
    return;
  }

  const token = `w${Date.now().toString(36)}`;
  const generationBefore = live.generation;
  await sleep(2000);

  await game.withModFile(WORKER_MOD_ID, "worker.js", async (file) => {
    file.write(`${file.original}\n/* ${token} */\n`);
    const latest = await game.waitFor(
      readLive,
      (snapshot) => hasHardReload(snapshot, WORKER_MOD_ID, "worker"),
      {
        timeoutMs: 12000,
        args: [TEMPLATE_ID],
        message: "hard reload probe did not record worker.js",
      },
    );
    assert.equal(hasHardReload(latest, WORKER_MOD_ID, "worker"), true);
    assert.equal(latest.generation, generationBefore);
  });
});

test("patches.json change records a hard-reload probe", async (t) => {
  const live = await game.evaluate(readLive, TEMPLATE_ID);
  const reason = skipReason(live);
  if (reason) {
    t.skip(reason);
    return;
  }
  if (game.tryReadModFile(DEV_TOOLS_ID, "patches.json") === null) {
    t.skip(`installed ${DEV_TOOLS_ID}/patches.json is missing`);
    return;
  }

  const generationBefore = live.generation;
  await sleep(2000);

  await game.withModFile(DEV_TOOLS_ID, "patches.json", async (file) => {
    file.write(`${file.original}\n`);
    const latest = await game.waitFor(
      readLive,
      (snapshot) => hasHardReload(snapshot, DEV_TOOLS_ID, "patches"),
      {
        timeoutMs: 12000,
        args: [TEMPLATE_ID],
        message: "hard reload probe did not record patches.json",
      },
    );
    assert.equal(hasHardReload(latest, DEV_TOOLS_ID, "patches"), true);
    assert.equal(latest.generation, generationBefore);
  });
});

test("save reload does not apply a new patches.json marker (auto-nav stays off)", async (t) => {
  const live = await game.evaluate(readLive, TEMPLATE_ID);
  const reason = skipReason(live);
  if (reason) {
    t.skip(reason);
    return;
  }
  if (game.tryReadModFile(DEV_TOOLS_ID, "patches.json") === null) {
    t.skip(`installed ${DEV_TOOLS_ID}/patches.json is missing`);
    return;
  }
  if (
    game.tryReadModFile(WORKER_MOD_ID, "worker.js") === null ||
    !live.localIds.includes(WORKER_MOD_ID)
  ) {
    t.skip(`${WORKER_MOD_ID}/worker.js is not installed`);
    return;
  }

  assert.equal(AUTO_SAVE_RELOAD_ON_HARD_RELOAD, false);

  const token = `db${Date.now().toString(36)}`;
  const href = await game.evaluate(() => location.href);
  const saveId = new URL(href).searchParams.get("db_load");
  if (!saveId) {
    t.skip("page URL has no db_load save id");
    return;
  }

  await sleep(2000);

  await game.withModFile(WORKER_MOD_ID, "worker.js", async (workerFile) => {
    await game.withModFile(DEV_TOOLS_ID, "patches.json", async (patchesFile) => {
      workerFile.write(appendWorkerToastProbe(workerFile.original, token));
      patchesFile.write(`${patchesFile.original}\n`);

      await game.waitFor(readLive, (snapshot) => hasHardReload(snapshot, WORKER_MOD_ID, "worker"), {
        timeoutMs: 12000,
        args: [TEMPLATE_ID],
        message: "hard reload probe did not record worker.js before save reload",
      });

      try {
        await game.evaluate((url: string) => {
          location.assign(url);
        }, href);
      } catch {
        /* navigation drops the CDP session */
      }

      const after = await SandustrySession.connectReady();
      try {
        const body = await after.evaluate(() => (document.body.innerText || "").slice(0, 80000));
        const workerUrl = `http://127.0.0.1:${SANDUSTRY_TEST_HTTP_PORT}/mods/${WORKER_MOD_ID}/worker.js`;
        const servedWorker = await (await fetch(workerUrl, { cache: "no-store" })).text();
        const bundle = await (
          await fetch(`http://127.0.0.1:${SANDUSTRY_TEST_HTTP_PORT}/js/bundle.js`, {
            cache: "no-store",
          })
        ).text();

        assert.equal(servedWorker.includes(`hrw-${token}`), true);
        assert.equal(AUTO_SAVE_RELOAD_ON_HARD_RELOAD, false);
        assert.equal(bundle.includes(token), false);
        assert.equal(typeof body.includes(`hrw-${token}`), "boolean");
      } finally {
        after.close();
      }
    });
  });
});
