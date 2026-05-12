"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { CURRENCIES, tokenIconUrl } from "@/lib/currencies";
import { type Side, useSwapStore } from "@/lib/store";

const explorerUrl = (mint: string) =>
  `https://explorer.solana.com/address/${mint}`;

export function StablecoinSelector({ side }: { side: Side }) {
  const currency = useSwapStore((s) => s[side].currency);
  const stablecoin = useSwapStore((s) => s[side].stablecoin);
  const otherSideState = useSwapStore(
    (s) => s[side === "from" ? "to" : "from"],
  );
  const setStablecoin = useSwapStore((s) => s.setStablecoin);
  const setActiveSide = useSwapStore((s) => s.setActiveSide);
  const openSignal = useSwapStore((s) => s.openStablecoinPickerFor);
  const clearSignal = useSwapStore((s) => s.clearStablecoinPickerSignal);

  const [open, setOpen] = useState(false);
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);

  useEffect(() => {
    if (openSignal === side) {
      setOpen(true);
      clearSignal();
    }
  }, [openSignal, side, clearSignal]);

  const stables = CURRENCIES[currency].stablecoins;

  const isBlocked = (symbol: string) =>
    currency === otherSideState.currency &&
    symbol === otherSideState.stablecoin;

  const copyMint = async (symbol: string, mint: string) => {
    try {
      await navigator.clipboard.writeText(mint);
      setCopiedSymbol(symbol);
      setTimeout(
        () => setCopiedSymbol((cur) => (cur === symbol ? null : cur)),
        1500,
      );
    } catch {
      // clipboard API unavailable — silently ignore
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setActiveSide(side);
      }}
    >
      <Popover.Trigger className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground hover:border-accent hover:text-accent">
        {/* biome-ignore lint/performance/noImgElement: small static icon, no optimization needed */}
        <img
          src={tokenIconUrl(stablecoin)}
          alt=""
          aria-hidden
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-full"
        />
        <span className="font-mono">{stablecoin}</span>
        <ChevronDown size={18} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 rounded-xl border border-border bg-background p-1 shadow-lg"
        >
          {stables.map((s) => {
            const blocked = isBlocked(s.symbol);
            const selected = s.symbol === stablecoin;
            const copied = copiedSymbol === s.symbol;
            return (
              <div
                key={s.symbol}
                className={`flex w-full items-center rounded-md text-sm ${
                  selected ? "bg-muted text-foreground" : "text-muted-fg"
                }`}
              >
                <Popover.Close asChild>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => setStablecoin(side, s.symbol)}
                    title={
                      blocked ? "Already selected on the other side" : undefined
                    }
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-fg"
                  >
                    {/* biome-ignore lint/performance/noImgElement: small static icon, no optimization needed */}
                    <img
                      src={tokenIconUrl(s.symbol)}
                      alt=""
                      aria-hidden
                      width={20}
                      height={20}
                      className="h-5 w-5 shrink-0 rounded-full"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-mono">{s.symbol}</span>
                      {s.name !== s.symbol && (
                        <span className="truncate text-muted-fg text-xs">
                          {s.name}
                        </span>
                      )}
                    </span>
                  </button>
                </Popover.Close>
                <button
                  type="button"
                  onClick={() => copyMint(s.symbol, s.mint)}
                  title={copied ? "Copied!" : "Copy mint address"}
                  className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 font-mono text-muted-fg text-xs hover:bg-muted hover:text-accent"
                >
                  {copied ? (
                    <>
                      <Check size={10} />
                      copied
                    </>
                  ) : (
                    <>
                      {s.mint.slice(0, 4)}…{s.mint.slice(-4)}
                    </>
                  )}
                </button>
                <a
                  href={explorerUrl(s.mint)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`View ${s.symbol} on Solana Explorer`}
                  className="mr-1 flex shrink-0 items-center rounded p-1 text-muted-fg hover:bg-muted hover:text-accent"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
