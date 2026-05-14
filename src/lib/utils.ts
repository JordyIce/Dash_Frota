/**
 * Helpers de formatação e parsing.
 * Todos os números vêm como string do Sheets (formato pt-BR: "5,99" ou "1,234.56" dependendo da config).
 */

/** Parse número aceitando "5,99", "5.99", "1.234,56", "1,234.56", "", "-". */
export function parseNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'n/a') return 0;

  // remove espaços e símbolos comuns
  s = s.replace(/\s/g, '').replace(/R\$/gi, '');

  // detecta formato: se tem vírgula E ponto, o último separador é o decimal
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma === -1 && lastDot === -1) {
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }

  if (lastComma > lastDot) {
    // formato pt-BR: 1.234,56 → 1234.56
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // formato en-US: 1,234.56 → 1234.56
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

/**
 * Parse data.
 *
 * IMPORTANTE: o Google Sheets quando exportado via `/export?format=csv` muitas vezes
 * serializa datas no formato AMERICANO `M/D/YY` ou `M/D/YYYY` mesmo quando a célula
 * é exibida como DD/MM/YYYY na interface. Isso depende da locale do contrato Google.
 * Confirmado para o B&Q: célula mostra "5/10/26 11:04" mas a barra de fórmulas
 * mostra "5/10/2026 11:04:44" — ou seja, mês = 5 (maio), dia = 10.
 *
 * Estratégia: quando vier no formato `N/N/N[ HH:MM[:SS]]`:
 *   - Se primeiro número > 12 → tem que ser DD/MM (americano não pode ter dia > 12 no mês)
 *   - Se segundo número > 12 → tem que ser MM/DD (americano)
 *   - Se ambos <= 12 (ambíguo) → DEFAULT MM/DD/YYYY (Sheets export)
 *
 * Também aceita ISO `YYYY-MM-DD ...` sem ambiguidade.
 *
 * Retorna null se inválido.
 */
export function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (s === '') return null;

  // ISO-ish (YYYY-MM-DD ...)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // N/N/N com hora opcional
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const hour = m[4] ? parseInt(m[4], 10) : 0;
    const min = m[5] ? parseInt(m[5], 10) : 0;
    const sec = m[6] ? parseInt(m[6], 10) : 0;

    let day: number;
    let month: number;
    if (a > 12 && b <= 12) {
      // primeiro número é dia (DD/MM/YYYY)
      day = a;
      month = b - 1;
    } else if (b > 12 && a <= 12) {
      // segundo número é dia (MM/DD/YYYY)
      month = a - 1;
      day = b;
    } else if (a > 12 && b > 12) {
      // impossível em qualquer formato
      return null;
    } else {
      // ambos <= 12: ambíguo. DEFAULT MM/DD/YYYY (Google Sheets CSV export)
      month = a - 1;
      day = b;
    }

    const d = new Date(year, month, day, hour, min, sec);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Format BRL — R$ 1.234,56 */
export function brl(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Format BRL compacto — R$ 1,2 mil / R$ 1,2 mi */
export function brlCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace('.', ',')} mi`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace('.', ',')} mil`;
  return brl(n);
}

/** Format número com casas decimais e separador pt-BR */
export function num(n: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** Format inteiro com separador de milhar */
export function int(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n));
}

/** Format percentual: 0.12 → "12,0%" */
export function pct(n: number, decimals = 1): string {
  return `${num(n * 100, decimals)}%`;
}

/** Format litros: "1.234,5 L" */
export function lt(n: number): string {
  return `${num(n, 1)} L`;
}

/** Format KM/L */
export function kmL(n: number): string {
  return `${num(n, 2)} km/L`;
}

/** Format date pt-BR */
export function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
}

/** Date → YYYY-MM-DD (input[type=date]) */
export function toInputDate(d: Date | null): string {
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** "YYYY-MM-DD" → Date (input[type=date]) */
export function fromInputDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

/** Início da semana (segunda) */
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Início do mês */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Chave temporal estável (yyyy-mm-dd, yyyy-Www, yyyy-mm, yyyy) */
export type Granularity = 'day' | 'week' | 'month' | 'year';
export function periodKey(d: Date, g: Granularity): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (g === 'day') return `${yyyy}-${mm}-${dd}`;
  if (g === 'month') return `${yyyy}-${mm}`;
  if (g === 'year') return `${yyyy}`;
  // week — ISO 8601 (semana começa na segunda; semana 1 é a que contém a 1ª quinta-feira do ano)
  const { isoYear, isoWeek } = isoWeekOf(d);
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
}

/**
 * Cálculo ISO 8601 de número de semana e ano-semana.
 * Detalhes do algoritmo:
 *   1. Move a data pra quinta-feira da mesma semana (ISO usa quinta como "ancora")
 *   2. O ano-semana é o ano dessa quinta-feira (resolve casos onde semana cruza ano)
 *   3. Semana = ceil(((quinta - 1ºJan do ano-semana) / 7 dias) + 1)
 * Garante 1-53 (nunca 0 nem 54+).
 */
function isoWeekOf(date: Date): { isoYear: number; isoWeek: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO: dia da semana 1=segunda ... 7=domingo
  const dayNum = d.getUTCDay() || 7;
  // pula pra quinta-feira dessa semana ISO
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear, isoWeek };
}

/** Label legível pra um periodKey */
export function periodLabel(key: string, g: Granularity): string {
  if (g === 'day') {
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  }
  if (g === 'month') {
    const [y, m] = key.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
  }
  if (g === 'year') return key;
  // week
  return key.replace('-W', ' Sem ');
}

/** Únicos preservando ordem de aparição, sem strings vazias */
export function unique(arr: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
