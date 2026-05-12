"use client";

import { currencyName } from "@/lib/currencies";
import { type Side, useSwapStore } from "@/lib/store";
import { CurrencySelector } from "./CurrencySelector";
import { StablecoinSelector } from "./StablecoinSelector";

export function TokenRow({ side, label }: { side: Side; label: string }) {
  const activeSide = useSwapStore((s) => s.activeSide);
  const currency = useSwapStore((s) => s[side].currency);

  const active = activeSide === side;

  return (
    <div
      className={`flex w-full flex-col gap-2 rounded-lg border bg-muted p-4 text-left transition-colors ${
        active ? "border-accent" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-fg text-xs uppercase tracking-wide">
          {label}
        </span>
        <CurrencySelector side={side} />
        <span className="ml-auto truncate text-muted-fg text-xs">
          {currencyName(currency)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <StablecoinSelector side={side} />
      </div>
    </div>
  );
}
