import { createConfig, http, cookieStorage, createStorage } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

// NOTE: Builder Code attribution is handled in MintReceiptButton.tsx
// by manually appending the ERC-8021 suffix from NEXT_PUBLIC_BUILDER_CODE
// directly to the call's data field. wagmi's dataSuffix mechanism gets
// stripped by the CDP Paymaster during AA repackaging.

export const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'Base Smart Profiler',
      preference: 'smartWalletOnly',
    }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [base.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
