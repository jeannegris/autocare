import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, Package, X } from 'lucide-react';
import { ProdutoAutocomplete } from '../types/ordem-servico';
import { apiFetch } from '../lib/api';

interface AutocompleteProdutoProps {
  onSelect: (produto: ProdutoAutocomplete) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function AutocompleteProduto({
  onSelect,
  placeholder = "Buscar produto...",
  disabled = false,
  className = ""
}: AutocompleteProdutoProps) {
  const [query, setQuery] = useState('');
  const [produtos, setProdutos] = useState<ProdutoAutocomplete[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Buscar produtos com debounce
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (query.length >= 2) {
      timeoutRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const data: ProdutoAutocomplete[] = await apiFetch(
            `/ordens/produtos/autocomplete?search=${encodeURIComponent(query)}&limit=10`
          );
          setProdutos(data);
          setIsOpen(true);
          setSelectedIndex(-1);
        } catch (error) {
          console.error('Erro ao buscar produtos:', error);
          setProdutos([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    } else {
      setProdutos([]);
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
    if (!isOpen || produtos.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < produtos.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : produtos.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < produtos.length) {
          handleSelect(produtos[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelect = (produto: ProdutoAutocomplete) => {
    onSelect(produto);
    setQuery('');
    setProdutos([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const clearSearch = () => {
    setQuery('');
    setProdutos([]);
    setIsOpen(false);
    setSelectedIndex(-1);
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
  }, [isOpen, produtos.length]);

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

  return (
    <div className={`relative ${className}`}> 
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
        
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        
        {query && (
          <button
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

        {isOpen && produtos.length > 0 && dropdownStyle && ReactDOM.createPortal(
          <ul
            ref={listRef}
            style={{ left: dropdownStyle.left, top: dropdownStyle.top, width: dropdownStyle.width }}
            className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-lg"
          >
            {produtos.map((produto, index) => (
              <li
                key={produto.id}
                onClick={() => handleSelect(produto)}
                className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                  index === selectedIndex ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    <Package className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {produto.codigo}
                        </span>
                        <span className="font-medium text-gray-900 truncate">
                          {produto.nome}
                        </span>
                      </div>
                      {produto.descricao && (
                        <p className="text-sm text-gray-600 truncate mt-1">
                          {produto.descricao}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-green-600 font-medium">
                          R$ {Number(produto.preco_venda ?? 0).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">
                          Estoque: {produto.quantidade_atual} {produto.unidade}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>,
          document.body
        )}

        {isOpen && query.length >= 2 && produtos.length === 0 && !isLoading && dropdownStyle && ReactDOM.createPortal(
          <div style={{ left: dropdownStyle.left, top: dropdownStyle.top, width: dropdownStyle.width }} className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-lg p-4 text-center text-gray-500">
            <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>Nenhum produto encontrado</p>
          </div>,
          document.body
        )}
    </div>
  );
}