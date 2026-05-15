import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { num } from '@/lib/utils';
import { Card, EmptyState, PageHeader } from '@/components/UI';

/**
 * Ranking Condutores - inspirado na aba "Ranking motoristas" (gid=1258518385).
 *
 * Mostra DOIS rankings lado a lado:
 *  1. Transações com restrição (Top piores em desvios)
 *  2. R$ Gasto (Top maiores gastos)
 *
 * "Restrição" = transação com Status transação = NOK (cartão Veloe negou a transação:
 * fora do horário, limite, posto não autorizado, etc).
 */

interface CondutorStats {
  motorista: string;
  operacao: string;
  gerente: string;
  transRestricao: number;
  gasto: number;
  kmRodado: number;
  volume: number;
  consumo: number;
}

export function Condutores() {
  const { data } = useData();
  const { filters } = useFilters();
  const [topN, setTopN] = useState(10);

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const combustivel = useMemo(() => onlyCombustivel(filtered), [filtered]);

  const statsPorCondutor = useMemo<CondutorStats[]>(() => {
    interface Acc {
      motorista: string;
      operacao: string;
      gerente: string;
      transRestricao: number;
      gasto: number;
      kmRodado: number;
      volume: number;
      somaProdKmL: number;
      somaLitros: number;
      operacoes: Map<string, number>;
    }
    const map = new Map<string, Acc>();

    for (const t of combustivel) {
      if (!t.motorista) continue;
      const e = map.get(t.motorista) || {
        motorista: t.motorista,
        operacao: '',
        gerente: t.gerente || '',
        transRestricao: 0,
        gasto: 0,
        kmRodado: 0,
        volume: 0,
        somaProdKmL: 0,
        somaLitros: 0,
        operacoes: new Map<string, number>(),
      };

      if (t.statusTransacao === 'NOK') {
        e.transRestricao++;
      }

      e.gasto += t.valorTotal || 0;
      e.kmRodado += t.kmHrPercorrido > 0 ? t.kmHrPercorrido : 0;
      e.volume += t.qtdMercadoria || 0;

      if (t.mediaEfetiva > 0 && t.qtdMercadoria > 0) {
        e.somaProdKmL += t.mediaEfetiva * t.qtdMercadoria;
        e.somaLitros += t.qtdMercadoria;
      }

      if (t.descricaoCC) {
        e.operacoes.set(t.descricaoCC, (e.operacoes.get(t.descricaoCC) || 0) + 1);
      }

      if (t.gerente) e.gerente = t.gerente;

      map.set(t.motorista, e);
    }

    const stats: CondutorStats[] = [];
    for (const e of map.values()) {
      let operacaoPrincipal = '';
      let maxTrans = 0;
      for (const [op, cnt] of e.operacoes.entries()) {
        if (cnt > maxTrans) {
          maxTrans = cnt;
          operacaoPrincipal = op;
        }
      }
      const consumo = e.somaLitros > 0 ? e.somaProdKmL / e.somaLitros : 0;
      stats.push({
        motorista: e.motorista,
        operacao: operacaoPrincipal || '—',
        gerente: e.gerente || '—',
        transRestricao: e.transRestricao,
        gasto: e.gasto,
        kmRodado: e.kmRodado,
        volume: e.volume,
        consumo,
      });
    }
    return stats;
  }, [combustivel]);

  const topRestricao = useMemo(() => {
    return [...statsPorCondutor]
      .filter((s) => s.transRestricao > 0)
      .sort((a, b) => b.transRestricao - a.transRestricao)
      .slice(0, topN);
  }, [statsPorCondutor, topN]);

  const topGasto = useMemo(() => {
    return [...statsPorCondutor]
      .filter((s) => s.gasto > 0)
      .sort((a, b) => b.gasto - a.gasto)
      .slice(0, topN);
  }, [statsPorCondutor, topN]);

  if (statsPorCondutor.length === 0) {
    return (
      <div>
        <PageHeader title="Ranking Condutores" subtitle="Top piores e maiores gastos" />
        <Card title="Sem dados">
          <EmptyState />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Ranking Condutores"
        subtitle={`${statsPorCondutor.length} condutores no período · Inspirado em "Ranking motoristas" · Restrição = transação NOK na Veloe`}
        actions={
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
          >
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
          </select>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card
          title="Transações com Maior Restrição"
          subtitle="Condutores com mais transações NOK (negadas) no período"
        >
          <TabelaCondutores stats={topRestricao} highlight="restricao" />
        </Card>

        <Card
          title="R$ Gasto por Condutor"
          subtitle="Condutores com maior gasto de combustível no período"
        >
          <TabelaCondutores stats={topGasto} highlight="gasto" />
        </Card>
      </div>
    </div>
  );
}

function TabelaCondutores({
  stats,
  highlight,
}: {
  stats: CondutorStats[];
  highlight: 'restricao' | 'gasto';
}) {
  if (stats.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
            <th className="text-center px-2 py-2 font-semibold whitespace-nowrap">Rkg</th>
            <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Nome</th>
            <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Operação</th>
            <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Gerente</th>
            <th className={`text-right px-2 py-2 font-semibold whitespace-nowrap ${highlight === 'restricao' ? 'text-red-600 dark:text-red-400' : ''}`}>
              Trans. restrição
            </th>
            <th className={`text-right px-2 py-2 font-semibold whitespace-nowrap ${highlight === 'gasto' ? 'text-red-600 dark:text-red-400' : ''}`}>
              R$ Gasto
            </th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Km rodado</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Volume</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Consumo</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={s.motorista} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="text-center px-2 py-1.5 font-bold text-slate-400 whitespace-nowrap">
                {i + 1}
              </td>
              <td className="text-left px-2 py-1.5 max-w-[200px] truncate font-medium" title={s.motorista}>
                {s.motorista}
              </td>
              <td className="text-left px-2 py-1.5 max-w-[180px] truncate text-slate-500" title={s.operacao}>
                {s.operacao}
              </td>
              <td className="text-left px-2 py-1.5 whitespace-nowrap text-slate-500">
                {s.gerente}
              </td>
              <td className={`text-right px-2 py-1.5 whitespace-nowrap ${highlight === 'restricao' ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>
                {s.transRestricao}
              </td>
              <td className={`text-right px-2 py-1.5 whitespace-nowrap ${highlight === 'gasto' ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>
                R$ {num(s.gasto, 0)}
              </td>
              <td className="text-right px-2 py-1.5 whitespace-nowrap">
                {num(s.kmRodado, 0)}
              </td>
              <td className="text-right px-2 py-1.5 whitespace-nowrap">
                {num(s.volume, 0)}
              </td>
              <td className="text-right px-2 py-1.5 whitespace-nowrap font-semibold">
                {s.consumo > 0 ? num(s.consumo, 1) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
