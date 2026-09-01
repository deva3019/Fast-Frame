import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Flask Session Security
    SECRET_KEY = os.getenv("SECRET_KEY", "ff_default_secret_key_2026")
    
    # Database Configuration (Isolated per deployment)
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/fastframe_studio")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "fastframe_studio")
    
    # 🔐 Master key for encrypting Google Credentials in MongoDB
    # Must be a 32 URL-safe base64-encoded bytes string
    FERNET_ENCRYPTION_KEY = os.getenv("FERNET_ENCRYPTION_KEY") 
    
    # In-memory Caching
    CACHE_TYPE = "SimpleCache"
    CACHE_DEFAULT_TIMEOUT = 1800  # 30 minutes cache

class ProductionConfig(Config):
    DEBUG = False

class DevelopmentConfig(Config):
    DEBUG = True

config_by_name = {
    "dev": DevelopmentConfig,
    "prod": ProductionConfig
}