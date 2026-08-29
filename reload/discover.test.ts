import assert from "node:assert/strict";
import test from "node:test";
import {
  collectModIds,
  discoverLocalMods,
  isLocalExternalMod,
  modsStateFromStore,
  orderedModsFromSession,
  resolveModsState,
  rewriteFileUrl,
  rewriteMainUrl,
  discoverWatchedFiles,
  replaceAssetFile,
  watchKey,
} from "./discover.ts";

test("collectModIds skips the companion id and dedupes", () => {
  assert.deepEqual(
    collectModIds(
      [
        { id: "dev-tools" },
        { id: "author.template" },
        { modId: "author.template" },
        "events-example",
      ],
      "dev-tools",
    ),
    ["author.template", "events-example"],
  );
});

test("collectModIds reads object maps keyed by id", () => {
  assert.deepEqual(
    collectModIds({ "author.template": { id: "author.template" }, "dev-tools": {} }, "dev-tools"),
    ["author.template"],
  );
});

test("rewriteMainUrl swaps workshop and file paths", () => {
  assert.equal(
    rewriteMainUrl("sandkit-workshop://dev-tools/main.js", "dev-tools", "author.template"),
    "sandkit-workshop://author.template/main.js",
  );
  assert.equal(
    rewriteMainUrl(
      "file:///home/me/.config/sandustry/mods/dev-tools/main.js",
      "dev-tools",
      "author.template",
    ),
    "file:///home/me/.config/sandustry/mods/author.template/main.js",
  );
  assert.equal(
    rewriteMainUrl(
      "file:///C:/Users/me/AppData/Roaming/sandustry/mods/dev-tools/main.js",
      "dev-tools",
      "a",
    ),
    "file:///C:/Users/me/AppData/Roaming/sandustry/mods/a/main.js",
  );
});

test("rewriteMainUrl falls back to workshop protocol", () => {
  assert.equal(
    rewriteMainUrl("blob:unknown", "dev-tools", "author.template"),
    "sandkit-workshop://author.template/main.js",
  );
});

test("replaceAssetFile swaps the last path segment", () => {
  assert.equal(
    replaceAssetFile("sandkit-workshop://dev-tools/main.js", "worker.js"),
    "sandkit-workshop://dev-tools/worker.js",
  );
  assert.equal(
    replaceAssetFile("file:///mods/dev-tools/main.js?x=1", "patches.json"),
    "file:///mods/dev-tools/patches.json?x=1",
  );
});

test("rewriteFileUrl uses self main for the companion", () => {
  assert.equal(
    rewriteFileUrl("file:///mods/dev-tools/main.js", "dev-tools", "dev-tools", "worker.js"),
    "file:///mods/dev-tools/worker.js",
  );
  assert.equal(
    rewriteFileUrl(
      "file:///mods/dev-tools/main.js",
      "dev-tools",
      "author.template",
      "patches.json",
    ),
    "file:///mods/author.template/patches.json",
  );
});

test("watchKey is unique per mod and file kind", () => {
  assert.equal(watchKey("a", "main"), "a:main");
  assert.notEqual(watchKey("a", "main"), watchKey("a", "worker"));
});

test("discoverLocalMods skips self", () => {
  const mods = discoverLocalMods("dev-tools", "sandkit-workshop://dev-tools/main.js", [
    { id: "dev-tools" },
    { id: "author.template" },
  ]);
  assert.deepEqual(mods, [
    { id: "author.template", mainUrl: "sandkit-workshop://author.template/main.js" },
  ]);
});

test("discoverWatchedFiles includes companion worker and patches", () => {
  const files = discoverWatchedFiles("dev-tools", "file:///mods/dev-tools/main.js", [
    {
      manifest: { id: "dev-tools" },
      rootUrl: "file:///mods/dev-tools/",
      workshop: { itemId: null, discoveredVia: ["local"] },
    },
    {
      manifest: { id: "author.template" },
      rootUrl: "file:///mods/author.template/",
      workshop: { itemId: null, discoveredVia: ["local"] },
    },
  ]);
  assert.deepEqual(
    files.filter((f) => f.kind !== "main"),
    [
      { id: "dev-tools", kind: "worker", url: "file:///mods/dev-tools/worker.js" },
      { id: "dev-tools", kind: "patches", url: "file:///mods/dev-tools/patches.json" },
      { id: "author.template", kind: "worker", url: "file:///mods/author.template/worker.js" },
      { id: "author.template", kind: "patches", url: "file:///mods/author.template/patches.json" },
    ],
  );
  assert.ok(files.some((f) => f.id === "dev-tools" && f.kind === "main"));
  assert.ok(files.some((f) => f.id === "author.template" && f.kind === "main"));
});

test("modsStateFromStore reads __sandkitExternalRuntimeV1.order", () => {
  const order = [{ id: "dev-tools" }, { id: "author.template", version: "0.0.1" }];
  assert.deepEqual(
    modsStateFromStore({
      items: {},
      __sandkitExternalRuntimeV1: { version: 1, order },
    }),
    order,
  );
  assert.equal(modsStateFromStore({ items: {} }), undefined);
});

test("isLocalExternalMod requires discoveredVia local", () => {
  assert.equal(
    isLocalExternalMod({
      manifest: { id: "author.template" },
      workshop: { itemId: null, discoveredVia: ["local"] },
    }),
    true,
  );
  assert.equal(
    isLocalExternalMod({
      manifest: { id: "workshop.mod" },
      workshop: { itemId: 1, discoveredVia: ["workshop"] },
    }),
    false,
  );
});

test("discoverLocalMods polls local orderedMods and skips Workshop", () => {
  const mods = discoverLocalMods("dev-tools", "file:///mods/dev-tools/main.js", [
    {
      manifest: { id: "dev-tools" },
      rootUrl: "file:///mods/dev-tools/",
      workshop: { itemId: null, discoveredVia: ["local"] },
    },
    {
      manifest: { id: "author.template" },
      rootUrl: "file:///mods/author.template/",
      workshop: { itemId: null, discoveredVia: ["local"] },
    },
    {
      manifest: { id: "workshop.mod" },
      rootUrl: "sandkit-workshop://workshop.mod/",
      workshop: { itemId: 99, discoveredVia: ["workshop"] },
    },
  ]);
  assert.deepEqual(mods, [
    { id: "author.template", mainUrl: "file:///mods/author.template/main.js" },
  ]);
});

test("discoverLocalMods does not poll Workshop-only orderedMods", () => {
  assert.deepEqual(
    discoverLocalMods("dev-tools", "file:///mods/dev-tools/main.js", [
      {
        manifest: { id: "workshop.mod" },
        rootUrl: "sandkit-workshop://workshop.mod/",
        workshop: { itemId: 99, discoveredVia: ["workshop"] },
      },
    ]),
    [],
  );
});

test("orderedModsFromSession reads session.externalMods.orderedMods", () => {
  const ordered = [{ manifest: { id: "author.template" } }];
  assert.deepEqual(orderedModsFromSession({ externalMods: { orderedMods: ordered } }), ordered);
  assert.equal(orderedModsFromSession({}), undefined);
});

test("resolveModsState does not fall back to Workshop order while orderedMods is missing", () => {
  assert.deepEqual(resolveModsState({ externalMods: {} }), []);
  assert.deepEqual(
    resolveModsState({
      externalMods: { orderedMods: [{ manifest: { id: "author.template" } }] },
    }),
    [{ manifest: { id: "author.template" } }],
  );
  assert.deepEqual(resolveModsState({}), []);
  assert.deepEqual(resolveModsState(undefined), []);
});
