// Utilitário para máscaras de documentos e telefones
// Padronização de CPF, CNPJ e telefone para busca e validação

/**
 * Remove todos os caracteres que não são dígitos
 */
export const cleanDocument = (value: string): string => {
  if (!value) return '';
  return value.replace(/\D/g, '');
};

/**
 * Formatar CPF com máscara
 * Formato: 000.000.000-00
 */
export const formatCPF = (value: string): string => {
  if (!value) return '';
  
  const cleanValue = cleanDocument(value);
  
  if (cleanValue.length <= 3) {
    return cleanValue;
  } else if (cleanValue.length <= 6) {
    return cleanValue.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  } else if (cleanValue.length <= 9) {
    return cleanValue.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  } else if (cleanValue.length <= 11) {
    return cleanValue.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  }
  
  // Limita a 11 dígitos
  return cleanValue.slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

/**
 * Formatar CNPJ com máscara
 * Formato: 00.000.000/0000-00
 */
export const formatCNPJ = (value: string): string => {
  if (!value) return '';
  
  const cleanValue = cleanDocument(value);
  
  if (cleanValue.length <= 2) {
    return cleanValue;
  } else if (cleanValue.length <= 5) {
    return cleanValue.replace(/(\d{2})(\d{1,3})/, '$1.$2');
  } else if (cleanValue.length <= 8) {
    return cleanValue.replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
  } else if (cleanValue.length <= 12) {
    return cleanValue.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
  } else if (cleanValue.length <= 14) {
    return cleanValue.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
  }
  
  // Limita a 14 dígitos
  return cleanValue.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

/**
 * Formatar telefone com máscara
 * Formato: (00) 0000-0000 ou (00) 00000-0000
 */
export const formatPhone = (value: string): string => {
  if (!value) return '';
  
  const cleanValue = cleanDocument(value);
  
  if (cleanValue.length <= 2) {
    return cleanValue;
  } else if (cleanValue.length <= 6) {
    return cleanValue.replace(/(\d{2})(\d{1,4})/, '($1) $2');
  } else if (cleanValue.length <= 10) {
    return cleanValue.replace(/(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3');
  } else if (cleanValue.length === 11) {
    // Celular: (00) 00000-0000
    return cleanValue.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  
  // Limita a 11 dígitos e aplica formato de celular
  return cleanValue.slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

/**
 * Detectar automaticamente o tipo de documento e aplicar a máscara apropriada
 * Para 11 dígitos: verifica se é CPF válido, senão trata como telefone
 */
export const formatDocument = (value: string): string => {
  if (!value) return '';
  
  const cleanValue = cleanDocument(value);
  
  if (cleanValue.length <= 11) {
    return formatCPF(value);
  } else {
    return formatCNPJ(value);
  }
};

/**
 * Detectar automaticamente entre CPF e telefone para 11 dígitos
 * Se for CPF válido, formata como CPF, senão como telefone
 */
export const smartFormatDocumentOrPhone = (value: string): string => {
  if (!value) return '';
  
  const cleanValue = cleanDocument(value);
  
  // Para 11 dígitos, verificar se é CPF válido
  if (cleanValue.length === 11) {
    // Verificar se é CPF válido
    if (validateCPF(value)) {
      return formatCPF(value);
    } else {
      // Se não for CPF válido, tratar como telefone
      return formatPhone(value);
    }
  }
  
  // Para outros tamanhos, usar lógica normal
  if (cleanValue.length < 11) {
    return formatCPF(value);
  } else if (cleanValue.length === 14) {
    return formatCNPJ(value);
  }
  
  return value;
};

/**
 * Validar CPF
 */
export const validateCPF = (cpf: string): boolean => {
  const cpfClean = cleanDocument(cpf);
  
  if (cpfClean.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpfClean)) return false;
  
  // Calcular primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpfClean.charAt(i)) * (10 - i);
  }
  let remainder = sum % 11;
  let digit1 = remainder < 2 ? 0 : 11 - remainder;
  
  if (digit1 !== parseInt(cpfClean.charAt(9))) return false;
  
  // Calcular segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpfClean.charAt(i)) * (11 - i);
  }
  remainder = sum % 11;
  let digit2 = remainder < 2 ? 0 : 11 - remainder;
  
  return digit2 === parseInt(cpfClean.charAt(10));
};

/**
 * Validar CNPJ
 */
export const validateCNPJ = (cnpj: string): boolean => {
  const cnpjClean = cleanDocument(cnpj);
  
  if (cnpjClean.length !== 14) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cnpjClean)) return false;
  
  // Calcular primeiro dígito verificador
  let length = cnpjClean.length - 2;
  let numbers = cnpjClean.substring(0, length);
  let digits = cnpjClean.substring(length);
  let sum = 0;
  let pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  
  // Calcular segundo dígito verificador
  length++;
  numbers = cnpjClean.substring(0, length);
  sum = 0;
  pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digits.charAt(1));
};

/**
 * Validar documento automaticamente (CPF ou CNPJ)
 */
export const validateDocument = (document: string): { valid: boolean; type: 'CPF' | 'CNPJ' | null; message: string } => {
  const cleanDoc = cleanDocument(document);
  
  if (cleanDoc.length === 11) {
    const valid = validateCPF(document);
    return {
      valid,
      type: 'CPF',
      message: valid ? '' : 'CPF inválido'
    };
  } else if (cleanDoc.length === 14) {
    const valid = validateCNPJ(document);
    return {
      valid,
      type: 'CNPJ',
      message: valid ? '' : 'CNPJ inválido'
    };
  } else {
    return {
      valid: false,
      type: null,
      message: 'CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos'
    };
  }
};

/**
 * Validar telefone
 */
export const validatePhone = (phone: string): { valid: boolean; message: string } => {
  const phoneClean = cleanDocument(phone);
  
  if (phoneClean.length < 10 || phoneClean.length > 11) {
    return {
      valid: false,
      message: 'Telefone deve ter 10 ou 11 dígitos'
    };
  }
  
  // Verificar se o DDD é válido (11 a 99)
  const ddd = parseInt(phoneClean.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return {
      valid: false,
      message: 'DDD inválido'
    };
  }
  
  // Verificar se é celular (11 dígitos) e se o primeiro dígito do número é 9
  if (phoneClean.length === 11 && phoneClean.charAt(2) !== '9') {
    return {
      valid: false,
      message: 'Celular deve começar com 9'
    };
  }
  
  return {
    valid: true,
    message: ''
  };
};

/**
 * Função para input handlers - aplica máscara em tempo real
 */
export const handleDocumentInput = (value: string, setValue: (value: string) => void) => {
  const formatted = formatDocument(value);
  setValue(formatted);
};

export const handlePhoneInput = (value: string, setValue: (value: string) => void) => {
  const formatted = formatPhone(value);
  setValue(formatted);
};

/**
 * Handler inteligente que detecta automaticamente CPF ou telefone
 * Para 11 dígitos: valida CPF primeiro, se inválido trata como telefone
 */
export const handleSmartDocumentOrPhoneInput = (value: string, setValue: (value: string) => void) => {
  const formatted = smartFormatDocumentOrPhone(value);
  setValue(formatted);
};

/**
 * Limpar documento para envio ao backend (remove máscaras)
 */
export const cleanDocumentForSubmit = (document: string): string => {
  return cleanDocument(document);
};

export const cleanPhoneForSubmit = (phone: string): string => {
  return cleanDocument(phone);
};