# Dev Tools

Local Sandustry mod. The game folder name is **`dev-tools`** (`mods/dev-tools`, from `modinfo.id`).

Manifest **`loadOrder`** is `-2147483648`.

Settings live on this mod. Open **Options → Mods → Dev Tools**.

## Builds

This folder builds like any other `src/` mod. `--mod irishbruse.dev-tools` builds only this folder.

## Settings

| Setting                   | Key               | Default     | Effect                                                                                                                                                                  |
| ------------------------- | ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mod enabled**           | `enabled`         | on          | Master switch for runtime helpers                                                                                                                                       |
| **Open DevTools on load** | `openDevTools`    | off         | Open Electron DevTools on load. Keep off under F5 and while MCP is on `:9222`                                                                                           |
| **F12 opens DevTools**    | `f12DevTools`     | off         | Capture-phase F12. Can disconnect an IDE debugger session                                                                                                               |
| **Auto-load save**        | `autoLoad`        | off         | On first load, `location.assign` with `?db_load=<saveId>`. Legacy `autoBoot` prefs still count until you set `autoLoad`                                                 |
| **Start save**            | `startSave`       | Mod storage | **Last played** or **Mod storage**. **Mod storage** reads `api.storage` (`startSave`). Set the id from DevTools or another mod.                                         |
| **F3 debug overlay**      | `f3Debug`         | off         | F3 toggles the debug overlay. Vanilla Debug / Stats stay on while the mod is enabled                                                                                    |
| **Crisp canvas zoom**     | `crispCanvas`     | off         | Nearest-neighbour scaling on `#canvas` and `#overlay-canvas` so zoom stays sharp instead of blurry                                                                      |

Turn on **Auto-load save**, **F3 debug overlay**, **Crisp canvas zoom**, **F12**, or **Open DevTools on load** when you want those helpers.

## Features

- **DevTools globals** (`main.ts`) — `sandkit`, `api`, `enums`, `react` on `globalThis` when the mod is enabled.
- **Open DevTools on load** (`boot/boot-menu.ts`) — retries until the Electron bridge is ready. Keep off under F5 and while MCP is on `:9222`.
- **F12 opens DevTools** (`boot/boot-menu.ts`) — capture-phase keydown.
- **Auto-load save** (`boot/boot-menu.ts`, `boot/auto-load-save.ts`) — on first load, reloads with `?db_load=` for the **Start save** pick.
- **F3 debug overlay** (`f3/F3DebugOverlay.tsx`) — Minecraft-style text HUD. Extend with `registerF3Section` / `globalThis.debugF3`.
- **Dev Tools** (`mod-inspector/`) — pause **Dev Tools** opens a 1100×720 panel. **Mods** tab: compact loaded-mod cards; **Open** fills the tab with details (description first, then contributes, then load meta); save issues stay collapsed. **Elements**: family sand table. **Chains**: pick an element. **Does** and **Comes from** list recipe hops. Depth 1 is one hop. The index includes engine builtins (Wet Sand shaker, Residue burn, Burnt Residue press, Water contacts) because those rows are not in `mods.recipes`.
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

It runs once on the first mod eval in a session (not after exit to the main menu).

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

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
