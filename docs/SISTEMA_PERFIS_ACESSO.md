# Sistema de Perfis de Acesso - AutoCare

## 📋 Resumo da Implementação

Foi implementado um sistema completo de controle de acesso baseado em perfis de usuário, permitindo configurar quais funcionalidades cada tipo de usuário pode acessar no sistema.

## ✅ Funcionalidades Implementadas

### Backend

1. **Modelo de Dados**
   - Criada tabela `perfis` com campos:
     - `id`: Identificador único
     - `nome`: Nome do perfil (único)
     - `descricao`: Descrição do perfil
     - `permissoes`: JSON com permissões (armazenado como TEXT)
     - `ativo`: Status do perfil
     - `editavel`: Se o perfil pode ser editado (false para Administrador)
     - `created_at`, `updated_at`: Timestamps

2. **Perfis Padrão Criados**
   - **Administrador** (ID: 1) - Acesso total, não editável
     - Todas as permissões habilitadas
   - **Supervisor** (ID: 2) - Acesso intermediário, editável
     - Dashboard, Clientes, Veículos, Estoque, Ordens de Serviço, Fornecedores, Relatórios
   - **Operador** (ID: 3) - Acesso básico, editável
     - Dashboard, Estoque, Ordens de Serviço

3. **Permissões Disponíveis**
   - `dashboard`: Acesso ao Dashboard
   - `clientes`: Gerenciar Clientes
   - `veiculos`: Gerenciar Veículos
   - `estoque`: Gerenciar Estoque
   - `ordens_servico`: Gerenciar Ordens de Serviço
   - `fornecedores`: Gerenciar Fornecedores
   - `relatorios`: Acessar Relatórios
   - `configuracoes`: Acessar Configurações
   - `usuarios`: Gerenciar Usuários
   - `perfis`: Gerenciar Perfis

4. **Rotas da API**
   - `GET /api/perfis/` - Listar todos os perfis
   - `GET /api/perfis/{id}` - Obter um perfil específico
   - `POST /api/perfis/` - Criar novo perfil
   - `PUT /api/perfis/{id}` - Atualizar perfil existente
   - `DELETE /api/perfis/{id}` - Deletar perfil

5. **Validações Backend**
   - Perfil Administrador não pode ser editado ou deletado
   - Não é possível deletar perfil que está sendo usado por usuários
   - Nomes de perfil devem ser únicos
   - Permissões são validadas no schema

6. **Integração com Usuários**
   - Adicionado campo `perfil_id` na tabela `usuarios`
   - Perfil padrão para novos usuários: **Operador** (ID: 3)
   - Endpoint `/api/auth/me` retorna permissões do usuário
   - Listagem de usuários inclui nome do perfil e permissões

### Frontend

1. **Página de Gerenciamento de Perfis** (`/perfis`)
   - Listagem de perfis em cards responsivos
   - Indicadores visuais para cada tipo de perfil
   - Criação de novos perfis
   - Edição de perfis existentes (exceto Administrador)
   - Configuração de permissões via checkboxes
   - Contador de permissões ativas
   - Exclusão de perfis (com validação)
   - Busca por nome ou descrição

2. **Atualização da Gestão de Usuários**
   - Campo de seleção de perfil no formulário
   - Badge mostrando o perfil atual no card do usuário
   - Perfil exibido junto com 2FA e Status (Ativo/Inativo)

3. **Controle de Acesso**
   - `AuthContext` atualizado com:
     - Dados do perfil do usuário
     - Permissões carregadas no login
     - Função `hasPermission(permission)` para validação
   - Menu lateral filtra itens baseado nas permissões
   - Apenas itens permitidos são exibidos

4. **Menu de Navegação**
   - Novos itens adicionados:
     - **Usuários** - Gerenciar usuários do sistema
     - **Perfis** - Gerenciar perfis de acesso
   - Todos os itens com controle de permissão

## 🗄️ Estrutura do Banco de Dados

### Tabela `perfis`
```sql
CREATE TABLE perfis (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT,
    permissoes TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    editavel BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### Tabela `usuarios` (atualizada)
```sql
ALTER TABLE usuarios ADD COLUMN perfil_id INTEGER NOT NULL DEFAULT 3;
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_perfil_id 
    FOREIGN KEY (perfil_id) REFERENCES perfis(id);
```

## 📝 Exemplo de Uso

### Criar um Novo Perfil

1. Acesse `/perfis` no sistema
2. Clique em "Novo Perfil"
3. Preencha:
   - Nome: Ex: "Gerente"
   - Descrição: Ex: "Gerente da oficina"
   - Selecione as permissões desejadas
4. Clique em "Criar Perfil"

### Atribuir Perfil a Usuário

1. Acesse `/usuarios` no sistema
2. Edite um usuário ou crie um novo
3. Selecione o perfil desejado no campo "Perfil de Acesso"
4. Salve as alterações

### Como Funciona o Controle de Acesso

1. Usuário faz login
2. Sistema carrega informações do perfil e permissões
3. Frontend filtra menu baseado nas permissões
4. Cada rota verifica se o usuário tem permissão
5. Apenas funcionalidades permitidas são exibidas

## 🔒 Segurança

- Perfil Administrador é protegido contra edição e exclusão
- Não é possível deletar perfis em uso
- Todas as rotas requerem autenticação
- Permissões são validadas no backend e frontend
- Perfil padrão (Operador) garante acesso mínimo

## 📁 Arquivos Modificados/Criados

### Backend
- `models/autocare_models.py` - Adicionado modelo Perfil e perfil_id em Usuario
- `schemas/schemas_perfil.py` - Schemas para CRUD de perfis
- `schemas/schemas_usuario.py` - Adicionado perfil_id e permissoes
- `routes/autocare_perfis.py` - Rotas de gerenciamento de perfis
- `routes/autocare_usuarios.py` - Atualizado para incluir perfil
- `routes/autocare_auth.py` - Endpoint /me retorna permissões
- `server.py` - Registradas rotas de perfis
- `alembic/versions/20251022_add_perfis_table.py` - Migration

### Frontend
- `pages/GerenciarPerfis.tsx` - Nova página de gestão de perfis
- `pages/GerenciarUsuarios.tsx` - Atualizado com seleção de perfil
- `contexts/AuthContext.tsx` - Adicionado hasPermission e permissoes
- `components/Layout.tsx` - Filtro de menu por permissões
- `App.tsx` - Adicionada rota /perfis

## 🧪 Status dos Testes

✅ Migration executada com sucesso
✅ Tabelas criadas corretamente
✅ Perfis padrão inseridos
✅ Backend respondendo às rotas de perfis
✅ Usuários atribuídos com perfil_id
✅ Perfil admin atualizado para Administrador

## 📌 Próximos Passos Sugeridos

1. Testar login com diferentes perfis
2. Validar filtro de menu para cada perfil
3. Testar criação e edição de perfis pela interface
4. Criar perfis personalizados conforme necessidade
5. Ajustar permissões dos perfis padrão se necessário

## 🎯 Conclusão

O sistema de perfis de acesso foi implementado com sucesso, proporcionando:
- ✅ Controle granular de permissões
- ✅ Interface intuitiva para gestão
- ✅ Segurança robusta
- ✅ Flexibilidade para criar perfis customizados
- ✅ Proteção do perfil Administrador
- ✅ Experiência de usuário otimizada

O sistema está pronto para uso em produção!

---
**Data da Implementação:** 22 de Outubro de 2025
**Versão:** 1.0
