"use client";

import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
  TransactionToast,
  TransactionToastAction,
  TransactionToastIcon,
  TransactionToastLabel,
} from "@coinbase/onchainkit/transaction";
import type { LifecycleStatus } from "@coinbase/onchainkit/transaction";
import { useAccount } from "wagmi";
import { useCallback, useState } from "react";
import {
  RECEIPT_ABI,
  RECEIPT_CONTRACT_ADDRESS,
  WalletCategory,
} from "../lib/contract";

interface Props {
  analyzedWallet: `0x${string}`;
  category: WalletCategory;
}

export function MintReceiptButton({ analyzedWallet, category }: Props) {
  const { isConnected } = useAccount();
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const handleStatus = useCallback((status: LifecycleStatus) => {
    if (status.statusName === "success") {
      const hash = status.statusData?.transactionReceipts?.[0]?.transactionHash;
      if (hash) setLastTxHash(hash);
    }
  }, []);

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

  const calls = [
    {
      address: RECEIPT_CONTRACT_ADDRESS,
      abi: RECEIPT_ABI,
      functionName: "mint",
      args: [analyzedWallet, category],
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <Transaction
        chainId={8453}
        calls={calls as never}
        isSponsored={true}
        onStatus={handleStatus}
      >
        <TransactionButton
          text="Mint Analysis Receipt (gasless)"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
        />
        <TransactionStatus>
          <TransactionStatusLabel />
          <TransactionStatusAction />
        </TransactionStatus>
        <TransactionToast>
          <TransactionToastIcon />
          <TransactionToastLabel />
          <TransactionToastAction />
        </TransactionToast>
      </Transaction>

      {lastTxHash ? (
        
          <a
          href={`https://basescan.org/tx/${lastTxHash}`}
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
