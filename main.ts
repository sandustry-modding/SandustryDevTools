import { registerDevToolsShortcut, scheduleMainMenuBoot } from "./boot/boot-menu";
import { syncCrispCanvas } from "./boot/crisp-canvas";
import { settingOn } from "./boot/settings";
import { installF3Debug } from "./f3/install";
import { installModInspector } from "./mod-inspector/install";
import modinfo from "./modinfo.json";
import { isEnabled } from "modkit/utils";

const api = sandkit.api;

function syncCrispCanvasSetting(): void {
  syncCrispCanvas(settingOn(api, "crispCanvas"));
}

function main() {
  if (!isEnabled(api)) return;

  const { enums, react } = sandkit;
  Object.assign(globalThis, { sandkit, api, enums, react });

  syncCrispCanvasSetting();
  if (settingOn(api, "f12DevTools")) registerDevToolsShortcut();
  scheduleMainMenuBoot(api);
  installF3Debug(api, modinfo.id);
  installModInspector(api, modinfo.id);
  api.settings.onChange(() => {
    syncCrispCanvasSetting();
  });

  console.log("Loaded");
}

main();
