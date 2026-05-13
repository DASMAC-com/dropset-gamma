"use client";

import { useEffect } from "react";
import { useSameToken, useSwapStore } from "@/lib/store";
import { SwapArrowButton } from "./SwapArrowButton";
import { TokenRow } from "./TokenRow";

export function SwapPanel() {
  const sameToken = useSameToken();
  const requestOpenPicker = useSwapStore((s) => s.requestOpenPicker);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack keys while the user is typing in an input/textarea or
      // contenteditable surface (e.g., the amount field or the picker's own
      // search box).
      const t = e.target as HTMLElement | null;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t?.isContentEditable
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        requestOpenPicker("from");
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        requestOpenPicker("to");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestOpenPicker]);

  return (
    <fieldset className="relative rounded-xl border border-border p-4">
      <legend className="px-2 font-semibold text-foreground text-sm">
        Swap
      </legend>
      <div className="relative flex flex-col gap-2">
        <TokenRow side="from" label="From" />
        <TokenRow side="to" label="To" />
        <div className="absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center">
          <SwapArrowButton />
        </div>
      </div>
      <button
        type="button"
        onClick={() => {}}
        disabled={sameToken}
        title={sameToken ? "Pick a different token on one side" : undefined}
        className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-background text-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-fg disabled:hover:bg-muted"
      >
        {sameToken ? "Pick a different token" : "Swap"}
      </button>
    </fieldset>
  );
}
