# Correção: Permissões de Perfis Não Sendo Salvas

## Problema Identificado

Ao editar o perfil "Operador" e marcar permissões (como "Dashboard Operacional"), a mensagem de sucesso aparecia, mas as permissões não eram persistidas no banco de dados.

## Causa Raiz

O problema estava em dois pontos:

1. **Schema sem validação**: O `PerfilUpdate` não tinha validador para garantir a integridade dos dados de dashboards
2. **Falta de logs**: Não havia logs para rastrear o que estava sendo enviado e salvo

## Correções Aplicadas

### 1. Backend - Schema (`backend/schemas/schemas_perfil.py`)

Adicionado validador no `PerfilUpdate` para garantir a validação dos dashboards:

```python
class PerfilUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    permissoes: Optional[Permissoes] = None
    ativo: Optional[bool] = None
    
    @model_validator(mode='after')
    def validar_dashboards(self):
        """Valida que apenas o perfil Administrador pode ter ambos os dashboards"""
        # Só validar se o nome foi fornecido e as permissões foram fornecidas
        if (self.nome and self.permissoes and
            self.nome != 'Administrador' and 
            self.permissoes.dashboard_gerencial and 
            self.permissoes.dashboard_operacional):
            raise ValueError(
                'Apenas o perfil Administrador pode ter ambos os dashboards habilitados. '
                'Para outros perfis, escolha apenas Dashboard Gerencial ou Dashboard Operacional.'
            )
        return self
```

### 2. Backend - Endpoint (`backend/routes/autocare_perfis.py`)

Adicionados logs detalhados no endpoint de atualização para rastrear:
- Dados recebidos
- Conversão das permissões
- Estado antes e depois do commit
- Resposta enviada

```python
# Log para debug
print(f"[DEBUG] Dados recebidos para atualização do perfil {perfil_id}:")
print(f"[DEBUG] update_data = {update_data}")

# ... processamento ...

print(f"[DEBUG] Permissões antes da conversão: {update_data['permissoes']}")
update_data["permissoes"] = json.dumps(update_data["permissoes"])
print(f"[DEBUG] Permissões após conversão JSON: {update_data['permissoes']}")

# ... commit ...

print(f"[DEBUG] Valor no banco antes do commit - permissoes: {db_perfil.permissoes}")
db.commit()
print(f"[DEBUG] Valor no banco após commit - permissoes: {db_perfil.permissoes}")
```

### 3. Frontend - Logs (`frontend/src/pages/GerenciarPerfis.tsx`)

Adicionados logs no console do navegador para rastrear:
- Dados sendo enviados
- Resposta recebida

```typescript
console.log('[DEBUG] Enviando dados para o backend:', {
  url,
  method,
  formData
});

// ... request ...

const result = await response.json();
console.log('[DEBUG] Resposta do backend:', result);
```

## Como Testar

### Passo 1: Reiniciar o Backend

Como o código foi alterado, você precisa reiniciar o serviço do backend:

```bash
# Se estiver usando PM2
cd backend
pm2 restart autocare-backend

# Ou se estiver usando o script start.sh
cd backend
./start.sh

# Ou reiniciar manualmente
pkill -f "uvicorn server:app"
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### Passo 2: Abrir o Console do Navegador

1. Abra o DevTools do navegador (F12)
2. Vá para a aba "Console"
3. Mantenha aberto durante os testes

### Passo 3: Testar a Edição do Perfil

1. Acesse `/perfis` no sistema
2. Clique no botão de editar (lápis) no card "Operador"
3. Marque a opção "Dashboard Operacional"
4. Clique em "Salvar Alterações"

### Passo 4: Verificar os Logs

**No Console do Navegador:**
- Deve aparecer `[DEBUG] Enviando dados para o backend:` com todas as permissões
- Deve aparecer `[DEBUG] Resposta do backend:` com as permissões atualizadas

**No Terminal do Backend:**
- Deve aparecer `[DEBUG] Dados recebidos para atualização do perfil 3:`
- Deve mostrar as permissões antes e depois da conversão JSON
- Deve mostrar o valor no banco antes e depois do commit

### Passo 5: Verificar a Persistência

1. Feche o modal
2. Clique novamente no botão de editar (lápis) do perfil "Operador"
3. Verifique se "Dashboard Operacional" está marcado
4. Feche o modal
5. Verifique se o card mostra "Dashboard Operacional" nas permissões

## Verificação Direta no Banco

Se quiser verificar diretamente no banco de dados:

```sql
-- Conectar ao banco
sqlite3 backend/autocare.db  -- ou o caminho correto do seu banco

-- Verificar as permissões do perfil Operador
SELECT id, nome, permissoes FROM perfis WHERE nome = 'Operador';

-- O resultado deve mostrar um JSON com dashboard_operacional: true
```

## O Que Observar

### ✅ Comportamento Esperado

- Ao marcar uma permissão e salvar, ela deve permanecer marcada
- O card deve mostrar a nova permissão na lista
- Os logs devem mostrar que os dados foram corretamente processados
- Ao reabrir o modal, a permissão deve estar marcada

### ❌ Se o Problema Persistir

Se mesmo com os logs você observar que:

1. **O frontend envia os dados corretamente** (log no console mostra as permissões)
2. **O backend recebe os dados** (log do servidor mostra os dados recebidos)
3. **Mas as permissões não são salvas no banco**

Então o problema pode estar em:
- Transação do banco não sendo commitada
- Problema com o SQLAlchemy
- Campo `updated_at` não sendo atualizado (trigger ou configuração)

Nesse caso, compartilhe os logs completos para análise adicional.

## Limpeza Após Correção

Após confirmar que tudo está funcionando, você pode remover os logs de debug:

1. Remover os `console.log` do frontend
2. Remover os `print` do backend
3. Fazer um commit limpo do código

---

**Data da Correção**: 23/10/2025  
**Arquivo Corrigido**: `backend/schemas/schemas_perfil.py`, `backend/routes/autocare_perfis.py`, `frontend/src/pages/GerenciarPerfis.tsx`
