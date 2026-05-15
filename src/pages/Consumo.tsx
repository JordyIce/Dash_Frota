import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { brlCompact, num, lt, kmL } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { Card, EmptyState, PageHeader, Badge } from '@/components/UI';

interface Linha {
  gerente: string;
  litros: number;
  gasto: number;
  kmRodados: number;
  kmL: number;          // KM/L médio ponderado
  metaKmL: number;      // meta média ponderada
  desviosAbaixo: number;
  transacoes: number;
}

export function Consumo() {
  const { data } = useData();
  const { filters } = useFilters();

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const combustivel = useMemo(() => onlyCombustivel(filtered), [filtered]);

  const linhas: Linha[] = useMemo(() => {
    const map = new Map<string, Linha>();
    for (const t of combustivel) {
      const gerente = t.gerente || 'Sem Gerente';
      const e = map.get(gerente) || {
        gerente,
        litros: 0,
        gasto: 0,
        kmRodados: 0,
        kmL: 0,
        metaKmL: 0,
        desviosAbaixo: 0,
        transacoes: 0,
      };
      e.litros += t.qtdMercadoria;
      e.gasto += t.valorTotal;
      e.kmRodados += t.kmHrPercorrido > 0 ? t.kmHrPercorrido : 0;
      e.transacoes++;
      if (t.descricaoDesvio === 'Desvio Abaixo') e.desviosAbaixo++;
      // KM/L ponderado por litros
      if (t.mediaEfetiva > 0 && t.qtdMercadoria > 0) {
        e.kmL += t.mediaEfetiva * t.qtdMercadoria;
      }
      if (t.rendimentoMedio > 0 && t.qtdMercadoria > 0) {
        e.metaKmL += t.rendimentoMedio * t.qtdMercadoria;
      }
      map.set(gerente, e);
    }
    // finaliza ponderações
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        kmL: r.litros > 0 ? r.kmL / r.litros : 0,
        metaKmL: r.litros > 0 ? r.metaKmL / r.litros : 0,
      }))
      .sort((a, b) => b.gasto - a.gasto);
  }, [combustivel]);

  return (
    <div>
      <PageHeader
        title="Consumo"
        subtitle="Volume, gasto e KM/L por Gerente"
      />

      <Card title="Consumo por Gerente" subtitle="Ordenado por gasto · ponderação de KM/L pelos litros consumidos">
        {linhas.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(280, linhas.length * 32)}>
              <BarChart data={linhas} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)} L`} stroke="#94a3b8" fontSize={11} />
                <YAxis type="category" dataKey="gerente" width={180} stroke="#475569" fontSize={11} />
                <Tooltip
                  formatter={(v: number, name: string) => [num(v, 1) + ' L', name]}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="litros" name="Volume" fill="#1e6091" radius={[0, 6, 6, 0]}>
                  <LabelList
                    dataKey="litros"
                    position="right"
                    formatter={(v: number) => `${num(v, 0)} L`}
                    style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto -mx-5 mt-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-5 py-2.5 font-medium">Gerente</th>
                    <th className="text-right px-5 py-2.5 font-medium">Volume</th>
                    <th className="text-right px-5 py-2.5 font-medium">Gasto</th>
                    <th className="text-right px-5 py-2.5 font-medium">KM rodado</th>
                    <th className="text-right px-5 py-2.5 font-medium">KM/L Efetivo</th>
                    <th className="text-right px-5 py-2.5 font-medium">Meta KM/L</th>
                    <th className="text-right px-5 py-2.5 font-medium">Aderência</th>
                    <th className="text-right px-5 py-2.5 font-medium">Trans. abaixo</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((r) => {
                    const aderencia = r.metaKmL > 0 ? r.kmL / r.metaKmL : 0;
                    const tone = aderencia >= 1 ? 'good' : aderencia >= 0.85 ? 'warn' : 'bad';
                    const pctAbaixo = r.transacoes > 0 ? (r.desviosAbaixo / r.transacoes) * 100 : 0;
                    return (
                      <tr key={r.gerente} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-2 font-medium text-slate-800">{r.gerente}</td>
                        <td className="px-5 py-2 text-right tabular-nums">{lt(r.litros)}</td>
                        <td className="px-5 py-2 text-right tabular-nums">{brlCompact(r.gasto)}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-slate-600">
                          {r.kmRodados > 0 ? num(r.kmRodados, 0) : '—'}
                        </td>
                        <td className="px-5 py-2 text-right tabular-nums font-semibold">
                          {r.kmL > 0 ? kmL(r.kmL) : '—'}
                        </td>
                        <td className="px-5 py-2 text-right tabular-nums text-slate-500">
                          {r.metaKmL > 0 ? kmL(r.metaKmL) : '—'}
                        </td>
                        <td className="px-5 py-2 text-right">
                          {r.metaKmL > 0 ? (
                            <Badge tone={tone}>{(aderencia * 100).toFixed(0)}%</Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-2 text-right tabular-nums text-slate-600">
                          {r.desviosAbaixo} <span className="text-slate-400">({pctAbaixo.toFixed(0)}%)</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
