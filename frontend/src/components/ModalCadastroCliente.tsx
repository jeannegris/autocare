import React, { useState, useEffect, useRef } from 'react';
import { X, User, Save, Loader2, AlertCircle } from 'lucide-react';
import { ClienteCadastroForm } from '../types/ordem-servico';
import { apiFetch } from '../lib/api';
import { handleDocumentInput, handlePhoneInput, cleanDocumentForSubmit, cleanPhoneForSubmit } from '../utils/documentMask';
import { buscarCEP, aplicarMascara, limparFormatacao, useValidacao } from '../utils/validations';

interface ModalCadastroClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (cliente: any) => void;
  termoBusca?: string; // Para pré-preencher com o termo que foi buscado
  veiculoParaTransferir?: any; // Veículo que será transferido para o novo cliente
}

export default function ModalCadastroCliente({
  isOpen,
  onClose,
  onSuccess,
  termoBusca = '',
  veiculoParaTransferir
}: ModalCadastroClienteProps) {
  const [formData, setFormData] = useState<ClienteCadastroForm>({
    nome: '',
    cpf_cnpj: '',
    email: '',
    telefone: '',
    telefone2: '',
    whatsapp: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    tipo: 'PF',
    data_nascimento: '',
    nome_fantasia: '',
    razao_social: '',
    contato_responsavel: '',
    rg_ie: '',
    observacoes: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [verificandoDocumento, setVerificandoDocumento] = useState(false);

  // Hook de validação inline
  const { erros, validarCampo, limparErro, limparTodosErros, definirErroCustomizado } = useValidacao();

  // Refs para focar nos campos com erro
  const nomeRef = useRef<HTMLInputElement>(null);
  const cpfCnpjRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telefoneRef = useRef<HTMLInputElement>(null);
  const docCheckTimeoutRef = useRef<number | null>(null);
  const telefoneCheckTimeoutRef = useRef<number | null>(null);

  // Função para determinar se é CPF, CNPJ ou telefone
  const determinarTipoEPreencher = (termo: string) => {
    // Se termo estiver vazio, retornar valores vazios
    if (!termo || termo.trim() === '') {
      return { tipo: 'PF', cpf_cnpj: '', telefone: '' };
    }
    
    const apenasNumeros = termo.replace(/\D/g, '');
    
    // Se o termo original contém parênteses, espaço ou hífen de telefone, é provável que seja telefone
    const temFormatoTelefone = termo.includes('(') || termo.includes(')') || 
                               (termo.includes('-') && termo.includes(' ')) ||
                               termo.match(/\(\d{2}\)/);  // formato (xx) xxxxx-xxxx
    
    // Verificar se é CNPJ primeiro (14 dígitos - prioridade alta)
    if (apenasNumeros.length === 14) {
      return {
        tipo: 'PJ',
        cpf_cnpj: termo,
        telefone: ''
      };
    }
    
    // Verificar se é telefone (10 ou 11 dígitos COM formatação específica de telefone)
    if ((apenasNumeros.length === 10 || apenasNumeros.length === 11) && temFormatoTelefone) {
      return {
        tipo: 'PF', // Por padrão, telefone sugere pessoa física
        cpf_cnpj: '',
        telefone: termo
      };
    }
    
    // Verificar se é telefone com 10 dígitos (sem formatação - mais provável ser telefone)
    if (apenasNumeros.length === 10 && !temFormatoTelefone) {
      return {
        tipo: 'PF',
        cpf_cnpj: '',
        telefone: termo
      };
    }
    
    // Verificar se é CPF (11 dígitos sem formatação de telefone)
    if (apenasNumeros.length === 11 && !temFormatoTelefone) {
      return {
        tipo: 'PF',
        cpf_cnpj: termo,
        telefone: ''
      };
    }
    
    // Para outros tamanhos, assumir que é documento
    return {
      tipo: 'PF',
      cpf_cnpj: termo,
      telefone: ''
    };
  };

  const verificarTelefoneExistente = async (telefone: string) => {
    if (!telefone) return;
    const limpo = cleanPhoneForSubmit(telefone);
    // aceitar telefones com 10 ou 11 dígitos
    if (!limpo || (limpo.length !== 10 && limpo.length !== 11)) return;
    try {
      setVerificandoDocumento(true);
      const resp = await apiFetch(`/clientes/buscar-telefone/${limpo}`);
      if (resp.encontrado && resp.cliente) {
        definirErroCustomizado('telefone', `Telefone já cadastrado para: ${resp.cliente.nome} (ID: ${resp.cliente.id})`);
      } else {
        validarCampo('telefone', telefone, 'telefone');
      }
    } catch (err) {
      validarCampo('telefone', telefone, 'telefone');
    } finally {
      setVerificandoDocumento(false);
    }
  };

  // Preenchimento inicial baseado em termoBusca
  useEffect(() => {
    if (!isOpen) return;
    const termo = (termoBusca || '').trim();
    if (!termo) {
      setFormData(prev => ({ ...prev, nome: '', cpf_cnpj: '', telefone: '', tipo: 'PF' }));
      limparTodosErros();
      setErro('');
      return;
    }
    const det = determinarTipoEPreencher(termo);
    setFormData({
      nome: '',
      cpf_cnpj: det.cpf_cnpj,
      email: '',
      telefone: det.telefone,
      telefone2: '',
      whatsapp: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      tipo: det.tipo as 'PF' | 'PJ',
      data_nascimento: '',
      nome_fantasia: '',
      razao_social: '',
      contato_responsavel: '',
      rg_ie: '',
      observacoes: ''
    });
    limparTodosErros();
    setErro('');
  }, [isOpen, termoBusca]);

  // Aplicar máscaras após montagem
  useEffect(() => {
    if (!isOpen) return;
    const termo = (termoBusca || '').trim();
    if (!termo) return;
    const det = determinarTipoEPreencher(termo);
    setTimeout(() => {
      if (det.telefone) {
        handlePhoneInput(det.telefone, (m) => {
          setFormData(prev => ({ ...prev, telefone: m }));
          // disparar verificação por telefone após aplicar máscara
          if (telefoneCheckTimeoutRef.current) clearTimeout(telefoneCheckTimeoutRef.current);
          if (m && m.trim()) {
            telefoneCheckTimeoutRef.current = window.setTimeout(() => {
              verificarTelefoneExistente(m);
            }, 700);
          }
        });
      }
      if (det.cpf_cnpj) handleDocumentInput(det.cpf_cnpj, (m) => setFormData(prev => ({ ...prev, cpf_cnpj: m })));
    }, 50);
  }, [isOpen, termoBusca]);

  const verificarDocumentoExistente = async (documento: string) => {
    if (!documento) return;
    const limpo = cleanDocumentForSubmit(documento);
    if (!limpo || limpo.length < 11) return;
    try {
      setVerificandoDocumento(true);
      const resp = await apiFetch(`/clientes/buscar-cpf-cnpj/${limpo}`);
      if (resp.encontrado && resp.cliente) {
        definirErroCustomizado('cpf_cnpj', `${formData.tipo === 'PF' ? 'CPF' : 'CNPJ'} já cadastrado para: ${resp.cliente.nome} (ID: ${resp.cliente.id})`);
      } else {
        const tipo = formData.tipo === 'PF' ? 'CPF' : 'CNPJ';
        validarCampo('cpf_cnpj', documento, tipo);
      }
    } catch {
      const tipo = formData.tipo === 'PF' ? 'CPF' : 'CNPJ';
      validarCampo('cpf_cnpj', documento, tipo);
    } finally {
      setVerificandoDocumento(false);
    }
  };

  const handleInputChange = (field: keyof ClienteCadastroForm, value: string) => {
    limparErro(field);

    if (field === 'cpf_cnpj') {
      // Aplicar máscara de documento
      handleDocumentInput(value, (masked) => {
        setFormData(prev => ({ ...prev, cpf_cnpj: masked }));
        if (docCheckTimeoutRef.current) clearTimeout(docCheckTimeoutRef.current);
        if (masked.trim()) {
          docCheckTimeoutRef.current = window.setTimeout(() => {
            verificarDocumentoExistente(masked);
          }, 700);
        }
      });
      return;
    }

    if (field === 'telefone' || field === 'telefone2' || field === 'whatsapp') {
      handlePhoneInput(value, (masked) => {
        setFormData(prev => ({ ...prev, [field]: masked }));
        if (field === 'telefone') {
          // validação imediata de formato
          if (masked.trim()) {
            validarCampo('telefone', masked, 'telefone');
          }

          // debounce para verificação de existência no servidor
          if (telefoneCheckTimeoutRef.current) clearTimeout(telefoneCheckTimeoutRef.current);
          if (masked && masked.trim()) {
            telefoneCheckTimeoutRef.current = window.setTimeout(() => {
              verificarTelefoneExistente(masked);
            }, 700);
          }
        }
      });
      return;
    }

    // Demais campos simples
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNomeChange = (value: string) => {
    handleInputChange('nome', value);
  };

  const handleEmailChange = (value: string) => {
    handleInputChange('email', value);
    if (value.trim()) validarCampo('email', value, 'email');
  };

  // Função para lidar com mudanças no CEP
  const handleCepChange = async (value: string) => {
    const valorFormatado = aplicarMascara('cep', value);
    setFormData(prev => ({ ...prev, cep: valorFormatado }));

    const cepLimpo = limparFormatacao(value);
    if (cepLimpo.length === 8) {
      setLoadingCEP(true);
      try {
        const resultado = await buscarCEP(value);
        if (resultado.sucesso && resultado.endereco) {
          setFormData(prev => ({
            ...prev,
            cep: resultado.endereco!.cep,
            endereco: resultado.endereco!.logradouro,
            bairro: resultado.endereco!.bairro,
            cidade: resultado.endereco!.cidade,
            estado: resultado.endereco!.estado
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      } finally {
        setLoadingCEP(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErro('');
    limparTodosErros();

    try {
      let formValido = true;
      let primeiroCampoComErro = '';

      // Validar nome (obrigatório)
      if (!formData.nome.trim()) {
        validarCampo('nome', formData.nome, 'obrigatorio');
        if (!primeiroCampoComErro) primeiroCampoComErro = 'nome';
        formValido = false;
      }

      // Validar CPF/CNPJ se preenchido
      if (formData.cpf_cnpj?.trim()) {
        const tipoDoc = formData.tipo === 'PF' ? 'CPF' : 'CNPJ';
        if (!validarCampo('cpf_cnpj', formData.cpf_cnpj, tipoDoc)) {
          if (!primeiroCampoComErro) primeiroCampoComErro = 'cpf_cnpj';
          formValido = false;
        }
      }

      // Validar email se preenchido
      if (formData.email?.trim()) {
        if (!validarCampo('email', formData.email, 'email')) {
          if (!primeiroCampoComErro) primeiroCampoComErro = 'email';
          formValido = false;
        }
      }

      // Validar telefone (obrigatório) - SEMPRE obrigatório
      if (!formData.telefone?.trim()) {
        console.log('❌ Telefone está vazio - marcando como erro');
        validarCampo('telefone', '', 'obrigatorio');
        if (!primeiroCampoComErro) primeiroCampoComErro = 'telefone';
        formValido = false;
      } else {
        console.log('✅ Telefone preenchido, validando formato:', formData.telefone);
        if (!validarCampo('telefone', formData.telefone, 'telefone')) {
          if (!primeiroCampoComErro) primeiroCampoComErro = 'telefone';
          formValido = false;
        }
      }

      // Se o formulário não é válido, focar no primeiro campo com erro
      if (!formValido) {
        console.log('🚫 Formulário inválido - primeiro campo com erro:', primeiroCampoComErro);
        console.log('📋 Estado dos erros:', erros);
        
        // Focar no primeiro campo com erro
        setTimeout(() => {
          if (primeiroCampoComErro === 'nome' && nomeRef.current) {
            console.log('🎯 Focando no campo nome');
            nomeRef.current.focus();
          } else if (primeiroCampoComErro === 'cpf_cnpj' && cpfCnpjRef.current) {
            console.log('🎯 Focando no campo cpf_cnpj');
            cpfCnpjRef.current.focus();
          } else if (primeiroCampoComErro === 'email' && emailRef.current) {
            console.log('🎯 Focando no campo email');
            emailRef.current.focus();
          } else if (primeiroCampoComErro === 'telefone' && telefoneRef.current) {
            console.log('🎯 Focando no campo telefone');
            telefoneRef.current.focus();
          }
        }, 100);
        
        setErro('Erro de validação dos dados. Verifique os campos obrigatórios.');
        setIsLoading(false);
        return;
      }
      
      console.log('✅ Formulário válido - prosseguindo com o envio');

      // Preparar dados para envio de forma mais robusta
      const dadosParaEnvio: { [key: string]: any } = {};

      // Adicionar campos obrigatórios
      dadosParaEnvio.nome = formData.nome.trim();
      dadosParaEnvio.tipo = formData.tipo;
      dadosParaEnvio.telefone = cleanPhoneForSubmit(formData.telefone!);
      dadosParaEnvio.ativo = true;

      // Adicionar CPF/CNPJ se preenchido
      if (formData.cpf_cnpj?.trim()) {
        dadosParaEnvio.cpf_cnpj = cleanDocumentForSubmit(formData.cpf_cnpj!);
      }

      // Adicionar campos opcionais apenas se tiverem valor
      if (formData.rg_ie?.trim()) dadosParaEnvio.rg_ie = formData.rg_ie.trim();
      if (formData.razao_social?.trim()) dadosParaEnvio.razao_social = formData.razao_social.trim();
      if (formData.nome_fantasia?.trim()) dadosParaEnvio.nome_fantasia = formData.nome_fantasia.trim();
      
      // Adicionar data_nascimento apenas se for PF e tiver valor
      if (formData.tipo === 'PF' && formData.data_nascimento?.trim()) {
        dadosParaEnvio.data_nascimento = formData.data_nascimento.trim();
      }

      if (formData.email?.trim()) dadosParaEnvio.email = formData.email.trim();
      if (formData.telefone2?.trim()) dadosParaEnvio.telefone2 = cleanPhoneForSubmit(formData.telefone2);
      if (formData.whatsapp?.trim()) dadosParaEnvio.whatsapp = cleanPhoneForSubmit(formData.whatsapp);
      if (formData.cep?.trim()) dadosParaEnvio.cep = formData.cep.trim();
      if (formData.endereco?.trim()) dadosParaEnvio.endereco = formData.endereco.trim();
      if (formData.numero?.trim()) dadosParaEnvio.numero = formData.numero.trim();
      if (formData.complemento?.trim()) dadosParaEnvio.complemento = formData.complemento.trim();
      if (formData.bairro?.trim()) dadosParaEnvio.bairro = formData.bairro.trim();
      if (formData.cidade?.trim()) dadosParaEnvio.cidade = formData.cidade.trim();
      if (formData.estado?.trim()) dadosParaEnvio.estado = formData.estado.trim();
      if (formData.observacoes?.trim()) dadosParaEnvio.observacoes = formData.observacoes.trim();
      if (formData.contato_responsavel?.trim()) dadosParaEnvio.contato_responsavel = formData.contato_responsavel.trim();

      // Log detalhado para debug
      console.log('📤 Dados finais sendo enviados:', dadosParaEnvio);

      // Criar cliente
      const novoCliente = await apiFetch('/clientes', {
        method: 'POST',
        body: JSON.stringify(dadosParaEnvio),
      });

      // Se há veículo para transferir, fazer a transferência
      if (veiculoParaTransferir) {
        console.log('🚗 Dados do veículo para transferir:', veiculoParaTransferir);
        
        // Verificar se é um veículo existente (com ID válido) ou um novo veículo
        const isNovoVeiculo = (veiculoParaTransferir as any).novoVeiculo || !veiculoParaTransferir.id || veiculoParaTransferir.id === 0;
        
        if (!isNovoVeiculo && veiculoParaTransferir.id) {
          console.log('🔄 Transferindo veículo existente ID:', veiculoParaTransferir.id);
          try {
            await apiFetch(`/veiculos/${veiculoParaTransferir.id}/transferir-proprietario`, {
              method: 'PATCH',
              body: JSON.stringify({ novo_cliente_id: novoCliente.id }),
            });
            console.log('✅ Transferência de veículo realizada com sucesso');
          } catch (transferError) {
            console.error('❌ Erro na transferência do veículo:', transferError);
            // Não interromper o fluxo - o cliente já foi criado
          }
        } else {
          console.log('📝 Veículo marcado como novo, não fazendo transferência');
        }
      }

      // Buscar cliente completo com veículos
      const clienteCompleto = await apiFetch(`/clientes/${novoCliente.id}`);

      // Determinar os veículos a incluir
      let veiculosParaIncluir = clienteCompleto.veiculos || [];
      
      if (veiculoParaTransferir) {
        const isNovoVeiculo = (veiculoParaTransferir as any).novoVeiculo || !veiculoParaTransferir.id || veiculoParaTransferir.id === 0;
        
        if (isNovoVeiculo) {
          // Para novo veículo, incluir na lista para posterior cadastro
          veiculosParaIncluir = [...veiculosParaIncluir, veiculoParaTransferir];
        }
        // Para veículo transferido, ele já deve aparecer na lista do cliente completo
      }

      onSuccess({
        ...clienteCompleto,
        veiculos: veiculosParaIncluir
      });
      
      onClose();
    } catch (error: any) {
      console.error('🚨 Erro completo:', error);
      console.error('📝 Error stringified:', JSON.stringify(error, null, 2));
      console.error('📦 Error body:', error.body);
      console.error('🔍 Error json:', error.json);
      console.error('📋 Error detail:', error.detail);
      
      // Se for erro 422, tentar extrair detalhes da validação
      if (error.status === 422 || error.message?.includes('422')) {
        console.log('🎯 Erro 422 detectado, analisando detalhes...');
        
        // Tentar acessar diferentes estruturas de erro do Pydantic
        let erroDetalhes = '';
        
        // Primeiro, tentar do campo detail direto
        if (error.detail) {
          if (Array.isArray(error.detail)) {
            console.log('📊 Encontrado array em error.detail');
            erroDetalhes = error.detail.map((d: any) => {
              const campo = d.loc ? d.loc.join('.') : 'campo desconhecido';
              const mensagem = d.msg || 'erro de validação';
              return `${campo}: ${mensagem}`;
            }).join(', ');
          } else if (typeof error.detail === 'string') {
            console.log('📝 Encontrado string em error.detail');
            erroDetalhes = error.detail;
          }
        }
        // Tentar do JSON parseado
        else if (error.json?.detail) {
          if (Array.isArray(error.json.detail)) {
            console.log('📊 Encontrado array em error.json.detail');
            erroDetalhes = error.json.detail.map((d: any) => {
              const campo = d.loc ? d.loc.join('.') : 'campo desconhecido';
              const mensagem = d.msg || 'erro de validação';
              return `${campo}: ${mensagem}`;
            }).join(', ');
          } else if (typeof error.json.detail === 'string') {
            console.log('📝 Encontrado string em error.json.detail');
            erroDetalhes = error.json.detail;
          }
        }
        // Tentar parsear o body como JSON se ainda não temos detalhes
        else if (error.body && !erroDetalhes) {
          console.log('🔄 Tentando parsear error.body');
          try {
            const bodyParsed = JSON.parse(error.body);
            if (bodyParsed.detail) {
              if (Array.isArray(bodyParsed.detail)) {
                erroDetalhes = bodyParsed.detail.map((d: any) => {
                  const campo = d.loc ? d.loc.join('.') : 'campo desconhecido';
                  const mensagem = d.msg || 'erro de validação';
                  return `${campo}: ${mensagem}`;
                }).join(', ');
              } else if (typeof bodyParsed.detail === 'string') {
                erroDetalhes = bodyParsed.detail;
              }
            }
          } catch (parseError) {
            console.error('❌ Erro ao parsear body:', parseError);
          }
        }
        
        if (erroDetalhes) {
          console.log('✅ Detalhes do erro extraídos:', erroDetalhes);
          setErro(`Erro de validação do backend: ${erroDetalhes}`);
        } else {
          console.log('❓ Não foi possível extrair detalhes específicos');
          setErro(`Erro de validação dos dados (422). Verifique os campos e tente novamente. Resposta: ${error.body?.substring(0, 200) || 'vazio'}`);
        }
      } else if (error.status === 409) {
        console.log('🔍 Erro 409 detectado - conflito de dados');
        
        // Extrair detalhes específicos do erro 409
        let mensagemErro = 'CPF/CNPJ ou E-mail já está cadastrado no sistema';
        
        if (error.detail && typeof error.detail === 'object') {
          const detalhes = error.detail;
          if (detalhes.message) {
            mensagemErro = detalhes.message;
            
            // Se tiver ID do cliente existente, incluir na mensagem
            if (detalhes.existing_id) {
              mensagemErro += ` (Cliente ID: ${detalhes.existing_id})`;
            }
          }
        } else if (error.json?.detail && typeof error.json.detail === 'object') {
          const detalhes = error.json.detail;
          if (detalhes.message) {
            mensagemErro = detalhes.message;
            
            if (detalhes.existing_id) {
              mensagemErro += ` (Cliente ID: ${detalhes.existing_id})`;
            }
          }
        }
        
        setErro(mensagemErro);
      } else {
        setErro(error.message || 'Erro ao cadastrar cliente');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isPJ = formData.tipo === 'PJ';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            <User className="mr-2 h-5 w-5" />
            {veiculoParaTransferir ? 'Cadastrar Novo Proprietário' : 'Cadastrar Novo Cliente'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {veiculoParaTransferir && (
          <div className="px-6 py-4 bg-blue-50 border-b">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              {(veiculoParaTransferir as any).novoVeiculo ? 'Novo veículo para cadastro:' : 'Veículo para transferência:'}
            </h3>
            <div className="bg-white rounded-md p-3 border border-blue-200">
              {(veiculoParaTransferir as any).novoVeiculo ? (
                <>
                  <p className="font-medium">Novo Veículo</p>
                  <p className="text-sm text-gray-600">Placa: {veiculoParaTransferir.placa}</p>
                </>
              ) : (
                <>
                  <p className="font-medium">{veiculoParaTransferir.marca} {veiculoParaTransferir.modelo} {veiculoParaTransferir.ano}</p>
                  <p className="text-sm text-gray-600">Placa: {veiculoParaTransferir.placa}</p>
                  {veiculoParaTransferir.cor && (
                    <p className="text-sm text-gray-600">Cor: {veiculoParaTransferir.cor}</p>
                  )}
                </>
              )}
            </div>
            <p className="text-sm text-blue-700 mt-2">
              {(veiculoParaTransferir as any).novoVeiculo 
                ? 'Após cadastrar o cliente, você poderá completar os dados do veículo.'
                : 'Este veículo será automaticamente associado ao novo cliente após o cadastro.'
              }
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tipo de Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Cliente *
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="PF"
                  checked={formData.tipo === 'PF'}
                  onChange={(e) => handleInputChange('tipo', e.target.value)}
                  className="mr-2"
                />
                Pessoa Física
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="PJ"
                  checked={formData.tipo === 'PJ'}
                  onChange={(e) => handleInputChange('tipo', e.target.value)}
                  className="mr-2"
                />
                Pessoa Jurídica
              </label>
            </div>
          </div>

          {/* Dados Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isPJ ? 'Nome/Razão Social *' : 'Nome Completo *'}
              </label>
              <input
                ref={nomeRef}
                type="text"
                value={formData.nome}
                onChange={(e) => handleNomeChange(e.target.value)}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erros.nome 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
                placeholder={isPJ ? 'Digite a razão social da empresa' : 'Digite o nome completo'}
              />
              {erros.nome && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.nome}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isPJ ? 'CNPJ' : 'CPF'}
              </label>
              <div className="relative">
                <input
                  ref={cpfCnpjRef}
                  type="text"
                  value={formData.cpf_cnpj || ''}
                  onChange={(e) => handleInputChange('cpf_cnpj', e.target.value)}
                  className={`w-full border rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:border-transparent ${
                    erros.cpf_cnpj 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder={isPJ ? '00.000.000/0000-00' : '000.000.000-00'}
                />
                {verificandoDocumento && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {erros.cpf_cnpj && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.cpf_cnpj}
                </p>
              )}
            </div>
          </div>

          {/* Nome Fantasia para PJ */}
          {isPJ && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome Fantasia
              </label>
              <input
                type="text"
                value={formData.nome_fantasia || ''}
                onChange={(e) => handleInputChange('nome_fantasia', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Contatos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone Principal *
              </label>
              <input
                ref={telefoneRef}
                type="text"
                value={formData.telefone}
                onChange={(e) => handleInputChange('telefone', e.target.value)}
                placeholder="(11) 99999-9999"
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erros.telefone 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
              />
              {erros.telefone && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.telefone}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone Secundário
              </label>
              <input
                type="text"
                value={formData.telefone2 || ''}
                onChange={(e) => handleInputChange('telefone2', e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp
              </label>
              <input
                type="text"
                value={formData.whatsapp || ''}
                onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                ref={emailRef}
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erros.email 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="exemplo@email.com"
              />
              {erros.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.email}
                </p>
              )}
            </div>
          </div>

          {/* Endereço */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Endereço (Opcional)</h3>
            
            {/* CEP */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEP
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.cep || ''}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {loadingCEP && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logradouro
                </label>
                <input
                  type="text"
                  value={formData.endereco || ''}
                  onChange={(e) => handleInputChange('endereco', e.target.value)}
                  placeholder="Rua, Avenida, etc."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número
                </label>
                <input
                  type="text"
                  value={formData.numero || ''}
                  onChange={(e) => handleInputChange('numero', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  value={formData.bairro || ''}
                  onChange={(e) => handleInputChange('bairro', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={formData.cidade || ''}
                  onChange={(e) => handleInputChange('cidade', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  UF
                </label>
                <input
                  type="text"
                  value={formData.estado || ''}
                  onChange={(e) => handleInputChange('estado', e.target.value.toUpperCase())}
                  placeholder="RJ"
                  maxLength={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Campos adicionais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.tipo === 'PF' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={formData.data_nascimento || ''}
                  onChange={(e) => handleInputChange('data_nascimento', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isPJ ? 'Inscrição Estadual' : 'RG'}
              </label>
              <input
                type="text"
                value={formData.rg_ie || ''}
                onChange={(e) => handleInputChange('rg_ie', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Contato Responsável para PJ */}
          {isPJ && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contato Responsável
              </label>
              <input
                type="text"
                value={formData.contato_responsavel || ''}
                onChange={(e) => handleInputChange('contato_responsavel', e.target.value)}
                placeholder="Nome da pessoa de contato"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={formData.observacoes || ''}
              onChange={(e) => handleInputChange('observacoes', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{erro}</p>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Cadastrar Cliente
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}