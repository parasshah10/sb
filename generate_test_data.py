import sqlite3
import random
import os
from datetime import datetime, timedelta
from pathlib import Path
import gzip

def create_test_data():
    """Generate test trading data for NIFTY options with proper P&L tracking"""
    
    data_folder = Path("data")
    data_folder.mkdir(exist_ok=True)
    
    test_date = datetime.now().strftime("%Y-%m-%d")
    db_filename = f"data-{test_date}.db"
    db_path = data_folder / db_filename
    
    if db_path.exists(): os.remove(db_path)
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    cursor.execute("CREATE TABLE IF NOT EXISTS instruments (id INTEGER PRIMARY KEY, symbol TEXT UNIQUE NOT NULL, underlying_symbol TEXT, type TEXT, strike REAL, expiry TEXT)")
    cursor.execute("CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, timestamp TEXT NOT NULL, total_pnl REAL)")
    cursor.execute("CREATE TABLE IF NOT EXISTS position_details (snapshot_id INTEGER, instrument_id INTEGER, quantity INTEGER, avg_price REAL, last_price REAL, unbooked_pnl REAL, booked_pnl REAL, underlying_price REAL, FOREIGN KEY (snapshot_id) REFERENCES snapshots (id), FOREIGN KEY (instrument_id) REFERENCES instruments (id))")
    
    print(f"Creating test data for date: {test_date}")
    
    nifty_price = 21500
    instruments = []
    instrument_id_counter = 1
    
    for strike in [nifty_price - 100, nifty_price, nifty_price + 100]:
        for option_type in ['CE', 'PE']:
            for expiry_days in [7, 14]:
                expiry = (datetime.strptime(test_date, "%Y-%m-%d") + timedelta(days=expiry_days)).strftime("%Y-%m-%d")
                symbol = f"NIFTY{expiry.replace('-', '')[2:]}{str(int(strike))}{option_type}"
                instruments.append({'id': instrument_id_counter, 'symbol': symbol, 'underlying_symbol': 'NIFTY', 'type': option_type, 'strike': strike, 'expiry': expiry})
                instrument_id_counter += 1

    for instrument in instruments:
        cursor.execute("INSERT INTO instruments (id, symbol, underlying_symbol, type, strike, expiry) VALUES (?, ?, ?, ?, ?, ?)",
                       (instrument['id'], instrument['symbol'], instrument['underlying_symbol'], instrument['type'], instrument['strike'], instrument['expiry']))
    
    print(f"Created {len(instruments)} instruments")
    
    start_time = datetime.strptime(f"{test_date} 09:15:00", "%Y-%m-%d %H:%M:%S")
    end_time = datetime.strptime(f"{test_date} 15:30:00", "%Y-%m-%d %H:%M:%S")
    
    current_time = start_time
    snapshot_id = 1
    current_positions = {}
    underlying_price = nifty_price
    snapshots_created = 0
    
    while current_time <= end_time:
        underlying_price += random.uniform(-0.5, 0.5)
        
        if random.random() < 0.08:
            trade_type = random.choice(['new', 'close'])
            if trade_type == 'new' and len(current_positions) < 6:
                instrument = random.choice(instruments)
                if instrument['id'] not in current_positions:
                    current_positions[instrument['id']] = {'instrument': instrument, 'quantity': random.choice([25, 50, -25, -50]), 'avg_price': max(5, random.uniform(15, 150)), 'booked_pnl': 0.0}
            elif trade_type == 'close' and current_positions:
                instrument_id_to_close = random.choice(list(current_positions.keys()))
                pos = current_positions.pop(instrument_id_to_close)
                last_price = pos.get('last_price', pos['avg_price'])
                pnl_from_close = (last_price - pos['avg_price']) * pos['quantity']
                
                # Add realized PNL to remaining open positions to simulate portfolio effect
                if current_positions:
                    for pid in current_positions:
                        current_positions[pid]['booked_pnl'] += pnl_from_close / len(current_positions)
        
        total_portfolio_pnl = 0
        
        # Insert snapshot first
        cursor.execute("INSERT INTO snapshots (id, timestamp, total_pnl) VALUES (?, ?, ?)", (snapshot_id, current_time.isoformat(), 0)) # Placeholder PNL
        
        details_to_insert = []
        for instrument_id, position in current_positions.items():
            instrument = position['instrument']
            time_decay = max(0.1, 1.0 - (current_time - start_time).total_seconds() / (6.25 * 3600))
            time_value = random.uniform(8, 35) * time_decay
            intrinsic = max(0, underlying_price - instrument['strike']) if instrument['type'] == 'CE' else max(0, instrument['strike'] - underlying_price)
            last_price = max(0.5, intrinsic + time_value + random.uniform(-3, 3))
            
            unbooked_pnl = (last_price - position['avg_price']) * position['quantity']
            position['last_price'] = last_price
            total_portfolio_pnl += unbooked_pnl + position['booked_pnl']
            
            details_to_insert.append((snapshot_id, instrument_id, position['quantity'], position['avg_price'], last_price, unbooked_pnl, position['booked_pnl'], underlying_price))
        
        # Update snapshot with correct total PNL
        cursor.execute("UPDATE snapshots SET total_pnl = ? WHERE id = ?", (total_portfolio_pnl, snapshot_id))
        
        # Bulk insert position details
        cursor.executemany("INSERT INTO position_details (snapshot_id, instrument_id, quantity, avg_price, last_price, unbooked_pnl, booked_pnl, underlying_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", details_to_insert)
        
        snapshot_id += 1
        snapshots_created += 1
        current_time += timedelta(seconds=15)
    
    conn.commit()
    conn.close()
    
    print(f"Created {snapshots_created} snapshots")
    
    compressed_path = data_folder / f"{db_filename}.gz"
    with open(db_path, 'rb') as f_in, gzip.open(compressed_path, 'wb') as f_out:
        f_out.writelines(f_in)
    os.remove(db_path)
    
    print(f"Compressed test data: {compressed_path}")
    print(f"\nTest data generated successfully!")

if __name__ == "__main__":
    create_test_data()