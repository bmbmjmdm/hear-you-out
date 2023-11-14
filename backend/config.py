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
  
  ACCESS_TOKEN_EXPIRE_MINUTES = os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES')
  
  AUDIO_FILE_PATH = os.environ.get('AUDIO_FILE_PATH')

  ADMIN_SECRET = os.environ.get('ADMIN_SECRET')

  HIDDEN_ENDPOINTS = os.environ.get('HIDDEN_ENDPOINTS') == 'True'

config = Config
  