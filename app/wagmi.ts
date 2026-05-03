import { createConfig, http, cookieStorage, createStorage } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';
import { Attribution } from 'ox/erc8021';

// Convert raw builder code (bc_il5mvrgl) → ERC-8021 dataSuffix bytes
const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE_RAW;

export const DATA_SUFFIX = BUILDER_CODE
  ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] })
  : undefined;

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: 'Base Smart Profiler',
      preference: 'smartWalletOnly',
    }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [baseSepolia.id]: http(),
  },
  ...(DATA_SUFFIX && { dataSuffix: DATA_SUFFIX }),
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
