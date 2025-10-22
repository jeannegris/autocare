import { useState } from 'react';

interface PeriodoFilterProps {
  periodoAtivo: string;
  onPeriodoChange: (periodo: string) => void;
}

export default function PeriodoFilter({ periodoAtivo, onPeriodoChange }: PeriodoFilterProps) {
  const [hoveredPeriodo, setHoveredPeriodo] = useState<string | null>(null);
  
  const periodos = [
    { key: 'T', label: 'T', tooltip: 'Total' },
    { key: 'A', label: 'A', tooltip: 'Anual' },
    { key: 'M', label: 'M', tooltip: 'Mensal' }
  ];

  return (
    <div className="flex space-x-0.5 ml-2">
      {periodos.map((periodo) => (
        <div key={periodo.key} className="relative">
          <button
            onClick={() => onPeriodoChange(periodo.key)}
            onMouseEnter={() => setHoveredPeriodo(periodo.key)}
            onMouseLeave={() => setHoveredPeriodo(null)}
            className={`w-4 h-4 text-[10px] font-medium rounded-sm transition-colors ${
              periodoAtivo === periodo.key
                ? 'bg-green-500 text-white'
                : 'bg-gray-300 text-gray-500 hover:bg-gray-400 hover:text-gray-600'
            }`}
          >
            {periodo.label}
          </button>
          
          {/* Tooltip */}
          {hoveredPeriodo === periodo.key && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-1.5 py-0.5 text-[10px] text-white bg-gray-700 rounded whitespace-nowrap z-10">
              {periodo.tooltip}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[3px] border-transparent border-t-gray-700"></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}