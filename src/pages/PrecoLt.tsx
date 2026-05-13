import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { brl, num, lt } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { Card, EmptyState, PageHeader } from '@/components/UI';
import { KpiCard } from '@/components/KpiCard';
import { Tag, ArrowDown, ArrowUp, ChartScatter } from 'lucide-react';

const COMBUSTIVEIS = ['Todos', 'Diesel S10', 'Diesel', 'Gasolina Comum', 'Etanol'];

export function PrecoLt() {
  const { data } = useData();
  const { filters } = useFilters();
  const [combustivel, setCombustivel] = useState<string>('Todos');

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const comb = useMemo(() => {
    const c = onlyCombustivel(filtered);
    if (combustivel === 'Todos') return c;
    return c.filter((t) => t.mercadoria === combustivel);
  }, [filtered, combustivel]);

  // Preço por operação (CC)
  const porOperacao = useMemo(() => {
    interface R {
      cc: string;
      somaValor: number;
      somaLitros: number;
      transacoes: number;
    }
    const map = new Map<string, R>();
    for (const t of comb) {
      const cc = t.descricaoCC || 'Sem CC';
      const e = map.get(cc) || { cc, somaValor: 0, somaLitros: 0, transacoes: 0 };
      e.somaValor += t.valorTotal;
      e.somaLitros += t.qtdMercadoria;
      e.transacoes++;
      map.set(cc, e);
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        precoMedio: r.somaLitros > 0 ? r.somaValor / r.somaLitros : 0,
      }))
      .filter((r) => r.precoMedio > 0)
      .sort((a, b) => b.precoMedio - a.precoMedio);
  }, [comb]);

  // Preço por estabelecimento (top 10 fornecedores)
  const porFornecedor = useMemo(() => {
    interface R {
      ec: string;
      bandeira: string;
      somaValor: number;
      somaLitros: number;
      transacoes: number;
    }
    const map = new Map<string, R>();
    for (const t of comb) {
      const ec = t.nomeEC || 'Sem EC';
      const e =
        map.get(ec) ||
        ({ ec, bandeira: t.bandeiraEC, somaValor: 0, somaLitros: 0, transacoes: 0 } as R);
      e.somaValor += t.valorTotal;
      e.somaLitros += t.qtdMercadoria;
      e.transacoes++;
      map.set(ec, e);
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        precoMedio: r.somaLitros > 0 ? r.somaValor / r.somaLitros : 0,
      }))
      .filter((r) => r.somaLitros >= 50) // descarta ruído
      .sort((a, b) => a.precoMedio - b.precoMedio);
  }, [comb]);

  // KPIs
  const stats = useMemo(() => {
    const somaValor = comb.reduce((s, t) => s + t.valorTotal, 0);
    const somaLitros = comb.reduce((s, t) => s + t.qtdMercadoria, 0);
    const medio = somaLitros > 0 ? somaValor / somaLitros : 0;
    const precos = comb
      .filter((t) => t.valorUnitario > 0)
      .map((t) => t.valorUnitario);
    const min = precos.length > 0 ? Math.min(...precos) : 0;
    const max = precos.length > 0 ? Math.max(...precos) : 0;
    return { medio, min, max, n: precos.length };
  }, [comb]);

  // cor da barra: maior caro = vermelho, mais barato = verde
  const maxPreco = porOperacao.length > 0 ? Math.max(...porOperacao.map((r) => r.precoMedio)) : 0;
  const minPreco = porOperacao.length > 0 ? Math.min(...porOperacao.map((r) => r.precoMedio)) : 0;
  function barColor(p: number) {
    if (maxPreco === minPreco) return '#1e6091';
    const t = (p - minPreco) / (maxPreco - minPreco);
    // verde → amarelo → vermelho
    if (t < 0.5) {
      // verde a amarelo
      const r = Math.round(16 + (245 - 16) * (t * 2));
      const g = Math.round(185 + (158 - 185) * (t * 2));
      const b = Math.round(129 + (11 - 129) * (t * 2));
      return `rgb(${r},${g},${b})`;
    }
    const tt = (t - 0.5) * 2;
    const r = Math.round(245 + (239 - 245) * tt);
    const g = Math.round(158 + (68 - 158) * tt);
    const b = Math.round(11 + (68 - 11) * tt);
    return `rgb(${r},${g},${b})`;
  }

  return (
    <div>
      <PageHeader
        title="Preço por Litro"
        subtitle="Preço médio de compra por operação · comparação entre fornecedores"
        actions={
          <select
            value={combustivel}
            onChange={(e) => setCombustivel(e.target.value)}
            className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
          >
            {COMBUSTIVEIS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard
          label="Preço médio"
          value={brl(stats.medio)}
          hint="Por litro · ponderado pelo volume"
          icon={Tag}
          tone="default"
        />
        <KpiCard label="Menor preço" value={brl(stats.min)} hint="Mínimo registrado" icon={ArrowDown} tone="good" />
        <KpiCard label="Maior preço" value={brl(stats.max)} hint="Máximo registrado" icon={ArrowUp} tone="bad" />
        <KpiCard
          label="Amplitude"
          value={brl(stats.max - stats.min)}
          hint={`${stats.n} pontos`}
          icon={ChartScatter}
          tone="warn"
        />
      </div>

      <Card title="Preço médio por operação" subtitle="Ordenado do mais caro para o mais barato">
        {porOperacao.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, porOperacao.length * 32)}>
            <BarChart data={porOperacao} layout="vertical" margin={{ left: 10, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                stroke="#94a3b8"
                fontSize={11}
                tickFormatter={(v) => brl(v)}
                domain={[(min: number) => min * 0.95, (max: number) => max * 1.05]}
              />
              <YAxis type="category" dataKey="cc" width={180} stroke="#475569" fontSize={11} />
              <Tooltip
                formatter={(v: number) => brl(v) + '/L'}
                contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="precoMedio" radius={[0, 6, 6, 0]}>
                {porOperacao.map((r, i) => (
                  <Cell key={i} fill={barColor(r.precoMedio)} />
                ))}
                <LabelList
                  dataKey="precoMedio"
                  position="right"
                  formatter={(v: number) => brl(v)}
                  style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Ranking de fornecedores" subtitle="Menor preço médio (mínimo 50L no período)" className="mt-4">
        {porFornecedor.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-2.5 font-medium">#</th>
                  <th className="text-left px-5 py-2.5 font-medium">Estabelecimento</th>
                  <th className="text-left px-5 py-2.5 font-medium">Bandeira</th>
                  <th className="text-right px-5 py-2.5 font-medium">Transações</th>
                  <th className="text-right px-5 py-2.5 font-medium">Volume</th>
                  <th className="text-right px-5 py-2.5 font-medium">R$/L médio</th>
                </tr>
              </thead>
              <tbody>
                {porFornecedor.slice(0, 20).map((r, i) => (
                  <tr key={r.ec} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-5 py-2 font-medium text-slate-800">{r.ec}</td>
                    <td className="px-5 py-2 text-slate-500 text-xs">{r.bandeira || '—'}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{r.transacoes}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{lt(r.somaLitros)}</td>
                    <td className="px-5 py-2 text-right tabular-nums font-semibold">{brl(r.precoMedio)}</td>
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
