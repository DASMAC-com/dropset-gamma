"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import {
  currencyFlag,
  type IsoCurrencyCode,
  SUPPORTED,
} from "@/lib/currencies";
import { type Side, useSwapStore } from "@/lib/store";

export function CurrencySelector({ side }: { side: Side }) {
  const currency = useSwapStore((s) => s[side].currency);
  const setCurrency = useSwapStore((s) => s.setCurrency);
  const setActiveSide = useSwapStore((s) => s.setActiveSide);

  return (
    <Popover.Root>
      <Popover.Trigger
        onPointerDown={() => setActiveSide(side)}
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-medium text-base text-foreground hover:border-accent hover:text-accent"
      >
        <span aria-hidden className="text-xl leading-none">
          {currencyFlag(currency)}
        </span>
        {currency}
        <ChevronDown size={18} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-40 rounded-xl border border-border bg-background p-1 shadow-lg"
        >
          {SUPPORTED.map((code: IsoCurrencyCode) => (
            <Popover.Close key={code} asChild>
              <button
                type="button"
                onClick={() => setCurrency(side, code)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                  code === currency
                    ? "bg-muted text-foreground"
                    : "text-muted-fg hover:bg-muted hover:text-foreground"
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {currencyFlag(code)}
                </span>
                <span className="font-medium">{code}</span>
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
