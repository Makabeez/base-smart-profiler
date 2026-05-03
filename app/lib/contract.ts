import type { Abi } from 'viem';

export const RECEIPT_CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_RECEIPT_CONTRACT as `0x${string}`;

export const RECEIPT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'analyzedWallet', type: 'address' },
      { name: 'category', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokensOfOwner',
    stateMutability: 'view',
    inputs: [{ name: 'holder', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    type: 'event',
    name: 'AnalysisMinted',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'minter', type: 'address', indexed: true },
      { name: 'analyzedWallet', type: 'address', indexed: true },
      { name: 'category', type: 'uint8', indexed: false },
    ],
    anonymous: false,
  },
] as const satisfies Abi;

export enum WalletCategory {
  Unknown = 0,
  SmartWallet = 1,
  EOA = 2,
}
