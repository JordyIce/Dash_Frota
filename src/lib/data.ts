import { parseCsv, csvToObjects } from './csv';
import { parseDate, parseNumber } from './utils';
import type { OciosoDia, OciosoRow, Transacao, VeloeRow } from './types';

/**
 * Tudo numa planilha só: "Painel Aderência - KPI Combustivel".
 * Abas usadas:
 *   - Base veloe (gid=101845243)  → transações Veloe + gerente já mapeado
 *   - Base ZUQ   (gid=1442572254) → telemetria diária (motor ocioso)
 */
const SHEET_ID = import.meta.env.VITE_SHEET_ID || '1va-mFQ0FjccgKqunvzEWuLAv4llMNkP8PzJo14ir9mk';
const GID_VELOE = import.meta.env.VITE_GID_VELOE || '101845243';
const GID_OCIOSO = import.meta.env.VITE_GID_OCIOSO || '1442572254';

export function getSheetCsvUrl(sheetId: string, gid: string | number): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/** Fetch da aba "Base veloe" da Painel Aderência. */
export async function fetchVeloeData(): Promise<Transacao[]> {
  const url = getSheetCsvUrl(SHEET_ID, GID_VELOE);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha na Base veloe: HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);
  // Linha 1 da Base veloe tem totalizadores/junk, header está na linha 2
  const raw = csvToObjects<VeloeRow>(rows, { skipRows: 1 });
  return raw.map(normalizeVeloeRow).filter((t) => t.placa);
}

/** Fetch da aba "Base ZUQ" da Painel Aderência. */
export async function fetchOciosoData(): Promise<OciosoDia[]> {
  const url = getSheetCsvUrl(SHEET_ID, GID_OCIOSO);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha na Base ZUQ: HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);
  const raw = csvToObjects<OciosoRow>(rows, { skipRows: 1 });
  return raw.map(normalizeOciosoRow).filter((r) => r.placa);
}

/**
 * Fetch das duas abas em paralelo.
 * O gerente vem direto da Base veloe; se ZUQ falhar, Veloe continua funcionando.
 */
export async function fetchAll(): Promise<{
  veloe: Transacao[];
  ocioso: OciosoDia[];
  placasGerente: Map<string, string>;
}> {
  const [veloe, ociosoResult] = await Promise.all([
    fetchVeloeData(),
    fetchOciosoData().catch((e) => {
      console.warn('Base ZUQ indisponível:', e);
      return []
