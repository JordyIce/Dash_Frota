import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { brl, brlCompact, num, periodKey, periodLabel, type Granularity, lt } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, EmptyState, PageHeader } from '@/components/UI';

const granularities: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
];

export function ConsumoTemporal() {
  const { data } = useData();
  const { filters } = useFilters();
  const [g, setG] = useState<Granularity>('week');

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const combustivel = useMemo(() => onlyCombustivel(filtered), [filtered]);

  const serie = useMemo(() => {
    const map = new Map<string, { gasto: number; litros: number }>();
    for (const t of combustivel) {
      if (!t.dataTransacao) continue;
      const k = periodKey(t.dataTransacao, g);
      const e = map.get(k) || { gasto: 0, litros: 0 };
      e.gasto += t.valorTotal;
      e.litros += t.qtdMercadoria;
      map.set(k, e);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ k, label: periodLabel(k, g), ...v }))
      .sort((a, b) => a.k.localeCompare(b.k));
  }, [combustivel, g]);

  return (
    <div>
      <PageHeader
        title="Consumo por Período"
        subtitle="Evolução temporal do gasto e volume"
        actions={
          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
            {granularities.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setG(opt.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                  g === opt.value ? 'bg-beq-blue text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      <Card title="Gasto e volume" subtitle={`Granularidade: ${granularities.find((x) => x.value === g)?.label}`}>
        {serie.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={serie} margin={{ left: 10, right: 30, top: 10 }}>
              <defs>
                <linearGradient id="gradGasto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e6091" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#1e6091" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLitros" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
              <YAxis
                yAxisId="left"
                stroke="#1e6091"
                fontSize={11}
                tickFormatter={(v) => brlCompact(v)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#f59e0b"
                fontSize={11}
                tickFormatter={(v) => `${num(v, 0)} L`}
              />
              <Tooltip
                formatter={(v: number, name: string) => {
                  if (name === 'Gasto') return brl(v);
                  return lt(v);
                }}
                contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="gasto"
                name="Gasto"
                stroke="#1e6091"
                fill="url(#gradGasto)"
                strokeWidth={2}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="litros"
                name="Volume"
                stroke="#f59e0b"
                fill="url(#gradLitros)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Detalhamento" className="mt-4">
        {serie.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-2.5 font-medium">Período</th>
                  <th className="text-right px-5 py-2.5 font-medium">Volume</th>
                  <th className="text-right px-5 py-2.5 font-medium">Gasto</th>
                  <th className="text-right px-5 py-2.5 font-medium">R$/L médio</th>
                </tr>
              </thead>
              <tbody>
                {serie.map((r) => (
                  <tr key={r.k} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-2 font-medium text-slate-800">{r.label}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{lt(r.litros)}</td>
                    <td className="px-5 py-2 text-right tabular-nums font-medium">{brl(r.gasto)}</td>
                    <td className="px-5 py-2 text-right tabular-nums text-slate-600">
                      {r.litros > 0 ? brl(r.gasto / r.litros) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
