/** Direct recipe hops for the Chains element explorer. */

import type { ChainIndex, ChainStep } from "./chain-index";
import type { ReactionKind } from "./step-icons";

export type TreeDirection = "up" | "down";

export function stepsFor(
  index: ChainIndex,
  elementType: number,
  dir: TreeDirection,
  enabledKinds: ReadonlySet<ReactionKind>,
): ChainStep[] {
  const raw = dir === "up" ? index.producedBy.get(elementType) : index.consumedBy.get(elementType);
  if (!raw?.length) return [];
  const out: ChainStep[] = [];
  for (const id of raw) {
    const step = index.steps.get(id);
    if (step && enabledKinds.has(step.kind)) out.push(step);
  }
  return out;
}

/** Far-side elements for the next hop (inputs when going up, outputs when going down). */
export function hopNeighbors(step: ChainStep, dir: TreeDirection, fromType: number): number[] {
  if (dir === "up") return step.inputs.filter((type) => type !== fromType);
  return step.outputs.map((out) => out.elementType).filter((type) => type !== fromType);
}
