import { NextResponse } from 'next/server';

// 🛑 4-Hour Cache Lock to protect your 50k API credits
export const revalidate = 14400; 

export async function GET() {
    const API_KEY = process.env.NANSEN_API_KEY;

    if (!API_KEY) {
        return NextResponse.json({ error: "NANSEN_API_KEY is missing from environment variables." }, { status: 500 });
    }

    const BASE_URL = 'https://api.nansen.ai/v1';
    const FACTORY_CONTRACT = '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842'; // Coinbase Smart Wallet Factory v1.1
    
    const headers = {
        'Content-Type': 'application/json',
        'api-key': API_KEY
    };

    try {
        // =======================================================================
        // STEP 1: THE COHORT QUERY (Identify the Smart Wallets)
        // Hit the profiler-counterparties endpoint to get wallets deployed by the factory.
        // =======================================================================
        const counterpartiesRes = await fetch(`${BASE_URL}/chain/base/profiler/${FACTORY_CONTRACT}/counterparties`, { headers });
        const counterpartiesData = await counterpartiesRes.json();

        // Extract the addresses. (Note: Depending on Nansen's exact JSON shape, 
        // you might need to adjust this map function: e.g., d.counterparty_address)
        const smartWalletAddresses = counterpartiesData?.data?.map(d => d.address).slice(0, 50) || [];

        // =======================================================================
        // STEP 2: THE AGGREGATION QUERY (Fetch their holdings)
        // Pass the cohort into the balances/portfolio endpoint.
        // =======================================================================
        // *Note for production: If Nansen requires batching, you may need to loop 
        // through the addresses or use a specific batch-portfolio endpoint here.*
        
        let aggregatedAssets = [];
        let aggregatedProtocols = [];

        if (smartWalletAddresses.length > 0) {
             // Example mapping logic: you will replace this block with the actual 
             // JSON parsing once you inspect Nansen's token-balances response.
             // const balancesRes = await fetch(`${BASE_URL}/chain/base/portfolio/batch`, { method: 'POST', headers, body: JSON.stringify({ addresses: smartWalletAddresses }) });
             // const balancesData = await balancesRes.json();
             // aggregatedAssets = parseAssets(balancesData);
             // aggregatedProtocols = parseProtocols(balancesData);
        }

        // =======================================================================
        // STEP 3: MAPPING TO THE D3 FRONTEND
        // Inject the live aggregated data into the structure your React charts expect.
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
                avgTxSize: 45, // Live mapping goes here
                protocols: aggregatedProtocols.length > 0 ? aggregatedProtocols : [
                    { name: 'Zora', value: 45 }, { name: 'Aerodrome', value: 40 }, { name: 'Uniswap', value: 10 }, { name: 'Seamless', value: 5 }
                ],
                assets: aggregatedAssets.length > 0 ? aggregatedAssets : [
                    { name: 'USDC', value: 60 }, { name: 'DEGEN', value: 25 }, { name: 'ETH', value: 10 }, { name: 'HIGHER', value: 5 }
                ]
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
        return NextResponse.json({ error: "Data pipeline execution failed." }, { status: 500 });
    }
}
