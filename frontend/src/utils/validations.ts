// Arquivo de funções utilitárias globais para validação e formatação
// Este arquivo centraliza todas as validações e funções reutilizáveis da aplicação

import React from 'react'
import {
  cleanDocument,
  formatCPF,
  formatCNPJ,
  formatPhone,
  validateCPF,
  validateCNPJ,
  validatePhone
} from './documentMask'

/**
 * Função para limpar formatação de CPF/CNPJ
 * @deprecated Use cleanDocument from documentMask.ts
 */
export const limparFormatacao = (valor: string): string => {
  return cleanDocument(valor)
}

/**
 * Função para formatar CPF
 * @deprecated Use formatCPF from documentMask.ts
 */
export const formatarCPF = (cpf: string): string => {
  return formatCPF(cpf)
}

/**
 * Função para formatar CNPJ
 * @deprecated Use formatCNPJ from documentMask.ts
 */
export const formatarCNPJ = (cnpj: string): string => {
  return formatCNPJ(cnpj)
}

/**
 * Função para validar CPF
 * @deprecated Use validateCPF from documentMask.ts
 */
export const validarCPF = (cpf: string): boolean => {
  return validateCPF(cpf)
}

/**
 * Função para validar CNPJ
 * @deprecated Use validateCNPJ from documentMask.ts
 */
export const validarCNPJ = (cnpj: string): boolean => {
  return validateCNPJ(cnpj)
}

/**
 * Função para validar CPF ou CNPJ automaticamente
 * @deprecated Use validateDocument from documentMask.ts
 */
export const validarCPFouCNPJ = (documento: string): { valido: boolean; tipo: 'CPF' | 'CNPJ' | null; mensagem: string } => {
  const docLimpo = cleanDocument(documento)
  
  if (docLimpo.length === 11) {
    const valido = validateCPF(documento)
    return {
      valido,
      tipo: 'CPF',
      mensagem: valido ? '' : 'CPF inválido'
    }
  } else if (docLimpo.length === 14) {
    const valido = validateCNPJ(documento)
    return {
      valido,
      tipo: 'CNPJ',
      mensagem: valido ? '' : 'CNPJ inválido'
    }
  } else {
    return {
      valido: false,
      tipo: null,
      mensagem: 'CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos'
    }
  }
}

/**
 * Função para formatar telefone brasileiro
 * @deprecated Use formatPhone from documentMask.ts
 */
export const formatarTelefone = (telefone: string): string => {
  return formatPhone(telefone)
}

/**
 * Função para validar telefone brasileiro
 * @deprecated Use validatePhone from documentMask.ts
 */
export const validarTelefone = (telefone: string): { valido: boolean; mensagem: string } => {
  const result = validatePhone(telefone)
  return {
    valido: result.valid,
    mensagem: result.message
  }
}

/**
 * Função para formatar placa de veículo
 */
export const formatarPlaca = (placa: string): string => {
  const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  
  if (placaLimpa.length <= 7) {
    // Formato antigo: ABC1234 -> ABC-1234
    if (placaLimpa.length >= 3) {
      return placaLimpa.replace(/([A-Z]{3})(\d{0,4})/, '$1-$2')
    }
  }
  
  return placaLimpa
}

/**
 * Função para validar placa de veículo (formatos antigo e Mercosul)
 */
export const validarPlaca = (placa: string): { valido: boolean; mensagem: string } => {
  const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  
  if (placaLimpa.length !== 7) {
    return {
      valido: false,
      mensagem: 'Placa deve ter 7 caracteres'
    }
  }
  
  // Formato antigo: AAA0000
  const formatoAntigo = /^[A-Z]{3}[0-9]{4}$/
  // Formato Mercosul: AAA0A00
  const formatoMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/
  
  if (formatoAntigo.test(placaLimpa) || formatoMercosul.test(placaLimpa)) {
    return {
      valido: true,
      mensagem: ''
    }
  }
  
  return {
    valido: false,
    mensagem: 'Formato de placa inválido'
  }
}

/**
 * Função para validar e-mail
 */
export const validarEmail = (email: string): { valido: boolean; mensagem: string } => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!email) {
    return {
      valido: false,
      mensagem: 'E-mail é obrigatório'
    }
  }
  
  if (!emailRegex.test(email)) {
    return {
      valido: false,
      mensagem: 'Formato de e-mail inválido'
    }
  }
  
  return {
    valido: true,
    mensagem: ''
  }
}

/**
 * Função para formatar CEP
 */
export const formatarCEP = (cep: string): string => {
  const cepLimpo = limparFormatacao(cep)
  return cepLimpo.replace(/(\d{5})(\d{3})/, '$1-$2')
}

/**
 * Função para buscar CEP automaticamente
 */
export const buscarCEP = async (cep: string): Promise<{
  sucesso: boolean
  endereco?: {
    logradouro: string
    bairro: string
    cidade: string
    estado: string
    cep: string
  }
  erro?: string
}> => {
  const cepLimpo = limparFormatacao(cep)
  
  if (cepLimpo.length !== 8) {
    return {
      sucesso: false,
      erro: 'CEP deve ter 8 dígitos'
    }
  }
  
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
    const data = await response.json()
    
    if (data.erro) {
      return {
        sucesso: false,
        erro: 'CEP não encontrado'
      }
    }
    
    return {
      sucesso: true,
      endereco: {
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
        cep: formatarCEP(cepLimpo)
      }
    }
  } catch (error) {
    return {
      sucesso: false,
      erro: 'Erro ao consultar CEP'
    }
  }
}

/**
 * Função para aplicar máscara em tempo real
 */
export const aplicarMascara = (tipo: 'CPF' | 'CNPJ' | 'telefone' | 'cep' | 'placa', valor: string): string => {
  switch (tipo) {
    case 'CPF':
      return formatarCPF(valor)
    case 'CNPJ':
      return formatarCNPJ(valor)
    case 'telefone':
      return formatarTelefone(valor)
    case 'cep':
      return formatarCEP(valor)
    case 'placa':
      return formatarPlaca(valor)
    default:
      return valor
  }
}

/**
 * Hook personalizado para validação em tempo real
 */
export const useValidacao = () => {
  const [erros, setErros] = React.useState<Record<string, string>>({})
  
  const validarCampo = (campo: string, valor: string, tipo: 'CPF' | 'CNPJ' | 'telefone' | 'email' | 'cep' | 'placa' | 'obrigatorio' | 'customizado') => {
    let resultado = { valido: true, mensagem: '' }
    
    switch (tipo) {
      case 'obrigatorio':
        resultado = valor.trim() ? { valido: true, mensagem: '' } : { valido: false, mensagem: `${campo.charAt(0).toUpperCase() + campo.slice(1)} é obrigatório` }
        break
      case 'CPF':
        resultado = validarCPF(valor) ? { valido: true, mensagem: '' } : { valido: false, mensagem: 'CPF inválido' }
        break
      case 'CNPJ':
        resultado = validarCNPJ(valor) ? { valido: true, mensagem: '' } : { valido: false, mensagem: 'CNPJ inválido' }
        break
      case 'telefone':
        resultado = validarTelefone(valor)
        break
      case 'email':
        resultado = validarEmail(valor)
        break
      case 'cep':
        const cepLimpo = limparFormatacao(valor)
        resultado = cepLimpo.length === 8 ? { valido: true, mensagem: '' } : { valido: false, mensagem: 'CEP deve ter 8 dígitos' }
        break
      case 'placa':
        resultado = validarPlaca(valor)
        break
      case 'customizado':
        // Para mensagens customizadas, não fazer validação, apenas aceitar o que vem
        resultado = { valido: true, mensagem: '' }
        break
    }
    
    setErros(prev => ({
      ...prev,
      [campo]: resultado.mensagem
    }))
    
    return resultado.valido
  }
  
  const definirErroCustomizado = (campo: string, mensagem: string) => {
    setErros(prev => ({
      ...prev,
      [campo]: mensagem
    }))
  }
  
  const limparErro = (campo: string) => {
    setErros(prev => {
      const novosErros = { ...prev }
      delete novosErros[campo]
      return novosErros
    })
  }
  
  const limparTodosErros = () => {
    setErros({})
  }
  
  return {
    erros,
    validarCampo,
    limparErro,
    limparTodosErros,
    definirErroCustomizado
  }
}