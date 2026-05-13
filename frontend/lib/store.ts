"use client";

import { create } from "zustand";
import { defaultAnchorCca2 } from "./countries";
import { currencyAnchor, type IsoCurrencyCode } from "./currencies";

export type Side = "from" | "to";

export type SideState = {
  currency: IsoCurrencyCode;
  stablecoin: string;
  cca2: string;
};

const otherSide = (s: Side): Side => (s === "from" ? "to" : "from");

const anchorFor = (currency: IsoCurrencyCode): string =>
  currencyAnchor(currency) || defaultAnchorCca2(currency);

// One-shot signal that asks a TokenPicker to open. The seq counter forces a
// new object identity per request so repeated presses of the same shortcut
// re-fire the effect even when `side` is unchanged.
export type OpenPickerRequest = { side: Side; seq: number };

type Store = {
  from: SideState;
  to: SideState;
  activeSide: Side;
  openPickerRequest: OpenPickerRequest | null;
  setActiveSide: (side: Side) => void;
  setToken: (
    side: Side,
    currency: IsoCurrencyCode,
    stablecoin: string,
    cca2?: string,
  ) => void;
  swapSides: () => void;
  requestOpenPicker: (side: Side) => void;
};

export const useSwapStore = create<Store>((set) => ({
  from: { currency: "USD", stablecoin: "USDC", cca2: anchorFor("USD") },
  to: { currency: "EUR", stablecoin: "EURC", cca2: anchorFor("EUR") },
  activeSide: "from",
  openPickerRequest: null,

  setActiveSide: (side) => set({ activeSide: side }),

  setToken: (side, currency, stablecoin, cca2) =>
    set({
      [side]: {
        currency,
        stablecoin,
        cca2: cca2 ?? anchorFor(currency),
      },
      activeSide: side,
    }),

  swapSides: () =>
    set((s) => ({
      from: s.to,
      to: s.from,
      activeSide: otherSide(s.activeSide),
    })),

  requestOpenPicker: (side) =>
    set((s) => ({
      openPickerRequest: { side, seq: (s.openPickerRequest?.seq ?? 0) + 1 },
    })),
}));

export const useSameToken = (): boolean =>
  useSwapStore(
    (s) =>
      s.from.currency === s.to.currency &&
      s.from.stablecoin === s.to.stablecoin,
  );
