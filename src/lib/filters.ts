import type { FilterState, Transacao } from './types';

/** Aplica os filtros globais à lista de transações. */
export function applyFilters(rows: Transacao[], f: FilterState): Transacao[] {
  return rows.filter((t) => {
    if (f.centroCusto.length > 0 && !f.centroCusto.includes(t.descricaoCC)) return false;
    if (f.gerente.length > 0 && !f.gerente.includes(t.gerente)) return false;
    if (f.tipoCarro.length > 0 && !f.tipoCarro.includes(t.perfilUso)) return false;
    if (f.grupoCarro.length > 0 && !f.grupoCarro.includes(t.tipoFrota)) return false;
    if (f.dataInicio || f.dataFim) {
      if (!t.dataTransacao) return false;
      const d = t.dataTransacao.getTime();
      if (f.dataInicio && d < f.dataInicio.getTime()) return false;
      if (f.dataFim) {
        // inclusivo: fim do dia
        const end = new Date(f.dataFim);
        end.setHours(23, 59, 59, 999);
        if (d > end.getTime()) return false;
      }
    }
    return true;
  });
}

/** Conta quantos filtros estão ativos (pra badge no botão). */
export function activeFilterCount(f: FilterState): number {
  let n = 0;
  if (f.centroCusto.length) n++;
  if (f.gerente.length) n++;
  if (f.tipoCarro.length) n++;
  if (f.grupoCarro.length) n++;
  if (f.dataInicio || f.dataFim) n++;
  return n;
}

/**
 * Aplica os filtros globais à lista de Motor Ocioso (Base ZUQ).
 * Mapeamento dos filtros:
 *   - gerente   → gerente (real, vem direto da ZUQ)
 *   - tipoCarro → grupo   (Pick-Up, Caminhao Sky, etc — equivalente ao "Perfil de uso" da Veloe)
 *   - centroCusto → operacao contém o nome do CC
 *   - data → data
 *   - grupoCarro → não aplicável (ZUQ não tem tipo de frota); ignorado
 */
export function applyFiltersOcioso(
  rows: import('./types').OciosoDia[],
  f: FilterState,
): import('./types').OciosoDia[] {
  return rows.filter((o) => {
    if (f.gerente.length > 0 && !f.gerente.includes(o.gerente)) return false;
    if (f.tipoCarro.length > 0 && !f.tipoCarro.includes(o.grupo)) return false;
    if (f.centroCusto.length > 0) {
      // operacao formato "141020202 - Multiservicos Itapaje"
      // filtro tem o nome do CC ou similar; checa se algum filtro está na operação
      const op = o.operacao.toLowerCase();
      const match = f.centroCusto.some((cc) => op.includes(cc.toLowerCase()));
      if (!match) return false;
    }
    if (f.dataInicio || f.dataFim) {
      if (!o.data) return false;
      const d = o.data.getTime();
      if (f.dataInicio && d < f.dataInicio.getTime()) return false;
      if (f.dataFim) {
        const end = new Date(f.dataFim);
        end.setHours(23, 59, 59, 999);
        if (d > end.getTime()) return false;
      }
    }
    return true;
  });
}
