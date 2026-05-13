import { parseCsv, csvToObjects } from './csv';
import { parseDate, parseNumber } from './utils';
import type { OciosoDia, OciosoRow, Transacao, VeloeRow } from './types';

const SHEET_ID_VELOE = import.meta.env.VITE_SHEET_ID || '17oX46NDGybC2UEXAFg0__cqDEJ61eLjg0DcfxURshP8';
const GID_VELOE = import.meta.env.VITE_GID_VELOE || '1773027822';

const SHEET_ID_OCIOSO = import.meta.env.VITE_SHEET_ID_OCIOSO || '1ACx9uDKLA-wB9g0FwINTTQ3ndMpn9DRJUpGS1s7dhi4';
const GID_OCIOSO = import.meta.env.VITE_GID_OCIOSO || '1024045145';

export function getSheetCsvUrl(sheetId: string, gid: string | number): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/** Fetch da base unificada Veloe GO Consolidado (combustível). */
export async function fetchVeloeData(): Promise<Transacao[]> {
  const url = getSheetCsvUrl(SHEET_ID_VELOE, GID_VELOE);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha na base Veloe: HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);
  const raw = csvToObjects<VeloeRow>(rows);
  return raw.map(normalizeVeloeRow);
}

/** Fetch da Base ZUQ (telemetria — motor ocioso por placa/dia). */
export async function fetchOciosoData(): Promise<OciosoDia[]> {
  const url = getSheetCsvUrl(SHEET_ID_OCIOSO, GID_OCIOSO);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha na Base ZUQ: HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);
  // ZUQ tem linha 1 vazia/#N/A; o header real está na linha 2
  const raw = csvToObjects<OciosoRow>(rows, { skipRows: 1 });
  return raw.map(normalizeOciosoRow).filter((r) => r.placa);
}

/**
 * Fetch das duas bases em paralelo + cruzamento de gerente.
 * Pra cada placa na ZUQ, descobre o gerente predominante e aplica
 * nas transações Veloe correspondentes. Fallback: descricaoCC.
 */
export async function fetchAll(): Promise<{
  veloe: Transacao[];
  ocioso: OciosoDia[];
  placasGerente: Map<string, string>;
}> {
  const [veloe, ociosoResult] = await Promise.all([
    fetchVeloeData(),
    fetchOciosoData().catch((e) => {
      console.warn('Base ZUQ indisponível, usando proxy de gerente:', e);
      return [] as OciosoDia[];
    }),
  ]);

  const placasGerente = buildPlacaGerenteMap(ociosoResult);

  for (const t of veloe) {
    const real = placasGerente.get(t.placa.toUpperCase());
    t.gerente = real || t.descricaoCC || 'Sem gerente';
  }

  return { veloe, ocioso: ociosoResult, placasGerente };
}

/**
 * Para cada placa, descobre o gerente mais frequente na ZUQ.
 * Em caso de empate, prefere qualquer gerente nominal sobre "Gestão Frota".
 */
function buildPlacaGerenteMap(ocioso: OciosoDia[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const o of ocioso) {
    if (!o.placa || !o.gerente) continue;
    const key = o.placa.toUpperCase();
    let inner = counts.get(key);
    if (!inner) {
      inner = new Map();
      counts.set(key, inner);
    }
    inner.set(o.gerente, (inner.get(o.gerente) || 0) + 1);
  }
  const out = new Map<string, string>();
  for (const [placa, inner] of counts) {
    let best: string | null = null;
    let bestN = -1;
    for (const [g, n] of inner) {
      const isGenerico = g === 'Gestão Frota';
      if (n > bestN || (n === bestN && best === 'Gestão Frota' && !isGenerico)) {
        best = g;
        bestN = n;
      }
    }
    if (best) out.set(placa, best);
  }
  return out;
}

function normalizeVeloeRow(r: VeloeRow): Transacao {
  return {
    contrato: r['Contrato'] || '',
    filial: r['Nome Filial'] || '',
    base: r['Base'] || '',
    perfilUso: r['Perfil de uso'] || '',
    placa: r['Placa'] || '',
    modelo: r['Modelo veículo'] || '',
    nomeVeiculo: r['Nome Veículo'] || '',
    tipoFrota: r['Tipo de Frota'] || '',
    centroCustoVeiculo: r['Centro de custo veículo'] || '',
    descricaoCC: r['Descrição Centro de custo placa'] || r['Descrição Centro de Custo Motorista'] || 'Sem CC',
    estado: r['Estado veículo'] || '',
    cidade: r['Cidade veículo'] || '',
    motorista: r['Nome motorista'] || '',
    cpfMotorista: r['CPF Motorista'] || '',
    matriculaMotorista: r['Matrícula Motorista'] || '',
    gerente: '', // preenchido depois via cruzamento com ZUQ

    dataTransacao: parseDate(r['Data/ Hora transação']),
    dataPostagem: parseDate(r['Data postagem']),

    nomeEC: r['Nome EC'] || '',
    bandeiraEC: r['Bandeira EC'] || '',
    cidadeEC: r['Cidade EC'] || '',
    ufEC: r['UF EC'] || '',

    tipoMercadoria: r['Tipo Mercadoria'] || '',
    mercadoria: r['Mercadoria'] || '',

    qtdMercadoria: parseNumber(r['Qtd Mercadoria']),
    valorUnitario: parseNumber(r['Valor Unit. Mercadoria']),
    valorTotal: parseNumber(r['Valor total original']),
    valorComDesconto: parseNumber(r['Valor total com desconto']),
    valorEconomizado: parseNumber(r['Valor total Economizado']),
    capacidadeTanque: parseNumber(r['Capacidade Tanque']),

    hodometroAnterior: parseNumber(r['Hodômetro Anterior - Dig. Motorista']),
    hodometroTransacao: parseNumber(r['Hodômetro Transação - Dig. Motorista']),
    rendimentoMedio: parseNumber(r['Rendimento Médio']),
    kmHrPercorrido: parseNumber(r['Km/Hr Percorrido']),
    mediaEfetiva: parseNumber(r['Média Efetiva (Km/Hr)']),
    tolerancia: parseNumber(r['Tolerância Rendimento Veículo (%)']),
    desvioPercentual: parseNumber(r['Desvio na Transação (%)']),
    desvioNumero: parseNumber(r['Desvio na Transação (número)']),
    descricaoDesvio: r['Descrição Desvio na Transação'] || '',

    raw: r,
  };
}

function normalizeOciosoRow(r: OciosoRow): OciosoDia {
  return {
    data: parseDate(r['Data']),
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

/** Helper: só transações de combustível (descarta Arla, lubrificantes etc) */
export function onlyCombustivel(rows: Transacao[]): Transacao[] {
  return rows.filter((t) => t.tipoMercadoria === 'Combustível');
}
