import type { Metadata } from "next";
import { CopyButton } from "@/components/CopyButton";
import { ExternalLink } from "@/components/icons";
import {
  CURRENCIES,
  currencyFlag,
  currencyName,
  type IsoCurrencyCode,
  SUPPORTED,
  type Stablecoin,
} from "@/lib/currencies";
import { explorerAddressUrl } from "@/lib/explorer";

export const metadata: Metadata = {
  title: "Currencies | Dropset",
};

const COLSPAN = 7;

const CURRENCY_TINT: Record<string, { chip: string; border: string }> = {
  USD: { chip: "bg-emerald-500/15", border: "border-emerald-500/60" },
  EUR: { chip: "bg-sky-500/15", border: "border-sky-500/60" },
  GBP: { chip: "bg-indigo-500/15", border: "border-indigo-500/60" },
  JPY: { chip: "bg-rose-500/15", border: "border-rose-500/60" },
  AUD: { chip: "bg-amber-500/15", border: "border-amber-500/60" },
  BRL: { chip: "bg-green-500/15", border: "border-green-500/60" },
  CHF: { chip: "bg-red-500/15", border: "border-red-500/60" },
  MXN: { chip: "bg-orange-500/15", border: "border-orange-500/60" },
  NGN: { chip: "bg-teal-500/15", border: "border-teal-500/60" },
  ZAR: { chip: "bg-fuchsia-500/15", border: "border-fuchsia-500/60" },
};
const tintFor = (code: IsoCurrencyCode) =>
  CURRENCY_TINT[code] ?? { chip: "bg-muted", border: "border-border" };

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const xHref = (handle: string) => `https://x.com/${handle}`;

function CurrencyHeaderRow({ code }: { code: IsoCurrencyCode }) {
  const tint = tintFor(code);
  return (
    <tr className="bg-background">
      <td
        colSpan={COLSPAN}
        className={`border-b ${tint.border} px-3 pt-6 pb-2`}
      >
        <div className="flex items-center gap-2 text-muted-fg text-xs uppercase tracking-wide">
          <span
            aria-hidden
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-2xl leading-none ${tint.chip}`}
          >
            {currencyFlag(code)}
          </span>
          <span className="font-semibold text-foreground text-sm">{code}</span>
          <span className="text-muted-fg">·</span>
          <span>{currencyName(code)}</span>
        </div>
      </td>
    </tr>
  );
}

function StablecoinRow({ s }: { s: Stablecoin }) {
  return (
    <tr
      id={s.symbol.toLowerCase()}
      className="scroll-mt-24 border-border border-t"
    >
      <td className="px-3 py-2 align-top">
        <div className="flex items-center gap-2">
          {/* biome-ignore lint/performance/noImgElement: small static icon, no optimization needed */}
          <img
            src={s.icon}
            alt=""
            aria-hidden
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 rounded-full"
          />
          <span className="font-mono text-foreground">{s.symbol}</span>
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <a
          href={s.issuer.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-fg hover:text-accent"
        >
          {s.name}
          <ExternalLink size={10} />
        </a>
      </td>
      <td className="px-3 py-2 align-top text-muted-fg">
        <div className="flex flex-col">
          {s.issuer.name.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        {s.issuer.socials?.x ? (
          <a
            href={xHref(s.issuer.socials.x)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-fg hover:text-accent"
          >
            @{s.issuer.socials.x}
            <ExternalLink size={10} />
          </a>
        ) : (
          ""
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-start gap-1">
          <span className="break-all font-mono text-muted-fg text-xs">
            {s.mint}
          </span>
          <CopyButton value={s.mint} label="mint address" />
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        {s.mintSourceUrl ? (
          <a
            href={s.mintSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-fg hover:text-accent"
          >
            {hostnameOf(s.mintSourceUrl)}
            <ExternalLink size={10} />
          </a>
        ) : (
          ""
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <a
          href={explorerAddressUrl(s.mint)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-fg hover:text-accent"
        >
          explorer
          <ExternalLink size={10} />
        </a>
      </td>
    </tr>
  );
}

export default function CurrenciesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-6 pb-16">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-14 z-10 bg-muted text-muted-fg text-xs uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Token</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Issuer(s)</th>
              <th className="px-3 py-2 font-medium">X</th>
              <th className="px-3 py-2 font-medium">Mint</th>
              <th className="px-3 py-2 font-medium">Mint source</th>
              <th className="px-3 py-2 font-medium">Explorer</th>
            </tr>
          </thead>
          <tbody>
            {SUPPORTED.flatMap((code) => [
              <CurrencyHeaderRow key={`h-${code}`} code={code} />,
              ...CURRENCIES[code].stablecoins.map((s) => (
                <StablecoinRow key={s.symbol} s={s} />
              )),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
