import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters, applyFiltersOcioso } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { num, fmtDate } from '@/lib/utils';
import { Card, EmptyState, PageHeader } from '@/components/UI';

/**
 * Ranking KM/L - Top 10 piores por categoria de veículo.
 * Inspirado na aba "Performance Stratws" da Painel Aderência (gid=836290110).
 *
 * Notas:
 *  - Motor Ocioso vem da Base ZUQ (sum motorOciosoHoras da placa no período filtrado).
 *  - Meta mensal e % Orçamento vêm da aba Track Orçamento / Metas Gerenciais
 *    (ainda não integradas) — por enquanto aparecem como "—".
 */

const CATEGORIAS_ORDEM = [
  'Caminhao Guindauto',
  'Caminhao Sky',
  'Caminhao Leve',
  'Pick-Up',
  'Pick-Up Leve',
  'Veiculo Leve',
  'Cavalo Mecanico',
];

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
  metaMensal: number | null;
  pctOrcamento: number | null;
}

export function RankingKmL() {
  const { data, ocioso } = useData();
  const { filters } = useFilters();

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
      transacoes: number;
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
        transacoes: 0,
      };
      e.kmRodado += t.kmHrPercorrido > 0 ? t.kmHrPercorrido : 0;
      e.somaGasto += t.valorTotal || 0;
      e.transacoes++;
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
        metaMensal: null,
        pctOrcamento: null,
      });
    }
    return stats;
  }, [transFiltradas, ociosoPorPlaca]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, PlacaStats[]>();
    for (const s of statsPorPlaca) {
      const arr = map.get(s.categoria) || [];
      arr.push(s);
      map.set(s.categoria, arr);
    }
    const result = new Map<string, PlacaStats[]>();
    for (const [cat, arr] of map.entries()) {
      const top10 = [...arr]
        .filter((s) => s.meta > 0)
        .sort((a, b) => a.pctConsumo - b.pctConsumo)
        .slice(0, 10);
      if (top10.length > 0) result.set(cat, top10);
    }
    return result;
  }, [statsPorPlaca]);

  const categoriasOrdenadas = useMemo(() => {
    const todas = Array.from(porCategoria.keys());
    const principais = CATEGORIAS_ORDEM.filter((c) => todas.includes(c));
    const outras = todas
      .filter((c) => !CATEGORIAS_ORDEM.includes(c))
      .sort((a, b) => (porCategoria.get(b)?.length || 0) - (porCategoria.get(a)?.length || 0));
    return [...principais, ...outras];
  }, [porCategoria]);

  if (statsPorPlaca.length === 0 || categoriasOrdenadas.length === 0) {
    return (
      <div>
        <PageHeader
          title="Ranking KM/L"
          subtitle="Top 10 piores em consumo por categoria de veículo"
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
        title="Ranking KM/L"
        subtitle="Top 10 piores em consumo por categoria · Inspirado em Performance Stratws · Motor Ocioso da Base ZUQ"
      />

      <div className="space-y-4">
        {categoriasOrdenadas.map((cat) => {
          const placas = porCategoria.get(cat) || [];
          return (
            <Card key={cat} title={cat} subtitle={`${placas.length} placa${placas.length !== 1 ? 's' : ''} no top piores`}>
              <TabelaCategoria placas={placas} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TabelaCategoria({ placas }: { placas: PlacaStats[] }) {
  const pctClass = (v: number) =>
    v >= 0 ? 'text-emerald-700' : v >= -10 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="bg-slate-100 text-slate-700">
            <th className="text-center px-2 py-1.5 font-semibold whitespace-nowrap">RKg</th>
            <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">Operação</th>
            <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">Gerente</th>
            <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">Placa</th>
            <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">Modelo</th>
            <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">Último condutor</th>
            <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Motor Ocioso</th>
            <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Km rodado</th>
            <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Últ. abast.</th>
            <th className="text-right px-2 py-1.5 font-semibold bg-blue-50 whitespace-nowrap">Consumo</th>
            <th className="text-right px-2 py-1.5 font-semibold bg-blue-50 whitespace-nowrap">Meta</th>
            <th className="text-right px-2 py-1.5 font-semibold bg-blue-50 whitespace-nowrap">%</th>
            <th className="text-right px-2 py-1.5 font-semibold bg-purple-50 whitespace-nowrap">R$</th>
            <th className="text-right px-2 py-1.5 font-semibold bg-purple-50 whitespace-nowrap">Meta R$</th>
            <th className="text-right px-2 py-1.5 font-semibold bg-purple-50 whitespace-nowrap">%</th>
          </tr>
        </thead>
        <tbody>
          {placas.map((p, i) => (
            <tr key={p.placa} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="text-center px-2 py-1 font-bold bg-red-100 text-red-900 whitespace-nowrap">
                {i + 1}
              </td>
              <td className="text-left px-2 py-1 text-slate-800 max-w-[200px] truncate" title={p.operacao}>
                {p.operacao || '—'}
              </td>
              <td className="text-left px-2 py-1 text-slate-700 whitespace-nowrap">
                {p.gerente || '—'}
              </td>
              <td className="text-left px-2 py-1 font-mono font-semibold text-slate-900 whitespace-nowrap">
                {p.placa}
              </td>
              <td className="text-left px-2 py-1 text-slate-600 max-w-[180px] truncate" title={p.modelo}>
                {p.modelo || '—'}
              </td>
              <td className="text-left px-2 py-1 text-slate-500 max-w-[180px] truncate" title={p.ultimoCondutor}>
                {p.ultimoCondutor}
              </td>
              <td className="text-right px-2 py-1 text-slate-700 whitespace-nowrap">
                {p.motorOcioso > 0 ? `${num(p.motorOcioso, 0)}h` : '—'}
              </td>
              <td className="text-right px-2 py-1 text-slate-700 whitespace-nowrap">
                {num(p.kmRodado, 0)}
              </td>
              <td className="text-right px-2 py-1 text-slate-500 whitespace-nowrap">
                {p.ultimoAbastecimento ? fmtDate(p.ultimoAbastecimento) : '—'}
              </td>
              <td className="text-right px-2 py-1 bg-blue-50 font-semibold text-slate-900 whitespace-nowrap">
                {num(p.consumo, 2)}
              </td>
              <td className="text-right px-2 py-1 bg-blue-50 text-slate-600 whitespace-nowrap">
                {p.meta > 0 ? num(p.meta, 2) : '—'}
              </td>
              <td className={`text-right px-2 py-1 bg-blue-50 font-semibold whitespace-nowrap ${pctClass(p.pctConsumo)}`}>
                {p.meta > 0 ? `${num(p.pctConsumo, 0)}%` : '—'}
              </td>
              <td className="text-right px-2 py-1 bg-purple-50 text-slate-700 whitespace-nowrap">
                R$ {num(p.gastoReais, 0)}
              </td>
              <td className="text-right px-2 py-1 bg-purple-50 text-slate-400 whitespace-nowrap">
                {p.metaMensal !== null ? `R$ ${num(p.metaMensal, 0)}` : '—'}
              </td>
              <td className="text-right px-2 py-1 bg-purple-50 text-slate-400 whitespace-nowrap">
                {p.pctOrcamento !== null ? `${num(p.pctOrcamento, 0)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
