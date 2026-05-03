"use client";

import { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { useAccount } from 'wagmi';
import { ConnectWalletButton } from './components/ConnectWalletButton';
import { MintReceiptButton } from './components/MintReceiptButton';
import { WalletCategory } from './lib/contract';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('global');
    const barChartRef = useRef();
    const donutChartRef = useRef();
    const { address, isConnected, connector } = useAccount();

    // Detect wallet type: Coinbase Smart Wallet vs EOA
    // The coinbaseWallet connector with smartWalletOnly preference always returns Smart Wallet
    const walletCategory = isConnected
        ? (connector?.id === 'coinbaseWalletSDK' || connector?.id === 'coinbaseWallet'
            ? WalletCategory.SmartWallet
            : WalletCategory.EOA)
        : WalletCategory.Unknown;

    const walletCategoryLabel =
        walletCategory === WalletCategory.SmartWallet ? 'Smart Wallet' :
        walletCategory === WalletCategory.EOA ? 'EOA' :
        'Unknown';

    useEffect(() => {
        async function loadData() {
            const res = await fetch('/api/nansen');
            const json = await res.json();
            setData(json);
        }
        loadData();
    }, []);

    useEffect(() => {
        if (!data || !barChartRef.current) return;
        const chartData = data[activeTab].protocols;
        const width = 400;
        const height = 250;
        const margin = { top: 20, right: 30, bottom: 40, left: 90 };

        const svg = d3.select(barChartRef.current);
        svg.selectAll("*").remove();

        const x = d3.scaleLinear().domain([0, 100]).range([margin.left, width - margin.right]);
        const y = d3.scaleBand().domain(chartData.map(d => d.name)).range([margin.top, height - margin.bottom]).padding(0.1);

        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + "%"))
            .attr("color", "#6b7280");

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y))
            .attr("color", "#6b7280").attr("font-size", "12px");

        svg.selectAll("rect").data(chartData).join("rect")
            .attr("x", margin.left).attr("y", d => y(d.name))
            .attr("height", y.bandwidth()).attr("fill", "#0052FF")
            .attr("rx", 4).attr("width", 0)
            .transition().duration(750).attr("width", d => x(d.value) - margin.left);
    }, [data, activeTab]);

    useEffect(() => {
        if (!data || !donutChartRef.current) return;
        const chartData = data[activeTab].assets;
        const width = 300; const height = 300; const radius = Math.min(width, height) / 2;

        const svg = d3.select(donutChartRef.current).attr("viewBox", [-width / 2, -height / 2, width, height]);
        svg.selectAll("*").remove();

        const color = d3.scaleOrdinal().domain(chartData.map(d => d.name))
            .range(["#10b981", "#8b5cf6", "#f59e0b", "#ef4444"]);

        const pie = d3.pie().value(d => d.value).sort(null);
        const arc = d3.arc().innerRadius(radius * 0.5).outerRadius(radius * 0.8);

        const arcs = svg.selectAll("path").data(pie(chartData)).join("path")
            .attr("fill", d => color(d.data.name)).attr("stroke", "#111827")
            .attr("stroke-width", 2).attr("d", arc)
            .each(function(d) { this._current = d; });

        arcs.transition().duration(750).attrTween("d", function(d) {
            const i = d3.interpolate(this._current, d);
            this._current = i(0);
            return t => arc(i(t));
        });

        svg.selectAll("text").data(pie(chartData)).join("text")
            .attr("transform", d => `translate(${arc.centroid(d)})`)
            .attr("text-anchor", "middle").attr("font-size", "12px")
            .attr("font-weight", "bold").attr("fill", "white")
            .text(d => d.data.name);
    }, [data, activeTab]);

    if (!data) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading Nansen Data...</div>;

    return (
        <div className="min-h-screen bg-[#0A0B0D] text-gray-100 p-8 font-sans selection:bg-blue-500 selection:text-white">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-end mb-6">
                    <ConnectWalletButton />
                </div>

                <header className="mb-12 text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3">
                        <span className="text-[#0052FF]">Base</span> Smart Wallet Profiler
                    </h1>
                    <p className="text-gray-400 text-lg">Separating the New Retail Wave from Crypto Natives onchain.</p>
                </header>

                <div className="flex justify-center space-x-4 mb-12">
                    {['global', 'smart_wallets', 'eoas'].map((tab) => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                                activeTab === tab ? 'bg-[#0052FF] text-white shadow-lg shadow-blue-500/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}>
                            {data[tab].title}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="bg-[#111827] rounded-2xl p-8 flex flex-col items-center justify-center border border-gray-800 shadow-xl">
                        <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-4">Average Tx Size</h3>
                        <div className="text-6xl font-black text-emerald-400 mb-6">
                            ${data[activeTab].avgTxSize.toLocaleString()}
                        </div>
                        <p className="text-sm text-gray-500 text-center leading-relaxed">
                            {activeTab === 'smart_wallets' && "High volume of micro-transactions via gasless relayers. Strong focus on consumer apps."}
                            {activeTab === 'eoas' && "High value transfers typical of DeFi power users and liquidity providers."}
                            {activeTab === 'global' && "Blended average across all active Base network users and contracts."}
                        </p>
                    </div>

                    <div className="bg-[#111827] rounded-2xl p-8 border border-gray-800 shadow-xl lg:col-span-1">
                        <h3 className="text-lg text-gray-200 font-semibold mb-6 text-center">Top Protocol Usage</h3>
                        <div className="flex justify-center"><svg ref={barChartRef} width="400" height="250"></svg></div>
                    </div>

                    <div className="bg-[#111827] rounded-2xl p-8 border border-gray-800 shadow-xl lg:col-span-1">
                        <h3 className="text-lg text-gray-200 font-semibold mb-6 text-center">Top Asset Holdings</h3>
                        <div className="flex justify-center"><svg ref={donutChartRef} width="300" height="300"></svg></div>
                    </div>
                </div>

                {isConnected && walletCategory !== WalletCategory.Unknown && (
                    <div className="mt-12 bg-gradient-to-br from-[#0052FF]/10 to-[#111827] border border-[#0052FF]/30 rounded-2xl p-8 shadow-xl">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-white mb-2">Be part of the dataset</h3>
                                <p className="text-gray-300 mb-2">
                                    We detected you are using a{' '}
                                    <span className="font-bold text-[#0052FF]">{walletCategoryLabel}</span>.
                                </p>
                                <p className="text-sm text-gray-400">
                                    Mint your free, gasless on-chain receipt. Sponsored by Base Paymaster, attributed via ERC-8021 Builder Code.
                                </p>
                                {address && (
                                    <p className="text-xs text-gray-500 mt-2 font-mono">
                                        {address.slice(0, 6)}...{address.slice(-4)}
                                    </p>
                                )}
                            </div>
                            <div className="w-full md:w-auto">
                                <MintReceiptButton
                                    analyzedWallet={address}
                                    category={walletCategory}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {!isConnected && (
                    <div className="mt-12 bg-[#111827] border border-gray-800 rounded-2xl p-8 text-center">
                        <p className="text-gray-400">
                            Connect your Smart Wallet above to mint your on-chain analysis receipt.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
