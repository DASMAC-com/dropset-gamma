import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-border border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold text-base text-foreground no-underline"
        >
          <Image
            src="/favicon.png"
            alt=""
            width={36}
            height={36}
            priority
          />
          Dropset
        </Link>
        <nav className="flex items-center gap-2">
          <span className="rounded-md bg-muted px-3 py-1.5 text-sm text-foreground">
            Swap
          </span>
        </nav>
      </div>
    </header>
  );
}
