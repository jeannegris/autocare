import { useState, useEffect } from 'react';
import { X, User, Car, Phone, Mail, MapPin, Calendar, FileText, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDocument, formatPhone } from '../utils/documentMask';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VeiculoCliente {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cor?: string;
  km_atual: number;
  combustivel?: string;
}

interface ClienteDetalhe {
  id: number;
  nome: string;
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  telefone2?: string;
  whatsapp?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  tipo: 'PF' | 'PJ';
  data_nascimento?: string;
  nome_fantasia?: string;
  razao_social?: string;
  contato_responsavel?: string;
  observacoes?: string;
  created_at?: string;
  total_gasto?: number;
  total_servicos?: number;
  veiculos_count?: number;
}

interface ModalVisualizarClienteProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: number | null;
}

export default function ModalVisualizarCliente({ isOpen, onClose, clienteId }: ModalVisualizarClienteProps) {
  const [cliente, setCliente] = useState<ClienteDetalhe | null>(null);
  const [veiculos, setVeiculos] = useState<VeiculoCliente[]>([]);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [loadingVeiculos, setLoadingVeiculos] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!isOpen || !clienteId) return;

    const carregarDados = async () => {
      setLoadingCliente(true);
      setLoadingVeiculos(true);
      setErro('');
      setCliente(null);
      setVeiculos([]);

      try {
        const [clienteData, veiculosData] = await Promise.all([
          apiFetch(`/clientes/${clienteId}`),
          apiFetch(`/veiculos/cliente/${clienteId}`),
        ]);
        setCliente(clienteData as ClienteDetalhe);
        setVeiculos(Array.isArray(veiculosData) ? (veiculosData as VeiculoCliente[]) : []);
      } catch {
        setErro('Erro ao carregar dados do cliente.');
      } finally {
        setLoadingCliente(false);
        setLoadingVeiculos(false);
      }
    };

    carregarDados();
  }, [isOpen, clienteId]);

  if (!isOpen) return null;

  const enderecoCompleto = [
    cliente?.endereco,
    cliente?.numero ? `nº ${cliente.numero}` : null,
    cliente?.complemento,
    cliente?.bairro,
    cliente?.cidade && cliente?.estado ? `${cliente.cidade} - ${cliente.estado}` : cliente?.cidade,
    cliente?.cep,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-6 mx-auto p-5 border max-w-3xl shadow-lg rounded-md bg-white mb-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {loadingCliente ? 'Carregando...' : cliente?.nome || '—'}
              </h3>
              {cliente?.tipo && (
                <span className="text-xs text-gray-500">
                  {cliente.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  {cliente.nome_fantasia ? ` · ${cliente.nome_fantasia}` : ''}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-red-700 text-sm">
            {erro}
          </div>
        )}

        {loadingCliente ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : cliente ? (
          <div className="space-y-5">
            {/* Dados do cliente */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Informações
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {cliente.cpf_cnpj && (
                  <div>
                    <span className="text-gray-500">{cliente.tipo === 'PF' ? 'CPF' : 'CNPJ'}:</span>
                    <p className="font-medium">{formatDocument(cliente.cpf_cnpj)}</p>
                  </div>
                )}
                {cliente.data_nascimento && (
                  <div>
                    <span className="text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3" /> Nascimento:</span>
                    <p className="font-medium">
                      {format(new Date(cliente.data_nascimento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                )}
                {cliente.contato_responsavel && (
                  <div>
                    <span className="text-gray-500">Responsável:</span>
                    <p className="font-medium">{cliente.contato_responsavel}</p>
                  </div>
                )}
                {cliente.created_at && (
                  <div>
                    <span className="text-gray-500">Cliente desde:</span>
                    <p className="font-medium">
                      {format(new Date(cliente.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Contatos */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Phone className="h-4 w-4" /> Contatos
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {cliente.telefone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    <span>{formatPhone(cliente.telefone)}</span>
                  </div>
                )}
                {cliente.telefone2 && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    <span>{formatPhone(cliente.telefone2)} <span className="text-gray-400 text-xs">(2º)</span></span>
                  </div>
                )}
                {cliente.whatsapp && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-green-500" />
                    <span>{formatPhone(cliente.whatsapp)} <span className="text-green-600 text-xs">(WhatsApp)</span></span>
                  </div>
                )}
                {cliente.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    <span className="break-all">{cliente.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Endereço */}
            {enderecoCompleto && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Endereço
                </h4>
                <p className="text-sm text-gray-800">{enderecoCompleto}</p>
              </div>
            )}

            {/* Observações */}
            {cliente.observacoes && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded p-3">
                <p className="text-sm text-gray-700">
                  <strong>Observações:</strong> {cliente.observacoes}
                </p>
              </div>
            )}

            {/* Veículos */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Car className="h-4 w-4" /> Veículos Associados
              </h4>

              {loadingVeiculos ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : veiculos.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                  Nenhum veículo associado a este cliente.
                </div>
              ) : (
                <div className="space-y-2">
                  {veiculos.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-4 bg-gray-50 rounded-lg p-3 border border-gray-200"
                    >
                      <div className="bg-blue-50 p-2 rounded-full">
                        <Car className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">
                          {v.marca} {v.modelo}
                          {v.ano ? ` · ${v.ano}` : ''}
                          {v.cor ? ` · ${v.cor}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Placa: <span className="font-medium text-gray-700">{v.placa}</span>
                          {v.km_atual ? ` · KM: ${v.km_atual.toLocaleString('pt-BR')}` : ''}
                          {v.combustivel ? ` · ${v.combustivel}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumo financeiro (se disponível) */}
            {(cliente.total_gasto != null || cliente.total_servicos != null) && (
              <div className="grid grid-cols-2 gap-3">
                {cliente.total_gasto != null && (
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Total Gasto</p>
                    <p className="text-lg font-bold text-green-700">
                      R$ {cliente.total_gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                {cliente.total_servicos != null && (
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Serviços Realizados</p>
                    <p className="text-lg font-bold text-blue-700">{cliente.total_servicos}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex justify-end mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
