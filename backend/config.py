import os
from dotenv import load_dotenv

load_dotenv()

# Configurações do banco de dados
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://autocare:autocare@localhost:5432/autocare")

# Configurações Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Configurações JWT
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Configurações da aplicação
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8008"))

# Configurações CORS
ALLOWED_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://0.0.0.0:3001",
    # Dev server running on port 3002 (configured in frontend vite.config.ts)
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://0.0.0.0:3002",
    "http://172.27.60.111",
    "http://172.27.60.111/autocare",
]

# Configurações de upload
UPLOAD_FOLDER = "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB