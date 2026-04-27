from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from contextlib import asynccontextmanager
import os
import logging
from logging.handlers import RotatingFileHandler

# Importações locais
from db import create_tables, get_db, SessionLocal
from config import DEBUG, ALLOWED_ORIGINS, UPLOAD_FOLDER

# Importar rotas
from routes import autocare_auth, autocare_usuarios, autocare_perfis, autocare_clientes, autocare_veiculos
from routes import autocare_estoque, autocare_ordens, autocare_fornecedores
from routes import autocare_relatorios, autocare_dashboard, autocare_configuracoes
from routes import autocare_sugestoes_manutencao, autocare_compras_fornecedor
from models.autocare_models import Perfil, Usuario
import json

def _configure_logging():
    """Configura logging para arquivo com rotação e nível DEBUG.
    Logs irão para backend/logs/autocare-app.log
    """
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        logs_dir = os.path.join(base_dir, 'logs')
        os.makedirs(logs_dir, exist_ok=True)

        log_path = os.path.join(logs_dir, 'autocare-app.log')

        logger = logging.getLogger('autocare')
        logger.setLevel(logging.DEBUG)

        # Evitar handlers duplicados em reload
        if not any(isinstance(h, RotatingFileHandler) for h in logger.handlers):
            handler = RotatingFileHandler(log_path, maxBytes=5*1024*1024, backupCount=3)
            formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] %(name)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)

        # Também elevar nível dos loggers Uvicorn para aparecerem no arquivo
        for name in ('uvicorn', 'uvicorn.error', 'uvicorn.access'):
            lg = logging.getLogger(name)
            lg.setLevel(logging.INFO)
            if not any(isinstance(h, RotatingFileHandler) for h in lg.handlers):
                handler = RotatingFileHandler(log_path, maxBytes=5*1024*1024, backupCount=3)
                formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] %(name)s - %(message)s')
                handler.setFormatter(formatter)
                lg.addHandler(handler)
    except Exception as e:
        print(f"⚠️  Aviso: falha ao configurar logging de arquivo: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Iniciando AutoCenter API...")
    _configure_logging()
    create_tables()
    
    # Inicializa RBAC (perfis e vínculos) caso ainda não exista
    try:
        db = SessionLocal()
        # Compatibilidade de esquema: garantir coluna de opt-in de envio de e-mail em OS.
        db.execute(text("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS enviar_email_os BOOLEAN DEFAULT TRUE"))
        db.execute(text("UPDATE usuarios SET enviar_email_os = TRUE WHERE enviar_email_os IS NULL"))
        db.execute(text("ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS formas_pagamento TEXT"))
        db.execute(text("""
            INSERT INTO configuracoes (chave, valor, descricao, tipo)
            VALUES ('email_envio_habilitado', 'true', 'Habilita/desabilita o envio de e-mail em toda a aplicação', 'boolean')
            ON CONFLICT (chave) DO NOTHING
        """))
        db.commit()

        # Seed de perfis padrão se necessário
        perfis_count = db.query(Perfil).count()
        if perfis_count == 0:
            print("🔧 Inicializando perfis padrão (Administrador, Supervisor, Operador)...")
            permissoes_admin = json.dumps({
                "dashboard_gerencial": True,
                "dashboard_operacional": True,
                "clientes": True,
                "veiculos": True,
                "estoque": True,
                "ordens_servico": True,
                "fornecedores": True,
                "relatorios": True,
                "configuracoes": True,
                "usuarios": True,
                "perfis": True,
            })
            permissoes_supervisor = json.dumps({
                "dashboard_gerencial": True,
                "dashboard_operacional": False,
                "clientes": True,
                "veiculos": True,
                "estoque": True,
                "ordens_servico": True,
                "fornecedores": True,
                "relatorios": True,
                "configuracoes": False,
                "usuarios": False,
                "perfis": False,
            })
            permissoes_operador = json.dumps({
                "dashboard_gerencial": False,
                "dashboard_operacional": True,
                "clientes": False,
                "veiculos": False,
                "estoque": True,
                "ordens_servico": True,
                "fornecedores": False,
                "relatorios": False,
                "configuracoes": False,
                "usuarios": False,
                "perfis": False,
            })

            db.add_all([
                Perfil(id=1, nome="Administrador", descricao="Acesso total ao sistema", permissoes=permissoes_admin, ativo=True, editavel=False),
                Perfil(id=2, nome="Supervisor", descricao="Acesso intermediário ao sistema", permissoes=permissoes_supervisor, ativo=True, editavel=True),
                Perfil(id=3, nome="Operador", descricao="Acesso básico ao sistema", permissoes=permissoes_operador, ativo=True, editavel=True),
            ])
            db.commit()

        # Garantir que todos os usuários tenham um perfil atribuído
        usuarios_sem_perfil = db.query(Usuario).filter((Usuario.perfil_id == None)).all()  # type: ignore
        for u in usuarios_sem_perfil:
            u.perfil_id = 3  # Operador por padrão
        if usuarios_sem_perfil:
            db.commit()

        # Garantir que o usuário "admin" esteja vinculado ao perfil Administrador
        admin = db.query(Usuario).filter(Usuario.username == "admin").first()
        if admin and admin.perfil_id != 1:
            print("🔐 Vinculando usuário 'admin' ao perfil Administrador...")
            admin.perfil_id = 1
            db.commit()
    except Exception as e:
        # Não bloquear a inicialização do app por erro de seed; apenas logar
        print(f"⚠️  Aviso: falha ao inicializar perfis/usuários padrão: {e}")
    finally:
        try:
            db.close()
        except Exception:
            pass
    
    # Criar diretório de uploads se não existir
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    
    print("✅ AutoCenter API iniciada com sucesso!")
    yield
    # Shutdown
    print("🔄 Finalizando AutoCenter API...")

# Criar instância do FastAPI
app = FastAPI(
    title="AutoCenter API",
    description="API completa para sistema de gestão de AutoCenter",
    version="1.0.0",
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir arquivos estáticos
# Garantir caminho absoluto para a pasta de uploads para evitar erro quando
# o serviço for iniciado com working directory diferente. Criamos o diretório
# se necessário antes de montar os arquivos estáticos.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_PATH = UPLOAD_FOLDER if os.path.isabs(UPLOAD_FOLDER) else os.path.join(BASE_DIR, UPLOAD_FOLDER)
if not os.path.exists(UPLOAD_PATH):
    os.makedirs(UPLOAD_PATH, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_PATH), name="uploads")

# Registrar rotas
app.include_router(autocare_auth.router, prefix="/api/auth", tags=["Autenticação"])
app.include_router(autocare_usuarios.router, prefix="/api/usuarios", tags=["Usuários"])
app.include_router(autocare_perfis.router, prefix="/api/perfis", tags=["Perfis"])
app.include_router(autocare_clientes.router, prefix="/api/clientes", tags=["Clientes"])
app.include_router(autocare_veiculos.router, prefix="/api/veiculos", tags=["Veículos"])
app.include_router(autocare_estoque.router, prefix="/api/estoque", tags=["Estoque"])
app.include_router(autocare_ordens.router, prefix="/api/ordens", tags=["Ordens"])
app.include_router(autocare_fornecedores.router, prefix="/api/fornecedores", tags=["Fornecedores"])
app.include_router(autocare_relatorios.router, prefix="/api/relatorios", tags=["Relatórios"])
app.include_router(autocare_dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(autocare_configuracoes.router, prefix="/api/configuracoes", tags=["Configurações"])
app.include_router(autocare_sugestoes_manutencao.router, prefix="/api/sugestoes-manutencao", tags=["Sugestões de Manutenção"])
app.include_router(autocare_compras_fornecedor.router, prefix="/api/compras-fornecedor", tags=["Compras de Fornecedor"])
# Compatibilidade com frontend servido em /autocare: expor mesmos endpoints em /autocare-api
app.include_router(autocare_auth.router, prefix="/autocare-api/auth", tags=["Autenticação"])
app.include_router(autocare_usuarios.router, prefix="/autocare-api/usuarios", tags=["Usuários"])
app.include_router(autocare_perfis.router, prefix="/autocare-api/perfis", tags=["Perfis"])
app.include_router(autocare_clientes.router, prefix="/autocare-api/clientes", tags=["Clientes"])
app.include_router(autocare_veiculos.router, prefix="/autocare-api/veiculos", tags=["Veículos"])
app.include_router(autocare_estoque.router, prefix="/autocare-api/estoque", tags=["Estoque"])
app.include_router(autocare_ordens.router, prefix="/autocare-api/ordens", tags=["Ordens"])
app.include_router(autocare_fornecedores.router, prefix="/autocare-api/fornecedores", tags=["Fornecedores"])
app.include_router(autocare_relatorios.router, prefix="/autocare-api/relatorios", tags=["Relatórios"])
app.include_router(autocare_dashboard.router, prefix="/autocare-api/dashboard", tags=["Dashboard"])
app.include_router(autocare_configuracoes.router, prefix="/autocare-api/configuracoes", tags=["Configurações"])
app.include_router(autocare_sugestoes_manutencao.router, prefix="/autocare-api/sugestoes-manutencao", tags=["Sugestões de Manutenção"])
app.include_router(autocare_compras_fornecedor.router, prefix="/autocare-api/compras-fornecedor", tags=["Compras de Fornecedor"])

# Middleware de modo manutenção: quando arquivo sentinela existir, bloquear requisições
@app.middleware("http")
async def maintenance_mode_guard(request: Request, call_next):
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        flag_paths = [
            os.path.join(base_dir, '.maintenance'),
            '/tmp/.autocare_maintenance'
        ]
        maintenance_on = any(os.path.exists(p) for p in flag_paths)
        if maintenance_on:
            path = request.url.path or ''
            # Permitir apenas endpoints essenciais: health e a própria restauração
            allowed_prefixes = (
                '/api/configuracoes/backups/',
                '/autocare-api/configuracoes/backups/',
                '/health', '/api/health', '/autocare-api/health',
                '/openapi.json', '/docs', '/redoc'
            )
            if not any(path.startswith(pref) for pref in allowed_prefixes):
                return JSONResponse(
                    status_code=503,
                    content={
                        'detail': 'Sistema em manutenção. Tente novamente em alguns instantes.'
                    }
                )
    except Exception:
        # Em caso de qualquer erro neste middleware, não bloquear o fluxo normal
        pass
    return await call_next(request)

@app.get("/")
async def root():
    return {
        "message": "AutoCenter API",
        "version": "1.0.0",
        "status": "online"
    }

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        # Testar conexão com o banco de forma explícita usando sqlalchemy.text
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": "2023-11-01T00:00:00Z"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")

# Endpoints de health para compatibilidade com proxies
@app.get("/api/health")
async def health_check_api(db: Session = Depends(get_db)):
    return await health_check(db)

@app.get("/autocare-api/health")
async def health_check_autocare_api(db: Session = Depends(get_db)):
    return await health_check(db)

if __name__ == "__main__":
    import uvicorn
    from config import HOST, PORT
    
    uvicorn.run(
        "server:app",
        host=HOST,
        port=PORT,
        reload=DEBUG
    )