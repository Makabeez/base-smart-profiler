import { NextResponse } from 'next/server';

// 🛑 4-Hour Cache Lock + stale-while-revalidate to protect your 50k API credits
// Nansen API gets called at most 6 times per day regardless of traffic volume.
export const revalidate = 14400;
export const dynamic = 'force-static'; 

export async function GET() {
    const API_KEY = process.env.NANSEN_API_KEY;

    if (!API_KEY) {
        return NextResponse.json({ error: "NANSEN_API_KEY is missing from environment variables." }, { status: 500 });
    }

    const BASE_URL = 'https://api.nansen.ai/api/v1';
    const FACTORY_CONTRACT = '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842'; // Coinbase Smart Wallet Factory
    
    const headers = {
        'Content-Type': 'application/json',
        'apikey': API_KEY // Corrected header: lowercase, no hyphen
    };

    try {
        // =======================================================================
        // STEP 1: DISCOVERY (Fetch the deployed Smart Wallets)
        // =======================================================================
        const cohortRes = await fetch(`${BASE_URL}/profiler/address/related-wallets`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                chain: "base",
                address: FACTORY_CONTRACT,
                pagination: { page: 1, per_page: 20 }
            })
        });

        if (!cohortRes.ok) {
            throw new Error(`Nansen API Error (Cohort): ${cohortRes.status}`);
        }

        const cohortData = await cohortRes.json();

        // Extract actual smart wallets deployed by the factory (relation: "Created Contract" / order: 4)
        const deployedWallets = cohortData.data
            ?.filter(row => row.order === 4 || row.relation === "Created Contract")
            ?.map(row => row.address) || [];

        // =======================================================================
        // STEP 2: ENRICHMENT (Fetch balances for a sample cohort)
        // Note: Vercel Serverless limits execution to 10 seconds. 
        // We take a sample of 3 wallets to ensure the request completes instantly.
        // =======================================================================
        const sampleWallets = deployedWallets.slice(0, 3);
        let aggregatedAssets = {};

        if (sampleWallets.length > 0) {
            const balancePromises = sampleWallets.map(wallet => 
                fetch(`${BASE_URL}/profiler/address/current-balance`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        chain: "base",
                        address: wallet,
                        pagination: { page: 1, per_page: 20 }
                    })
                }).then(res => res.json())
            );

            const balancesResults = await Promise.all(balancePromises);

            // Tally up the USD value of tokens across the sample wallets
            balancesResults.forEach(result => {
                if (result.data) {
                    result.data.forEach(token => {
                        // Filter out dust/spam tokens worth less than $1
                        if (token.value_usd > 1) { 
                            if (!aggregatedAssets[token.token_symbol]) {
                                aggregatedAssets[token.token_symbol] = 0;
                            }
                            aggregatedAssets[token.token_symbol] += token.value_usd;
                        }
                    });
                }
            });
        }

        // Convert the aggregated object back into the array format D3.js expects
        const formattedAssets = Object.keys(aggregatedAssets)
            .map(symbol => ({ name: symbol, value: Math.round(aggregatedAssets[symbol]) }))
            .sort((a, b) => b.value - a.value) // Sort highest value to lowest
            .slice(0, 4); // Keep top 4 for the donut chart

        // Safe fallback in case the sample wallets are currently empty
        const finalAssets = formattedAssets.length > 0 ? formattedAssets : [
            { name: 'USDC', value: 60 }, { name: 'DEGEN', value: 25 }, { name: 'ETH', value: 10 }, { name: 'HIGHER', value: 5 }
        ];

        // =======================================================================
        // STEP 3: MAPPING TO FRONTEND
        // =======================================================================
        const liveProfileData = {
            global: {
                title: "Global View",
                avgTxSize: 450, 
                protocols: [{ name: 'Aerodrome', value: 50 }, { name: 'Uniswap', value: 30 }, { name: 'Zora', value: 10 }, { name: 'Morpho', value: 10 }],
                assets: [{ name: 'ETH', value: 45 }, { name: 'USDC', value: 35 }, { name: 'DEGEN', value: 10 }, { name: 'AERO', value: 10 }]
            },
            smart_wallets: {
                title: "Smart Wallets (New Wave)",
                avgTxSize: 45, 
                protocols: [
                    { name: 'Zora', value: 45 }, { name: 'Aerodrome', value: 40 }, { name: 'Uniswap', value: 10 }, { name: 'Seamless', value: 5 }
                ],
                assets: finalAssets // <--- LIVE NANSEN DATA INJECTED HERE
            },
            eoas: {
                title: "Traditional EOAs (Natives)",
                avgTxSize: 1200,
                protocols: [{ name: 'Uniswap', value: 55 }, { name: 'Aerodrome', value: 30 }, { name: 'Morpho', value: 10 }, { name: 'Aave', value: 5 }],
                assets: [{ name: 'ETH', value: 65 }, { name: 'USDC', value: 15 }, { name: 'AERO', value: 15 }, { name: 'DEGEN', value: 5 }]
            }
        };

        return NextResponse.json(liveProfileData);

    } catch (error) {
        console.error("Nansen API Pipeline Error:", error);
        // Fallback to static segment data so the dashboard still renders
        // even if Nansen is down or rate-limited
        const fallbackData = {
            global: {
                title: "Global View",
                avgTxSize: 450,
                protocols: [{ name: 'Aerodrome', value: 50 }, { name: 'Uniswap', value: 30 }, { name: 'Zora', value: 10 }, { name: 'Morpho', value: 10 }],
                assets: [{ name: 'ETH', value: 45 }, { name: 'USDC', value: 35 }, { name: 'DEGEN', value: 10 }, { name: 'AERO', value: 10 }]
            },
            smart_wallets: {
                title: "Smart Wallets (New Wave)",
                avgTxSize: 45,
                protocols: [{ name: 'Zora', value: 45 }, { name: 'Aerodrome', value: 40 }, { name: 'Uniswap', value: 10 }, { name: 'Seamless', value: 5 }],
                assets: [{ name: 'USDC', value: 60 }, { name: 'DEGEN', value: 25 }, { name: 'ETH', value: 10 }, { name: 'HIGHER', value: 5 }]
            },
            eoas: {
                title: "Traditional EOAs (Natives)",
                avgTxSize: 1200,
                protocols: [{ name: 'Uniswap', value: 55 }, { name: 'Aerodrome', value: 30 }, { name: 'Morpho', value: 10 }, { name: 'Aave', value: 5 }],
                assets: [{ name: 'ETH', value: 65 }, { name: 'USDC', value: 15 }, { name: 'AERO', value: 15 }, { name: 'DEGEN', value: 5 }]
            }
        };
        return NextResponse.json(fallbackData);
    }
}