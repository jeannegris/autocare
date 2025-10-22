// Utilitário para máscara de placa de veículo
// Formato: ABC-1234 (3 letras + hífen + 4 números)

export const formatPlaca = (value: string): string => {
  if (!value) return '';
  
  // Remove todos os caracteres que não são letras ou números
  const cleanValue = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  if (cleanValue.length <= 3) {
    return cleanValue;
  } else if (cleanValue.length <= 7) {
    // Detectar se é formato Mercosul (AAA0A00) ou antigo (AAA0000)
    const parte1 = cleanValue.slice(0, 3); // 3 letras
    const parte2 = cleanValue.slice(3);    // até 4 caracteres restantes
    
    // Se o 4º caractere é número e o 5º é letra, é formato Mercosul
    if (parte2.length >= 2 && /\d/.test(parte2[0]) && /[A-Z]/.test(parte2[1])) {
      // Formato Mercosul: ABC1A23 -> ABC-1A23
      return `${parte1}-${parte2}`;
    } else {
      // Formato antigo: ABC1234 -> ABC-1234
      return `${parte1}-${parte2}`;
    }
  } else {
    // Limita a 7 caracteres
    return `${cleanValue.slice(0, 3)}-${cleanValue.slice(3, 7)}`;
  }
};

export const validatePlaca = (placa: string): boolean => {
  // Remove a máscara para validar
  const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  if (placaLimpa.length !== 7) {
    return false;
  }
  
  // Formato antigo: AAA0000 (ex: ABC1234)
  const formatoAntigo = /^[A-Z]{3}[0-9]{4}$/;
  // Formato Mercosul: AAA0A00 (ex: ABC1A23)
  const formatoMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  
  return formatoAntigo.test(placaLimpa) || formatoMercosul.test(placaLimpa);
};

export const cleanPlaca = (placa: string): string => {
  // Remove a máscara para enviar ao backend
  return placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

// Componente Input com máscara de placa
export const handlePlacaInput = (
  value: string, 
  onChange: (formattedValue: string) => void
) => {
  const formatted = formatPlaca(value);
  onChange(formatted);
};