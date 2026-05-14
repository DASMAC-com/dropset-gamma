"use client";

import { autoDiscover, createClient } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";
import type { ReactNode } from "react";
import { PUBLIC_RPC_URL, PUBLIC_WS_URL } from "./env";

const client = createClient({
  endpoint: PUBLIC_RPC_URL,
  websocketEndpoint: PUBLIC_WS_URL,
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: { children: ReactNode }) {
  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}
