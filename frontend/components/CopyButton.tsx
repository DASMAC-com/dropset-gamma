"use client";

import { useState } from "react";
import { Check, Copy } from "./icons";

export function CopyButton({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={copied ? "Copied!" : `Copy ${label ?? "value"}`}
      className="inline-flex shrink-0 items-center gap-1 rounded p-1 text-muted-fg hover:bg-muted hover:text-accent"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}
