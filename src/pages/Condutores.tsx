import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { kmL, num, lt, brl } from '@/lib/utils';
import { Card, EmptyState, PageHeader, Badge } from '@/components/UI';
import { KpiCard } from '@/components/KpiCard';
import { AlertTriangle, CheckCircle2, MinusCircle, UserX } from 'lucide-react';

export function Condutores() {
  const { data } = useData();
  const { filters } = useFilters();

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const combustivel = useMemo(() => onlyCombustivel(filtered), [filtered]);

  // Conta transações por motorista classificadas por desvio
  const ranking = useMemo(() => {
    interface R {
      motorista: string;
      cc: string;
      abaixo: number;
      acima: number;
      sem: number;
      total: number;
      litros: number;
      kmLPond: number;
      metaPond: number;
      gasto: number;
    }
    const map = new Map<string, R>();
    for (const t of combustivel) {
      const m = t.motorista || 'Sem motorista associado';
      const e =
        map.get(m) ||
        ({ motorista: m, cc: t.descricaoCC, abaixo: 0, acima: 0, sem: 0, total: 0, litros: 0, kmLPond: 0, metaPond: 0, gasto: 0 } as R);
      if (t.descricaoDesvio === 'Desvio Abaixo') e.abaixo++;
      else if (t.descricaoDesvio === 'Desvio Acima') e.acima++;
      else if (t.descricaoDesvio === 'Sem Desvio') e.sem++;
      e.total++;
      e.litros += t.qtdMercadoria;
      e.gasto += t.valorTotal;
      if (t.mediaEfetiva > 0 && t.qtdMercadoria > 0) e.kmLPond += t.mediaEfetiva * t.qtdMercadoria;
      if (t.rendimentoMedio > 0 && t.qtdMercadoria > 0) e.metaPond += t.rendimentoMedio * t.qtdMercadoria;
      map.set(m, e);
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        kmL: r.litros > 0 ? r.kmLPond / r.litros : 0,
        meta: r.litros > 0 ? r.metaPond / r.litros : 0,
        pctAbaixo: r.total > 0 ? (r.abaixo / r.total) * 100 : 0,
      }))
      .sort((a, b) => {
        // Prioriza maior número absoluto; em empate, maior %
        if (b.abaixo !== a.abaixo) return b.abaixo - a.abaixo;
        return b.pctAbaixo - a.pctAbaixo;
      });
  }, [combustivel]);

  const totals = useMemo(() => {
    let abaixo = 0, acima = 0, sem = 0;
    for (const t of combustivel) {
      if (t.descricaoDesvio === 'Desvio Abaixo') abaixo++;
      else if (t.descricaoDesvio === 'Desvio Acima') acima++;
      else if (t.descricaoDesvio === 'Sem Desvio') sem++;
    }
    return { abaixo, acima, sem, total: combustivel.length };
  }, [combustivel]);

  return (
    <div>
      <PageHeader
        title="Condutores"
        subtitle="Ranking de transações abaixo da meta de rendimento"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard
          label="Abaixo da meta"
          value={String(totals.abaixo)}
          hint={
            totals.total > 0
              ? `${((totals.abaixo / totals.total) * 100).toFixed(1)}% das transações`
              : ''
          }
          icon={AlertTriangle}
          tone="bad"
        />
        <KpiCard
          label="Acima da meta"
          value={String(totals.acima)}
          hint={
            totals.total > 0
              ? `${((totals.acima / totals.total) * 100).toFixed(1)}% das transações`
              : ''
          }
          icon={CheckCircle2}
          tone="good"
        />
        <KpiCard
          label="Sem desvio"
          value={String(totals.sem)}
          hint={
            totals.total > 0
              ? `${((totals.sem / totals.total) * 100).toFixed(1)}% das transações`
              : ''
          }
          icon={MinusCircle}
          tone="warn"
        />
        <KpiCard
          label="Total"
          value={String(totals.total)}
          hint="Transações no período"
          icon={UserX}
        />
      </div>

      <Card
        title="Motoristas com mais transações abaixo da meta"
        subtitle="Ordenado por nº absoluto · desempate por % do total"
      >
        {ranking.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-2.5 font-medium">#</th>
                  <th className="text-left px-5 py-2.5 font-medium">Motorista</th>
                  <th className="text-right px-5 py-2.5 font-medium">Abaixo</th>
                  <th className="text-right px-5 py-2.5 font-medium">Acima</th>
                  <th className="text-right px-5 py-2.5 font-medium">Sem desvio</th>
                  <th className="text-right px-5 py-2.5 font-medium">Total</th>
                  <th className="text-right px-5 py-2.5 font-medium">% Abaixo</th>
                  <th className="text-right px-5 py-2.5 font-medium">KM/L</th>
                  <th className="text-right px-5 py-2.5 font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => {
                  const tone = r.pctAbaixo >= 50 ? 'bad' : r.pctAbaixo >= 25 ? 'warn' : 'good';
                  return (
                    <tr key={r.motorista} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-5 py-2">
                        <div className="font-medium text-slate-800">{r.motorista}</div>
                        <div className="text-[11px] text-slate-500">{r.cc || '—'}</div>
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums font-semibold text-red-600">
                        {r.abaixo}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-emerald-600">{r.acima}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-500">{r.sem}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{r.total}</td>
                      <td className="px-5 py-2 text-right">
                        <Badge tone={tone}>{r.pctAbaixo.toFixed(0)}%</Badge>
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-600">
                        {r.kmL > 0 ? kmL(r.kmL) : '—'}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-600">
                        {lt(r.litros)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
