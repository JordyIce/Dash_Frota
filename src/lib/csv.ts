/**
 * Parser CSV character-by-character state-machine.
 * Lida com:
 *   - aspas duplas (com escape "" dentro de campos)
 *   - vírgulas dentro de campos entre aspas
 *   - quebras de linha (LF, CRLF, CR)
 *   - quebras de linha dentro de campos entre aspas
 *   - campos vazios
 *
 * Mesmo padrão usado no Dash_Metro — não usa split() ingênuo.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  // strip BOM
  if (len > 0 && text.charCodeAt(0) === 0xfeff) i = 1;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    // not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      // CRLF ou só CR
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (i + 1 < len && text[i + 1] === '\n') i += 2;
      else i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // último campo/linha
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Converte 2D array em array de objetos.
 * options.skipRows: pular N linhas iniciais (útil quando a planilha tem
 * linhas de título/junk antes do header real). Default 0.
 */
export function csvToObjects<T extends Record<string, string>>(
  rows: string[][],
  options?: { skipRows?: number },
): T[] {
  const skip = options?.skipRows ?? 0;
  if (rows.length <= skip) return [];
  const header = rows[skip].map((h) => h.trim());
  const out: T[] = [];
  for (let r = skip + 1; r < rows.length; r++) {
    const row = rows[r];
    // pula linhas totalmente vazias
    if (row.every((c) => c === '')) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = (row[c] ?? '').trim();
    }
    out.push(obj as T);
  }
  return out;
}
