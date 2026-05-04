'use client';

import { useSendCalls, useWaitForCallsStatus } from 'wagmi/experimental';
import { useAccount } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { useState } from 'react';
import {
  RECEIPT_ABI,
  RECEIPT_CONTRACT_ADDRESS,
  WalletCategory,
} from '../lib/contract';

interface Props {
  analyzedWallet: `0x${string}`;
  category: WalletCategory;
}

export function MintReceiptButton({ analyzedWallet, category }: Props) {
  const { isConnected } = useAccount();
  const [error, setError] = useState<string | null>(null);

  const {
    sendCalls,
    data: callsData,
    isPending,
    error: sendError,
  } = useSendCalls();

  const callsId = callsData?.id;

  const { data: callsStatus } = useWaitForCallsStatus({
    id: callsId,
  });

  const txHash = callsStatus?.receipts?.[0]?.transactionHash;
  const isSuccess = callsStatus?.status === 'success';

  if (!isConnected) {
    return (
      <div className="text-sm text-gray-400 italic">
        Connect wallet to mint analysis receipt
      </div>
    );
  }

  if (category === WalletCategory.Unknown) {
    return null;
  }

  const handleMint = () => {
    setError(null);

    try {
      // 1. Encode the mint() function call
      const baseCalldata = encodeFunctionData({
        abi: RECEIPT_ABI,
        functionName: 'mint',
        args: [analyzedWallet, category],
      });

      // 2. Append the ERC-8021 Builder Code suffix manually
      // This bypasses paymaster suffix-stripping during AA repackaging
      const builderCodeHex = process.env.NEXT_PUBLIC_BUILDER_CODE;
      if (!builderCodeHex) {
        throw new Error('NEXT_PUBLIC_BUILDER_CODE not configured');
      }

      // Strip the 0x prefix from suffix and append to baseCalldata
      const suffix = builderCodeHex.startsWith('0x')
        ? builderCodeHex.slice(2)
        : builderCodeHex;
      const fullCalldata = (baseCalldata + suffix) as `0x${string}`;

      // 3. Send via wagmi useSendCalls with paymaster sponsorship
      sendCalls({
        calls: [
          {
            to: RECEIPT_CONTRACT_ADDRESS,
            data: fullCalldata,
          },
        ],
        capabilities: {
          paymasterService: {
            url: process.env.NEXT_PUBLIC_PAYMASTER_URL!,
          },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send mint call';
      setError(msg);
      console.error('Mint error:', err);
    }
  };

  const buttonText = isPending
    ? 'Minting...'
    : isSuccess
    ? 'Receipt Minted ✓'
    : 'Mint Analysis Receipt (gasless)';

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleMint}
        disabled={isPending || isSuccess}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        {buttonText}
      </button>

      {sendError ? (
        <p className="text-xs text-red-400">
          {sendError.message || 'Transaction failed'}
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {txHash ? (<a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline"
        >
          View receipt on Basescan →
        </a>
      ) : null}
    </div>
  );
}
