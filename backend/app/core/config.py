import os
from pathlib import Path

class Settings:
    # Project paths
    PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
    DATA_FOLDER = PROJECT_ROOT / "data"
    
    # API settings
    API_V1_STR = "/api"
    PROJECT_NAME = "Trading Dashboard API"
    VERSION = "1.0.0"
    
    # Database settings
    DB_PREFIX = "data-"
    DB_EXTENSION = ".db"
    COMPRESSED_EXTENSION = ".gz"
    
    # Performance settings
    BATCH_SIZE = 1000
    MAX_WORKERS = 4
    
    # CORS settings
    ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    def __init__(self):
        # Ensure data folder exists
        self.DATA_FOLDER.mkdir(exist_ok=True)

settings = Settings()