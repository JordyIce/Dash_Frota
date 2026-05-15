import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters, applyFiltersOcioso } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { num, fmtDate } from '@/lib/utils';
import { Card, EmptyState, PageHeader } from '@/components/UI';

interface PlacaStats {
  placa: string;
  categoria: string;
  operacao: string;
  gerente: string;
  modelo: string;
  ultimoCondutor: string;
  motorOcioso: number;
  kmRodado: number;
  ultimoAbastecimento: Date | null;
  consumo: number;
  meta: number;
  pctConsumo: number;
  gastoReais: number;
}

export function RankingKmL() {
  const { data, ocioso } = useData();
  const { filters } = useFilters();
  const [topN, setTopN] = useState(20);

  const transFiltradas = useMemo(
    () => onlyCombustivel(applyFilters(data, filters)),
    [data, filters],
  );
  const ociosoFiltrado = useMemo(
    () => applyFiltersOcioso(ocioso, filters),
    [ocioso, filters],
  );

  const ociosoPorPlaca = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of ociosoFiltrado) {
      if (!o.placa) continue;
      const k = o.placa.toUpperCase();
      map.set(k, (map.get(k) || 0) + o.motorOciosoHoras);
    }
    return map;
  }, [ociosoFiltrado]);

  const statsPorPlaca = useMemo<PlacaStats[]>(() => {
    interface Acc {
      placa: string;
      categoria: string;
      operacao: string;
      gerente: string;
      modelo: string;
      ultimoCondutor: string;
      ultimoCondutorData: Date | null;
      kmRodado: number;
      ultimoAbastecimento: Date | null;
      somaProdKmL: number;
      somaProdMeta: number;
      somaLitros: number;
      somaGasto: number;
    }
    const map = new Map<string, Acc>();

    for (const t of transFiltradas) {
      if (!t.placa) continue;
      const e = map.get(t.placa) || {
        placa: t.placa,
        categoria: t.categoriaVeiculo || 'Sem Categoria',
        operacao: t.descricaoCC || '',
        gerente: t.gerente || '',
        modelo: t.modelo || '',
        ultimoCondutor: '',
        ultimoCondutorData: null,
        kmRodado: 0,
        ultimoAbastecimento: null,
        somaProdKmL: 0,
        somaProdMeta: 0,
        somaLitros: 0,
        somaGasto: 0,
      };
      e.kmRodado += t.kmHrPercorrido > 0 ? t.kmHrPercorrido : 0;
      e.somaGasto += t.valorTotal || 0;
      if (t.mediaEfetiva > 0 && t.qtdMercadoria > 0) {
        e.somaProdKmL += t.mediaEfetiva * t.qtdMercadoria;
        e.somaLitros += t.qtdMercadoria;
      }
      if (t.rendimentoMedio > 0 && t.qtdMercadoria > 0) {
        e.somaProdMeta += t.rendimentoMedio * t.qtdMercadoria;
      }
      if (t.dataTransacao && (!e.ultimoAbastecimento || t.dataTransacao > e.ultimoAbastecimento)) {
        e.ultimoAbastecimento = t.dataTransacao;
      }
      if (t.dataTransacao && t.motorista && (!e.ultimoCondutorData || t.dataTransacao > e.ultimoCondutorData)) {
        e.ultimoCondutorData = t.dataTransacao;
        e.ultimoCondutor = t.motorista;
      }
      map.set(t.placa, e);
    }

    const stats: PlacaStats[] = [];
    for (const e of map.values()) {
      const consumo = e.somaLitros > 0 ? e.somaProdKmL / e.somaLitros : 0;
      const meta = e.somaLitros > 0 ? e.somaProdMeta / e.somaLitros : 0;
      const pctConsumo = meta > 0 ? ((consumo - meta) / meta) * 100 : 0;
      stats.push({
        placa: e.placa,
        categoria: e.categoria,
        operacao: e.operacao,
        gerente: e.gerente,
        modelo: e.modelo,
        ultimoCondutor: e.ultimoCondutor || '—',
        motorOcioso: ociosoPorPlaca.get(e.placa.toUpperCase()) || 0,
        kmRodado: e.kmRodado,
        ultimoAbastecimento: e.ultimoAbastecimento,
        consumo,
        meta,
        pctConsumo,
        gastoReais: e.somaGasto,
      });
    }
    return stats;
  }, [transFiltradas, ociosoPorPlaca]);

  const topPiores = useMemo(() => {
    return [...statsPorPlaca]
      .filter((s) => s.meta > 0)
      .sort((a, b) => a.pctConsumo - b.pctConsumo)
      .slice(0, topN);
  }, [statsPorPlaca, topN]);

  if (topPiores.length === 0) {
    return (
      <div>
        <PageHeader title="Ranking KM/L" subtitle="Top piores em consumo" />
        <Card title="Sem dados">
          <EmptyState />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Ranking KM/L"
        subtitle="Top piores em consumo · Use o filtro Tipo do Carro pra restringir a uma categoria · Motor Ocioso da Base ZUQ"
        actions={
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
          >
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
          </select>
        }
      />

      <Card title="Piores placas" subtitle={`${topPiores.length} placas ordenadas pelo pior % consumo`}>
        <TabelaPiores placas={topPiores} />
      </Card>
    </div>
  );
}

function TabelaPiores({ placas }: { placas: PlacaStats[] }) {
  const pctClass = (v: number) =>
    v >= 0 ? 'text-emerald-600 font-semibold' :
    v >= -10 ? 'text-amber-600 font-semibold' :
    'text-red-600 font-semibold';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
            <th className="text-center px-2 py-2 font-semibold whitespace-nowrap">RKg</th>
            <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Operação</th>
            <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Gerente</th>
            <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Tipo</th>
            <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Placa</th>
            <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Modelo</th>
            <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Último condutor</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Motor Ocioso</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Km rodado</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Últ. abast.</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap border-l border-slate-200 dark:border-slate-700">Consumo</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Meta</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">%</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap border-l border-slate-200 dark:border-slate-700">R$</th>
          </tr>
        </thead>
        <tbody>
          {placas.map((p, i) => (
            <tr key={p.placa} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="text-center px-2 py-1.5 font-bold text-slate-400 whitespace-nowrap">
                {i + 1}
              </td>
              <td className="text-left px-2 py-1.5 max-w-[200px] truncate" title={p.operacao}>
                {p.operacao || '—'}
              </td>
              <td className="text-left px-2 py-1.5 whitespace-nowrap">
                {p.gerente || '—'}
              </td>
              <td className="text-left px-2 py-1.5 whitespace-nowrap text-slate-500">
                {p.categoria}
              </td>
              <td className="text-left px-2 py-1.5 font-mono font-semibold whitespace-nowrap">
                {p.placa}
              </td>
              <td className="text-left px-2 py-1.5 max-w-[180px] truncate text-slate-500" title={p.modelo}>
                {p.modelo || '—'}
              </td>
              <td className="text-left px-2 py-1.5 max-w-[180px] truncate text-slate-500" title={p.ultimoCondutor}>
                {p.ultimoCondutor}
              </td>
              <td className="text-right px-2 py-1.5 whitespace-nowrap">
                {p.motorOcioso > 0 ? `${num(p.motorOcioso, 0)}h` : '—'}
              </td>
              <td className="text-right px-2 py-1.5 whitespace-nowrap">
                {num(p.kmRodado, 0)}
              </td>
              <td className="text-right px-2 py-1.5 whitespace-nowrap text-slate-500">
                {p.ultimoAbastecimento ? fmtDate(p.ultimoAbastecimento) : '—'}
              </td>
              <td className="text-right px-2 py-1.5 font-semibold whitespace-nowrap border-l border-slate-100 dark:border-slate-800">
                {num(p.consumo, 2)}
              </td>
              <td className="text-right px-2 py-1.5 text-slate-500 whitespace-nowrap">
                {num(p.meta, 2)}
              </td>
              <td className={`text-right px-2 py-1.5 whitespace-nowrap ${pctClass(p.pctConsumo)}`}>
                {num(p.pctConsumo, 0)}%
              </td>
              <td className="text-right px-2 py-1.5 whitespace-nowrap border-l border-slate-100 dark:border-slate-800">
                R$ {num(p.gastoReais, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
