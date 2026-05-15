import type { FilterState, OciosoDia, Transacao } from './types';

/** Aplica os filtros globais à lista de transações. */
export function applyFilters(rows: Transacao[], f: FilterState): Transacao[] {
  return rows.filter((t) => {
    if (f.centroCusto.length > 0 && !f.centroCusto.includes(t.descricaoCC)) return false;
    if (f.gerente.length > 0 && !f.gerente.includes(t.gerente)) return false;
    // Tipo do Carro agora usa a coluna "Para" (categoriaVeiculo): Pick-Up Leve, Caminhao Sky, etc
    if (f.tipoCarro.length > 0 && !f.tipoCarro.includes(t.categoriaVeiculo)) return false;
    // Combustível: Gasolina / Diesel S10 / Arla (coluna "Tipo")
    if (f.combustivel.length > 0 && !f.combustivel.includes(t.combustivel)) return false;
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
  if (f.combustivel.length) n++;
  if (f.dataInicio || f.dataFim) n++;
  return n;
}

/**
 * Aplica os filtros globais à lista de Motor Ocioso (Base ZUQ).
 * Mapeamento dos filtros:
 *   - gerente   → gerente (real, vem direto da ZUQ)
 *   - tipoCarro → grupo   (Pick-Up, Caminhao Sky, etc)
 *   - centroCusto → operacao contém o nome do CC
 *   - data → data
 *   - combustivel → não aplicável (ZUQ não tem combustível por dia); ignorado
 */
export function applyFiltersOcioso(rows: OciosoDia[], f: FilterState): OciosoDia[] {
  return rows.filter((o) => {
    if (f.gerente.length > 0 && !f.gerente.includes(o.gerente)) return false;
    if (f.tipoCarro.length > 0 && !f.tipoCarro.includes(o.grupo)) return false;
    if (f.centroCusto.length > 0) {
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
