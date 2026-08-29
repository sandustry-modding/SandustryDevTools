import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_SAVE_RELOAD_ON_HARD_RELOAD,
  HARD_RELOAD_KEY,
  hardReloadToastMessage,
  notifyHardReload,
  recordHardReload,
  tryNavigateSaveReload,
  type HardReloadState,
} from "./hard-reload.ts";

test("recordHardReload appends reasons on globalThis", () => {
  const g = {} as typeof globalThis;
  recordHardReload({ modId: "a", kind: "worker", at: 1 }, g);
  recordHardReload({ modId: "a", kind: "patches", at: 2 }, g);
  const bag = (g as typeof g & { [HARD_RELOAD_KEY]?: HardReloadState })[HARD_RELOAD_KEY];
  assert.deepEqual(bag?.reasons, [
    { modId: "a", kind: "worker", at: 1 },
    { modId: "a", kind: "patches", at: 2 },
  ]);
});

test("notifyHardReload toasts with danger variant and records the reason", () => {
  const seen: unknown[] = [];
  const g = globalThis as typeof globalThis & { [HARD_RELOAD_KEY]?: HardReloadState };
  const prev = g[HARD_RELOAD_KEY];
  delete g[HARD_RELOAD_KEY];
  try {
    notifyHardReload(
      {
        ui: {
          toast: (message, options) => {
            seen.push([message, options]);
          },
        },
      },
      "example.worker-api",
      "worker",
      9,
    );
    assert.deepEqual(seen, [
      [
        hardReloadToastMessage("example.worker-api", "worker"),
        {
          variant: "danger",
          duration: false,
          cooldownKey: "dev-tools.hard-reload.example.worker-api.worker",
          cooldown: 2000,
        },
      ],
    ]);
    const reasons = g[HARD_RELOAD_KEY]?.reasons ?? [];
    const last = reasons[reasons.length - 1];
    assert.equal(last?.kind, "worker");
  } finally {
    if (prev) g[HARD_RELOAD_KEY] = prev;
    else delete g[HARD_RELOAD_KEY];
  }
});

test("tryNavigateSaveReload is off by default", () => {
  const assigned: Array<string> = [];
  const capture = (url: string): void => {
    assigned.push(url);
  };
  assert.equal(AUTO_SAVE_RELOAD_ON_HARD_RELOAD, false);
  assert.equal(tryNavigateSaveReload("save-1", { assign: capture }), false);
  assert.deepEqual(assigned, []);
  assert.equal(
    tryNavigateSaveReload("save-1", {
      assign: capture,
      enabled: true,
      href: "http://game/index.html",
    }),
    true,
  );
  assert.equal(assigned.length, 1);
  assert.match(assigned[0] ?? "", /db_load=save-1/);
});
