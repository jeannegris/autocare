# AutoCenter - Sistema de Gestão Completo 🚗

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-ready-success.svg)

## 📋 Descrição

Sistema completo de gestão para AutoCenter desenvolvido com as mais modernas tecnologias web. Uma solução leve, responsiva e otimizada para desktop e mobile.

### ✨ Funcionalidades Principais

- 👥 **Gestão de Clientes**: Cadastro completo com histórico de serviços
- 🚙 **Controle de Veículos**: Gestão detalhada da frota dos clientes
- 📦 **Estoque Inteligente**: Controle automatizado de peças e produtos
- 📋 **Ordens de Serviço**: Sistema completo de OS e ordens de compra
- 🏪 **Fornecedores**: Cadastro e gestão de parceiros
- 💰 **Financeiro**: Controle de vendas e faturamento
- 📊 **Relatórios**: Dashboards e relatórios avançados
- 🔔 **Alertas Inteligentes**: Aniversários, KM e estoque baixo
- 🧾 **Nota Fiscal**: Emissão integrada

## 🏗️ Arquitetura

### Frontend
- ⚛️ **React 18** com TypeScript
- ⚡ **Vite** para build ultrarrápida
- 🎨 **Tailwind CSS** + componentes personalizados
- 📱 **Design Responsivo** (mobile-first)
- 📊 **Chart.js** para gráficos interativos

### Backend
- 🚀 **FastAPI** (Python) com alta performance
- 🗄️ **SQLAlchemy** + **Alembic** para ORM e migrações
- 🔴 **Redis** para cache e mensageria
- 🔐 **JWT** para autenticação segura
- 📄 **ReportLab/WeasyPrint** para PDFs

### Infraestrutura
- 🐘 **PostgreSQL** como banco principal
- 🐳 **Docker Compose** para desenvolvimento
- 📈 **Metabase** para dashboards gerenciais
- 🔄 **Celery** para tarefas assíncronas

## 📁 Estrutura do Projeto

```
autocare/
├── 🎨 frontend/                 # Aplicação React
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/             # Componentes UI padronizados
│   │   ├── hooks/              # Hooks personalizados
│   │   ├── pages/              # Páginas da aplicação
│   │   ├── services/           # Serviços de API
│   │   └── types/              # Tipagens TypeScript
│   ├── package.json
│   └── start.sh               # Script de inicialização
├── ⚡ backend/                  # API FastAPI
│   ├── models/                # Modelos SQLAlchemy
│   │   └── autocare_models.py
│   ├── schemas/               # Schemas Pydantic (schemas_*.py)
│   │   ├── schemas_cliente.py
│   │   ├── schemas_veiculo.py
│   │   ├── schemas_estoque.py
│   │   └── ...
│   ├── routes/                # Rotas da API (autocare_*.py)
│   │   ├── autocare_clientes.py
│   │   ├── autocare_veiculos.py
│   │   ├── autocare_estoque.py
│   │   └── ...
│   ├── services/              # Serviços e tarefas
│   │   └── celery_tasks.py    # Tarefas assíncronas
│   ├── alembic/               # Migrações do banco
│   ├── server.py              # Servidor principal
│   ├── db.py                  # Configuração do banco
│   ├── requirements.txt
│   └── start.sh               # Script de inicialização
├── 🐳 docker-compose.yml        # Serviços Docker
├── 🚀 start_services.sh         # Iniciar todos os serviços
└── 📚 README.md                # Esta documentação
```

## 🚀 Instalação e Execução

### Pré-requisitos
- Python 3.8+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (ou usar Docker)

### 1️⃣ Clonar e Configurar

```bash
# Já está clonado em /var/www/autocare
cd /var/www/autocare

# Dar permissões aos scripts
chmod +x start_services.sh
chmod +x backend/start.sh
chmod +x frontend/start.sh
```

### 2️⃣ Iniciar Serviços (PostgreSQL, Redis, Metabase)

```bash
./start_services.sh
```

### 3️⃣ Configurar Backend

```bash
cd backend

# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Copiar configurações
cp .env.example .env

# Iniciar servidor
./start.sh
```

### 4️⃣ Configurar Frontend

```bash
cd frontend

# Instalar dependências
yarn install

# Iniciar servidor de desenvolvimento
./start.sh
```

## 🌐 Acesso ao Sistema

- 🎨 **Frontend**: http://localhost:3001
- ⚡ **API**: http://localhost:8000
- 📚 **Documentação API**: http://localhost:8000/docs
- 📊 **Metabase**: http://localhost:3000

### 👤 Login Padrão
- **Usuário**: `admin`
- **Senha**: `admin123`

## 📊 Banco de Dados

### Configuração
- **Host**: localhost
- **Porta**: 5432
- **Banco**: autocare
- **Usuário**: autocare
- **Senha**: autocare

### 🗄️ Principais Tabelas

- `clientes` - Dados dos clientes
- `veiculos` - Veículos dos clientes  
- `produtos` - Estoque de peças
- `fornecedores` - Parceiros fornecedores
- `ordens_servico` - Ordens de serviço
- `itens_ordem` - Itens das ordens
- `movimentos_estoque` - Movimentação de estoque
- `alertas_km` - Alertas de manutenção

## 🔌 API Endpoints

### Principais Rotas

- `GET /api/dashboard/resumo` - Dashboard principal
- `GET /api/clientes` - Listar clientes
- `POST /api/clientes` - Criar cliente
- `GET /api/veiculos` - Listar veículos
- `GET /api/estoque/produtos` - Produtos em estoque
- `GET /api/ordens` - Ordens de serviço
- `GET /api/relatorios/vendas` - Relatório de vendas

### Documentação Completa
Acesse http://localhost:8000/docs para ver toda a API interativa.

## 📱 Componentes UI Disponíveis

O sistema inclui uma biblioteca completa de componentes:

- `accordion` - Acordeon expansível
- `alert-dialog` - Diálogos de confirmação
- `button` - Botões padronizados
- `card` - Cards informativos
- `form` - Formulários validados
- `input` - Campos de entrada
- `table` - Tabelas responsivas
- `toast` - Notificações
- E muitos outros...

## 🔄 Tarefas Automáticas (Celery + Redis)

### Alertas Configurados

- 🎂 **Aniversários**: Verificação diária
- ⚙️ **Manutenção por KM**: Verificação a cada hora
- 📦 **Estoque baixo**: Verificação a cada 6 horas

### Iniciar Worker

```bash
cd backend
./start_celery.sh
```

## 📈 Relatórios Disponíveis

### Formatos Suportados
- 📊 JSON (para dashboards)
- 📋 Excel (.xlsx)
- 📄 PDF

### Tipos de Relatórios
- **Vendas por período**
- **Movimentação de estoque**
- **Produtos mais vendidos**
- **Clientes mais ativos**
- **Análise financeira**

## 🛠️ Scripts de Gerenciamento

```bash
# Iniciar todos os serviços
./start_services.sh

# Iniciar apenas o backend
cd backend && ./start.sh

# Iniciar apenas o frontend  
cd frontend && ./start.sh

# Iniciar worker Celery
cd backend && ./start_celery.sh

# Parar serviços Docker
docker-compose down
```

## 🔧 Configurações Avançadas

### Variáveis de Ambiente (.env)
```bash
DATABASE_URL=postgresql://autocare:autocare@localhost:5432/autocare
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key-change-in-production
DEBUG=True
SMTP_SERVER=smtp.gmail.com  # Para emails
```

### Migrações do Banco
```bash
cd backend
alembic revision --autogenerate -m "Descrição da mudança"
alembic upgrade head
```

## 🎯 Funcionalidades Detalhadas

### 👥 Gestão de Clientes
- Cadastro com CPF/CNPJ
- Endereço completo
- Múltiplos contatos
- Histórico de serviços
- Alertas de aniversário

### 🚙 Controle de Veículos
- Dados completos do veículo
- Controle de quilometragem
- Alertas de manutenção por KM
- Histórico de serviços

### 📦 Estoque Inteligente
- Controle de entrada/saída
- Estoque mínimo configurável
- Localização no estoque
- Múltiplos fornecedores
- Relatórios de movimentação

### 📋 Ordens de Serviço
- Criação rápida e intuitiva
- Produtos e serviços na mesma OS
- Controle de status
- Baixa automática do estoque
- Impressão e emissão

## 🚀 Deploy em Produção

### Configurações Necessárias
1. Alterar `DEBUG=False` no `.env`
2. Configurar `SECRET_KEY` segura
3. Configurar HTTPS
4. Configurar backup automático
5. Configurar SMTP para emails

### Docker para Produção
```bash
# Build das imagens
docker-compose -f docker-compose.prod.yml build

# Iniciar em produção
docker-compose -f docker-compose.prod.yml up -d
```

## 🤝 Suporte e Contribuição

### Suporte Técnico
- 📧 Email: suporte@autocare.com
- 📱 Telefone: (11) 9999-9999
- 💬 Chat: Disponível no sistema

### Próximas Funcionalidades
- [ ] App mobile nativo
- [ ] Integração com WhatsApp
- [ ] Sistema de agendamento
- [ ] Integração com NFe
- [ ] Relatórios avançados BI

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 🎉 Sistema Pronto para Uso!

O **AutoCenter** está completamente configurado e pronto para uso. Todas as funcionalidades principais foram implementadas seguindo as melhores práticas de desenvolvimento.

### 🚀 Para começar agora:

1. Execute `./start_services.sh` (serviços)
2. Execute `cd backend && ./start.sh` (API)
3. Execute `cd frontend && ./start.sh` (Interface)
4. Acesse http://localhost:3001
5. Faça login com `admin` / `admin123`

**Desenvolvido com ❤️ para AutoCenters modernos e eficientes!**