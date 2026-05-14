"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useWalletModalState } from "@solana/react-hooks";
import Image from "next/image";

export function WalletPickerDialog() {
  const modal = useWalletModalState({ closeOnConnect: true });

  if (!modal.isReady) return null;

  return (
    <Dialog.Root
      open={modal.isOpen}
      onOpenChange={(open) => (open ? modal.open() : modal.close())}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 w-80 rounded-2xl border border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-border border-b px-5 py-4">
            <Dialog.Title className="font-semibold text-foreground">
              Connect a wallet
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-fg transition-colors hover:bg-muted hover:text-foreground">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="stroke-current"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <title>Close</title>
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </Dialog.Close>
          </div>

          <div className="p-3">
            {modal.connectors.length === 0 && (
              <p className="px-3 py-6 text-center text-muted-fg text-sm">
                No wallets detected.
              </p>
            )}

            {modal.connectors.map((connector) => (
              <button
                key={connector.id}
                type="button"
                disabled={modal.status === "connecting"}
                onClick={() => modal.connect(connector.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
              >
                {connector.icon ? (
                  <Image
                    src={connector.icon}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-lg"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted font-bold text-muted-fg text-xs">
                    {connector.name.charAt(0)}
                  </div>
                )}
                <span className="flex-1 font-medium text-foreground">
                  {connector.name}
                </span>
                {connector.ready && (
                  <span className="text-accent text-xs">Detected</span>
                )}
              </button>
            ))}

            {modal.status === "connecting" && (
              <div className="px-3 py-3 text-center text-muted-fg text-xs">
                Connecting...
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
