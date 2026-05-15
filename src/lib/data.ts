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
      return [] as OciosoDia[];
    }),
  ]);

  const placasGerente = new Map<string, string>();
  for (const t of veloe) {
    if (t.placa && t.gerente && !placasGerente.has(t.placa.toUpperCase())) {
      placasGerente.set(t.placa.toUpperCase(), t.gerente);
    }
  }

  return { veloe, ocioso: ociosoResult, placasGerente };
}

function normalizeVeloeRow(r: VeloeRow): Transacao {
  // Combina data + hora em uma string única pro parseDate
  const dataStr = r['Data/ Hora'] || '';
  const horaStr = r['Hora'] || '';
  const dataHoraCombinada = horaStr ? `${dataStr} ${horaStr}` : dataStr;

  // Descrição (coluna BB) é o nome amigável do CC — "Obras SP", "Multiservicos Sao Benedito", etc
  const descricaoCC = (r['Descrição'] || '').trim() || 'Sem CC';

  // gerente: usa o real; se vier "Outros" ou vazio, cai pra descricaoCC
  const gerenteRaw = (r['Gerente'] || '').trim();
  const gerenteFinal = gerenteRaw && gerenteRaw !== 'Outros' ? gerenteRaw : descricaoCC;

  // "Para" — categoria amigável: Pick-Up Leve, Caminhao Sky, etc
  const categoriaVeiculo = (r['Para'] || '').trim() || (r['Perfil de uso'] || '').trim();

  // "Tipo" — combustível simplificado: Gasolina, Diesel S10, Arla
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

    dataTransacao: parseDate(dataHoraCombinada),
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
