'use client';

import { useAccount, useConnect, useDisconnect, useEnsName, useBalance } from 'wagmi';
import { useState, useRef, useEffect } from 'react';
import { base } from "wagmi/chains";

export function ConnectWalletButton() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ENS lookup on Ethereum mainnet (where Basenames also resolve)
  const { data: ensName } = useEnsName({
    address,
    chainId: base.id,
  });

  const { data: balance } = useBalance({
    address,
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  if (!isConnected) {
    const coinbaseConnector = connectors.find(
      (c) => c.id === 'coinbaseWalletSDK' || c.id === 'coinbaseWallet'
    );
    return (
      <button
        onClick={() => coinbaseConnector && connect({ connector: coinbaseConnector })}
        disabled={isPending}
        className="bg-[#0052FF] hover:bg-[#0046d9] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-full transition-colors shadow-lg shadow-blue-500/20 text-sm"
      >
        {isPending ? 'Connecting...' : 'Connect Smart Wallet'}
      </button>
    );
  }

  const displayName =
    ensName ||
    (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '');

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-[#111827] hover:bg-[#1a2332] border border-gray-700 text-white font-medium px-4 py-2.5 rounded-full transition-colors text-sm flex items-center gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        {displayName}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-64 bg-[#111827] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Wallet</p>
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            {address ? (
              <p className="text-xs text-gray-500 font-mono mt-1 truncate">{address}</p>
            ) : null}
          </div>

          {balance ? (
            <div className="px-4 py-3 border-b border-gray-700">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Balance</p>
              <p className="text-sm font-medium text-white">
                {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
              </p>
            </div>
          ) : null}

          <button
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
