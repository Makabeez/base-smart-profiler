"""
Base Smart Wallet Profiler — Cohort Caching Script

Samples the Coinbase Smart Wallet Factory's deployment history at 4 windows
(Jul 2025, Nov 2025, Feb 2026, latest available) and caches ~500 wallets per
window to SQLite for downstream enrichment and analysis.

Run: python cohort_cache.py
Env:  NANSEN_API_KEY must be set (source .env first)
"""

import asyncio
import os
import sqlite3
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import aiohttp

# --- Configuration ---------------------------------------------------------

NANSEN_API_KEY = os.environ.get("NANSEN_API_KEY")
if not NANSEN_API_KEY:
    sys.exit("ERROR: NANSEN_API_KEY not set. Run: set -a; source .env; set +a")

FACTORY_ADDRESS = "0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842"
CHAIN = "base"
API_URL = "https://api.nansen.ai/api/v1/profiler/address/related-wallets"
PER_PAGE = 100
DB_PATH = Path(__file__).parent / "cohort.db"

# Sample windows derived empirically from scoping calls.
# Each window fetches PAGES_PER_WINDOW contiguous pages around the target page,
# yielding roughly PAGES_PER_WINDOW * PER_PAGE wallets per sample.
PAGES_PER_WINDOW = 5  # 5 pages × 100 = ~500 wallets per window

SAMPLE_WINDOWS = [
    # (label, target_page, expected_date_approx)
    ("launch_jul_2025",    50,    "2025-07-15"),
    ("growth_nov_2025",    3500,  "2025-11-15"),
    ("peak_feb_2026",      15000, "2026-02-14"),
    ("latest_mar_2026",    18800, "2026-04-01"),
]

# Rate limiting: Nansen allows 20 req/sec, 500 req/min. We stay well below.
CONCURRENT_REQUESTS = 3
DELAY_BETWEEN_CALLS = 0.3  # seconds

# --- Data model ------------------------------------------------------------

@dataclass
class WalletRecord:
    address: str
    deployment_tx: str
    deployment_timestamp: str
    cohort_sample: str
    page_fetched: int


# --- SQLite setup ----------------------------------------------------------

def init_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS smart_wallets (
            address TEXT PRIMARY KEY,
            deployment_tx TEXT,
            deployment_timestamp TEXT,
            cohort_sample TEXT,
            page_fetched INTEGER,
            fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS fetch_log (
            cohort_sample TEXT,
            page INTEGER,
            wallets_returned INTEGER,
            earliest_timestamp TEXT,
            latest_timestamp TEXT,
            fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (cohort_sample, page)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cohort ON smart_wallets(cohort_sample)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_deployment_ts ON smart_wallets(deployment_timestamp)")
    conn.commit()
    return conn


def is_page_fetched(conn: sqlite3.Connection, sample: str, page: int) -> bool:
    cursor = conn.execute(
        "SELECT 1 FROM fetch_log WHERE cohort_sample = ? AND page = ?",
        (sample, page),
    )
    return cursor.fetchone() is not None


def record_fetch(
    conn: sqlite3.Connection,
    sample: str,
    page: int,
    wallets: list[WalletRecord],
) -> None:
    if wallets:
        conn.executemany(
            """
            INSERT OR IGNORE INTO smart_wallets
                (address, deployment_tx, deployment_timestamp, cohort_sample, page_fetched)
            VALUES (?, ?, ?, ?, ?)
            """,
            [(w.address, w.deployment_tx, w.deployment_timestamp, w.cohort_sample, w.page_fetched)
             for w in wallets],
        )
    timestamps = [w.deployment_timestamp for w in wallets]
    conn.execute(
        """
        INSERT OR REPLACE INTO fetch_log
            (cohort_sample, page, wallets_returned, earliest_timestamp, latest_timestamp)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            sample,
            page,
            len(wallets),
            min(timestamps) if timestamps else None,
            max(timestamps) if timestamps else None,
        ),
    )
    conn.commit()


# --- Nansen API client -----------------------------------------------------

async def fetch_page(
    session: aiohttp.ClientSession,
    page: int,
    sample_label: str,
) -> list[WalletRecord]:
    """Fetch one page from Nansen and return only 'Created Contract' relations."""
    payload = {
        "chain": CHAIN,
        "address": FACTORY_ADDRESS,
        "pagination": {"page": page, "per_page": PER_PAGE},
        "order_by": [{"field": "order", "direction": "DESC"}],
    }
    headers = {
        "Content-Type": "application/json",
        "apikey": NANSEN_API_KEY,
    }

    async with session.post(API_URL, json=payload, headers=headers) as resp:
        if resp.status != 200:
            body = await resp.text()
            print(f"  ERROR page {page}: HTTP {resp.status}: {body[:200]}")
            return []
        data = await resp.json()

    wallets = []
    for row in data.get("data", []):
        # Only keep wallets the Factory deployed (exclude Factory's own creator/deployer)
        if row.get("relation") != "Created Contract":
            continue
        wallets.append(WalletRecord(
            address=row["address"],
            deployment_tx=row["transaction_hash"],
            deployment_timestamp=row["block_timestamp"],
            cohort_sample=sample_label,
            page_fetched=page,
        ))
    return wallets


async def fetch_window(
    session: aiohttp.ClientSession,
    conn: sqlite3.Connection,
    label: str,
    target_page: int,
    expected_date: str,
) -> None:
    """Fetch PAGES_PER_WINDOW contiguous pages centered on target_page."""
    half = PAGES_PER_WINDOW // 2
    start_page = max(1, target_page - half)
    end_page = target_page + (PAGES_PER_WINDOW - half) - 1
    pages = list(range(start_page, end_page + 1))

    print(f"\n[{label}] target page {target_page} (~{expected_date})")
    print(f"  fetching pages {start_page}..{end_page}")

    for page in pages:
        if is_page_fetched(conn, label, page):
            print(f"  page {page}: already cached, skipping")
            continue

        wallets = await fetch_page(session, page, label)
        record_fetch(conn, label, page, wallets)

        if wallets:
            ts_range = f"{wallets[0].deployment_timestamp[:10]}..{wallets[-1].deployment_timestamp[:10]}"
            print(f"  page {page}: {len(wallets)} wallets ({ts_range})")
        else:
            print(f"  page {page}: empty (past end of dataset)")

        await asyncio.sleep(DELAY_BETWEEN_CALLS)


# --- Main ------------------------------------------------------------------

async def main() -> None:
    conn = init_db()
    print(f"DB: {DB_PATH}")
    print(f"Factory: {FACTORY_ADDRESS} on {CHAIN}")
    print(f"Windows: {len(SAMPLE_WINDOWS)} × {PAGES_PER_WINDOW} pages × {PER_PAGE} per_page")
    print(f"Credit cost estimate: {len(SAMPLE_WINDOWS) * PAGES_PER_WINDOW * 5} credits")

    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        for label, target_page, expected_date in SAMPLE_WINDOWS:
            await fetch_window(session, conn, label, target_page, expected_date)

    # Summary
    print("\n--- Summary ---")
    for label, _, _ in SAMPLE_WINDOWS:
        row = conn.execute(
            """
            SELECT COUNT(*), MIN(deployment_timestamp), MAX(deployment_timestamp)
            FROM smart_wallets WHERE cohort_sample = ?
            """,
            (label,),
        ).fetchone()
        count, earliest, latest = row
        print(f"  {label:<20} {count:>5} wallets   {earliest or '-'}  →  {latest or '-'}")

    total = conn.execute("SELECT COUNT(*) FROM smart_wallets").fetchone()[0]
    print(f"  {'TOTAL':<20} {total:>5} wallets")
    conn.close()


if __name__ == "__main__":
    asyncio.run(main())
