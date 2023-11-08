import os

# Rebuild the above
class Config:
  DB_CONFIG = {
    'user': os.environ.get('DB_USER'),
    'password': os.environ.get('DB_PASSWORD'),
    'host': os.environ.get('DB_HOST'),
    'port': os.environ.get('DB_PORT'),
    'database': os.environ.get('DB_NAME'),
  }
  SQLALCHEMY_DATABASE_URI = f"postgresql+asyncpg://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"


config = Config
  