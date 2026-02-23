from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import DATABASE_URL
import redis
from config import REDIS_URL

# Configuração PostgreSQL
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Configuração Redis
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

def get_db():
    """Dependency para obter sessão do banco de dados"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_redis():
    """Dependency para obter cliente Redis"""
    return redis_client

# Função para criar tabelas
def create_tables():
    Base.metadata.create_all(bind=engine)