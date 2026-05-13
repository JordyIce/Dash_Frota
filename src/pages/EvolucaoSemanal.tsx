import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { brl, brlCompact, num, lt, kmL as fmtKmL, periodKey, periodLabel } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, LabelList,
} from 'recharts';
import { Card, EmptyState, PageHeader } from '@/components/UI';
import { KpiCard } from '@/components/KpiCard';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

export function EvolucaoSemanal() {
  const { data } = useData();
  const { filters } = useFilters();

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const combustivel = useMemo(() => onlyCombustivel(filtered), [filtered]);

  const semanas = useMemo(() => {
    interface S {
      k: string;
      label: string;
      gasto: number;
      litros: number;
      kmLPond: number;
      transacoes: number;
      abaixo: number;
    }
    const map = new Map<string, S>();
    for (const t of combustivel) {
      if (!t.dataTransacao) continue;
      const k = periodKey(t.dataTransacao, 'week');
      const e =
        map.get(k) ||
        ({ k, label: periodLabel(k, 'week'), gasto: 0, litros: 0, kmLPond: 0, transacoes: 0, abaixo: 0 } as S);
      e.gasto += t.valorTotal;
      e.litros += t.qtdMercadoria;
      e.transacoes++;
      if (t.descricaoDesvio === 'Desvio Abaixo') e.abaixo++;
      if (t.mediaEfetiva > 0 && t.qtdMercadoria > 0) e.kmLPond += t.mediaEfetiva * t.qtdMercadoria;
      map.set(k, e);
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        kmL: r.litros > 0 ? r.kmLPond / r.litros : 0,
        pctAbaixo: r.transacoes > 0 ? (r.abaixo / r.transacoes) * 100 : 0,
        precoMedio: r.litros > 0 ? r.gasto / r.litros : 0,
      }))
      .sort((a, b) => a.k.localeCompare(b.k));
  }, [combustivel]);

  // KPIs: comparação última vs penúltima semana
  const trend = useMemo(() => {
    if (semanas.length < 2) return null;
    const last = semanas[semanas.length - 1];
    const prev = semanas[semanas.length - 2];
    return {
      gastoDelta: prev.gasto > 0 ? ((last.gasto - prev.gasto) / prev.gasto) * 100 : 0,
      litrosDelta: prev.litros > 0 ? ((last.litros - prev.litros) / prev.litros) * 100 : 0,
      kmLDelta: prev.kmL > 0 ? ((last.kmL - prev.kmL) / prev.kmL) * 100 : 0,
      last,
      prev,
    };
  }, [semanas]);

  // média de KM/L (linha de referência)
  const mediaKmL = useMemo(() => {
    const valid = semanas.filter((s) => s.kmL > 0);
    if (valid.length === 0) return 0;
    const total = valid.reduce((s, x) => s + x.kmLPond, 0);
    const totalL = valid.reduce((s, x) => s + x.litros, 0);
    return totalL > 0 ? total / totalL : 0;
  }, [semanas]);

  return (
    <div>
      <PageHeader title="Evolução Semanal" subtitle="Tendência semana a semana — gasto, volume e KM/L" />

      {trend && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard
            label="Gasto última semana"
            value={brl(trend.last.gasto)}
            hint={`vs. ${brl(trend.prev.gasto)} semana anterior`}
            icon={trend.gastoDelta >= 0 ? TrendingUp : TrendingDown}
            tone={trend.gastoDelta > 0 ? 'bad' : 'good'}
            delta={{
              value: `${Math.abs(trend.gastoDelta).toFixed(1)}%`,
              positive: trend.gastoDelta < 0,
            }}
          />
          <KpiCard
            label="Volume última semana"
            value={lt(trend.last.litros)}
            hint={`vs. ${lt(trend.prev.litros)} semana anterior`}
            icon={Activity}
            tone="default"
            delta={{
              value: `${Math.abs(trend.litrosDelta).toFixed(1)}%`,
              positive: trend.litrosDelta < 0,
            }}
          />
          <KpiCard
            label="KM/L última semana"
            value={trend.last.kmL > 0 ? fmtKmL(trend.last.kmL) : '—'}
            hint={trend.prev.kmL > 0 ? `vs. ${fmtKmL(trend.prev.kmL)} semana anterior` : ''}
            icon={trend.kmLDelta >= 0 ? TrendingUp : TrendingDown}
            tone={trend.kmLDelta >= 0 ? 'good' : 'bad'}
            delta={{
              value: `${Math.abs(trend.kmLDelta).toFixed(1)}%`,
              positive: trend.kmLDelta >= 0,
            }}
          />
          <KpiCard
            label="% abaixo da meta"
            value={`${trend.last.pctAbaixo.toFixed(0)}%`}
            hint={`${trend.last.abaixo} de ${trend.last.transacoes} transações`}
            icon={TrendingDown}
            tone={trend.last.pctAbaixo >= 50 ? 'bad' : trend.last.pctAbaixo >= 25 ? 'warn' : 'good'}
          />
        </div>
      )}

      <Card title="Gasto e volume semanal">
        {semanas.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={semanas} margin={{ left: 10, right: 30, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="left" stroke="#1e6091" fontSize={11} tickFormatter={(v) => brlCompact(v)} />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#f59e0b"
                fontSize={11}
                tickFormatter={(v) => `${num(v, 0)}`}
              />
              <Tooltip
                formatter={(v: number, name: string) => {
                  if (name === 'Gasto') return brl(v);
                  return lt(v);
                }}
                contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="gasto" name="Gasto" stroke="#1e6091" strokeWidth={2.5} dot={{ r: 3 }}>
                <LabelList
                  dataKey="gasto"
                  position="top"
                  formatter={(v: number) => brlCompact(v)}
                  style={{ fontSize: 10, fill: '#1e6091', fontWeight: 600 }}
                />
              </Line>
              <Line yAxisId="right" type="monotone" dataKey="litros" name="Volume" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }}>
                <LabelList
                  dataKey="litros"
                  position="bottom"
                  formatter={(v: number) => `${num(v, 0)}L`}
                  style={{ fontSize: 10, fill: '#b45309', fontWeight: 600 }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="KM/L semanal" subtitle="Linha tracejada: média ponderada do período" className="mt-4">
        {semanas.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={semanas} margin={{ left: 10, right: 30, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#475569" fontSize={11} tickFormatter={(v) => num(v, 1)} />
              <Tooltip
                formatter={(v: number) => fmtKmL(v)}
                contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
              />
              {mediaKmL > 0 && (
                <ReferenceLine
                  y={mediaKmL}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: `Média ${fmtKmL(mediaKmL)}`, position: 'right', fontSize: 11, fill: '#64748b' }}
                />
              )}
              <Line type="monotone" dataKey="kmL" name="KM/L" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }}>
                <LabelList
                  dataKey="kmL"
                  position="top"
                  formatter={(v: number) => num(v, 2)}
                  style={{ fontSize: 10, fill: '#065f46', fontWeight: 600 }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
