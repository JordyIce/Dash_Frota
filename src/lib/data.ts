import { parseCsv, csvToObjects } from './csv';
import { parseDate, parseNumber, detectDateFormat, type DateFormat } from './utils';
import type { OciosoDia, OciosoRow, Transacao, VeloeRow } from './types';

/**
 * Painel Aderência - KPI Combustivel (Google Sheets nativo).
 * Abas:
 *   - Base veloe        (gid=101845243)  → transações Veloe (gerente vem da coluna BP)
 *   - Base ZUQ          (gid=1442572254) → telemetria diária (motor ocioso, etc)
 *   - Motorista         (gid=1011349077) → lookup CPF→Nome canônico do motorista
 *   - Controle de Frota (gid=1557557647) → lookup placa→Tipo do veículo (coluna W)
 */
const SHEET_ID = import.meta.env.VITE_SHEET_ID || '1va-mFQ0FjccgKqunvzEWuLAv4llMNkP8PzJo14ir9mk';
const GID_VELOE = import.meta.env.VITE_GID_VELOE || '101845243';
const GID_OCIOSO = import.meta.env.VITE_GID_OCIOSO || '1442572254';
const GID_MOTORISTAS = import.meta.env.VITE_GID_MOTORISTAS || '1011349077';
const GID_CONTROLE = import.meta.env.VITE_GID_CONTROLE || '1557557647';

// Índices (0-based) das colunas na aba Controle de Frota
const COL_CONTROLE_PLACA = 0;    // A
const COL_CONTROLE_GERENTE = 32; // AG
const COL_CONTROLE_TIPO = 22;    // W (Tipo do veículo: ONIBUS, EQUIPAMENTOS, VEICULO LEVE, etc)

// Índice (0-based) da coluna de Gerente na Base veloe
const COL_VELOE_GERENTE = 67;    // BP (a Base veloe tem 2 colunas "Gerente"; usamos a BP)

export function getSheetCsvUrl(sheetId: string, gid: string | number): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

export async function fetchVeloeData(): Promise<Transacao[]> {
  const url = getSheetCsvUrl(SHEET_ID, GID_VELOE);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha na Base veloe: HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);

  // Header está na linha de índice 1 (skipRows: 1). Dados começam no índice 2.
  const SKIP = 1;
  if (rows.length <= SKIP) return [];
  const header = rows[SKIP].map((h) => h.trim());

  // Detecta formato de data analisando o conjunto
  const idxData = (() => {
    const i = header.indexOf('Data');
    return i >= 0 ? i : header.indexOf('Data/ Hora');
  })();
  const amostras: string[] = [];
  for (let r = SKIP + 1; r < rows.length; r++) {
    const v = idxData >= 0 ? (rows[r][idxData] || '') : '';
    if (v) amostras.push(v);
  }
  const fmtData = detectDateFormat(amostras);
  console.log(`[Veloe] Formato de data detectado: ${fmtData.toUpperCase()}`);

  const out: Transacao[] = [];
  for (let r = SKIP + 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => c === '')) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = (row[c] ?? '').trim();
    }
    // gerente vem da coluna BP (índice 67) lida por POSIÇÃO, porque há 2 colunas "Gerente"
    const gerenteBP = (row[COL_VELOE_GERENTE] || '').trim();
    const t = normalizeVeloeRow(obj as VeloeRow, fmtData, gerenteBP);
    if (t.placa) out.push(t);
  }
  return out;
}

export async function fetchOciosoData(): Promise<OciosoDia[]> {
  const url = getSheetCsvUrl(SHEET_ID, GID_OCIOSO);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha na Base ZUQ: HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);
  const raw = csvToObjects<OciosoRow>(rows, { skipRows: 1 });
  const amostras = raw.map((r) => r['Data'] || '').filter(Boolean);
  const fmtData = detectDateFormat(amostras);
  console.log(`[ZUQ] Formato de data detectado: ${fmtData.toUpperCase()}`);
  return raw.map((r) => normalizeOciosoRow(r, fmtData)).filter((r) => r.placa);
}

/**
 * Lê a aba "Motorista" (gid=1011349077) com pares CPF→Nome canônico.
 * Estrutura: coluna A = CPF, coluna B = Nome. Header na linha 1.
 */
export async function fetchMotoristas(): Promise<Map<string, string>> {
  const url = getSheetCsvUrl(SHEET_ID, GID_MOTORISTAS);
  const map = new Map<string, string>();
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      console.warn(`Aba Motorista indisponível: HTTP ${res.status}`);
      return map;
    }
    const text = await res.text();
    const rows = parseCsv(text);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cpfRaw = (row[0] || '').trim();
      const nome = (row[1] || '').trim();
      if (!cpfRaw || !nome) continue;
      const cpfNormalizado = cpfRaw.replace(/\D/g, '');
      if (cpfNormalizado.length < 8) continue;
      map.set(cpfNormalizado, nome);
    }
    console.log(`[Motorista] ${map.size} motoristas carregados.`);
  } catch (e) {
    console.warn('Erro ao buscar Motoristas:', e);
  }
  return map;
}

/**
 * Normaliza texto pra Title Case, unificando grafias diferentes do mesmo valor.
 * Ex: "PICK-UP LEVE", "Pick-Up Leve", "pick-up leve" → todos viram "Pick-Up Leve".
 */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/])([a-zà-ÿ])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

/**
 * Lê a aba "Controle de Frota" (gid=1557557647).
 * Cruza por placa pra obter o Tipo de Veículo (coluna W / índice 22).
 * Lê por POSIÇÃO (índice) porque a aba tem várias colunas chamadas "Tipo".
 */
export async function fetchControleFrota(): Promise<{
  gerentePorPlaca: Map<string, string>;
  tipoPorPlaca: Map<string, string>;
}> {
  const url = getSheetCsvUrl(SHEET_ID, GID_CONTROLE);
  const gerentePorPlaca = new Map<string, string>();
  const tipoPorPlaca = new Map<string, string>();
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      console.warn(`Controle de Frota indisponível: HTTP ${res.status}`);
      return { gerentePorPlaca, tipoPorPlaca };
    }
    const text = await res.text();
    const rows = parseCsv(text);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const placa = (row[COL_CONTROLE_PLACA] || '').toUpperCase().replace(/\s/g, '').trim();
      if (!placa) continue;
      const gerente = (row[COL_CONTROLE_GERENTE] || '').trim();
      const tipo = (row[COL_CONTROLE_TIPO] || '').trim();
      if (gerente) gerentePorPlaca.set(placa, gerente);
      if (tipo) tipoPorPlaca.set(placa, titleCase(tipo));
    }
    console.log(`[Controle de Frota] ${gerentePorPlaca.size} placas com gerente, ${tipoPorPlaca.size} com tipo.`);
  } catch (e) {
    console.warn('Erro ao buscar Controle de Frota:', e);
  }
  return { gerentePorPlaca, tipoPorPlaca };
}

export async function fetchAll(): Promise<{
  veloe: Transacao[];
  ocioso: OciosoDia[];
  placasGerente: Map<string, string>;
  placasGrupo: Map<string, string>;
}> {
  const [veloeRaw, ociosoResult, motoristasMap, controleFrota] = await Promise.all([
    fetchVeloeData(),
    fetchOciosoData().catch((e) => {
      console.warn('Base ZUQ indisponível:', e);
      return [] as OciosoDia[];
    }),
    fetchMotoristas().catch((e) => {
      console.warn('Aba Motorista indisponível:', e);
      return new Map<string, string>();
    }),
    fetchControleFrota().catch((e) => {
      console.warn('Controle de Frota indisponível:', e);
      return { gerentePorPlaca: new Map<string, string>(), tipoPorPlaca: new Map<string, string>() };
    }),
  ]);

  // Lookups placa→gerente e placa→grupo a partir da ZUQ (mantidos pro Motor Ocioso e fallback)
  const placasGerente = new Map<string, string>();
  const placasGrupo = new Map<string, string>();
  const ultimaDataPorPlaca = new Map<string, number>();

  for (const o of ociosoResult) {
    if (!o.placa || !o.gerente) continue;
    const placaUC = o.placa.toUpperCase();
    const ts = o.data ? o.data.getTime() : 0;
    const tsAtual = ultimaDataPorPlaca.get(placaUC) ?? -1;
    if (ts >= tsAtual) {
      ultimaDataPorPlaca.set(placaUC, ts);
      placasGerente.set(placaUC, o.gerente);
      if (o.grupo) placasGrupo.set(placaUC, o.grupo);
    }
  }

  const { gerentePorPlaca, tipoPorPlaca } = controleFrota;

  // Aplica Controle de Frota na ZUQ pro TIPO (grupo). O gerente da ZUQ é mantido
  // (Motor Ocioso não tem como cruzar com a BP da Veloe, são bases distintas).
  const ocioso = ociosoResult.map((o) => {
    const placaUC = (o.placa || '').toUpperCase().replace(/\s/g, '');
    const tipoFinal = tipoPorPlaca.get(placaUC) || o.grupo;
    return {
      ...o,
      gerente: gerentePorPlaca.get(placaUC) || o.gerente,
      grupo: tipoFinal ? titleCase(tipoFinal) : tipoFinal,
    };
  });

  const veloe = veloeRaw.map((t) => {
    // Placa normalizada (UPPERCASE, sem espaços) pra cruzar com Controle de Frota
    const placaUC = (t.placa || '').toUpperCase().replace(/\s/g, '');

    // TIPO: fonte primária = Controle de Frota (coluna W). Fallback = ZUQ → Veloe.
    const tipoControle = tipoPorPlaca.get(placaUC);
    const grupoZuq = placasGrupo.get(placaUC);
    const tipoFinal = tipoControle || grupoZuq || t.categoriaVeiculo;

    // MOTORISTA: cruza pelo CPF na aba Motorista; fallback = nome da Veloe.
    const cpfNormalizado = (t.cpfMotorista || '').replace(/\D/g, '');
    const nomeCanonico = cpfNormalizado ? motoristasMap.get(cpfNormalizado) : undefined;

    return {
      ...t,
      // GERENTE: vem da coluna BP da Base veloe (já resolvido em t.gerente).
      gerente: t.gerente,
      categoriaVeiculo: tipoFinal ? titleCase(tipoFinal) : tipoFinal,
      motorista: nomeCanonico || t.motorista,
    };
  });

  return { veloe, ocioso, placasGerente, placasGrupo };
}

function normalizeVeloeRow(r: VeloeRow, fmtData: DateFormat = 'mdy', gerenteBP = ''): Transacao {
  // Ignora coluna de horário (Hora/Horas) — não usamos pra nada nas análises,
  // e algumas linhas vêm com valores corrompidos que quebram o parseDate.
  const dataStr = (r['Data'] || r['Data/ Hora'] || '').trim();
  const dataHoraCombinada = dataStr;

  const descricaoCC = (r['Descrição'] || '').trim() || 'Sem CC';

  // Gerente: usa a coluna BP (passada por posição). Fallback: coluna "Gerente" do objeto
  // ou o centro de custo se vier "Outros"/vazio.
  const gerenteRaw = (gerenteBP || r['Gerente'] || '').trim();
  const gerenteFinal = gerenteRaw && gerenteRaw !== 'Outros' ? gerenteRaw : descricaoCC;

  const categoriaVeiculo = (r['Para'] || '').trim() || (r['Perfil de uso'] || '').trim();
  const combustivel = (r['Tipo'] || '').trim();

  return {
    contrato: r['Contrato'] || '',
    filial: r['Nome Filial'] || '',
    base: r['Base'] || '',
    perfilUso: r['Perfil de uso'] || '',
    categoriaVeiculo,
    placa: r['Placa'] || '',
    modelo: r['Modelo veículo'] || '',
    nomeVeiculo: r['Nome Veículo'] || '',
    tipoFrota: r['Tipo de Frota'] || '',
    centroCustoVeiculo: r['Centro de Custo'] || r['CC'] || '',
    descricaoCC,
    estado: r['Estado veículo'] || '',
    cidade: r['Cidade veículo'] || r['Cidade'] || '',
    motorista: r['Nome motorista'] || '',
    cpfMotorista: r['CPF Motorista'] || '',
    matriculaMotorista: r['Matrícula Motorista'] || '',
    gerente: gerenteFinal,

    dataTransacao: parseDate(dataHoraCombinada, fmtData),
    dataPostagem: null,

    nomeEC: r['Nome EC'] || '',
    bandeiraEC: r['Bandeira EC'] || '',
    cidadeEC: r['Cidade EC'] || '',
    ufEC: r['UF EC'] || '',

    tipoMercadoria: r['Tipo Mercadoria'] || '',
    mercadoria: r['Mercadoria'] || '',
    combustivel,

    qtdMercadoria: parseNumber(r['Qtd Mercadoria']),
    valorUnitario: parseNumber(r['Valor Unit. Mercadoria']),
    valorTotal: parseNumber(r['Valor total original']),
    valorComDesconto: parseNumber(r['Valor total com desconto']),
    valorEconomizado: parseNumber(r['Valor total Economizado']),
    capacidadeTanque: parseNumber(r['Capacidade Tanque']),

    hodometroAnterior: parseNumber(r['Hodômetro Anterior - Dig. Motorista']),
    hodometroTransacao: parseNumber(r['Hodômetro Transação - Dig. Motorista']),
    rendimentoMedio: parseNumber(r['Rendimento Médio']) || parseNumber(r['Meta consumo']),
    kmHrPercorrido: parseNumber(r['Km/Hr Percorrido']),
    mediaEfetiva: parseNumber(r['Média Efetiva (Km/Hr)']),
    tolerancia: parseNumber(r['Tolerância Rendimento Veículo (%)']),
    desvioPercentual: parseNumber(r['Desvio na Transação (%)']),
    desvioNumero: parseNumber(r['Desvio na Transação (número)']),
    descricaoDesvio: r['Descrição Desvio na Transação'] || '',
    statusTransacao: (r['Status transação'] || '').trim().toUpperCase(),

    raw: r,
  };
}

function normalizeOciosoRow(r: OciosoRow, fmtData: DateFormat = 'mdy'): OciosoDia {
  return {
    data: parseDate(r['Data'], fmtData),
    placa: (r['Veículo'] || '').toUpperCase().trim(),
    distanciaKm: parseNumber(r['Distância(km)']),
    ligadoMin: parseNumber(r['Ligado(min)']),
    paradoIgnicaoMin: parseNumber(r['Parado com a Ignição Ligada(min)']),
    motorOciosoHoras: parseNumber(r['Motor ocioso']),
    velocidadeMaxima: parseNumber(r['Velocidade Máxima(km/h)']),
    velocidadeMedia: parseNumber(r['Velocidade Média(km/h)']),
    semana: r['Semana'] || '',
    mes: r['Mês'] || '',
    gerente: r['Gerente'] || '',
    grupo: r['Grupo'] || '',
    operacao: r['Operação'] || '',
    raw: r,
  };
}

export function onlyCombustivel(rows: Transacao[]): Transacao[] {
  return rows.filter((t) => t.tipoMercadoria === 'Combustível');
}
