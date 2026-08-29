import assert from "node:assert/strict";
import test from "node:test";
import type { WatchedFile } from "./discover.ts";
import { applySettledWatch, classifyWatchAction } from "./watch.ts";

test("classifyWatchAction skips companion main and hot-evals sibling main", () => {
  assert.equal(classifyWatchAction("main", true), "skip");
  assert.equal(classifyWatchAction("main", false), "hot-eval");
  assert.equal(classifyWatchAction("worker", true), "hard-reload");
  assert.equal(classifyWatchAction("worker", false), "hard-reload");
  assert.equal(classifyWatchAction("patches", false), "hard-reload");
});

test("applySettledWatch does not hot-eval worker or patches", async () => {
  const seen: string[] = [];
  const worker: WatchedFile = {
    id: "example.worker-api",
    kind: "worker",
    url: "file:///mods/example.worker-api/worker.js",
  };
  const patches: WatchedFile = {
    id: "dev-tools",
    kind: "patches",
    url: "file:///mods/dev-tools/patches.json",
  };
  const selfMain: WatchedFile = {
    id: "dev-tools",
    kind: "main",
    url: "file:///mods/dev-tools/main.js",
  };
  const siblingMain: WatchedFile = {
    id: "author.template",
    kind: "main",
    url: "file:///mods/author.template/main.js",
  };

  await applySettledWatch(worker, "dev-tools", "w", {
    hotEval: async (id) => {
      seen.push(`hot:${id}`);
    },
    hardReload: (id, kind) => {
      seen.push(`hard:${id}:${kind}`);
    },
  });
  await applySettledWatch(patches, "dev-tools", "p", {
    hotEval: async (id) => {
      seen.push(`hot:${id}`);
    },
    hardReload: (id, kind) => {
      seen.push(`hard:${id}:${kind}`);
    },
  });
  await applySettledWatch(selfMain, "dev-tools", "m", {
    hotEval: async (id) => {
      seen.push(`hot:${id}`);
    },
    hardReload: (id, kind) => {
      seen.push(`hard:${id}:${kind}`);
    },
  });
  await applySettledWatch(siblingMain, "dev-tools", "m2", {
    hotEval: async (id) => {
      seen.push(`hot:${id}`);
    },
    hardReload: (id, kind) => {
      seen.push(`hard:${id}:${kind}`);
    },
  });

  assert.deepEqual(seen, [
    "hard:example.worker-api:worker",
    "hard:dev-tools:patches",
    "hot:author.template",
  ]);
});
