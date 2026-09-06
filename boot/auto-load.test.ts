import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_LOAD_SESSION_KEY,
  autoLoadSessionDone,
  buildAutoLoadUrl,
  isBootQueryActive,
  markAutoLoadSessionDone,
  shouldAutoLoad,
} from "./auto-load.ts";

function mockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test("isBootQueryActive matches known boot query keys", () => {
  assert.equal(isBootQueryActive("?db_load=abc"), true);
  assert.equal(isBootQueryActive("?new_game=1"), true);
  assert.equal(isBootQueryActive(""), false);
});

test("shouldAutoLoad rejects in-game, session done, and active boot query", () => {
  assert.equal(
    shouldAutoLoad({
      search: "",
      autoLoadEnabled: true,
      saveId: "save-1",
      sessionDone: false,
      inGame: true,
    }),
    false,
  );
  assert.equal(
    shouldAutoLoad({
      search: "?db_load=abc",
      autoLoadEnabled: true,
      saveId: "save-1",
      sessionDone: false,
      inGame: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoLoad({
      search: "",
      autoLoadEnabled: true,
      saveId: "save-1",
      sessionDone: true,
      inGame: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoLoad({
      search: "",
      autoLoadEnabled: true,
      saveId: "save-1",
      sessionDone: false,
      inGame: false,
    }),
    true,
  );
});

test("buildAutoLoadUrl clears other query params", () => {
  const url = buildAutoLoadUrl("save-1", "https://game.test/?foo=1");
  assert.equal(url.search, "?db_load=save-1");
});

test("autoLoadSessionDone uses the current session key only", () => {
  const session = mockStorage();
  const originalSession = globalThis.sessionStorage;
  Object.defineProperty(globalThis, "sessionStorage", { value: session, configurable: true });
  try {
    assert.equal(autoLoadSessionDone(), false);
    session.setItem("irishbruse.debug:autoLoadDone", "1");
    session.setItem("hot-reload.autoLoadDone", "1");
    assert.equal(autoLoadSessionDone(), false);
    markAutoLoadSessionDone();
    assert.equal(session.getItem(AUTO_LOAD_SESSION_KEY), "1");
    assert.equal(autoLoadSessionDone(), true);
  } finally {
    Object.defineProperty(globalThis, "sessionStorage", {
      value: originalSession,
      configurable: true,
    });
  }
});
