import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { brl, brlCompact, lt, num, fmtDate } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';
import { Wallet, Fuel, Coins } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { Card, EmptyState, PageHeader } from '@/components/UI';

const COLORS = ['#1e6091', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function Orcamento() {
  const { data } = useData();
  const { filters } = useFilters();

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const combustivel = useMemo(() => onlyCombustivel(filtered), [filtered]);

  const totals = useMemo(() => {
    const gastoTotal = filtered.reduce((s, t) => s + t.valorTotal, 0);
    const gastoCombustivel = combustivel.reduce((s, t) => s + t.valorTotal, 0);
    const litros = combustivel.reduce((s, t) => s + t.qtdMercadoria, 0);
    const economia = filtered.reduce((s, t) => s + t.valorEconomizado, 0);
    const precoMedio = litros > 0 ? gastoCombustivel / litros : 0;
    return { gastoTotal, gastoCombustivel, litros, economia, precoMedio };
  }, [filtered, combustivel]);

  // Gasto por Centro de Custo (top 10)
  const porCC = useMemo(() => {
    const map = new Map<string, { gasto: number; litros: number }>();
    for (const t of combustivel) {
      const cc = t.descricaoCC || 'Sem CC';
      const e = map.get(cc) || { gasto: 0, litros: 0 };
      e.gasto += t.valorTotal;
      e.litros += t.qtdMercadoria;
      map.set(cc, e);
    }
    return Array.from(map.entries())
      .map(([cc, v]) => ({ cc, ...v }))
      .sort((a, b) => b.gasto - a.gasto)
      .slice(0, 12);
  }, [combustivel]);

  // Distribuição por tipo de combustível
  const porTipo = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of combustivel) {
      const k = t.mercadoria || 'Outros';
      map.set(k, (map.get(k) || 0) + t.valorTotal);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [combustivel]);

  // Período coberto pelos dados filtrados
  const periodo = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const t of filtered) {
      if (!t.dataTransacao) continue;
      if (!min || t.dataTransacao < min) min = t.dataTransacao;
      if (!max || t.dataTransacao > max) max = t.dataTransacao;
    }
    return { min, max };
  }, [filtered]);

  return (
    <div>
      <PageHeader
        title="Orçamento"
        subtitle={`Gasto de combustível · ${fmtDate(periodo.min)} → ${fmtDate(periodo.max)}`}
      />

     <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <KpiCard
          label="Gasto Total"
          value={brl(totals.gastoTotal)}
          hint="Combustível + lubrificantes"
          icon={Wallet}
          tone="default"
        />
        <KpiCard
          label="Gasto Combustível"
          value={brl(totals.gastoCombustivel)}
          hint="Apenas combustível"
          icon={Fuel}
          tone="default"
        />
        <KpiCard
          label="Volume"
          value={lt(totals.litros)}
          hint={`Preço médio ${brl(totals.precoMedio)}/L`}
          icon={Coins}
          tone="warn"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Top centros de custo por gasto" subtitle="Combustível, R$" className="lg:col-span-2">
          {porCC.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, porCC.length * 28)}>
              <BarChart data={porCC} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => brlCompact(v)} stroke="#94a3b8" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="cc"
                  width={160}
                  stroke="#475569"
                  fontSize={11}
                  tick={{ width: 160 }}
                />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="gasto" fill="#1e6091" radius={[0, 6, 6, 0]}>
                  <LabelList
                    dataKey="gasto"
                    position="right"
                    formatter={(v: number) => brlCompact(v)}
                    style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Mix por combustível" subtitle="Distribuição do gasto">
          {porTipo.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={porTipo}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                  label={({ percent }) =>
                    percent && percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''
                  }
                  labelLine={false}
                >
                  {porTipo.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Detalhamento por Centro de Custo" className="lg:col-span-3">
          {porCC.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-5 py-2.5 font-medium">Centro de Custo</th>
                    <th className="text-right px-5 py-2.5 font-medium">Volume (L)</th>
                    <th className="text-right px-5 py-2.5 font-medium">Gasto</th>
                    <th className="text-right px-5 py-2.5 font-medium">R$/L médio</th>
                    <th className="text-right px-5 py-2.5 font-medium">% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {porCC.map((r) => (
                    <tr key={r.cc} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-2 font-medium text-slate-800">{r.cc}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{num(r.litros, 1)}</td>
                      <td className="px-5 py-2 text-right tabular-nums font-medium">{brl(r.gasto)}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-600">
                        {r.litros > 0 ? brl(r.gasto / r.litros) : '—'}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-600">
                        {totals.gastoCombustivel > 0
                          ? `${((r.gasto / totals.gastoCombustivel) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
