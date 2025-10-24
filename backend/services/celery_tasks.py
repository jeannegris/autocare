from celery import Celery
from celery.schedules import crontab
from datetime import datetime, timedelta
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from config import REDIS_URL, DATABASE_URL
from models.autocare_models import Cliente, Veiculo, AlertaKm, Produto
from db import SessionLocal
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
import os

# Configurar Celery
celery_app = Celery(
    "autocare_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['services.celery_tasks']
)

# Configuração do Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='America/Sao_Paulo',
    enable_utc=True,
    beat_schedule={
        'verificar-aniversarios': {
            'task': 'services.celery_tasks.verificar_aniversarios',
            'schedule': 86400.0,  # 24 horas
        },
        'verificar-alertas-km': {
            'task': 'services.celery_tasks.verificar_alertas_km',
            'schedule': 3600.0,  # 1 hora
        },
        'verificar-estoque-baixo': {
            'task': 'services.celery_tasks.verificar_estoque_baixo',
            'schedule': 21600.0,  # 6 horas
        },
        'backup-mensal': {
            'task': 'services.celery_tasks.backup_mensal_task',
            # Cron: dia 31 às 22:00 (ou último dia do mês se não houver dia 31)
            'schedule': crontab(hour=22, minute=0, day_of_month='28-31'),
        },
    },
)

@celery_app.task
def verificar_aniversarios():
    """Verificar aniversários de clientes e enviar alertas"""
    db = SessionLocal()
    try:
        hoje = datetime.now().date()
        
        # Buscar clientes que fazem aniversário hoje
        clientes_aniversario = db.query(Cliente).filter(
            Cliente.ativo == True,
            Cliente.data_nascimento.isnot(None),
            db.func.extract('month', Cliente.data_nascimento) == hoje.month,
            db.func.extract('day', Cliente.data_nascimento) == hoje.day
        ).all()
        
        alertas_enviados = 0
        
        for cliente in clientes_aniversario:
            # Aqui você pode implementar o envio de notificação
            # Por exemplo, salvar em uma tabela de notificações ou enviar email
            print(f"🎂 Aniversário de {cliente.nome} - {cliente.data_nascimento}")
            
            # Exemplo de envio de email (configurar SMTP)
            # enviar_email_aniversario(cliente)
            
            alertas_enviados += 1
        
        return f"Verificação de aniversários concluída. {alertas_enviados} alertas processados."
    
    finally:
        db.close()

@celery_app.task
def verificar_alertas_km():
    """Verificar alertas de quilometragem dos veículos"""
    db = SessionLocal()
    try:
        # Buscar alertas ativos que estão próximos do vencimento
        alertas = db.query(AlertaKm).join(Veiculo).filter(
            AlertaKm.ativo == True,
            AlertaKm.notificado == False,
            # Alerta quando faltam 1000 km ou menos
            Veiculo.km_atual >= AlertaKm.km_proximo_servico - 1000
        ).all()
        
        alertas_processados = 0
        
        for alerta in alertas:
            veiculo = alerta.veiculo
            km_restante = alerta.km_proximo_servico - veiculo.km_atual
            
            if km_restante <= 0:
                # Serviço vencido
                print(f"🚨 VENCIDO: {veiculo.marca} {veiculo.modelo} - {alerta.tipo_servico}")
                prioridade = "ALTA"
            else:
                # Serviço próximo
                print(f"⚠️ PRÓXIMO: {veiculo.marca} {veiculo.modelo} - {alerta.tipo_servico} ({km_restante} km)")
                prioridade = "MEDIA"
            
            # Marcar como notificado
            alerta.notificado = True
            
            # Aqui você pode implementar o envio da notificação
            # Por exemplo, salvar em uma tabela de notificações
            
            alertas_processados += 1
        
        db.commit()
        return f"Verificação de alertas de KM concluída. {alertas_processados} alertas processados."
    
    finally:
        db.close()

@celery_app.task
def verificar_estoque_baixo():
    """Verificar produtos com estoque baixo"""
    db = SessionLocal()
    try:
        # Buscar produtos com estoque baixo
        produtos_estoque_baixo = db.query(Produto).filter(
            Produto.ativo == True,
            Produto.estoque_atual <= Produto.estoque_minimo
        ).all()
        
        if produtos_estoque_baixo:
            print(f"📦 {len(produtos_estoque_baixo)} produtos com estoque baixo:")
            
            for produto in produtos_estoque_baixo:
                print(f"   - {produto.nome}: {produto.estoque_atual}/{produto.estoque_minimo}")
                
                # Aqui você pode implementar o envio de notificação
                # Por exemplo, enviar email para o gestor de estoque
        
        return f"Verificação de estoque concluída. {len(produtos_estoque_baixo)} produtos com estoque baixo."
    
    finally:
        db.close()

@celery_app.task
def enviar_email_aniversario(cliente_id: int):
    """Enviar email de parabéns por aniversário (exemplo)"""
    # Configuração SMTP (substituir pelos seus dados)
    SMTP_SERVER = "smtp.gmail.com"
    SMTP_PORT = 587
    EMAIL_USER = "seu_email@gmail.com"
    EMAIL_PASS = "sua_senha_app"
    
    db = SessionLocal()
    try:
        cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
        if not cliente or not cliente.email:
            return "Cliente não encontrado ou sem email"
        
        # Criar mensagem
        msg = MIMEMultipart()
        msg['From'] = EMAIL_USER
        msg['To'] = cliente.email
        msg['Subject'] = "🎂 Feliz Aniversário!"
        
        corpo = f"""
        Olá {cliente.nome}!
        
        A equipe da AutoCenter deseja um Feliz Aniversário! 🎉
        
        Aproveitamos para lembrar que estamos sempre à disposição
        para cuidar do seu veículo com todo carinho e profissionalismo.
        
        Atenciosamente,
        Equipe AutoCenter
        """
        
        msg.attach(MIMEText(corpo, 'plain'))
        
        # Enviar email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        server.send_message(msg)
        server.quit()
        
        return f"Email de aniversário enviado para {cliente.nome}"
    
    except Exception as e:
        return f"Erro ao enviar email: {str(e)}"
    
    finally:
        db.close()

@celery_app.task
def backup_diario_task():
    """
    Backup diário do banco de dados.
    Mantém apenas os últimos 7 backups diários.
    """
    from services.system_monitor import create_database_backup
    from models.autocare_models import BackupLog
    
    db = SessionLocal()
    try:
        # Criar backup diário
        print("🔄 Iniciando backup diário automático...")
        resultado = create_database_backup(
            tipo='diario',
            criado_por='sistema',
            db_session=db
        )
        
        if resultado.get('sucesso'):
            print(f"✅ Backup diário criado: {resultado.get('arquivo')}")
            print(f"   Hash: {resultado.get('hash')}")
            print(f"   Tamanho: {resultado.get('tamanho_mb')} MB")
            
            # Limpar backups antigos (manter apenas 7 dias)
            data_limite = datetime.now() - timedelta(days=7)
            backups_antigos = db.query(BackupLog).filter(
                BackupLog.tipo == 'diario',
                BackupLog.data_hora < data_limite,
                BackupLog.status == 'sucesso'
            ).all()
            
            removidos = 0
            for backup in backups_antigos:
                try:
                    # Remover arquivo físico
                    if backup.caminho_arquivo and Path(backup.caminho_arquivo).exists():
                        Path(backup.caminho_arquivo).unlink()
                        print(f"🗑️  Backup antigo removido: {backup.caminho_arquivo}")
                    
                    # Remover registro do banco
                    db.delete(backup)
                    removidos += 1
                except Exception as e:
                    print(f"⚠️  Erro ao remover backup {backup.id}: {str(e)}")
            
            if removidos > 0:
                db.commit()
                print(f"🧹 {removidos} backup(s) antigo(s) removido(s)")
            
            return f"Backup diário concluído. {removidos} backup(s) antigo(s) removido(s)."
        else:
            erro = resultado.get('erro', 'Erro desconhecido')
            print(f"❌ Erro no backup diário: {erro}")
            return f"Erro no backup diário: {erro}"
    
    except Exception as e:
        print(f"❌ Erro crítico no backup diário: {str(e)}")
        return f"Erro crítico: {str(e)}"
    
    finally:
        db.close()


@celery_app.task
def backup_mensal_task():
    """
    Backup mensal do banco de dados.
    Executado no dia 31 de cada mês às 22:00 (ou último dia do mês).
    Backups mensais não são removidos automaticamente.
    """
    from services.system_monitor import create_database_backup
    
    db = SessionLocal()
    try:
        hoje = datetime.now()
        
        # Verificar se é o último dia do mês
        # Se hoje é dia 28-30 e amanhã seria mês diferente, é o último dia
        amanha = hoje + timedelta(days=1)
        if amanha.month != hoje.month or hoje.day == 31:
            print("🔄 Iniciando backup mensal automático...")
            resultado = create_database_backup(
                tipo='mensal',
                criado_por='sistema',
                db_session=db
            )
            
            if resultado.get('sucesso'):
                print(f"✅ Backup mensal criado: {resultado.get('arquivo')}")
                print(f"   Hash: {resultado.get('hash')}")
                print(f"   Tamanho: {resultado.get('tamanho_mb')} MB")
                return f"Backup mensal concluído: {resultado.get('arquivo')}"
            else:
                erro = resultado.get('erro', 'Erro desconhecido')
                print(f"❌ Erro no backup mensal: {erro}")
                return f"Erro no backup mensal: {erro}"
        else:
            print("ℹ️  Não é o último dia do mês, backup mensal não executado.")
            return "Não é o último dia do mês"
    
    except Exception as e:
        print(f"❌ Erro crítico no backup mensal: {str(e)}")
        return f"Erro crítico: {str(e)}"
    
    finally:
        db.close()


@celery_app.task
def processar_backup_dados():
    """Fazer backup dos dados importantes - DESCONTINUADO, use backup_diario_task"""
    print("⚠️  Esta tarefa foi substituída por backup_diario_task")
    pass

@celery_app.task
def limpar_logs_antigos():
    """Limpar logs antigos do sistema"""
    # Implementar limpeza de logs
    pass

# Função para iniciar o worker Celery
def start_celery_worker():
    """Iniciar worker Celery"""
    celery_app.worker_main([
        'worker',
        '--loglevel=info',
        '--concurrency=4',
        '--beat'
    ])

if __name__ == "__main__":
    start_celery_worker()