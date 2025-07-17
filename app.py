import requests
import sqlite3
import time
import gzip
import os
from datetime import datetime, date, timedelta, time as time_obj
from enum import Enum

# --- Configuration ---
SIMULATION_MODE = False
SIM_MARKET_OPEN_IN_SECONDS = 10
SIM_MARKET_DURATION_SECONDS = 35
SIM_COMPRESSION_IN_SECONDS_AFTER_CLOSE = 5

DATA_SUBFOLDER = "data"
SIM_DB_FILE = "simulation_data.db"

SENSIBULL_URL = "https://oxide.sensibull.com/v1/compute/verified_by_sensibull/live_positions/snapshot/oculated-toy"
HEADERS = {"accept": "application/json, text/plain, */*"}
FETCH_INTERVAL_SECONDS = 15

UPSTOX_API_URL = "https://api.upstox.com/v2/market/timings"
UPSTOX_HEADERS = {'Accept': 'application/json'}
COMPRESSION_HOUR = 16
SAFE_API_CHECK_HOUR = 9

# --- State Management ---
class State(Enum):
    INITIALIZING = 1
    WAITING_FOR_MARKET_OPEN = 2
    CAPTURING_DATA = 3
    POST_MARKET_TASKS = 4
    SLEEPING = 5

# --- Helper Functions ---

def get_market_timings_for_date(check_date):
    try:
        url = f"{UPSTOX_API_URL}/{check_date.strftime('%Y-%m-%d')}"
        response = requests.get(url, headers=UPSTOX_HEADERS, timeout=10)
        response.raise_for_status()
        data = response.json()
        timings_list = data.get('data', [])
        for exchange_data in timings_list:
            if exchange_data.get('exchange') == 'NSE':
                open_time_ms = exchange_data.get('start_time')
                close_time_ms = exchange_data.get('end_time')
                if open_time_ms and close_time_ms:
                    open_time = datetime.fromtimestamp(open_time_ms / 1000).time()
                    close_time = datetime.fromtimestamp(close_time_ms / 1000).time()
                    return {'open': open_time, 'close': close_time}
        return None
    except Exception: return None

def get_db_filename_for_date(d):
    filename = f"data-{d.strftime('%Y-%m-%d')}.db"
    return os.path.join(DATA_SUBFOLDER, filename)

def compress_db_file(db_file):
    if not os.path.exists(db_file): return
    compressed_file = f"{db_file}.gz"
    try:
        with open(db_file, 'rb') as f_in:
            with gzip.open(compressed_file, 'wb') as f_out: f_out.writelines(f_in)
        os.remove(db_file)
        print(f"[SUCCESS] Compressed {db_file} to {compressed_file}")
    except Exception as e: print(f"[ERROR] Failed to compress {db_file}: {e}")

def setup_database(db_file):
    with sqlite3.connect(db_file) as con:
        cur = con.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS instruments (id INTEGER PRIMARY KEY, symbol TEXT UNIQUE NOT NULL, underlying_symbol TEXT, type TEXT, strike REAL, expiry TEXT)")
        cur.execute("CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, timestamp TEXT NOT NULL, total_pnl REAL)")
        cur.execute("CREATE TABLE IF NOT EXISTS position_details (snapshot_id INTEGER, instrument_id INTEGER, quantity INTEGER, avg_price REAL, last_price REAL, unbooked_pnl REAL, booked_pnl REAL, underlying_price REAL, FOREIGN KEY (snapshot_id) REFERENCES snapshots (id), FOREIGN KEY (instrument_id) REFERENCES instruments (id))")
    print(f"Database setup/check complete for {db_file}.")

def insert_positions_data(db_file, payload, instrument_cache):
    snapshot_data = payload.get('position_snapshot_data')
    if not snapshot_data or not snapshot_data.get('data'): return 0
    with sqlite3.connect(db_file) as con:
        cur = con.cursor()
        cur.execute("INSERT INTO snapshots (timestamp, total_pnl) VALUES (?, ?)", (snapshot_data.get('created_at'), snapshot_data.get('total_profit')))
        snapshot_id = cur.lastrowid
        rows_inserted = 0
        for position_group in snapshot_data.get('data', []):
            underlying_symbol = position_group.get('trading_symbol')
            underlying_price = position_group.get('underlying_price')
            for trade in position_group.get('trades', []):
                instrument_symbol = trade.get('trading_symbol')
                if instrument_symbol not in instrument_cache:
                    info = trade.get('instrument_info', {})
                    cur.execute("INSERT OR IGNORE INTO instruments (symbol, underlying_symbol, type, strike, expiry) VALUES (?, ?, ?, ?, ?)", (instrument_symbol, underlying_symbol, 'CE' if info.get('instrument_type') == 'CALL' else 'PE' if info.get('instrument_type') == 'PUT' else info.get('instrument_type'), info.get('strike'), info.get('expiry')))
                    cur.execute("SELECT id FROM instruments WHERE symbol = ?", (instrument_symbol,))
                    instrument_id_tuple = cur.fetchone()
                    if instrument_id_tuple: instrument_cache[instrument_symbol] = instrument_id_tuple[0]
                    else: print(f"\n[ERROR] Could not retrieve instrument ID for {instrument_symbol}."); continue
                instrument_id = instrument_cache[instrument_symbol]
                cur.execute("INSERT INTO position_details (snapshot_id, instrument_id, quantity, avg_price, last_price, unbooked_pnl, booked_pnl, underlying_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (snapshot_id, instrument_id, trade.get('quantity'), trade.get('average_price'), trade.get('last_price'), trade.get('unbooked_pnl'), trade.get('booked_profit_loss'), underlying_price))
                rows_inserted += 1
        return rows_inserted

def fetch_and_store_data(db_file, instrument_cache):
    try:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching data... ", end='')
        response = requests.get(SENSIBULL_URL, headers=HEADERS, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data.get('success') and 'payload' in data:
            rows = insert_positions_data(db_file, data['payload'], instrument_cache)
            print(f"Success! Inserted {rows} rows.")
        else:
            print("API call not successful or payload missing.")
    except Exception as e:
        print(f"\n[ERROR] An error occurred during fetch: {e}")

def run_simulation_mode():
    print("="*50 + "\n===      RUNNING IN SIMULATION MODE      ===\n" + "="*50)
    
    sim_db_path = os.path.join(DATA_SUBFOLDER, SIM_DB_FILE)
    if os.path.exists(sim_db_path): os.remove(sim_db_path)
    
    setup_database(sim_db_path)
    instrument_cache = {}
    
    start_time = datetime.now() + timedelta(seconds=SIM_MARKET_OPEN_IN_SECONDS)
    close_time = start_time + timedelta(seconds=SIM_MARKET_DURATION_SECONDS)
    compress_time = close_time + timedelta(seconds=SIM_COMPRESSION_IN_SECONDS_AFTER_CLOSE)

    print(f"Simulation will run:\n  - Market Open:   {start_time.strftime('%H:%M:%S')}\n  - Market Close:  {close_time.strftime('%H:%M:%S')}\n  - Compression:   {compress_time.strftime('%H:%M:%S')}")
    
    while datetime.now() < start_time:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Simulation waiting to start...", end='\r')
        time.sleep(1)
    
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] SIM: Market is OPEN.")
    while datetime.now() < close_time:
        fetch_and_store_data(sim_db_path, instrument_cache)
        time.sleep(FETCH_INTERVAL_SECONDS)
        
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] SIM: Market is CLOSED.")
    
    while datetime.now() < compress_time:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Simulation waiting for compression time...", end='\r')
        time.sleep(1)
        
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] SIM: Performing post-market tasks.")
    compress_db_file(sim_db_path)
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Simulation cycle complete.")

# --- Main Autonomous Loop ---

def main():
    os.makedirs(DATA_SUBFOLDER, exist_ok=True)

    if SIMULATION_MODE:
        run_simulation_mode()
        return

    print("--- Autonomous Data Capture Script (Polling Mode): Starting Up ---")
    current_state = State.INITIALIZING
    current_db_file = None
    instrument_cache = {}
    market_timings_today = None
    last_checked_date = None
    
    try:
        while True:
            now = datetime.now()
            today = now.date()
            current_time = now.time()

            if last_checked_date != today:
                print(f"\n--- New Day Detected: {today.strftime('%Y-%m-%d')} ---")
                
                last_trading_day_for_compression = None
                if market_timings_today: last_trading_day_for_compression = last_checked_date

                market_timings_today = None
                last_checked_date = today
                current_state = State.INITIALIZING
                
                while datetime.now().hour < SAFE_API_CHECK_HOUR:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Pre-market sleep. Waiting for {SAFE_API_CHECK_HOUR}:00...", end='\r')
                    time.sleep(30)

                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Safe hour reached. Checking market status...")
                market_timings_today = get_market_timings_for_date(today)

                if market_timings_today:
                    market_open, market_close = market_timings_today['open'], market_timings_today['close']
                    print(f"Today is a trading day. Market Hours: {market_open.strftime('%H:%M')} - {market_close.strftime('%H:%M')}")
                    
                    if now.hour >= COMPRESSION_HOUR:
                        print(f"[{current_time.strftime('%H:%M:%S')}] [Catch-Up] It's past compression time. Running cleanup.")
                        perform_post_market_tasks(last_trading_day_for_compression)
                        current_state = State.SLEEPING
                    elif current_time >= market_close:
                        print(f"[{current_time.strftime('%H:%M:%S')}] [Catch-Up] It's past market close.")
                        current_state = State.POST_MARKET_TASKS
                    elif current_time >= market_open:
                        print(f"[{current_time.strftime('%H:%M:%S')}] [Catch-Up] It's mid-market. Starting data capture.")
                        current_state = State.CAPTURING_DATA
                    else:
                        current_state = State.WAITING_FOR_MARKET_OPEN
                else:
                    print("Today is a market holiday or weekend.")
                    current_state = State.SLEEPING
            
            if current_state == State.WAITING_FOR_MARKET_OPEN:
                print(f"[{current_time.strftime('%H:%M:%S')}] Waiting for market to open at {market_open.strftime('%H:%M')}...", end='\r')
                if datetime.now().time() >= market_open:
                    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Market is OPEN.")
                    current_state = State.CAPTURING_DATA
                else:
                    time.sleep(1)

            elif current_state == State.CAPTURING_DATA:
                if current_db_file is None: # Just-in-time setup on first capture
                    current_db_file = get_db_filename_for_date(today)
                    instrument_cache = {}
                    setup_database(current_db_file)
                
                if datetime.now().time() < market_close:
                    fetch_and_store_data(current_db_file, instrument_cache)
                    time.sleep(FETCH_INTERVAL_SECONDS)
                else:
                    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Market is CLOSED.")
                    current_state = State.POST_MARKET_TASKS

            elif current_state == State.POST_MARKET_TASKS:
                print(f"[{current_time.strftime('%H:%M:%S')}] Performing post-market tasks.")
                if last_trading_day_for_compression:
                    db_to_compress = get_db_filename_for_date(last_trading_day_for_compression)
                    compress_db_file(db_to_compress)
                print("Post-market tasks complete. Switching to sleep mode.")
                current_state = State.SLEEPING
            
            elif current_state == State.SLEEPING:
                print(f"[{current_time.strftime('%H:%M:%S')}] Main thread status: {current_state.name}. Sleeping...", end='\r')
                time.sleep(60)

    except (KeyboardInterrupt, SystemExit):
        print("\n--- Shutting down script ---")

if __name__ == "__main__":
    main()