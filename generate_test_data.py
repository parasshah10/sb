import sqlite3
import random
import os
from datetime import datetime, timedelta
from pathlib import Path
import gzip

def create_test_data():
    """Generate test trading data for NIFTY options with proper P&L tracking"""
    
    # Configuration
    data_folder = Path("data")
    data_folder.mkdir(exist_ok=True)
    
    # Test date
    test_date = datetime.now().strftime("%Y-%m-%d")
    db_filename = f"data-{test_date}.db"
    db_path = data_folder / db_filename
    
    # Remove existing file
    if db_path.exists():
        os.remove(db_path)
    
    # Create database
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS instruments (
            id INTEGER PRIMARY KEY,
            symbol TEXT UNIQUE NOT NULL,
            underlying_symbol TEXT,
            type TEXT,
            strike REAL,
            expiry TEXT
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY,
            timestamp TEXT NOT NULL,
            total_pnl REAL
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS position_details (
            snapshot_id INTEGER,
            instrument_id INTEGER,
            quantity INTEGER,
            avg_price REAL,
            last_price REAL,
            unbooked_pnl REAL,
            booked_pnl REAL,
            underlying_price REAL,
            FOREIGN KEY (snapshot_id) REFERENCES snapshots (id),
            FOREIGN KEY (instrument_id) REFERENCES instruments (id)
        )
    """)
    
    print(f"Creating test data for date: {test_date}")
    
    # Generate instruments (NIFTY options)
    nifty_price = 21500
    strikes = [nifty_price - 200, nifty_price - 100, nifty_price, nifty_price + 100, nifty_price + 200]
    expiry = "2024-12-31"
    
    instruments = []
    instrument_id = 1
    
    for strike in strikes:
        for option_type in ['CE', 'PE']:
            symbol = f"NIFTY{expiry[-2:]}{str(int(strike)).zfill(5)}{option_type}"
            instruments.append({
                'id': instrument_id,
                'symbol': symbol,
                'underlying_symbol': 'NIFTY',
                'type': option_type,
                'strike': strike,
                'expiry': expiry
            })
            instrument_id += 1
    
    # Insert instruments
    for instrument in instruments:
        cursor.execute("""
            INSERT INTO instruments (id, symbol, underlying_symbol, type, strike, expiry)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            instrument['id'], instrument['symbol'], instrument['underlying_symbol'],
            instrument['type'], instrument['strike'], instrument['expiry']
        ))
    
    print(f"Created {len(instruments)} instruments")
    
    # Generate snapshots (market hours: 9:15 AM to 3:30 PM)
    start_time = datetime.strptime(f"{test_date} 09:15:00", "%Y-%m-%d %H:%M:%S")
    end_time = datetime.strptime(f"{test_date} 15:30:00", "%Y-%m-%d %H:%M:%S")
    
    current_time = start_time
    snapshot_id = 1
    
    # Track positions and P&L properly
    current_positions = {}
    realized_pnl = 0.0  # Track realized P&L from closed positions
    underlying_price = nifty_price
    
    snapshots_created = 0
    
    while current_time <= end_time:
        # Market movement simulation
        price_change = random.uniform(-0.5, 0.5)
        underlying_price += price_change
        underlying_price = max(underlying_price, nifty_price * 0.97)  # Don't go too low
        underlying_price = min(underlying_price, nifty_price * 1.03)  # Don't go too high
        
        # Randomly add/remove positions (simulate trading)
        if random.random() < 0.08:  # 8% chance of trade
            trade_type = random.choice(['new', 'modify', 'close'])
            
            if trade_type == 'new' and len(current_positions) < 6:
                # Add new position
                instrument = random.choice(instruments)
                if instrument['id'] not in current_positions:
                    quantity = random.choice([25, 50, 75, 100]) * random.choice([1, -1])
                    avg_price = max(5, random.uniform(15, 150))
                    
                    current_positions[instrument['id']] = {
                        'instrument': instrument,
                        'quantity': quantity,
                        'avg_price': avg_price
                    }
                    print(f"  NEW: {instrument['symbol']} qty={quantity} @ {avg_price:.2f}")
            
            elif trade_type == 'modify' and current_positions:
                # Modify existing position
                instrument_id = random.choice(list(current_positions.keys()))
                position = current_positions[instrument_id]
                
                # Change quantity
                quantity_change = random.choice([25, 50, -25, -50])
                old_quantity = position['quantity']
                position['quantity'] += quantity_change
                
                print(f"  MODIFY: {position['instrument']['symbol']} qty={old_quantity} -> {position['quantity']}")
                
                if position['quantity'] == 0:
                    # Calculate realized P&L before closing
                    last_price = position.get('last_price', position['avg_price'])
                    closed_pnl = (last_price - position['avg_price']) * old_quantity
                    realized_pnl += closed_pnl
                    print(f"  CLOSED: {position['instrument']['symbol']} realized P&L: {closed_pnl:.2f}")
                    del current_positions[instrument_id]
            
            elif trade_type == 'close' and current_positions:
                # Close position
                instrument_id = random.choice(list(current_positions.keys()))
                position = current_positions[instrument_id]
                
                # Calculate realized P&L
                last_price = position.get('last_price', position['avg_price'])
                closed_pnl = (last_price - position['avg_price']) * position['quantity']
                realized_pnl += closed_pnl
                print(f"  CLOSE: {position['instrument']['symbol']} realized P&L: {closed_pnl:.2f}")
                
                del current_positions[instrument_id]
        
        # Calculate option prices and unrealized P&L
        unrealized_pnl = 0
        
        for instrument_id, position in current_positions.items():
            instrument = position['instrument']
            
            # Simple option pricing (distance from strike)
            time_decay = max(0.1, 1.0 - (current_time - start_time).total_seconds() / (6.25 * 3600))
            time_value = random.uniform(8, 35) * time_decay
            
            if instrument['type'] == 'CE':
                intrinsic = max(0, underlying_price - instrument['strike'])
            else:  # PE
                intrinsic = max(0, instrument['strike'] - underlying_price)
            
            last_price = intrinsic + time_value + random.uniform(-3, 3)
            last_price = max(0.5, last_price)  # Minimum price
            
            # Calculate unrealized P&L
            pnl = (last_price - position['avg_price']) * position['quantity']
            unrealized_pnl += pnl
            
            position['last_price'] = last_price
            position['pnl'] = pnl
        
        # Total P&L = Realized + Unrealized
        total_pnl = realized_pnl + unrealized_pnl
        
        # Insert snapshot
        cursor.execute("""
            INSERT INTO snapshots (id, timestamp, total_pnl)
            VALUES (?, ?, ?)
        """, (snapshot_id, current_time.isoformat(), total_pnl))
        
        # Insert position details
        for instrument_id, position in current_positions.items():
            cursor.execute("""
                INSERT INTO position_details (
                    snapshot_id, instrument_id, quantity, avg_price, 
                    last_price, unbooked_pnl, booked_pnl, underlying_price
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                snapshot_id, instrument_id, position['quantity'], 
                position['avg_price'], position['last_price'],
                position['pnl'], realized_pnl, underlying_price
            ))
        
        snapshot_id += 1
        snapshots_created += 1
        
        # Move to next snapshot (15 second intervals)
        current_time += timedelta(seconds=15)
    
    conn.commit()
    conn.close()
    
    print(f"Created {snapshots_created} snapshots")
    print(f"Test database created: {db_path}")
    
    # Compress the file
    compressed_path = data_folder / f"{db_filename}.gz"
    with open(db_path, 'rb') as f_in:
        with gzip.open(compressed_path, 'wb') as f_out:
            f_out.writelines(f_in)
    
    # Remove uncompressed file
    os.remove(db_path)
    
    print(f"Compressed test data: {compressed_path}")
    print(f"Final underlying price: {underlying_price:.2f}")
    print(f"Final total P&L: {total_pnl:.2f}")
    print(f"  - Realized P&L: {realized_pnl:.2f}")
    print(f"  - Unrealized P&L: {unrealized_pnl:.2f}")
    print(f"Current positions: {len(current_positions)}")
    
    return str(compressed_path)

if __name__ == "__main__":
    test_file = create_test_data()
    print(f"\nTest data generated successfully!")
    print(f"File: {test_file}")
    print(f"\nTo test the API:")
    print(f"1. Install dependencies: uv pip install -r backend/requirements.txt")
    print(f"2. Run server: python backend/run.py")
    print(f"3. Visit: http://localhost:8000/docs")