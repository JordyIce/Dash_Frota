import type { FilterState } from './types';

/** Parse numérico que aceita "1.234,56" e "1,234.56" */
export function parseNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let s = String(v).trim();
  if (s === '' || s === '-' || s === '#N/A' || s === '#REF!' || s === '#VALOR!') return 0;
  // Remove R$, %, espaços, etc.
  s = s.replace(/[R$\s%]/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // Decide qual é decimal pelo último símbolo
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // formato BR: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // formato US: 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // só vírgula: assume decimal BR (1234,56 → 1234.56)
    s = s.replace(',', '.');
  }
  // só ponto: já é decimal

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Deduplica array preservando ordem */
export function unique<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

/** Pequena utilitária pra somar */
export function sum(arr: number[]): number {
  let s = 0;
  for (const x of arr) s += x;
  return s;
}

/**
 * Tipo de formato de data quando ambíguo (ambos números <= 12).
 *  - 'mdy' → MM/DD/YYYY (americano, default do Google Sheets CSV export)
 *  - 'dmy' → DD/MM/YYYY (brasileiro)
 */
export type DateFormat = 'auto' | 'mdy' | 'dmy';

/**
 * Detecta o formato dominante (DD/MM ou MM/DD) varrendo uma lista de strings de data.
 * Conta quantas têm evidência inequívoca (primeiro > 12 → DMY, segundo > 12 → MDY)
 * e retorna o vencedor. Empate ou nada decisivo → 'mdy' (default Google Sheets).
 */
export function detectDateFormat(samples: (string | null | undefined)[]): DateFormat {
  let dmyVotes = 0;
  let mdyVotes = 0;
  for (const v of samples) {
    if (!v) continue;
    const s = String(v).trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}/);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a > 12 && b <= 12) dmyVotes++;
    else if (b > 12 && a <= 12) mdyVotes++;
  }
  if (dmyVotes > mdyVotes) return 'dmy';
  if (mdyVotes > dmyVotes) return 'mdy';
  return 'mdy';
}

export function parseDate(v: string | null | undefined, fmt: DateFormat = 'mdy'): Date | null {
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
      // primeiro número é dia (DD/MM/YYYY) — inequívoco
      day = a;
      month = b - 1;
    } else if (b > 12 && a <= 12) {
      // segundo número é dia (MM/DD/YYYY) — inequívoco
      month = a - 1;
      day = b;
    } else if (a > 12 && b > 12) {
      // impossível em qualquer formato
      return null;
    } else {
      // ambos <= 12: ambíguo. Usa o formato informado.
      if (fmt === 'dmy') {
        day = a;
        month = b - 1;
      } else {
        // 'mdy' (default) ou 'auto' não resolvido cai aqui
        month = a - 1;
        day = b;
      }
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

/** BRL compacto pra valores grandes (R$ 1,2 mi / R$ 850 mil) */
export function brlCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  }
  if (abs >= 1_000) {
    return `R$ ${(n / 1_000).toFixed(1).replace('.', ',')} mil`;
  }
  return brl(n);
}

/** Format pt-BR pra inteiro com separador de milhar */
export function num(n: number, casas = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(n);
}

/** Format litros — 1.234,5 L */
export function lt(n: number): string {
  return `${num(n, 1)} L`;
}

/** Format km/L */
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

/** Semana ISO 8601 — usa quinta-feira como âncora */
export function isoWeekOf(d: Date): { isoYear: number; isoWeek: number } {
  const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // joga pra quinta-feira da semana corrente
  const day = (tmp.getDay() + 6) % 7; // segunda = 0, domingo = 6
  tmp.setDate(tmp.getDate() - day + 3);
  const isoYear = tmp.getFullYear();
  const week1 = new Date(isoYear, 0, 4);
  const week1Day = (week1.getDay() + 6) % 7;
  week1.setDate(week1.getDate() - week1Day + 3);
  const diff = tmp.getTime() - week1.getTime();
  const isoWeek = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return { isoYear, isoWeek };
}

/** Format label de período pra eixo de gráfico */
export function periodLabel(key: string, g: Granularity): string {
  if (g === 'day') {
    const [y, m, d] = key.split('-');
    return `${d}/${m}`;
  }
  if (g === 'week') {
    const [, w] = key.split('-W');
    return `Sem ${w}`;
  }
  if (g === 'month') {
    const [, m] = key.split('-');
    const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return nomes[parseInt(m, 10) - 1] || key;
  }
  return key;
}

/** Constrói FilterState vazio */
export function emptyFilterState(): FilterState {
  return {
    centroCusto: [],
    gerente: [],
    tipoCarro: [],
    combustivel: [],
    dataInicio: null,
    dataFim: null,
  };
}
