import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { kmL, lt, brlCompact, num } from '@/lib/utils';
import { Card, EmptyState, PageHeader, Badge } from '@/components/UI';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

type GroupBy = 'cc' | 'placa' | 'motorista';

interface Linha {
  key: string;
  label: string;
  detail?: string;
  litros: number;
  kmL: number;
  metaKmL: number;
  aderencia: number; // kmL / metaKmL
  transacoes: number;
  gasto: number;
}

export function RankingKmL() {
  const { data } = useData();
  const { filters } = useFilters();
  const [groupBy, setGroupBy] = useState<GroupBy>('cc');
  const [topN, setTopN] = useState(10);

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const combustivel = useMemo(() => onlyCombustivel(filtered), [filtered]);

  const linhas: Linha[] = useMemo(() => {
    const map = new Map<string, Linha>();
    for (const t of combustivel) {
      let key = '';
      let label = '';
      let detail = '';
      if (groupBy === 'cc') {
        key = t.descricaoCC || 'Sem CC';
        label = key;
      } else if (groupBy === 'placa') {
        key = t.placa || 'sem-placa';
        label = t.placa || '—';
        detail = `${t.modelo || ''} · ${t.descricaoCC || ''}`;
      } else {
        key = t.motorista || 'sem-motorista';
        label = t.motorista || '—';
        detail = t.descricaoCC || '';
      }

      const e =
        map.get(key) ||
        {
          key,
          label,
          detail,
          litros: 0,
          kmL: 0,
          metaKmL: 0,
          aderencia: 0,
          transacoes: 0,
          gasto: 0,
        };

      e.litros += t.qtdMercadoria;
      e.transacoes++;
      e.gasto += t.valorTotal;
      if (t.mediaEfetiva > 0 && t.qtdMercadoria > 0) e.kmL += t.mediaEfetiva * t.qtdMercadoria;
      if (t.rendimentoMedio > 0 && t.qtdMercadoria > 0) e.metaKmL += t.rendimentoMedio * t.qtdMercadoria;
      map.set(key, e);
    }
    // ponderação final
    return Array.from(map.values())
      .map((r) => {
        const kmL = r.litros > 0 ? r.kmL / r.litros : 0;
        const meta = r.litros > 0 ? r.metaKmL / r.litros : 0;
        return {
          ...r,
          kmL,
          metaKmL: meta,
          aderencia: meta > 0 ? kmL / meta : 0,
        };
      })
      // só vale ranquear quem teve dados de KM/L válidos (filtra ruído)
      .filter((r) => r.kmL > 0 && r.transacoes >= 2);
  }, [combustivel, groupBy]);

  const melhores = useMemo(
    () => [...linhas].sort((a, b) => b.aderencia - a.aderencia).slice(0, topN),
    [linhas, topN],
  );
  const piores = useMemo(
    () => [...linhas].sort((a, b) => a.aderencia - b.aderencia).slice(0, topN),
    [linhas, topN],
  );

  return (
    <div>
      <PageHeader
        title="Ranking KM/L"
        subtitle="Melhores e piores em aderência à meta · KM/L ponderado por volume consumido"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
              {(['cc', 'placa', 'motorista'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    groupBy === g
                      ? 'bg-beq-blue text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {g === 'cc' ? 'Gerência' : g === 'placa' ? 'Placa' : 'Motorista'}
                </button>
              ))}
            </div>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="text-sm px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
            </select>
          </div>
        }
      />

      {linhas.length === 0 ? (
        <Card>
          <EmptyState
            title="Sem dados de KM/L"
            message="Não há transações com média efetiva calculada para ranquear."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card
            title="🟢 Melhores (acima ou próximo da meta)"
            subtitle="Maior aderência à meta KM/L"
          >
            <RankingTable rows={melhores} positive />
          </Card>
          <Card
            title="🔴 Piores (abaixo da meta)"
            subtitle="Menor aderência à meta KM/L"
          >
            <RankingTable rows={piores} positive={false} />
          </Card>
        </div>
      )}
    </div>
  );
}

function RankingTable({ rows, positive }: { rows: Linha[]; positive: boolean }) {
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <th className="text-left px-5 py-2.5 font-medium">#</th>
            <th className="text-left px-5 py-2.5 font-medium">Item</th>
            <th className="text-right px-5 py-2.5 font-medium">KM/L</th>
            <th className="text-right px-5 py-2.5 font-medium">Meta</th>
            <th className="text-right px-5 py-2.5 font-medium">Aderência</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const tone = r.aderencia >= 1 ? 'good' : r.aderencia >= 0.85 ? 'warn' : 'bad';
            const Icon = positive ? ArrowUpCircle : ArrowDownCircle;
            return (
              <tr key={r.key} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                <td className="px-5 py-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${positive ? 'text-emerald-500' : 'text-red-500'}`} />
                    <div>
                      <div className="font-medium text-slate-800">{r.label}</div>
                      {r.detail && <div className="text-[11px] text-slate-500">{r.detail}</div>}
                      <div className="text-[11px] text-slate-400">
                        {r.transacoes} trans. · {lt(r.litros)} · {brlCompact(r.gasto)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-2 text-right tabular-nums font-semibold">{kmL(r.kmL)}</td>
                <td className="px-5 py-2 text-right tabular-nums text-slate-500">{kmL(r.metaKmL)}</td>
                <td className="px-5 py-2 text-right">
                  <Badge tone={tone}>{(r.aderencia * 100).toFixed(0)}%</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
