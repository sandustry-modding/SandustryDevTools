import { useEffect, useState, type WheelEvent } from "react";
import { OptionsButton, OptionsNumberInput, OptionsRow, OptionsSwitch } from "@modkit/ui";
import {
  formatLiveConfigDefaults,
  groupLiveConfigFields,
  listLiveConfigs,
  subscribeLiveConfig,
  type LiveConfigEntry,
  type LiveConfigField,
} from "@modkit/utils/live-config";

function FieldControl({
  entry,
  field,
  value,
}: {
  entry: LiveConfigEntry;
  field: LiveConfigField;
  value: boolean | number;
}) {
  if (field.kind === "boolean") {
    return (
      <OptionsSwitch
        subtle
        checked={Boolean(value)}
        onChange={(checked) => entry.set(field.key, checked)}
      />
    );
  }
  return (
    <OptionsNumberInput
      className="w-24"
      value={Number(value)}
      min={field.min}
      max={field.max}
      step={field.step}
      aria-label={field.key}
      onChange={(next) => entry.set(field.key, next)}
    />
  );
}

/** Interactive live-config editor on the F3 overlay. */
export function F3LiveConfigPanel() {
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeLiveConfig(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 400);
    return () => window.clearInterval(timer);
  }, []);

  const entries = listLiveConfigs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active = entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;
  const values = active?.get() ?? {};
  const groups = active ? groupLiveConfigFields(active.fields) : [];

  function stopWorld(event: WheelEvent<HTMLDivElement> | { stopPropagation(): void }): void {
    event.stopPropagation();
  }

  async function copyDefaults(): Promise<void> {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(formatLiveConfigDefaults(active));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="text-white flex flex-col min-h-0"
      style={{
        width: 420,
        maxHeight: "calc(100vh - 16px)",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        padding: "8px 10px",
        fontFamily: '"Consolas", "Liberation Mono", "Courier New", monospace',
        fontSize: 12,
        textShadow: "1px 1px 0 #3f3f3f",
      }}
      onWheel={stopWorld}
      onMouseDown={stopWorld}
      onPointerDown={stopWorld}
      onKeyDown={stopWorld}
      onKeyUp={stopWorld}
    >
      <div style={{ color: "#ffff55", marginBottom: 6 }}>Live config</div>
      {entries.length === 0 ? (
        <p className="text-slate-300" style={{ textShadow: "none" }}>
          No live configs. A mod calls createLiveConfig.
        </p>
      ) : (
        <div className="flex flex-col gap-2 min-h-0 flex-1" style={{ textShadow: "none" }}>
          <div className="flex flex-wrap gap-1 shrink-0 pb-1 border-b border-slate-700/80">
            {entries.map((entry) => {
              const selected = entry.id === active?.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`shrink-0 text-left px-2 py-1.5 border text-xs ${
                    selected
                      ? "border-[#ffe700] text-[#ffe700] bg-black/40"
                      : "border-slate-700 text-slate-200 hover:border-slate-500"
                  }`}
                >
                  <div className="font-medium truncate">{entry.title}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{entry.id}</div>
                </button>
              );
            })}
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto pr-1">
            {active ? (
              <>
                <div className="flex items-center justify-between gap-2 pb-1">
                  <p className="text-[10px] text-slate-500 font-mono truncate">
                    {active.globalKey}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <OptionsButton onClick={() => void copyDefaults()}>
                      {copied ? "Copied" : "Copy"}
                    </OptionsButton>
                    <OptionsButton onClick={() => active.reset()}>Reset</OptionsButton>
                  </div>
                </div>
                {groups.map((section, index) => (
                  <div key={section.group}>
                    <div
                      className={`text-xs font-bold uppercase tracking-widest text-[#ffe700] pb-1 ${
                        index === 0 ? "pt-0" : "pt-3 mt-1 border-t border-slate-800/50"
                      }`}
                    >
                      {section.group}
                    </div>
                    {section.fields.map((field) => (
                      <OptionsRow key={field.key} label={field.key} className="font-mono">
                        <FieldControl entry={active} field={field} value={values[field.key] ?? 0} />
                      </OptionsRow>
                    ))}
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
