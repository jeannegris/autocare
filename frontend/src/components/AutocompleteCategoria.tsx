import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Tag, X, Plus } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface Categoria {
  id: number;
  nome: string;
  descricao?: string;
}

interface AutocompleteCategoriaProps {
  onSelect: (categoria: string) => void;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function AutocompleteCategoria({
  onSelect,
  value = '',
  placeholder = "Buscar ou criar categoria...",
  disabled = false,
  className = ""
}: AutocompleteCategoriaProps) {
  const [query, setQuery] = useState(value);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Sincronizar com valor externo
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Buscar categorias com debounce
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (query.length >= 1) {
      timeoutRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const data: Categoria[] = await apiFetch(
            `/estoque/categorias?ativo=true&limit=50`
          );
          
          // Filtrar categorias baseado na query
          const filtradas = data.filter(cat => 
            cat.nome.toLowerCase().includes(query.toLowerCase())
          );
          
          setCategorias(filtradas);
          setIsOpen(true);
          setSelectedIndex(-1);
        } catch (error) {
          console.error('Erro ao buscar categorias:', error);
          setCategorias([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    } else if (query.length === 0) {
      // Se query vazia, buscar todas as categorias
      timeoutRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const data: Categoria[] = await apiFetch(
            `/estoque/categorias?ativo=true&limit=50`
          );
          setCategorias(data);
          setSelectedIndex(-1);
        } catch (error) {
          console.error('Erro ao buscar categorias:', error);
          setCategorias([]);
        } finally {
          setIsLoading(false);
        }
      }, 100);
    } else {
      setCategorias([]);
      setIsOpen(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node) &&
          listRef.current && !listRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Calcular total de itens (categorias + opção de criar nova)
    const totalItems = categorias.length + (query.trim() && !categoriaExataExiste() ? 1 : 0);
    
    if (!isOpen || totalItems === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < totalItems - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : totalItems - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < categorias.length) {
          handleSelect(categorias[selectedIndex].nome);
        } else if (selectedIndex === categorias.length && query.trim() && !categoriaExataExiste()) {
          // Selecionar opção de criar nova categoria
          handleCreateNew();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelect = (categoriaNome: string) => {
    onSelect(categoriaNome);
    setQuery(categoriaNome);
    setCategorias([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const categoriaExataExiste = (): boolean => {
    return categorias.some(cat => 
      cat.nome.toLowerCase() === query.trim().toLowerCase()
    );
  };

  const handleCreateNew = async () => {
    const novaCategoria = query.trim();
    if (!novaCategoria) return;

    try {
      setIsLoading(true);
      const categoria: Categoria = await apiFetch('/estoque/categorias', {
        method: 'POST',
        body: JSON.stringify({
          nome: novaCategoria,
          ativo: true
        })
      });
      
      handleSelect(categoria.nome);
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      alert('Erro ao criar categoria. Verifique se já existe uma categoria com este nome.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setCategorias([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const [dropdownStyle, setDropdownStyle] = useState<{ left: number; top: number; width: number } | null>(null);

  // Atualiza posição do dropdown baseado na posição do input
  const updateDropdownPosition = () => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    setDropdownStyle({ left: rect.left + window.scrollX, top: rect.bottom + window.scrollY, width: rect.width });
  };

  useEffect(() => {
    if (isOpen) updateDropdownPosition();
  }, [isOpen, categorias.length]);

  useEffect(() => {
    const onScroll = () => {
      if (isOpen) updateDropdownPosition();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen]);

  const mostrarOpcaoCriarNova = query.trim() && !categoriaExataExiste();

  return (
    <div className={`relative ${className}`}> 
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (categorias.length > 0 || query.length === 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
        
        <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {isOpen && (categorias.length > 0 || mostrarOpcaoCriarNova) && dropdownStyle && ReactDOM.createPortal(
        <ul
          ref={listRef}
          style={{ left: dropdownStyle.left, top: dropdownStyle.top, width: dropdownStyle.width }}
          className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {categorias.map((categoria, index) => (
            <li
              key={categoria.id}
              onClick={() => handleSelect(categoria.nome)}
              className={`px-4 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-center">
                <Tag className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900">{categoria.nome}</span>
                  {categoria.descricao && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {categoria.descricao}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
          
          {mostrarOpcaoCriarNova && (
            <li
              onClick={handleCreateNew}
              className={`px-4 py-2 cursor-pointer border-t border-gray-200 hover:bg-green-50 ${
                selectedIndex === categorias.length ? 'bg-green-50 border-green-200' : ''
              }`}
            >
              <div className="flex items-center">
                <Plus className="h-4 w-4 text-green-600 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-green-700">
                    Criar "{query}"
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Adicionar nova categoria
                  </p>
                </div>
              </div>
            </li>
          )}
        </ul>,
        document.body
      )}

      {isOpen && query.length >= 1 && categorias.length === 0 && !mostrarOpcaoCriarNova && !isLoading && dropdownStyle && ReactDOM.createPortal(
        <div style={{ left: dropdownStyle.left, top: dropdownStyle.top, width: dropdownStyle.width }} className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-lg p-4 text-center text-gray-500">
          <Tag className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p>Nenhuma categoria encontrada</p>
        </div>,
        document.body
      )}
    </div>
  );
}
