import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { brlCompact, num, unique } from '@/lib/utils';
import { Card, EmptyState, PageHeader } from '@/components/UI';
import { activeFilterCount } from '@/lib/filters';
import type { Transacao } from '@/lib/types';

/**
 * Performance Stratws - tabelas pivot (Tipo × Mês) lado a lado.
 *   - Esquerda "Geral": IGNORA todos os filtros — mostra a base inteira como baseline fixo
 *   - Direita: respeita TODOS os filtros (data, gerente, tipo carro, combustível)
 * 5 blocos: KM rodado, Consumo (KM/L), Volume (L), R$, R$/KM.
 */

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function mesKey(t: Transacao): string {
  if (!t.dataTransacao) return '';
  return `${t.dataTransacao.getFullYear()}-${String(t.dataTransacao.getMonth() + 1).padStart(2, '0')}`;
}

function mesLabel(key: string): string {
  const [, m] = key.split('-');
  return MESES_NOMES[parseInt(m, 10) - 1] || key;
}

interface Aggregator {
  add(t: Transacao): void;
  value(): number;
}

function sumValor(field: 'valorTotal' | 'qtdMercadoria'): () => Aggregator {
  return () => {
    let s = 0;
    return {
      add(t: Transacao) { s += t[field] || 0; },
      value() { return s; },
    };
  };
}

function sumKm(): Aggregator {
  let s = 0;
  return {
    add(t: Transacao) { s += t.kmHrPercorrido || 0; },
    value() { return s; },
  };
}

function kmlPond(): Aggregator {
  let num = 0;
  let den = 0;
  return {
    add(t: Transacao) {
      if (t.mediaEfetiva > 0 && t.qtdMercadoria > 0) {
        num += t.mediaEfetiva * t.qtdMercadoria;
        den += t.qtdMercadoria;
      }
    },
    value() { return den > 0 ? num / den : 0; },
  };
}

function reaisPorKm(): Aggregator {
  let gasto = 0;
  let km = 0;
  return {
    add(t: Transacao) {
      gasto += t.valorTotal || 0;
      km += t.kmHrPercorrido || 0;
    },
    value() { return km > 0 ? gasto / km : 0; },
  };
}

interface BlocoConfig {
  id: string;
  titulo: string;
  unidade: string;
  agg: () => Aggregator;
  format: (v: number) => string;
  emptyOnZero?: boolean;
}

const BLOCOS: BlocoConfig[] = [
  {
    id: 'km',
    titulo: 'KM Rodado',
    unidade: 'KM rodado',
    agg: sumKm,
    format: (v) => num(v, 0),
  },
  {
    id: 'consumo',
    titulo: 'Consumo (KM/L)',
    unidade: 'Consumo',
    agg: kmlPond,
    format: (v) => v > 0 ? num(v, 2) : '—',
    emptyOnZero: true,
  },
  {
    id: 'volume',
    titulo: 'Volume (Litros)',
    unidade: 'Volume',
    agg: sumValor('qtdMercadoria'),
    format: (v) => num(v, 0),
  },
  {
    id: 'reais',
    titulo: 'Gasto (R$)',
    unidade: 'R$',
    agg: sumValor('valorTotal'),
    format: (v) => brlCompact(v),
  },
  {
    id: 'rkm',
    titulo: 'R$/KM',
    unidade: 'R$/KM',
    agg: reaisPorKm,
    format: (v) => v > 0 ? num(v, 2) : '—',
    emptyOnZero: true,
  },
];

interface PivotData {
  tipos: string[];
  meses: string[];
  cells: Map<string, number>;
  totaisPorMes: Map<string, number>;
  totaisPorTipo: Map<string, number>;
}

function calcPivot(rows: Transacao[], bloco: BlocoConfig): PivotData {
  const tipos = unique(rows.map((t) => t.categoriaVeiculo));
  const mesesSet = new Set<string>();
  rows.forEach((t) => {
    const k = mesKey(t);
    if (k) mesesSet.add(k);
  });
  const meses = Array.from(mesesSet).sort();

  const cellAggs = new Map<string, Aggregator>();
  const totalMesAggs = new Map<string, Aggregator>();
  const totalTipoAggs = new Map<string, Aggregator>();

  for (const t of rows) {
    const tipo = t.categoriaVeiculo || 'Sem Tipo';
    const mes = mesKey(t);
    if (!mes) continue;

    const cellKey = `${tipo}|${mes}`;
    if (!cellAggs.has(cellKey)) cellAggs.set(cellKey, bloco.agg());
    cellAggs.get(cellKey)!.add(t);

    if (!totalMesAggs.has(mes)) totalMesAggs.set(mes, bloco.agg());
    totalMesAggs.get(mes)!.add(t);

    if (!totalTipoAggs.has(tipo)) totalTipoAggs.set(tipo, bloco.agg());
    totalTipoAggs.get(tipo)!.add(t);
  }

  const cells = new Map<string, number>();
  cellAggs.forEach((a, k) => cells.set(k, a.value()));

  const totaisPorMes = new Map<string, number>();
  totalMesAggs.forEach((a, k) => totaisPorMes.set(k, a.value()));

  const totaisPorTipo = new Map<string, number>();
  totalTipoAggs.forEach((a, k) => totaisPorTipo.set(k, a.value()));

  return { tipos, meses, cells, totaisPorMes, totaisPorTipo };
}

function calcGap(cells: Map<string, number>, tipo: string, meses: string[]): number {
  if (meses.length < 2) return 0;
  const primeiro = cells.get(`${tipo}|${meses[0]}`) || 0;
  const ultimo = cells.get(`${tipo}|${meses[meses.length - 1]}`) || 0;
  return ultimo - primeiro;
}

function PivotTable({
  titulo,
  pivot,
  bloco,
}: {
  titulo: string;
  pivot: PivotData;
  bloco: BlocoConfig;
}) {
  const tiposOrdenados = useMemo(() => {
    return [...pivot.tipos].sort((a, b) => {
      const ta = pivot.totaisPorTipo.get(a) || 0;
      const tb = pivot.totaisPorTipo.get(b) || 0;
      return tb - ta;
    });
  }, [pivot.tipos, pivot.totaisPorTipo]);

  if (pivot.tipos.length === 0 || pivot.meses.length === 0) {
    return (
      <div className="flex-1">
        <div className="text-xs font-semibold text-slate-700 mb-2 px-1">{titulo}</div>
        <div className="bg-slate-50 rounded-lg p-6 text-center text-xs text-slate-400">
          Sem dados
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold text-slate-700 mb-2 px-1">{titulo}</div>
      <table className="w-full text-[11px] tabular-nums table-fixed">
        <thead>
          <tr className="bg-slate-100 text-slate-700">
            <th className="text-left px-2 py-1.5 font-semibold w-[130px]">Tipo</th>
            {pivot.meses.map((m) => (
              <th key={m} className="text-right px-2 py-1.5 font-semibold">
                <div>{mesLabel(m)}</div>
                <div className="text-[9px] font-normal text-slate-400">{bloco.unidade}</div>
              </th>
            ))}
            <th className="text-right px-2 py-1.5 font-semibold bg-amber-100 text-amber-900 w-[80px]">
              Gap
            </th>
          </tr>
        </thead>
        <tbody>
          {tiposOrdenados.map((tipo) => {
            const gap = calcGap(pivot.cells, tipo, pivot.meses);
            return (
              <tr key={tipo} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="text-left px-2 py-1 font-medium text-slate-800 truncate" title={tipo}>
                  {tipo}
                </td>
                {pivot.meses.map((m) => {
                  const v = pivot.cells.get(`${tipo}|${m}`) || 0;
                  const display = bloco.emptyOnZero && v === 0 ? '—' : bloco.format(v);
                  return (
                    <td key={m} className="text-right px-2 py-1 text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis">
                      {display}
                    </td>
                  );
                })}
                <td className={[
                  'text-right px-2 py-1 font-semibold bg-amber-50 whitespace-nowrap overflow-hidden text-ellipsis',
                  gap > 0 ? 'text-emerald-700' : gap < 0 ? 'text-red-700' : 'text-amber-900',
                ].join(' ')}>
                  {gap === 0 ? '—' : bloco.format(gap)}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
            <td className="text-left px-2 py-1.5">Total</td>
            {pivot.meses.map((m) => (
              <td key={m} className="text-right px-2 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                {bloco.format(pivot.totaisPorMes.get(m) || 0)}
              </td>
            ))}
            <td className="text-right px-2 py-1.5 bg-amber-100 text-amber-900 whitespace-nowrap overflow-hidden text-ellipsis">
              {(() => {
                const t0 = pivot.totaisPorMes.get(pivot.meses[0]) || 0;
                const tN = pivot.totaisPorMes.get(pivot.meses[pivot.meses.length - 1]) || 0;
                const gap = tN - t0;
                return gap === 0 ? '—' : bloco.format(gap);
              })()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function PerformanceStratws() {
  const { data } = useData();
  const { filters } = useFilters();

  // Esquerda: TUDO, sem filtros — baseline fixo
  const baseGeral = useMemo(() => onlyCombustivel(data), [data]);

  // Direita: aplica todos os filtros
  const baseFiltrada = useMemo(() => {
    return onlyCombustivel(applyFilters(data, filters));
  }, [data, filters]);

  const nFiltros = activeFilterCount(filters);
  const tituloDireita = nFiltros === 0
    ? 'Filtrado (sem filtros aplicados)'
    : `Filtrado (${nFiltros} ${nFiltros === 1 ? 'filtro' : 'filtros'} ativos)`;

  if (baseGeral.length === 0) {
    return (
      <div>
        <PageHeader
          title="Performance Stratws"
          subtitle="Comparativo Geral × Filtrado por tipo de veículo e mês"
        />
        <Card title="Sem dados">
          <EmptyState />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Performance Stratws"
        subtitle="Geral (tudo) × Filtrado · Os filtros do topo afetam só a tabela da direita · Gap = último mês − primeiro mês"
      />

      <div className="space-y-5">
        {BLOCOS.map((bloco) => {
          const pivotGeral = calcPivot(baseGeral, bloco);
          const pivotFiltrada = calcPivot(baseFiltrada, bloco);
          return (
            <Card key={bloco.id} title={bloco.titulo}>
              <div className="flex flex-col xl:flex-row gap-5">
                <PivotTable titulo="Geral (todos os dados)" pivot={pivotGeral} bloco={bloco} />
                <PivotTable titulo={tituloDireita} pivot={pivotFiltrada} bloco={bloco} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
