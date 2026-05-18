import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFilters } from '@/contexts/FiltersContext';
import { applyFilters } from '@/lib/filters';
import { onlyCombustivel } from '@/lib/data';
import { num } from '@/lib/utils';
import { Card, EmptyState, PageHeader } from '@/components/UI';

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function numShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace('.', ',')}M`;
  if (abs >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}K`;
  return num(n, 0);
}

interface Linha {
  gerente: string;
  metaMes: number;
  gastoMesesAnteriores: number[];
  metaD1: number;
  realizado: number;
  pctVsMetaD1: number;
  semanas: number[];
}

export function ResumoGerencial() {
  const { data, metasGerentes } = useData();
  const { filters } = useFilters();

  // Ignora filtro de data (a página tem lógica temporal própria) mas respeita os outros.
  const filtersSemData = useMemo(() => ({ ...filters, dataInicio: null, dataFim: null }), [filters]);
  const combustivel = useMemo(() => onlyCombustivel(applyFilters(data, filtersSemData)), [data, filtersSemData]);

  const referencia = useMemo(() => {
    let max: Date | null = null;
    for (const t of combustivel) {
      if (t.dataTransacao && (!max || t.dataTransacao > max)) max = t.dataTransacao;
    }
    return max || new Date();
  }, [combustivel]);

  const mesAtualIdx = referencia.getMonth();
  const anoAtual = referencia.getFullYear();
  const diaAtual = referencia.getDate();
  const diasNoMes = new Date(anoAtual, mesAtualIdx + 1, 0).getDate();
  const nomeMesAtual = MESES_NOMES[mesAtualIdx];

  const mesesAnteriores = useMemo(() => {
    const meses: { idx: number; nome: string }[] = [];
    for (let m = 0; m < mesAtualIdx; m++) {
      meses.push({ idx: m, nome: MESES_NOMES[m] });
    }
    return meses;
  }, [mesAtualIdx]);

  const linhas: Linha[] = useMemo(() => {
    interface Acc {
      gastoPorMes: Map<number, number>;
      gastoMesAtualPorSemana: number[];
      gastoMesAtualTotal: number;
    }
    const map = new Map<string, Acc>();

    function getAcc(gerente: string): Acc {
      let acc = map.get(gerente);
      if (!acc) {
        acc = {
          gastoPorMes: new Map(),
          gastoMesAtualPorSemana: [0, 0, 0, 0, 0],
          gastoMesAtualTotal: 0,
        };
        map.set(gerente, acc);
      }
      return acc;
    }

    for (const t of combustivel) {
      if (!t.dataTransacao || !t.gerente) continue;
      const gerente = t.gerente;
      const dt = t.dataTransacao;
      const ano = dt.getFullYear();
      const mes = dt.getMonth();
      if (ano !== anoAtual) continue;
      const v = t.valorTotal || 0;
      const acc = getAcc(gerente);

      acc.gastoPorMes.set(mes, (acc.gastoPorMes.get(mes) || 0) + v);

      if (mes === mesAtualIdx) {
        acc.gastoMesAtualTotal += v;
        const dia = dt.getDate();
        const semanaIdx = Math.min(Math.floor((dia - 1) / 7), 4);
        acc.gastoMesAtualPorSemana[semanaIdx] += v;
      }
    }

    const todosGerentes = new Set<string>([
      ...metasGerentes.keys(),
      ...map.keys(),
    ]);

    const resultado: Linha[] = [];
    for (const gerente of todosGerentes) {
      const acc = map.get(gerente) || {
        gastoPorMes: new Map<number, number>(),
        gastoMesAtualPorSemana: [0, 0, 0, 0, 0],
        gastoMesAtualTotal: 0,
      };
      const metaMes = metasGerentes.get(gerente) || 0;
      const metaD1 = metaMes > 0 && diasNoMes > 0
        ? (metaMes * Math.max(diaAtual - 1, 0)) / diasNoMes
        : 0;
      const realizado = acc.gastoMesAtualTotal;
      const pctVsMetaD1 = metaD1 > 0 ? ((realizado - metaD1) / metaD1) * 100 : 0;

      resultado.push({
        gerente,
        metaMes,
        gastoMesesAnteriores: mesesAnteriores.map((m) => acc.gastoPorMes.get(m.idx) || 0),
        metaD1,
        realizado,
        pctVsMetaD1,
        semanas: acc.gastoMesAtualPorSemana,
      });
    }

    return resultado
      .filter((l) => l.metaMes > 0 || l.realizado > 0)
      .sort((a, b) => b.realizado - a.realizado);
  }, [combustivel, metasGerentes, mesAtualIdx, anoAtual, diaAtual, diasNoMes, mesesAnteriores]);

  const totalGeral = useMemo(() => {
    const total = {
      metaMes: 0,
      gastoMesesAnteriores: mesesAnteriores.map(() => 0),
      metaD1: 0,
      realizado: 0,
      pctVsMetaD1: 0,
      semanas: [0, 0, 0, 0, 0],
    };
    for (const l of linhas) {
      total.metaMes += l.metaMes;
      total.metaD1 += l.metaD1;
      total.realizado += l.realizado;
      l.gastoMesesAnteriores.forEach((v, i) => (total.gastoMesesAnteriores[i] += v));
      l.semanas.forEach((v, i) => (total.semanas[i] += v));
    }
    total.pctVsMetaD1 = total.metaD1 > 0 ? ((total.realizado - total.metaD1) / total.metaD1) * 100 : 0;
    return total;
  }, [linhas, mesesAnteriores]);

  const pctClass = (v: number) =>
    v <= 0 ? 'text-emerald-700' :
    v <= 10 ? 'text-amber-700' :
    'text-red-700';

  const rgkBg = (idx: number) => {
    if (idx === 0) return 'bg-red-200 text-red-900';
    if (idx === 1) return 'bg-red-100 text-red-900';
    if (idx === 2) return 'bg-orange-100 text-orange-900';
    if (idx <= 5) return 'bg-amber-50 text-amber-900';
    return 'bg-emerald-50 text-emerald-900';
  };

  if (linhas.length === 0) {
    return (
      <div>
        <PageHeader title="Resumo Gerencial" subtitle="Orçamento Combustíveis · Ranking por gerente" />
        <Card title="Sem dados">
          <EmptyState message="Não foi possível carregar dados de gasto ou metas. Verifique se a aba Track Orçamento está acessível." />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Resumo Gerencial"
        subtitle={`Orçamento Combustíveis · Mês de referência: ${nomeMesAtual}/${anoAtual} · Meta d-1 = proporcional até dia ${diaAtual - 1} · Metas via Track Orçamento`}
      />

      <Card title={`Ranking Gerencial Orçamento — ${nomeMesAtual}/${anoAtual}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] tabular-nums">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="text-center px-2 py-2 font-semibold whitespace-nowrap">Rgk</th>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Gerente</th>
                <th className="text-right px-2 py-2 font-semibold whitespace-nowrap bg-blue-50 text-blue-900">
                  Meta {nomeMesAtual}
                </th>
                {mesesAnteriores.map((m) => (
                  <th key={m.idx} className="text-right px-2 py-2 font-semibold whitespace-nowrap text-slate-500">
                    {m.nome}
                  </th>
                ))}
                <th className="text-right px-2 py-2 font-semibold whitespace-nowrap bg-amber-50 text-amber-900">
                  Meta d-1
                </th>
                <th className="text-right px-2 py-2 font-semibold whitespace-nowrap bg-amber-50 text-amber-900">
                  Realizado
                </th>
                <th className="text-right px-2 py-2 font-semibold whitespace-nowrap bg-amber-50 text-amber-900">
                  %
                </th>
                {[1, 2, 3, 4, 5].map((n) => (
                  <th key={n} className="text-right px-2 py-2 font-semibold whitespace-nowrap text-slate-500">
                    Semana {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.gerente} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className={`text-center px-2 py-1.5 font-bold whitespace-nowrap ${rgkBg(i)}`}>
                    {i + 1}
                  </td>
                  <td className="text-left px-3 py-1.5 font-medium text-slate-800 whitespace-nowrap">
                    {l.gerente}
                  </td>
                  <td className="text-right px-2 py-1.5 bg-blue-50 font-semibold text-slate-900 whitespace-nowrap">
                    {l.metaMes > 0 ? numShort(l.metaMes) : '—'}
                  </td>
                  {l.gastoMesesAnteriores.map((v, mIdx) => (
                    <td key={mIdx} className="text-right px-2 py-1.5 text-slate-600 whitespace-nowrap">
                      {v > 0 ? numShort(v) : '—'}
                    </td>
                  ))}
                  <td className="text-right px-2 py-1.5 bg-amber-50 text-slate-700 whitespace-nowrap">
                    {l.metaD1 > 0 ? numShort(l.metaD1) : '—'}
                  </td>
                  <td className="text-right px-2 py-1.5 bg-amber-50 font-semibold text-slate-900 whitespace-nowrap">
                    {l.realizado > 0 ? numShort(l.realizado) : '—'}
                  </td>
                  <td className={`text-right px-2 py-1.5 bg-amber-50 font-semibold whitespace-nowrap ${pctClass(l.pctVsMetaD1)}`}>
                    {l.metaD1 > 0 ? `${num(l.pctVsMetaD1, 0)}%` : '—'}
                  </td>
                  {l.semanas.map((v, sIdx) => (
                    <td key={sIdx} className="text-right px-2 py-1.5 text-slate-600 whitespace-nowrap">
                      {v > 0 ? numShort(v) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                <td className="px-2 py-2"></td>
                <td className="text-left px-3 py-2 whitespace-nowrap">Total Geral</td>
                <td className="text-right px-2 py-2 bg-blue-100 text-blue-900 whitespace-nowrap">
                  {numShort(totalGeral.metaMes)}
                </td>
                {totalGeral.gastoMesesAnteriores.map((v, mIdx) => (
                  <td key={mIdx} className="text-right px-2 py-2 whitespace-nowrap">
                    {numShort(v)}
                  </td>
                ))}
                <td className="text-right px-2 py-2 bg-amber-100 text-amber-900 whitespace-nowrap">
                  {numShort(totalGeral.metaD1)}
                </td>
                <td className="text-right px-2 py-2 bg-amber-100 text-amber-900 whitespace-nowrap">
                  {numShort(totalGeral.realizado)}
                </td>
                <td className={`text-right px-2 py-2 bg-amber-100 font-semibold whitespace-nowrap ${pctClass(totalGeral.pctVsMetaD1)}`}>
                  {totalGeral.metaD1 > 0 ? `${num(totalGeral.pctVsMetaD1, 0)}%` : '—'}
                </td>
                {totalGeral.semanas.map((v, sIdx) => (
                  <td key={sIdx} className="text-right px-2 py-2 whitespace-nowrap">
                    {v > 0 ? numShort(v) : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
