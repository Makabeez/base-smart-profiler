# Base Smart Wallet Profiler

> Separating the **New Retail Wave** from **Crypto Natives** on Base.

A live dashboard that visualizes how Coinbase Smart Wallet users (the new retail wave) behave fundamentally differently from traditional EOA holders (the crypto natives) on the Base network — plus a self-classify flow that mints you a **gasless soulbound on-chain receipt**.

🌐 **Live**: [base-smart-profiler.vercel.app](https://base-smart-profiler.vercel.app)
📜 **Contract** (Base mainnet, verified): [`0x3F9F8222D7c3D3363A9394BD51d2c6B17e772413`](https://basescan.org/address/0x3F9F8222D7c3D3363A9394BD51d2c6B17e772413)
🪙 **First mint**: [Token #1 receipt](https://basescan.org/tx/0x98a2cf84823a317f3ed01479432fdfd6cff95199de13cc1c6b123c1927026474)

---

## Why This Project

Smart Wallets aren't just a new key-management tool — they represent a different **user**. The data on Base shows it clearly:

- **Smart Wallet users** (new retail) trend toward consumer apps, micro-transactions, and gasless flows. Average tx size is small. Top protocols are Aerodrome, Uniswap, Zora.
- **Traditional EOAs** (crypto natives) trend toward DeFi power tooling, large transfers, and liquidity provision. Average tx size is high. Top protocols are different.

Most analytics tools blend these two populations together and miss the story. This project surfaces the divide — and lets users self-classify, generating an on-chain artifact that itself becomes part of the dataset.

> **Meta-narrative**: The tool that analyzes Smart Wallet adoption *uses* Smart Wallets to power its UX. Every analysis is a paymaster-sponsored, builder-code-attributed transaction. The dashboard is recursive.

---

## Architecture

```
┌─────────────────────────┐      ┌─────────────────┐      ┌──────────────────┐
│  Next.js 16 (App Router) │ ---> │   OnchainKit    │ ---> │  Coinbase Smart  │
│  React 19 + Tailwind 4   │      │  + wagmi + viem │      │     Wallet       │
└────────────────┬────────┘      └─────────────────┘      └──────────────────┘
                 │
                 ▼
┌─────────────────────────┐                                       ┌──────────────────┐
│    Nansen API (server)   │                                       │  Base Paymaster  │
│ (segment-level analytics)│                                       │  (CDP, mainnet)  │
└─────────────────────────┘                                       └────────┬───────┘
                                                                          │
                                                                          ▼
                                                                ┌────────────────────────────┐
                                                                │  AnalysisReceipt.sol   │
                                                                │  (soulbound ERC-721)   │
                                                                │  Base mainnet, verified│
                                                                └────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, D3.js for charts |
| Wallet | Coinbase Smart Wallet (passkey-based, ERC-4337) |
| Web3 | OnchainKit, wagmi, viem |
| Attribution | ERC-8021 Builder Code (`bc_il5mvrgl`) |
| Gas Sponsorship | Coinbase Developer Platform Paymaster |
| Smart Contract | Solidity 0.8.24, soulbound ERC-721 |
| Hosting | Vercel (auto-deploy from GitHub) |

---

## The Mint Flow

1. User visits the site and sees the segment dashboard
2. Clicks **Connect Wallet** → Coinbase Smart Wallet popup (passkey, no seed phrase)
3. The app detects wallet type via the wagmi connector ID
4. A "Be part of the dataset" card appears: *"We detected you are using a Smart Wallet"*
5. User clicks **Mint Analysis Receipt (gasless)**
6. Single passkey signature → transaction submitted as an ERC-4337 user operation
7. Coinbase Paymaster sponsors gas (user pays nothing)
8. ERC-8021 Builder Code suffix appended to calldata for attribution
9. ~5 seconds later, the user owns a soulbound `AnalysisReceipt` NFT
10. View on Basescan link rendered

**Total user UX**: 2 clicks, 1 passkey tap, 0 ETH spent. No seed phrase, no gas dialog, no token approvals.

---

## Smart Contract: `AnalysisReceipt`

A minimal soulbound ERC-721 contract. Each receipt records:

- `minter` — who ran the analysis
- `analyzedWallet` — the wallet that was classified
- `timestamp` — when analysis ran
- `category` — `SmartWallet` or `EOA`

All transfer-related functions revert with a custom `Soulbound()` error — receipts cannot be traded, only minted.

```solidity
function mint(address analyzedWallet, uint8 category) external returns (uint256);

// All revert with Soulbound()
function transferFrom(...) external pure { revert Soulbound(); }
function safeTransferFrom(...) external pure { revert Soulbound(); }
function approve(...) external pure { revert Soulbound(); }
```

Verified source: [basescan.org](https://basescan.org/address/0x3F9F8222D7c3D3363A9394BD51d2c6B17e772413#code)

---

## Local Development

```bash
git clone https://github.com/Makabeez/base-smart-profiler.git
cd base-smart-profiler
npm install
```

Create `.env.local` with:

```bash
# Coinbase Developer Platform
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_cdp_api_key
NEXT_PUBLIC_PAYMASTER_URL=your_paymaster_endpoint

# ERC-8021 Builder Code (from base.dev)
NEXT_PUBLIC_BUILDER_CODE_RAW=bc_yourcode

# AnalysisReceipt contract on Base mainnet
NEXT_PUBLIC_RECEIPT_CONTRACT=0x3F9F8222D7c3D3363A9394BD51d2c6B17e772413

# Nansen API for segment-level analytics
NANSEN_API_KEY=your_nansen_key
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment

Auto-deploys to Vercel on push to `main`. Production domain: [base-smart-profiler.vercel.app](https://base-smart-profiler.vercel.app).

The same set of environment variables must be configured in **Vercel → Settings → Environment Variables** (Production + Preview).

---

## Builder Code Attribution

Every transaction triggered through this app carries an [ERC-8021](https://blog.base.dev/builder-codes-and-erc-8021-fixing-onchain-attribution) data suffix linking it to Builder Code `bc_il5mvrgl`. Implementation:

```ts
// app/wagmi.ts
import { Attribution } from 'ox/erc8021';

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: [process.env.NEXT_PUBLIC_BUILDER_CODE_RAW],
});

export const config = createConfig({
  chains: [base],
  connectors: [coinbaseWallet({ preference: 'smartWalletOnly' })],
  dataSuffix: DATA_SUFFIX,  // applied to every tx automatically
  // ...
});
```

App also registered on [base.dev](https://base.dev) with verified domain (`base:app_id` meta tag) for ecosystem-level attribution.

---

## License

MIT © 2026 [Makabeez](https://github.com/Makabeez)

Built solo for the Base ecosystem. Contributions welcome.
