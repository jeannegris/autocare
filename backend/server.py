from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from contextlib import asynccontextmanager
import os

# Importações locais
from db import create_tables, get_db, SessionLocal
from config import DEBUG, ALLOWED_ORIGINS, UPLOAD_FOLDER

# Importar rotas
from routes import autocare_auth, autocare_usuarios, autocare_perfis, autocare_clientes, autocare_veiculos
from routes import autocare_estoque, autocare_ordens, autocare_fornecedores
from routes import autocare_relatorios, autocare_dashboard, autocare_configuracoes
from routes import autocare_sugestoes_manutencao
from models.autocare_models import Perfil, Usuario
import json

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Iniciando AutoCenter API...")
    create_tables()
    
    # Inicializa RBAC (perfis e vínculos) caso ainda não exista
    try:
        db = SessionLocal()
        # Seed de perfis padrão se necessário
        perfis_count = db.query(Perfil).count()
        if perfis_count == 0:
            print("🔧 Inicializando perfis padrão (Administrador, Supervisor, Operador)...")
            permissoes_admin = json.dumps({
                "dashboard": True,
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
                "dashboard": True,
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
                "dashboard": True,
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