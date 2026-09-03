# Dev Tools

Local Sandustry mod. The game folder name is **`dev-tools`** (`mods/dev-tools`, from `modinfo.id`).

Manifest **`loadOrder`** is `-2147483648`. Session entry order may still run other mods first, so API-call logging is installed in an early boot patch before any mod `main.js`.

When **Watch local mods** is on, this mod polls other mods' `main.js` and re-evals the renderer bundle after a save. It also polls `patches.json`, and `worker.js` only when that mod has a worker. Those files cannot hot-eval: a danger toast tells you to **stop and start** the game (F5). Save reload (`?db_load=`) is not enough on Steam. Turn the setting on in **Options → Mods → Dev Tools**.

Settings live on this mod. Open **Options → Mods → Dev Tools**.

## Builds

This folder builds like any other `src/` mod. Boot helpers live in `patches.json` (always applied). `--mod irishbruse.dev-tools` builds only this folder.

## Settings

| Setting                   | Key               | Default     | Effect                                                                                                                                                                  |
| ------------------------- | ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mod enabled**           | `enabled`         | on          | Master switch for runtime helpers                                                                                                                                       |
| **Open DevTools on load** | `openDevTools`    | off         | Open Electron DevTools on load. Keep off under F5 and while MCP is on `:9222`                                                                                           |
| **F12 opens DevTools**    | `f12DevTools`     | off         | Capture-phase F12. Can disconnect an IDE debugger session                                                                                                               |
| **Auto-load save**        | `autoLoad`        | off         | On load, `location.assign` with `?db_load=<saveId>`. Skips splash and main menu. Legacy `autoBoot` prefs still count until you set `autoLoad`                           |
| **Start save**            | `startSave`       | Mod storage | **Last played** or **Mod storage**. **Mod storage** reads `api.storage` (`startSave`). Set the id from DevTools or another mod.                                         |
| **F3 debug overlay**      | `f3Debug`         | off         | F3 toggles the debug overlay. Vanilla Debug / Stats stay on while the mod is enabled                                                                                    |
| **Watch local mods**      | `watchLocalMods`  | off         | Poll other mods' `main.js` and re-eval the renderer bundle. Toast when `worker.js` or `patches.json` change (restart the game).                                         |
| **Fast dev boot**         | `fastBoot`        | off         | Skip `foliage.generate` on boot. Raster, shadows, and shader compile stay vanilla. Writes `localStorage`. Needs the boot patches in `patches.json`. Restart once after you turn it on |
| **Crisp canvas zoom**     | `crispCanvas`     | off         | Nearest-neighbour scaling on `#canvas` and `#overlay-canvas` so zoom stays sharp instead of blurry                                                                      |

Turn on **Watch local mods**, **Fast dev boot**, **Auto-load save**, **F3 debug overlay**, **Crisp canvas zoom**, **F12**, or **Open DevTools on load** when you want those helpers.

## Features

- **DevTools globals** (`main.ts`) — `sandkit`, `api`, `enums`, `react` on `globalThis` when the mod is enabled.
- **Open DevTools on load** (`boot/boot-menu.ts`) — retries until the Electron bridge is ready. Keep off under F5 and while MCP is on `:9222`.
- **F12 opens DevTools** (`boot/boot-menu.ts`) — capture-phase keydown.
- **Auto-load save** (`boot/boot-menu.ts`, `boot/auto-load-save.ts`) — reloads with `?db_load=` for the **Start save** pick.
- **F3 debug overlay** (`f3/F3DebugOverlay.tsx`) — Minecraft-style text HUD. Extend with `registerF3Section` / `globalThis.debugF3`.
- **Dev Tools** (`mod-inspector/`) — pause **Dev Tools** opens a 1100×720 panel. **Mods** tab: compact loaded-mod cards; **Open** fills the tab with details (description first, then contributes, then load meta); save issues stay collapsed. **Elements**: family sand table. **Chains**: pick an element. **Does** and **Comes from** list recipe hops. Depth 1 is one hop. The index includes engine builtins (Wet Sand shaker, Residue burn, Burnt Residue press, Water contacts) because those rows are not in `mods.recipes`.
- **Watch local mods** (`reload/`) — poll and re-eval other mods' renderer `main.js`. Toast when `worker.js` or `patches.json` change.
- **Fast dev boot** (`patches.json`, `boot/fast-boot.ts`) — when on, skips `foliage.generate` only. Raster fill, shadow rebuild, and outline compile stay vanilla. Restart once after you turn it on.
- **Crisp canvas zoom** (`boot/crisp-canvas.ts`) — injects `image-rendering: pixelated` on the world canvases. Toggle in **Options → Mods → dev-tools**.

## DevTools globals

This mod copies the live Sandkit objects onto `globalThis` for the browser console. In TypeScript, `sandkit` is already an ambient free variable. Use that name in mod code. Do not import a value binding. DevTools also gets `api`, `enums`, and `react` on `globalThis`.

- `sandkit`
- `api` (`sandkit.api`)
- `enums`
- `react`

## DevTools

- On first load, `openDevToolsOnStartup` calls `window.electron.openDevTools()` immediately and again at 250 ms, 750 ms, 1500 ms, and 3000 ms when **Open DevTools on load** is on. Opening Electron DevTools on top of an IDE attach drops the debugger. Keep that setting off under F5. Do not fetch `:9222` from the page.
- **F12** still opens Electron DevTools. That can disconnect an IDE CDP session. Prefer the IDE debugger panel when you launched with F5.
- The listener uses capture phase so the game does not swallow the key.

## Auto-load save

When **Auto-load save** is on, this mod resolves a save id from **Start save** and navigates like the game **Continue** path:

```ts
const url = new URL(window.location.href);
url.search = "";
url.searchParams.set("db_load", saveId);
location.assign(url.toString());
```

If that value is missing or the save is gone, auto-load falls back to last played.

It does nothing when:

- The URL already has a boot query (`db_load`, `new_game`, `load`, …)
- The session is already in-game
- There is no resolvable save
- Auto-load already ran this browser session (for example after you exit to the main menu and the page reloads)

## F3 debug overlay

When **F3 debug overlay** is on, **F3** toggles a Minecraft-style text overlay. Built-in sections show **Player** world/cell position and **Mouse** cell/world position while in-game. Vanilla Debug / Stats stay on while this mod is enabled.

Add sections from this mod:

```ts
import { registerF3Section } from "../f3/registry";

registerF3Section({
  id: "my-stats",
  title: "My mod",
  lines: () => [{ left: "Foo", right: "42" }],
});
```

After boot, `globalThis.debugF3.registerSection` is the same API for DevTools experiments.

## Watch local mods

When **Watch local mods** is on, this mod polls other **local** mods' `main.js` about twice per second. It uses `session.externalMods.orderedMods` with `discoveredVia: local`. It does not poll Workshop ids from the save order list. After `npm run dev` writes a new bundle, it re-evals that renderer entry with **that mod's** `sandkit` (stashed at first load as `globalThis.__sandkitByMod[id]`). It does not wrap this mod's `sandkit`.

On first load, this mod's `main.js` installs `__devToolsWrapSandkit` for dispose tracking. `stash-sandkit-by-mod` stashes the raw host, then passes a wrapped copy into `c(sandkit)`. Hot eval wraps again the same way.

Each reload runs tracked disposers first:

- `api.ui.inject` return functions
- `api.ui.regions.mount` via handle `unmount` (canonical 0.5.5+ API)
- `api.ui.overlays.register` via `overlays.unregister` (deprecated alias; still wrapped for older mods)
- `api.input.registerBinding` handlers (they stop after reload)
- `api.events.on`, `api.settings.onChange`, `api.hooks.intercept` / `modify`

Hot eval leaves `api.ui.toast` messages unchanged. The console logs `Reloaded <id> vN`.

When `worker.js` or `patches.json` change (any local mod, including this one), the poller does **not** eval them. It shows a danger toast: restart the game (F5). `globalThis.__devToolsHardReload.reasons` records `{ modId, kind, at }` for tests. Steam applies patches and worker source at **process** start. `?db_load=` / a page reload does not re-read those files. The Chromium integration host may re-fetch HTTP `worker.js`; that is not Steam behavior. Auto save-reload on those files stays **off**.

Content `register` calls (`elements`, `structures`, `i18n`, …) are not wrapped — they have no unregister and the game updates the same id on re-register.

It does not:

- Hot-eval this mod's `main.js`
- Reload `worker.js` into sim workers
- Re-apply `patches.json`

Restart the game (stop and start / F5) for workers and patches. Restart once after a `patches.json` change (the per-mod `sandkit` stash is a boot patch).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
