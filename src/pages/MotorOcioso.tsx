import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFiltersOcioso } from '@/lib/filters';
import { num, periodKey, periodLabel, fmtDate } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Cell, LabelList,
} from 'recharts';
import { Card, EmptyState, PageHeader, Badge } from '@/components/UI';
import { KpiCard } from '@/components/KpiCard';
import { Gauge, Clock, Activity } from 'lucide-react';

type GroupBy = 'gerente' | 'operacao' | 'grupo';

export function MotorOcioso() {
  const { ocioso } = useData();
  const { filters } = useFilters();
  const [groupBy, setGroupBy] = useState<GroupBy>('gerente');

  const filtered = useMemo(() => applyFiltersOcioso(ocioso, filters), [ocioso, filters]);

  // KPIs gerais
  const stats = useMemo(() => {
    const totalHoras = filtered.reduce((s, o) => s + o.motorOciosoHoras, 0);
    const totalLigado = filtered.reduce((s, o) => s + o.ligadoMin, 0) / 60;
    const dias = filtered.length;
    const mediaPorDia = dias > 0 ? totalHoras / dias : 0;
    const pctOcioso = totalLigado > 0 ? (totalHoras / totalLigado) * 100 : 0;
    return { totalHoras, totalLigado, dias, mediaPorDia, pctOcioso };
  }, [filtered]);

  // Ranking por grouping
  const ranking = useMemo(() => {
    interface R {
      key: string;
      somaOcioso: number;
      somaLigado: number;
      dias: number;
      placasUnicas: Set<string>;
    }
    const map = new Map<string, R>();
    for (const o of filtered) {
      const key =
        groupBy === 'gerente'
          ? o.gerente || 'Sem gerente'
          : groupBy === 'operacao'
          ? o.operacao || 'Sem operação'
          : o.grupo || 'Sem grupo';
      const e =
        map.get(key) ||
        ({ key, somaOcioso: 0, somaLigado: 0, dias: 0, placasUnicas: new Set<string>() } as R);
      e.somaOcioso += o.motorOciosoHoras;
      e.somaLigado += o.ligadoMin / 60;
      e.dias++;
      if (o.placa) e.placasUnicas.add(o.placa);
      map.set(key, e);
    }
    return Array.from(map.values())
      .map((r) => ({
        key: r.key,
        ocioso: r.somaOcioso,
        ligado: r.somaLigado,
        dias: r.dias,
        placas: r.placasUnicas.size,
        media: r.dias > 0 ? r.somaOcioso / r.dias : 0,
        pctOcioso: r.somaLigado > 0 ? (r.somaOcioso / r.somaLigado) * 100 : 0,
      }))
      .sort((a, b) => b.ocioso - a.ocioso);
  }, [filtered, groupBy]);

  // Piores placas
  const pioresPlacas = useMemo(() => {
    interface P {
      placa: string;
      somaOcioso: number;
      somaLigado: number;
      dias: number;
      gerente: string;
      grupo: string;
      operacao: string;
    }
    const map = new Map<string, P>();
    for (const o of filtered) {
      if (!o.placa) continue;
      const e =
        map.get(o.placa) ||
        ({
          placa: o.placa,
          somaOcioso: 0,
          somaLigado: 0,
          dias: 0,
          gerente: o.gerente,
          grupo: o.grupo,
          operacao: o.operacao,
        } as P);
      e.somaOcioso += o.motorOciosoHoras;
      e.somaLigado += o.ligadoMin / 60;
      e.dias++;
      map.set(o.placa, e);
    }
    return Array.from(map.values())
      .map((p) => ({
        ...p,
        media: p.dias > 0 ? p.somaOcioso / p.dias : 0,
        pctOcioso: p.somaLigado > 0 ? (p.somaOcioso / p.somaLigado) * 100 : 0,
      }))
      .filter((p) => p.somaOcioso > 0)
      .sort((a, b) => b.somaOcioso - a.somaOcioso)
      .slice(0, 20);
  }, [filtered]);

  // Evolução semanal
  const semanas = useMemo(() => {
    const map = new Map<string, { k: string; label: string; horas: number; placas: Set<string> }>();
    for (const o of filtered) {
      if (!o.data) continue;
      const k = periodKey(o.data, 'week');
      const e = map.get(k) || { k, label: periodLabel(k, 'week'), horas: 0, placas: new Set<string>() };
      e.horas += o.motorOciosoHoras;
      if (o.placa) e.placas.add(o.placa);
      map.set(k, e);
    }
    return Array.from(map.values())
      .map((s) => ({ k: s.k, label: s.label, horas: s.horas, placas: s.placas.size }))
      .sort((a, b) => a.k.localeCompare(b.k));
  }, [filtered]);

  const mediaSemanal =
    semanas.length > 0 ? semanas.reduce((s, x) => s + x.horas, 0) / semanas.length : 0;

  // período coberto
  const periodo = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const o of filtered) {
      if (!o.data) continue;
      if (!min || o.data < min) min = o.data;
      if (!max || o.data > max) max = o.data;
    }
    return { min, max };
  }, [filtered]);

  function barColor(h: number, max: number) {
    if (max === 0) return '#1e6091';
    const t = Math.min(h / max, 1);
    const r = Math.round(16 + (239 - 16) * t);
    const g = Math.round(185 + (68 - 185) * t);
    const b = Math.round(129 + (68 - 129) * t);
    return `rgb(${r},${g},${b})`;
  }
  const maxRanking = ranking.length > 0 ? ranking[0].ocioso : 0;

  if (filtered.length === 0) {
    return (
      <div>
        <PageHeader title="Motor Ocioso" subtitle="Telemetria via Base ZUQ" />
        <Card>
          <EmptyState
            title="Sem dados de telemetria"
            message="A Base ZUQ pode estar vazia, sem permissão de acesso, ou os filtros aplicados não retornam resultados."
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Motor Ocioso"
        subtitle={`Telemetria · ${fmtDate(periodo.min)} → ${fmtDate(periodo.max)}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <KpiCard
          label="Total motor ocioso"
          value={`${num(stats.totalHoras, 1)} h`}
          hint={`em ${stats.dias} dia-veículo`}
          icon={Clock}
          tone="bad"
        />
        <KpiCard
          label="% do tempo ligado"
          value={`${num(stats.pctOcioso, 1)}%`}
          hint={`Ligado: ${num(stats.totalLigado, 0)} h`}
          icon={Gauge}
          tone={stats.pctOcioso >= 30 ? 'bad' : stats.pctOcioso >= 15 ? 'warn' : 'good'}
        />
        <KpiCard
          label="Média por dia"
          value={`${num(stats.mediaPorDia, 2)} h`}
          hint="Por veículo, por dia"
          icon={Activity}
          tone="warn"
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800">Ranking por:</h2>
        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
          {(['gerente', 'operacao', 'grupo'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                groupBy === g
                  ? 'bg-beq-blue text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {g === 'gerente' ? 'Gerência' : g === 'operacao' ? 'Operação' : 'Grupo'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Horas de motor ocioso" subtitle="Ordenado do pior para o melhor">
          <ResponsiveContainer width="100%" height={Math.max(280, ranking.length * 32)}>
            <BarChart data={ranking} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${num(v, 0)}h`} />
              <YAxis type="category" dataKey="key" width={170} stroke="#475569" fontSize={11} />
              <Tooltip
                formatter={(v: number) => `${num(v, 1)} h`}
                contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="ocioso" radius={[0, 6, 6, 0]}>
                {ranking.map((r, i) => (
                  <Cell key={i} fill={barColor(r.ocioso, maxRanking)} />
                ))}
                <LabelList
                  dataKey="ocioso"
                  position="right"
                  formatter={(v: number) => `${num(v, 1)}h`}
                  style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Detalhamento" subtitle={`${ranking.length} ${groupBy === 'gerente' ? 'gerentes' : groupBy === 'operacao' ? 'operações' : 'grupos'}`}>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-2.5 font-medium">#</th>
                  <th className="text-left px-5 py-2.5 font-medium">
                    {groupBy === 'gerente' ? 'Gerência' : groupBy === 'operacao' ? 'Operação' : 'Grupo'}
                  </th>
                  <th className="text-right px-5 py-2.5 font-medium">Horas</th>
                  <th className="text-right px-5 py-2.5 font-medium">% Lig.</th>
                  <th className="text-right px-5 py-2.5 font-medium">Placas</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => {
                  const tone = r.pctOcioso >= 30 ? 'bad' : r.pctOcioso >= 15 ? 'warn' : 'good';
                  return (
                    <tr key={r.key} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-5 py-2 font-medium text-slate-800 truncate max-w-xs">{r.key}</td>
                      <td className="px-5 py-2 text-right tabular-nums font-semibold">{num(r.ocioso, 1)}h</td>
                      <td className="px-5 py-2 text-right">
                        <Badge tone={tone}>{num(r.pctOcioso, 0)}%</Badge>
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-600">{r.placas}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Piores placas" subtitle="Top 20 veículos com mais horas de motor ocioso no período" className="mt-4">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-2.5 font-medium">#</th>
                <th className="text-left px-5 py-2.5 font-medium">Placa</th>
                <th className="text-left px-5 py-2.5 font-medium">Gerência</th>
                <th className="text-left px-5 py-2.5 font-medium">Operação</th>
                <th className="text-right px-5 py-2.5 font-medium">Total</th>
                <th className="text-right px-5 py-2.5 font-medium">Média/dia</th>
                <th className="text-right px-5 py-2.5 font-medium">% Lig.</th>
              </tr>
            </thead>
            <tbody>
              {pioresPlacas.map((p, i) => {
                const tone = p.pctOcioso >= 30 ? 'bad' : p.pctOcioso >= 15 ? 'warn' : 'good';
                return (
                  <tr key={p.placa} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-5 py-2 font-mono font-semibold text-slate-800">{p.placa}</td>
                    <td className="px-5 py-2 text-slate-600">{p.gerente}</td>
                    <td className="px-5 py-2 text-slate-500 text-xs truncate max-w-xs">{p.operacao}</td>
                    <td className="px-5 py-2 text-right tabular-nums font-semibold text-red-600">
                      {num(p.somaOcioso, 1)}h
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums text-slate-600">
                      {num(p.media, 2)}h
                    </td>
                    <td className="px-5 py-2 text-right">
                      <Badge tone={tone}>{num(p.pctOcioso, 0)}%</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Evolução semanal" subtitle="Horas de motor ocioso · linha tracejada = média do período" className="mt-4">
        {semanas.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={semanas} margin={{ left: 10, right: 30, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#475569" fontSize={11} tickFormatter={(v) => `${num(v, 0)}h`} />
              <Tooltip
                formatter={(v: number, name: string) => {
                  if (name === 'Horas ociosas') return `${num(v, 1)} h`;
                  return v;
                }}
                contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
              />
              {mediaSemanal > 0 && (
                <ReferenceLine
                  y={mediaSemanal}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{
                    value: `Média ${num(mediaSemanal, 0)}h`,
                    position: 'right',
                    fontSize: 11,
                    fill: '#64748b',
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="horas"
                name="Horas ociosas"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#ef4444' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
