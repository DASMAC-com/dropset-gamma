import { mainnet } from "@solana/rpc-types";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const DEFAULT_WS = "wss://api.mainnet-beta.solana.com";

export const PUBLIC_RPC_URL = mainnet(
  process.env.NEXT_PUBLIC_RPC_URL ?? DEFAULT_RPC,
);
export const PUBLIC_WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? DEFAULT_WS;
