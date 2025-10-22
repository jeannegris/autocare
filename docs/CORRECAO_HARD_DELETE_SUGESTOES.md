# Correção: Hard Delete para Sugestões de Manutenção

**Data:** 16/10/2025  
**Status:** ✅ Concluído

## 📋 Objetivo

Converter o sistema de exclusão de sugestões de manutenção de **soft delete** (desativação) para **hard delete** (exclusão permanente), implementando um modal de confirmação seguindo os padrões já adotados pela aplicação.

## 🔍 Problema Anterior

1. O sistema utilizava soft delete (campo `ativo`)
2. Itens "excluídos" permaneciam no banco de dados
3. Comportamento confuso para o usuário (alternância ativar/desativar)
4. Necessidade de endpoint adicional para reativar itens

## ✨ Solução Implementada

### Backend

**Arquivo:** `/var/www/autocare/backend/routes/autocare_sugestoes_manutencao.py`

1. **Endpoint DELETE modificado** (linhas 110-135):
   ```python
   # ANTES (soft delete)
   sugestao.ativo = False
   sugestao.updated_at = datetime.now()
   db.commit()
   
   # DEPOIS (hard delete)
   db.delete(sugestao)
   db.commit()
   ```

2. **Endpoint de reativação removido** (linhas 137-164):
   - Endpoint `POST /api/sugestoes-manutencao/{id}/reativar` completamente removido
   - Não é mais necessário pois a exclusão é permanente

### Frontend

**Arquivo:** `/var/www/autocare/frontend/src/pages/Configuracoes.tsx`

1. **Estado adicionado** (linha 43):
   ```typescript
   const [sugestaoParaDeletar, setSugestaoParaDeletar] = useState<SugestaoManutencao | null>(null);
   ```

2. **Import do ícone X** (linha 6):
   ```typescript
   import { Save, Plus, Edit2, Trash2, Eye, EyeOff, X } from 'lucide-react';
   ```

3. **Mutation simplificada** (linhas 186-198):
   ```typescript
   // Substituiu mutationToggleSugestao por mutationDeletarSugestao
   const mutationDeletarSugestao = useMutation({
     mutationFn: (id: number) => 
       axios.delete(`${API_URL}/api/sugestoes-manutencao/${id}`),
     onSuccess: () => {
       queryClient.invalidateQueries(['sugestoes-manutencao']);
     },
   });
   ```

4. **Handler removido**:
   - Função `handleToggleSugestao` completamente removida (não é mais necessária)

5. **Botão de exclusão atualizado** (linha ~571):
   ```typescript
   // ANTES
   onClick={() => handleToggleSugestao(sugestao)}
   className={sugestao.ativo ? 'text-red-600' : 'text-green-600'}
   
   // DEPOIS
   onClick={() => setSugestaoParaDeletar(sugestao)}
   className="text-red-600 hover:text-red-800"
   ```

6. **Modal de confirmação adicionado** (linhas 733-759):
   ```typescript
   {sugestaoParaDeletar && (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
       <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
         <button onClick={() => setSugestaoParaDeletar(null)}>
           <X className="h-5 w-5" />
         </button>
         <h2>Confirmar exclusão</h2>
         <p>
           Tem certeza que deseja excluir a sugestão de manutenção{' '}
           <strong>{sugestaoParaDeletar.nome_peca}</strong>?{' '}
           Esta ação não pode ser desfeita.
         </p>
         <button onClick={() => setSugestaoParaDeletar(null)}>
           Cancelar
         </button>
         <button onClick={() => {
           mutationDeletarSugestao.mutate(sugestaoParaDeletar.id);
           setSugestaoParaDeletar(null);
         }}>
           Excluir
         </button>
       </div>
     </div>
   )}
   ```

## 🎨 Padrões Seguidos

O modal de confirmação segue o mesmo padrão visual já utilizado em outras partes da aplicação (como em `Clientes.tsx`):

- ✅ Overlay escuro (`bg-black/40`)
- ✅ Botão X no canto superior direito
- ✅ Título "Confirmar exclusão"
- ✅ Mensagem explicativa com o nome do item em negrito
- ✅ Aviso "Esta ação não pode ser desfeita"
- ✅ Botão "Cancelar" cinza
- ✅ Botão "Excluir" vermelho

## 🔧 Compilação e Deploy

```bash
# Frontend
cd /var/www/autocare/frontend
yarn build

# Backend
sudo systemctl restart autocare-backend
```

**Resultado:** ✅ Compilação bem-sucedida, serviços reiniciados

## ✅ Resultados

1. **Hard delete implementado:** Registros são permanentemente removidos do banco de dados
2. **UX melhorada:** Modal de confirmação claro e consistente com o resto da aplicação
3. **Código simplificado:** Remoção do endpoint de reativação e lógica de soft delete
4. **Segurança:** Confirmação explícita antes de exclusão permanente

## 📝 Observações

- ⚠️ **Ação irreversível:** Uma vez excluída, a sugestão não pode ser recuperada
- ✅ **Banco de dados limpo:** Não há mais registros "fantasma" inativos
- ✅ **Consistência:** Padrão visual e de UX mantido em toda a aplicação

## 🔗 Arquivos Modificados

1. `/var/www/autocare/backend/routes/autocare_sugestoes_manutencao.py`
2. `/var/www/autocare/frontend/src/pages/Configuracoes.tsx`

## 📚 Referências

- Padrão de modal baseado em: `Clientes.tsx` (linhas 1440-1470)
- Mutação DELETE: TanStack Query (React Query)
- SQLAlchemy: `db.delete()` para exclusão física
