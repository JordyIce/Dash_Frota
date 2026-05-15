import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { MultiSelect } from './MultiSelect';
import { unique, toInputDate, fromInputDate } from '@/lib/utils';
import { activeFilterCount } from '@/lib/filters';
import { RotateCcw, Filter } from 'lucide-react';

export function GlobalFilters() {
  const { data, ocioso } = useData();
  const { filters, updateFilter, resetFilters } = useFilters();

  // opções derivadas das duas bases (Veloe + ZUQ)
  const opts = useMemo(() => {
    return {
      centroCusto: unique(data.map((d) => d.descricaoCC)),
      // Gerente: união dos gerentes reais (Veloe já recebeu o cruzamento)
      // + os da ZUQ pra cobrir placas com telemetria mas sem transação no período
      gerente: unique([
        ...data.map((d) => d.gerente),
        ...ocioso.map((o) => o.gerente),
      ]),
      // Tipo do Carro: categoria amigável (coluna "Para") + grupo da ZUQ
      tipoCarro: unique([
        ...data.map((d) => d.categoriaVeiculo),
        ...ocioso.map((o) => o.grupo),
      ]),
      // Combustível: Gasolina, Diesel S10, Arla (coluna "Tipo")
      combustivel: unique(data.map((d) => d.combustivel)),
    };
  }, [data, ocioso]);

  const active = activeFilterCount(filters);

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-beq-blue" />
          <h2 className="text-sm font-semibold text-slate-800">Filtros</h2>
          {active > 0 && (
            <span className="bg-beq-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              {active}
            </span>
          )}
        </div>
        {active > 0 && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MultiSelect
          label="Centro de Custo"
          options={opts.centroCusto}
          value={filters.centroCusto}
          onChange={(v) => updateFilter('centroCusto', v)}
        />
        <MultiSelect
          label="Gerente"
          options={opts.gerente}
          value={filters.gerente}
          onChange={(v) => updateFilter('gerente', v)}
        />
        <MultiSelect
          label="Tipo do Carro"
          options={opts.tipoCarro}
          value={filters.tipoCarro}
          onChange={(v) => updateFilter('tipoCarro', v)}
        />
        <MultiSelect
          label="Combustível"
          options={opts.combustivel}
          value={filters.combustivel}
          onChange={(v) => updateFilter('combustivel', v)}
        />
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1 uppercase tracking-wide">
            Data início
          </label>
          <input
            type="date"
            value={toInputDate(filters.dataInicio)}
            onChange={(e) => updateFilter('dataInicio', fromInputDate(e.target.value))}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-beq-blue/40 focus:outline-none focus:ring-2 focus:ring-beq-blue/30"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1 uppercase tracking-wide">
            Data fim
          </label>
          <input
            type="date"
            value={toInputDate(filters.dataFim)}
            onChange={(e) => updateFilter('dataFim', fromInputDate(e.target.value))}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-beq-blue/40 focus:outline-none focus:ring-2 focus:ring-beq-blue/30"
          />
        </div>
      </div>
    </div>
  );
}
