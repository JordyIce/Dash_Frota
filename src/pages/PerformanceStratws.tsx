import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { brl, num, unique } from '@/lib/utils';
import { Card, EmptyState, PageHeader } from '@/components/UI';
import type { Transacao } from '@/lib/types';

/**
 * Performance Stratws - tabelas pivot (Tipo × Mês) com comparativo
 * Geral × Gerente selecionado.
 * 5 blocos: KM rodado, Consumo (KM/L), Volume (L), R$, R$/KM.
 */

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Retorna chave "YYYY-MM" do mês da transação */
function mesKey(t: Transacao): string {
  if (!t.dataTransacao) return '';
  return `${t.dataTransacao.getFullYear()}-${String(t.dataTransacao.getMonth() + 1).padStart(2, '0')}`;
}

function mesLabel(key: string): string {
  const [, m] = key.split('-');
  return MESES_NOMES[parseInt(m, 10) - 1] || key;
}

// === Tipos de agregação ===
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

/** KM rodado = soma de Km/Hr Percorrido (mesmo cálculo da planilha) */
function sumKm(): Aggregator {
  let s = 0;
  return {
    add(t: Transacao) { s += t.kmHrPercorrido || 0; },
    value() { return s; },
  };
}

/** KM/L médio ponderado pelos litros */
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

/** R$/KM = Gasto total / KM rodado total */
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
    format: (v) => brl(v),
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
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="text-left px-3 py-2 font-semibold min-w-[140px] sticky left-0 bg-slate-100">
                Tipo
              </th>
              {pivot.meses.map((m) => (
                <th key={m} className="text-right px-3 py-2 font-semibold whitespace-nowrap">
                  <div>{mesLabel(m)}</div>
                  <div className="text-[10px] font-normal text-slate-400">{bloco.unidade}</div>
                </th>
              ))}
              <th className="text-right px-3 py-2 font-semibold bg-slate-200/70 whitespace-nowrap">
                Gap
              </th>
            </tr>
          </thead>
          <tbody>
            {tiposOrdenados.map((tipo) => {
              const gap = calcGap(pivot.cells, tipo, pivot.meses);
              return (
                <tr key={tipo} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="text-left px-3 py-1.5 font-medium text-slate-800 sticky left-0 bg-white hover:bg-slate-50">
                    {tipo}
                  </td>
                  {pivot.meses.map((m) => {
                    const v = pivot.cells.get(`${tipo}|${m}`) || 0;
                    const display = bloco.emptyOnZero && v === 0 ? '—' : bloco.format(v);
                    return (
                      <td key={m} className="text-right px-3 py-1.5 text-slate-700">
                        {display}
                      </td>
                    );
                  })}
                  <td className={[
                    'text-right px-3 py-1.5 font-semibold bg-slate-50',
                    gap > 0 ? 'text-emerald-700' : gap < 0 ? 'text-red-600' : 'text-slate-500',
                  ].join(' ')}>
                    {gap === 0 ? '—' : bloco.format(gap)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
              <td className="text-left px-3 py-2 sticky left-0 bg-slate-100">Total</td>
              {pivot.meses.map((m) => (
                <td key={m} className="text-right px-3 py-2">
                  {bloco.format(pivot.totaisPorMes.get(m) || 0)}
                </td>
              ))}
              <td className="text-right px-3 py-2 bg-slate-200/70">
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
    </div>
  );
}

export function PerformanceStratws() {
  const { data } = useData();
  const { filters } = useFilters();

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const combustivel = useMemo(() => onlyCombustivel(filtered), [filtered]);

  const gerentesOrdenados = useMemo(() => {
    const gastoPorGerente = new Map<string, number>();
    for (const t of combustivel) {
      const g = t.gerente || 'Sem Gerente';
      gastoPorGerente.set(g, (gastoPorGerente.get(g) || 0) + (t.valorTotal || 0));
    }
    return Array.from(gastoPorGerente.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g);
  }, [combustivel]);

  const [gerenteSelecionado, setGerenteSelecionado] = useState<string>('');
  const gerenteAtual = gerenteSelecionado || gerentesOrdenados[0] || '';

  const dadosGerente = useMemo(() => {
    if (!gerenteAtual) return [] as Transacao[];
    return combustivel.filter((t) => (t.gerente || 'Sem Gerente') === gerenteAtual);
  }, [combustivel, gerenteAtual]);

  if (combustivel.length === 0) {
    return (
      <div>
        <PageHeader
          title="Performance Stratws"
          subtitle="Comparativo Geral × Gerência por tipo de veículo e mês"
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
        subtitle="Comparativo Geral × Gerência por tipo de veículo e mês · Gap = último mês − primeiro mês"
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Comparar com:</label>
            <select
              value={gerenteAtual}
              onChange={(e) => setGerenteSelecionado(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm hover:border-beq-blue/40 focus:outline-none focus:ring-2 focus:ring-beq-blue/30"
            >
              {gerentesOrdenados.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        }
      />

      <div className="space-y-5">
        {BLOCOS.map((bloco) => {
          const pivotGeral = calcPivot(combustivel, bloco);
          const pivotGerente = calcPivot(dadosGerente, bloco);
          return (
            <Card key={bloco.id} title={bloco.titulo}>
              <div className="flex flex-col lg:flex-row gap-5">
                <PivotTable titulo="Geral" pivot={pivotGeral} bloco={bloco} />
                <PivotTable
                  titulo={gerenteAtual || 'Selecione um gerente'}
                  pivot={pivotGerente}
                  bloco={bloco}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
