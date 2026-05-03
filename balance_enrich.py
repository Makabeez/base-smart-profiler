"""
Base Smart Wallet Profiler — Balance Enrichment Script

Walks the cohort cache and fetches current token balances for each wallet via
Nansen's /profiler/address/current-balance endpoint (0 credits per call).

Designed to run after cohort_cache.py. Resumable — skips wallets already enriched.

Run: python balance_enrich.py
Env:  NANSEN_API_KEY must be set (source .env first)
"""

import asyncio
import os
import sqlite3
import sys
from pathlib import Path

import aiohttp

# --- Configuration ---------------------------------------------------------

NANSEN_API_KEY = os.environ.get("NANSEN_API_KEY")
if not NANSEN_API_KEY:
    sys.exit("ERROR: NANSEN_API_KEY not set. Run: set -a; source .env; set +a")

API_URL = "https://api.nansen.ai/api/v1/profiler/address/current-balance"
DB_PATH = Path(__file__).parent / "cohort.db"

CONCURRENT_REQUESTS = 5
DELAY_BETWEEN_CALLS = 0.15  # ~6.7 calls/sec, well under 20/sec limit

# Fetch balances across all chains — wallets may bridge
CHAIN_FILTER = "base"  # switch to "all" if you want cross-chain visibility

# --- SQLite setup ----------------------------------------------------------

def init_balance_tables(conn: sqlite3.Connection) -> None:
    """Add balance + enrichment-status tables. Does not touch existing cohort tables."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS wallet_balances (
            wallet_address TEXT,
            token_address TEXT,
            token_symbol TEXT,
            token_name TEXT,
            token_amount REAL,
            price_usd REAL,
            value_usd REAL,
            chain TEXT,
            fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (wallet_address, token_address, chain)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS enrichment_log (
            wallet_address TEXT PRIMARY KEY,
            status TEXT,
            token_count INTEGER,
            total_value_usd REAL,
            fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
            error_message TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_wallet ON wallet_balances(wallet_address)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_symbol ON wallet_balances(token_symbol)")
    conn.commit()


def wallets_to_enrich(conn: sqlite3.Connection) -> list[str]:
    """Return wallet addresses that haven't been enriched yet."""
    cursor = conn.execute("""
        SELECT sw.address
        FROM smart_wallets sw
        LEFT JOIN enrichment_log el ON sw.address = el.wallet_address
        WHERE el.wallet_address IS NULL
        ORDER BY sw.cohort_sample, sw.address
    """)
    return [row[0] for row in cursor.fetchall()]


def record_enrichment(
    conn: sqlite3.Connection,
    address: str,
    balances: list[dict],
    status: str = "ok",
    error_message: str | None = None,
) -> None:
    if balances:
        conn.executemany(
            """
            INSERT OR REPLACE INTO wallet_balances
                (wallet_address, token_address, token_symbol, token_name,
                 token_amount, price_usd, value_usd, chain)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    address,
                    b.get("token_address"),
                    b.get("token_symbol"),
                    b.get("token_name"),
                    b.get("token_amount"),
                    b.get("price_usd"),
                    b.get("value_usd"),
                    b.get("chain"),
                )
                for b in balances
            ],
        )

    total_usd = sum(b.get("value_usd") or 0 for b in balances)
    conn.execute(
        """
        INSERT OR REPLACE INTO enrichment_log
            (wallet_address, status, token_count, total_value_usd, error_message)
        VALUES (?, ?, ?, ?, ?)
        """,
        (address, status, len(balances), total_usd, error_message),
    )
    conn.commit()


# --- Nansen API client -----------------------------------------------------

async def fetch_balance(
    session: aiohttp.ClientSession,
    address: str,
    semaphore: asyncio.Semaphore,
) -> tuple[str, list[dict], str, str | None]:
    """Fetch balance for a single wallet. Returns (address, balances, status, error)."""
    payload = {
        "chain": CHAIN_FILTER,
        "address": address,
        "pagination": {"page": 1, "per_page": 100},
    }
    headers = {
        "Content-Type": "application/json",
        "apikey": NANSEN_API_KEY,
    }

    async with semaphore:
        await asyncio.sleep(DELAY_BETWEEN_CALLS)
        try:
            async with session.post(API_URL, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return address, data.get("data", []), "ok", None
                else:
                    body = await resp.text()
                    return address, [], f"http_{resp.status}", body[:200]
        except Exception as e:
            return address, [], "exception", str(e)


# --- Main ------------------------------------------------------------------

async def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    init_balance_tables(conn)

    pending = wallets_to_enrich(conn)
    total_wallets = conn.execute("SELECT COUNT(*) FROM smart_wallets").fetchone()[0]
    already_done = total_wallets - len(pending)

    print(f"DB: {DB_PATH}")
    print(f"Total wallets in cohort: {total_wallets}")
    print(f"Already enriched: {already_done}")
    print(f"Pending enrichment: {len(pending)}")
    print(f"Chain filter: {CHAIN_FILTER}")

    if not pending:
        print("Nothing to do. All wallets already enriched.")
        print_summary(conn)
        conn.close()
        return

    semaphore = asyncio.Semaphore(CONCURRENT_REQUESTS)
    timeout = aiohttp.ClientTimeout(total=30)

    processed = 0
    errors = 0
    empty = 0
    holders = 0

    async with aiohttp.ClientSession(timeout=timeout) as session:
        # Process in chunks so we can checkpoint progress
        chunk_size = 50
        for chunk_start in range(0, len(pending), chunk_size):
            chunk = pending[chunk_start:chunk_start + chunk_size]
            tasks = [fetch_balance(session, addr, semaphore) for addr in chunk]
            results = await asyncio.gather(*tasks)

            for address, balances, status, error in results:
                record_enrichment(conn, address, balances, status, error)
                processed += 1
                if status != "ok":
                    errors += 1
                elif not balances:
                    empty += 1
                else:
                    holders += 1

            pct = (chunk_start + len(chunk)) / len(pending) * 100
            print(
                f"  progress: {chunk_start + len(chunk):>4}/{len(pending)} ({pct:>5.1f}%) "
                f"| holders: {holders} | empty: {empty} | errors: {errors}"
            )

    print(f"\nDone. Processed {processed}. Holders: {holders}, Empty: {empty}, Errors: {errors}")
    print_summary(conn)
    conn.close()


def print_summary(conn: sqlite3.Connection) -> None:
    print("\n--- Enrichment Summary ---")
    rows = conn.execute("""
        SELECT
            sw.cohort_sample,
            COUNT(DISTINCT sw.address) AS total,
            SUM(CASE WHEN el.token_count > 0 THEN 1 ELSE 0 END) AS holders,
            SUM(CASE WHEN el.token_count = 0 THEN 1 ELSE 0 END) AS empty_wallets,
            SUM(CASE WHEN el.status != 'ok' THEN 1 ELSE 0 END) AS errors,
            ROUND(AVG(CASE WHEN el.total_value_usd > 0 THEN el.total_value_usd END), 2) AS avg_usd_held
        FROM smart_wallets sw
        LEFT JOIN enrichment_log el ON sw.address = el.wallet_address
        GROUP BY sw.cohort_sample
        ORDER BY sw.cohort_sample
    """).fetchall()

    print(f"  {'cohort':<22} {'total':>6} {'holders':>8} {'empty':>7} {'errors':>7} {'avg $':>12}")
    for r in rows:
        cohort, total, holders, empty, errors, avg = r
        print(
            f"  {cohort:<22} {total:>6} {holders or 0:>8} "
            f"{empty or 0:>7} {errors or 0:>7} {avg or 0:>12,.2f}"
        )

    # Top tokens across cohort
    print("\n--- Top 15 tokens by holder count ---")
    rows = conn.execute("""
        SELECT token_symbol, COUNT(DISTINCT wallet_address) AS holders,
               ROUND(SUM(value_usd), 2) AS total_usd
        FROM wallet_balances
        WHERE token_symbol IS NOT NULL
        GROUP BY token_symbol
        ORDER BY holders DESC
        LIMIT 15
    """).fetchall()
    print(f"  {'symbol':<15} {'holders':>8} {'aggregate $':>15}")
    for symbol, holders, total_usd in rows:
        print(f"  {symbol:<15} {holders:>8} {total_usd or 0:>15,.2f}")


if __name__ == "__main__":
    asyncio.run(main())
