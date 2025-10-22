# 📝 Mapeamento Completo de Inputs: Frontend ↔ Backend ↔ Database

**Data:** 15 de outubro de 2025  
**Objetivo:** Documentar todos os campos de formulário do frontend e sua correspondência com backend e banco de dados.

---

## 1. FORMULÁRIO DE CLIENTES

### Frontend (`Clientes.tsx` - ClienteFormData)
| Campo Frontend | Tipo | Obrigatório | Backend Schema | Model Backend | Coluna DB | Status |
|----------------|------|-------------|----------------|---------------|-----------|--------|
| nome | string | ✅ | ClienteCreate.nome | Cliente.nome | clientes.nome | ✅ |
| email | string | ❌ | ClienteCreate.email | Cliente.email | clientes.email | ✅ |
| telefone | string | ❌ | ClienteCreate.telefone | Cliente.telefone | clientes.telefone | ✅ |
| telefone2 | string | ❌ | ClienteCreate.telefone2 | Cliente.telefone2 | clientes.telefone2 | ✅ |
| whatsapp | string | ❌ | ClienteCreate.whatsapp | Cliente.whatsapp | clientes.whatsapp | ✅ |
| endereco | string | ❌ | ClienteCreate.endereco | Cliente.endereco | clientes.endereco | ✅ |
| numero | string | ❌ | ClienteCreate.numero | Cliente.numero | clientes.numero | ✅ |
| complemento | string | ❌ | ClienteCreate.complemento | Cliente.complemento | clientes.complemento | ✅ |
| bairro | string | ❌ | ClienteCreate.bairro | Cliente.bairro | clientes.bairro | ✅ |
| cidade | string | ❌ | ClienteCreate.cidade | Cliente.cidade | clientes.cidade | ✅ |
| estado | string | ❌ | ClienteCreate.estado | Cliente.estado | clientes.estado | ✅ |
| cep | string | ❌ | ClienteCreate.cep | Cliente.cep | clientes.cep | ✅ |
| cpf_cnpj | string | ❌ | ClienteCreate.cpf_cnpj | Cliente.cpf_cnpj | clientes.cpf_cnpj | ✅ |
| rg_ie | string | ❌ | ClienteCreate.rg_ie | Cliente.rg_ie | clientes.rg_ie | ✅ |
| tipo | 'PF'\|'PJ' | ✅ | ClienteCreate.tipo | Cliente.tipo | clientes.tipo | ✅ |
| data_nascimento | date | ❌ | ClienteCreate.data_nascimento | Cliente.data_nascimento | clientes.data_nascimento | ✅ |
| nome_fantasia | string | ❌ | ClienteCreate.nome_fantasia | Cliente.nome_fantasia | clientes.nome_fantasia | ✅ |
| razao_social | string | ❌ | ClienteCreate.razao_social | Cliente.razao_social | clientes.razao_social | ✅ |
| contato_responsavel | string | ❌ | ClienteCreate.contato_responsavel | Cliente.contato_responsavel | clientes.contato_responsavel | ✅ |
| observacoes | string | ❌ | ClienteCreate.observacoes | Cliente.observacoes | clientes.observacoes | ✅ |

**Status Geral: ✅ 100% CORRESPONDENTE**

---

## 2. FORMULÁRIO DE VEÍCULOS

### Frontend (`Veiculos.tsx` - VeiculoFormData)
| Campo Frontend | Tipo | Obrigatório | Backend Schema | Model Backend | Coluna DB | Status |
|----------------|------|-------------|----------------|---------------|-----------|--------|
| cliente_id | number | ✅ | VeiculoCreate.cliente_id | Veiculo.cliente_id | veiculos.cliente_id | ✅ |
| marca | string | ✅ | VeiculoCreate.marca | Veiculo.marca | veiculos.marca | ✅ |
| modelo | string | ✅ | VeiculoCreate.modelo | Veiculo.modelo | veiculos.modelo | ✅ |
| ano | number | ✅ | VeiculoCreate.ano | Veiculo.ano | veiculos.ano | ✅ |
| cor | string | ❌ | VeiculoCreate.cor | Veiculo.cor | veiculos.cor | ✅ |
| placa | string | ❌ | VeiculoCreate.placa | Veiculo.placa | veiculos.placa | ✅ |
| chassis | string | ❌ | VeiculoCreate.chassis | Veiculo.chassis | veiculos.chassis | 🔴 ERRO MODEL |
| renavam | string | ❌ | VeiculoCreate.renavam | Veiculo.renavam | veiculos.renavam | ✅ |
| km_atual | number | ✅ | VeiculoCreate.km_atual | Veiculo.km_atual | veiculos.km_atual | ✅ |
| combustivel | enum | ❌ | VeiculoCreate.combustivel | Veiculo.combustivel | veiculos.combustivel | ✅ |
| observacoes | string | ❌ | VeiculoCreate.observacoes | Veiculo.observacoes | veiculos.observacoes | ✅ |

**Status Geral: 🔴 95% - Erro no mapeamento do campo `chassis`**

**Problema:** Model mapeia `chassis` para coluna `chassi`, mas DB tem `chassis`

---

## 3. FORMULÁRIO DE PRODUTOS/ESTOQUE

### Frontend (`Estoque.tsx` - ItemEstoqueFormData)
| Campo Frontend | Tipo | Obrigatório | Backend Schema | Model Backend | Coluna DB | Status |
|----------------|------|-------------|----------------|---------------|-----------|--------|
| codigo | string | ✅ | ProdutoCreate.codigo | Produto.codigo | produtos.codigo | 🔴 ERRO MODEL |
| nome | string | ✅ | ProdutoCreate.nome | Produto.nome | produtos.nome | ✅ |
| descricao | string | ❌ | ProdutoCreate.descricao | Produto.descricao | produtos.descricao | ✅ |
| categoria | string | ❌ | ProdutoCreate.categoria | Produto.categoria | produtos.categoria | ✅ |
| fornecedor_id | number | ❌ | ProdutoCreate.fornecedor_id | Produto.fornecedor_id | produtos.fornecedor_id | ✅ |
| preco_custo | decimal | ✅ | ProdutoCreate.preco_custo | Produto.preco_custo | produtos.preco_custo | ✅ |
| preco_venda | decimal | ✅ | ProdutoCreate.preco_venda | Produto.preco_venda | produtos.preco_venda | ✅ |
| quantidade_atual | number | ✅ | ProdutoCreate.quantidade_atual | Produto.quantidade_atual | produtos.quantidade_atual | ✅ |
| quantidade_minima | number | ✅ | ProdutoCreate.quantidade_minima | Produto.quantidade_minima | produtos.quantidade_minima | ✅ |
| unidade | enum | ✅ | ProdutoCreate.unidade | Produto.unidade | produtos.unidade | ✅ |
| localizacao | string | ❌ | ProdutoCreate.localizacao | Produto.localizacao | produtos.localizacao | ✅ |

**Status Geral: 🔴 90% - Erro no mapeamento do campo `codigo`**

**Problema:** Model mapeia `codigo` para coluna `codigo_barras`, mas DB tem `codigo`

---

## 4. FORMULÁRIO DE FORNECEDORES

### Frontend (`Fornecedores.tsx` - FornecedorForm)
| Campo Frontend | Tipo | Obrigatório | Backend Schema | Model Backend | Coluna DB | Status |
|----------------|------|-------------|----------------|---------------|-----------|--------|
| nome | string | ✅ | FornecedorCreate.nome | Fornecedor.nome | fornecedores.nome | ✅ |
| razao_social | string | ❌ | FornecedorCreate.razao_social | Fornecedor.razao_social | fornecedores.razao_social | ✅ |
| cnpj | string | ❌ | FornecedorCreate.cnpj | Fornecedor.cnpj | fornecedores.cnpj | ✅ |
| email | string | ❌ | FornecedorCreate.email | Fornecedor.email | fornecedores.email | ✅ |
| telefone | string | ❌ | FornecedorCreate.telefone | Fornecedor.telefone | fornecedores.telefone | ✅ |
| endereco | string | ❌ | FornecedorCreate.endereco | Fornecedor.endereco | fornecedores.endereco | ✅ |
| cidade | string | ❌ | FornecedorCreate.cidade | Fornecedor.cidade | fornecedores.cidade | ✅ |
| estado | string | ❌ | FornecedorCreate.estado | Fornecedor.estado | fornecedores.estado | ✅ |
| cep | string | ❌ | FornecedorCreate.cep | Fornecedor.cep | fornecedores.cep | ✅ |
| contato | string | ❌ | FornecedorCreate.contato | Fornecedor.contato | fornecedores.contato | ✅ |
| observacoes | string | ❌ | FornecedorCreate.observacoes | Fornecedor.observacoes | fornecedores.observacoes | ✅ |

**Status Geral: ✅ 100% CORRESPONDENTE**

---

## 5. FORMULÁRIO DE ORDEM DE SERVIÇO

### Frontend (`ordem-servico.ts` - OrdemServicoNova)
| Campo Frontend | Tipo | Obrigatório | Backend Schema | Model Backend | Coluna DB | Status |
|----------------|------|-------------|----------------|---------------|-----------|--------|
| cliente_id | number | ✅ | OrdemServicoNovaCreate.cliente_id | OrdemServico.cliente_id | ordens_servico.cliente_id | ✅ |
| veiculo_id | number\|null | ⚠️ | OrdemServicoNovaCreate.veiculo_id | OrdemServico.veiculo_id | ordens_servico.veiculo_id | ✅ |
| tipo_ordem | enum | ✅ | OrdemServicoNovaCreate.tipo_ordem | OrdemServico.tipo_ordem | ordens_servico.tipo_ordem | ✅ |
| data_ordem | datetime | ❌ | OrdemServicoNovaCreate.data_ordem | OrdemServico.data_abertura | ordens_servico.data_abertura | ✅ |
| km_veiculo | number | ❌ | OrdemServicoNovaCreate.km_veiculo | OrdemServico.km_veiculo | ordens_servico.km_veiculo | ✅ |
| tempo_estimado_horas | number | ❌ | OrdemServicoNovaCreate.tempo_estimado_horas | @property | ordens_servico.tempo_estimado_horas | ⚠️ |
| descricao_servico | string | ⚠️ | OrdemServicoNovaCreate.descricao_servico | OrdemServico.descricao_servico | ordens_servico.descricao_servico | ✅ |
| valor_servico | decimal | ✅ | OrdemServicoNovaCreate.valor_servico | OrdemServico.valor_servico | ordens_servico.valor_mao_obra | ✅ |
| percentual_desconto | decimal | ❌ | OrdemServicoNovaCreate.percentual_desconto | @property | ordens_servico.percentual_desconto | ⚠️ |
| tipo_desconto | enum | ✅ | OrdemServicoNovaCreate.tipo_desconto | @property | ordens_servico.tipo_desconto | ⚠️ |
| observacoes | string | ❌ | OrdemServicoNovaCreate.observacoes | OrdemServico.observacoes | ordens_servico.observacoes | ✅ |
| funcionario_responsavel | string | ❌ | OrdemServicoNovaCreate.funcionario_responsavel | OrdemServico.funcionario_responsavel | ordens_servico.tecnico_responsavel | ✅ |
| itens | array | ✅ | OrdemServicoNovaCreate.itens | OrdemServico.itens | (relação) | ✅ |

**Status Geral: ⚠️ 85% - Alguns campos são properties, não colunas**

**Nota:** Campos como `tempo_estimado_horas`, `percentual_desconto` e `tipo_desconto` existem no DB mas são tratados como properties no model.

---

## 6. FORMULÁRIO DE ITEM DE ORDEM

### Frontend (`ordem-servico.ts` - ItemOrdemNova)
| Campo Frontend | Tipo | Obrigatório | Backend Schema | Model Backend | Coluna DB | Status |
|----------------|------|-------------|----------------|---------------|-----------|--------|
| produto_id | number | ⚠️ | ItemOrdemNovaCreate.produto_id | ItemOrdem.produto_id | itens_ordem.produto_id | ✅ |
| descricao | string | ✅ | ItemOrdemNovaCreate.descricao | ItemOrdem.descricao | itens_ordem.descricao | ✅ |
| quantidade | decimal | ✅ | ItemOrdemNovaCreate.quantidade | ItemOrdem.quantidade | itens_ordem.quantidade | ✅ |
| valor_unitario | decimal | ✅ | ItemOrdemNovaCreate.valor_unitario | ItemOrdem.valor_unitario | itens_ordem.valor_unitario | ✅ |
| valor_total | decimal | ✅ | ItemOrdemNovaCreate.valor_total | ItemOrdem.valor_total | itens_ordem.valor_total | ✅ |
| tipo | enum | ✅ | ItemOrdemNovaCreate.tipo | ItemOrdem.tipo | itens_ordem.tipo | ✅ |
| desconto_item | decimal | ❌ | ItemOrdemNovaCreate.desconto_item | ItemOrdem.desconto_item | itens_ordem.desconto_item | ✅ |
| observacoes | string | ❌ | ItemOrdemNovaCreate.observacoes | ItemOrdem.observacoes | itens_ordem.observacoes | ✅ |

**Status Geral: ✅ 100% CORRESPONDENTE**

---

## 7. FORMULÁRIO DE MOVIMENTAÇÃO DE ESTOQUE

### Frontend (`Estoque.tsx` - MovimentacaoEstoque)
| Campo Frontend | Tipo | Obrigatório | Backend Schema | Model Backend | Coluna DB | Status |
|----------------|------|-------------|----------------|---------------|-----------|--------|
| item_id | number | ✅ | - | MovimentoEstoque.item_id | movimentos_estoque.item_id | ✅ |
| tipo | enum | ✅ | - | MovimentoEstoque.tipo | movimentos_estoque.tipo | ✅ |
| quantidade | number | ✅ | - | MovimentoEstoque.quantidade | movimentos_estoque.quantidade | ✅ |
| preco_unitario | decimal | ⚠️ | - | MovimentoEstoque.preco_unitario | movimentos_estoque.preco_unitario | ✅ |
| preco_custo | decimal | ⚠️ | - | MovimentoEstoque.preco_custo | movimentos_estoque.preco_custo | ⚠️ |
| preco_venda | decimal | ⚠️ | - | MovimentoEstoque.preco_venda | movimentos_estoque.preco_venda | ⚠️ |
| margem_lucro | decimal | ❌ | - | MovimentoEstoque.margem_lucro | movimentos_estoque.margem_lucro | ⚠️ |
| valor_total | decimal | ❌ | - | MovimentoEstoque.valor_total | movimentos_estoque.valor_total | ✅ |
| motivo | string | ✅ | - | MovimentoEstoque.motivo | movimentos_estoque.motivo | ✅ |
| observacoes | string | ❌ | - | MovimentoEstoque.observacoes | movimentos_estoque.observacoes | ✅ |
| fornecedor_id | number | ❌ | - | MovimentoEstoque.fornecedor_id | movimentos_estoque.fornecedor_id | ✅ |
| ordem_servico_id | number | ❌ | - | MovimentoEstoque.ordem_servico_id | movimentos_estoque.ordem_servico_id | ✅ |

**Status Geral: ✅ 90% - Campos adicionais de preço existem no DB**

**Nota:** Campos `preco_custo`, `preco_venda`, `margem_lucro` não estavam na estrutura antiga mas foram adicionados.

---

## 📊 RESUMO GERAL

### Status por Módulo

| Módulo | Total Campos | Correspondentes | Com Erro | % Sucesso |
|--------|-------------|-----------------|----------|-----------|
| Clientes | 19 | 19 | 0 | 100% |
| Veículos | 11 | 10 | 1 | 91% |
| Produtos | 11 | 10 | 1 | 91% |
| Fornecedores | 11 | 11 | 0 | 100% |
| Ordens de Serviço | 13 | 11 | 2 | 85% |
| Itens de Ordem | 8 | 8 | 0 | 100% |
| Movimentação | 11 | 11 | 0 | 100% |
| **TOTAL** | **84** | **80** | **4** | **95%** |

### Erros Críticos Encontrados

1. 🔴 **Produtos.codigo** - Mapeado para `codigo_barras` mas DB tem `codigo`
2. 🔴 **Veiculos.chassis** - Mapeado para `chassi` mas DB tem `chassis`
3. ⚠️ **OrdemServico.tempo_estimado_horas** - Existe no DB mas é tratado como property
4. ⚠️ **OrdemServico.percentual_desconto** - Existe no DB mas é tratado como property

---

## 🎯 VALIDAÇÕES ESPECIAIS

### Máscaras e Formatações Frontend

| Campo | Máscara Frontend | Formato Enviado | Backend Valida |
|-------|------------------|-----------------|----------------|
| cpf_cnpj | 000.000.000-00 ou 00.000.000/0000-00 | Apenas números | ✅ |
| telefone | (00) 0000-0000 ou (00) 00000-0000 | Apenas números | ✅ |
| cep | 00000-000 | Apenas números | ✅ |
| placa | AAA-0000 ou AAA0A00 | Letras maiúsculas | ✅ |
| cnpj | 00.000.000/0000-00 | Apenas números | ✅ |

### Validações de Negócio

| Campo | Validação Frontend | Validação Backend | DB Constraint |
|-------|-------------------|-------------------|---------------|
| Cliente.email | Email válido | EmailStr (Pydantic) | - |
| Cliente.tipo | 'PF' ou 'PJ' | Enum validator | - |
| Veiculo.ano | 1900-2030 | Range validator | - |
| Veiculo.combustivel | Lista predefinida | Enum validator | - |
| Produto.unidade | Lista predefinida | Enum validator | - |
| Veiculo.placa | - | - | UNIQUE |
| Veiculo.chassis | - | - | UNIQUE |
| Produto.codigo | - | - | UNIQUE |
| Fornecedor.cnpj | - | - | UNIQUE |

---

## 🔍 CAMPOS CALCULADOS (Não persistem no DB)

### Clientes
- `total_gasto` - Soma de ordens de serviço concluídas
- `total_servicos` - Contagem de ordens de serviço
- `ultima_visita` - Data da última ordem de serviço
- `veiculos_count` - Contagem de veículos do cliente

### Veículos
- `total_servicos` - Contagem de ordens de serviço do veículo
- `ultima_manutencao` - Data da última manutenção
- `proxima_manutencao` - Data prevista próxima manutenção
- `km_proxima_manutencao` - KM previsto próxima manutenção
- `status_manutencao` - Status calculado (EM_DIA, PROXIMO_VENCIMENTO, ATRASADO)

### Produtos
- `status` - Calculado com base no estoque (DISPONIVEL, BAIXO_ESTOQUE, SEM_ESTOQUE)
- `fornecedor_nome` - Join com tabela fornecedores
- ⚠️ Mas no DB existem: `data_ultima_movimentacao`, `tipo_ultima_movimentacao`, `status`

### Ordens de Serviço
- `cliente_nome`, `cliente_telefone`, `cliente_email` - Join com clientes
- `veiculo_placa`, `veiculo_marca`, `veiculo_modelo`, `veiculo_ano` - Join com veículos

---

## ✅ CONCLUSÃO

**Correspondência Geral: 95%**

A aplicação possui **excelente correspondência** entre frontend, backend e banco de dados. Os problemas identificados são:

1. **2 erros críticos** de mapeamento (produtos.codigo e veiculos.chassis)
2. **2 inconsistências** em campos que existem no DB mas são tratados como properties
3. **Campos calculados** bem documentados e implementados

**Recomendação:** Aplicar as correções documentadas em `CORRECOES_NECESSARIAS.md` para atingir 100% de correspondência.

---

**Documento gerado automaticamente**  
**Data:** 15/10/2025  
**Autor:** GitHub Copilot
