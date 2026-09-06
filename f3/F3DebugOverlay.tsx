import { useEffect, useState } from "react";
import { Interactive, OverlayRoot } from "@modkit/ui";
import { f3DebugOn } from "../boot/settings";
import { F3LiveConfigPanel } from "./F3LiveConfigPanel";
import { hideManagementColumn } from "./management-column";

const api = sandkit.api;
const TOGGLE_CODE = "F3";

/** F3 overlay: live-config panel in the top-left. */
export function F3DebugOverlay() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => f3DebugOn(api));

  useEffect(() => {
    function refreshSettings(): void {
      const on = f3DebugOn(api);
      setEnabled(on);
      if (!on) setOpen(false);
    }

    refreshSettings();
    const stop = api.settings.onChange(() => refreshSettings());
    return () => stop();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.code !== TOGGLE_CODE && event.key !== "F3") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen((value) => !value);
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);

  useEffect(() => {
    if (!open || !enabled) return;
    return hideManagementColumn();
  }, [open, enabled]);

  if (!open || !enabled) return null;

  return (
    <OverlayRoot>
      <Interactive>
        <div style={{ position: "fixed", top: 8, left: 8 }}>
          <F3LiveConfigPanel />
        </div>
      </Interactive>
    </OverlayRoot>
  );
}
