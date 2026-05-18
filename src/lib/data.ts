import { parseCsv, csvToObjects } from './csv';
import { parseDate, parseNumber } from './utils';
import type { OciosoDia, OciosoRow, Transacao, VeloeRow } from './types';

/**
 * Painel Aderência - KPI Combustivel (Google Sheets nativo).
 * Abas:
 *   - Base veloe       (gid=101845243)  → transações Veloe
 *   - Base ZUQ         (gid=1442572254) → telemetria diária + lookup placa→gerente/grupo
 *   - Track Orçamento  (gid=571916323)  → metas mensais por gerente
 */
const SHEET_ID = import.meta.env.VITE_SHEET_ID || '1va-mFQ0FjccgKqunvzEWuLAv4llMNkP8PzJo14ir9mk';
const GID_VELOE = import.meta.env.VITE_GID_VELOE || '101845243';
const GID_OCIOSO = import.meta.env.VITE_GID_OCIOSO || '1442572254';
const GID_METAS = import.meta.env.VITE_GID_METAS || '571916
