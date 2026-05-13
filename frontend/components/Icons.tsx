"use client";

// Re-exports the Lucide icons used in the app with `suppressHydrationWarning`
// baked into every render. Browser extensions like Dark Reader, Grammarly,
// and ColorZilla mutate inline `stroke`/`style` on every SVG they touch
// after the server-rendered HTML arrives, which manifests as React hydration
// warnings on every Lucide icon. The warnings are unavoidable from inside
// the app, so we suppress them at the SVG level.

import {
  ArrowUpDown as ArrowUpDownBase,
  Check as CheckBase,
  ChevronDown as ChevronDownBase,
  Compass as CompassBase,
  Crosshair as CrosshairBase,
  ExternalLink as ExternalLinkBase,
  type LucideProps,
  Minus as MinusBase,
  Pause as PauseBase,
  Play as PlayBase,
  Plus as PlusBase,
  Search as SearchBase,
} from "lucide-react";
import type { ComponentType } from "react";

function wrap(
  Inner: ComponentType<LucideProps>,
  name: string,
): ComponentType<LucideProps> {
  const Wrapped = (props: LucideProps) => (
    <Inner suppressHydrationWarning {...props} />
  );
  Wrapped.displayName = name;
  return Wrapped;
}

export const ArrowUpDown = wrap(ArrowUpDownBase, "ArrowUpDown");
export const Check = wrap(CheckBase, "Check");
export const ChevronDown = wrap(ChevronDownBase, "ChevronDown");
export const Compass = wrap(CompassBase, "Compass");
export const Crosshair = wrap(CrosshairBase, "Crosshair");
export const ExternalLink = wrap(ExternalLinkBase, "ExternalLink");
export const Minus = wrap(MinusBase, "Minus");
export const Pause = wrap(PauseBase, "Pause");
export const Play = wrap(PlayBase, "Play");
export const Plus = wrap(PlusBase, "Plus");
export const Search = wrap(SearchBase, "Search");
