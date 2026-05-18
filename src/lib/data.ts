import { parseCsv, csvToObjects } from './csv';
import { parseDate, parseNumber } from './utils';
import type { OciosoDia, OciosoRow, Transacao, VeloeRow } from './types';

/**
 * Tudo numa planilha só: "Painel Aderência - KPI Combustivel" (Google Sheets nativo).
 * Abas usadas:
 *   - Base veloe (gid=101845243)  → transações Veloe
 *   - Base ZUQ   (gid=1442572254) → telemetria diária + fonte canônica de Gerente e Tipo de Carro
 */
const SHEET_ID = import.meta.env.VITE_SHEET_ID || '1va-mFQ0FjccgKqunvzEWuLAv4llMNkP8PzJo14ir9mk';
const GID_VELOE = import.meta.env.VITE_GID_VELOE || '101845243';
const GID_OCIOSO = import.meta.env.VITE_GID_OCIOSO || '1442572254';

export function getSheetCsvUrl(sheetId: string, gid: string | number): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

export async function fetchVeloeData(): Promise<Transacao[]> {
  const url = getSheetCsvUrl(SHEET_ID, GID_VELOE);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha na Base veloe: HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);
  const raw = csvToObjects<VeloeRow>(rows, { skipRows: 1 });
  return raw.map(normalizeVeloeRow).filter((t) => t.placa);
}

export async function fetchOciosoData(): Promise<OciosoDia[]> {
  const url = getSheetCsvUrl(SHEET_ID, GID_OCIOSO);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha na Base ZUQ: HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);
  const raw = csvToObjects<OciosoRow>(rows, { skipRows: 1 });
  return raw.map(normalizeOciosoRow).filter((r) => r.placa);
}

export async function fetchAll(): Promise<{
  veloe: Transacao[];
  ocioso: OciosoDia[];
  placasGerente: Map<string, string>;
  placasGrupo: Map<string, string>;
}> {
  const [veloeRaw, ociosoResult] = await Promise.all([
    fetchVeloeData(),
    fetchOciosoData().catch((e) => {
      console.warn('Base ZUQ indisponível:', e);
      return [] as OciosoDia[];
    }),
  ]);

  // Monta lookups placa→gerente e placa→grupo a partir da ZUQ.
  // Pra cada placa, usa o registro com a data MAIS RECENTE.
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

  const veloe = veloeRaw.map((t) => {
    const placaUC = (t.placa || '').toUpperCase();
    const gerenteZuq = placasGerente.get(placaUC);
    const grupoZuq = placasGrupo.get(placaUC);
    return {
      ...t,
      gerente: gerenteZuq || t.gerente,
      categoriaVeiculo: grupoZuq || t.categoriaVeiculo,
    };
  });

  return { veloe, ocioso: ociosoResult, placasGerente, placasGrupo };
}

function normalizeVeloeRow(r: VeloeRow): Transacao {
  // Suporta ambos formatos de cabeçalho da planilha:
  //   - Formato antigo: "Data/ Hora" + "Hora"
  //   - Formato novo:   "Data" + "Horas"
  const dataStr = (r['Data'] || r['Data/ Hora'] || '').trim();
  const horaStr = (r['Horas'] || r['Hora'] || '').trim();
  // Se dataStr já contém horário, não concatena horaStr de novo
  const dataJaTemHora = /\s+\d{1,2}:\d{2}/.test(dataStr);
  const dataHoraCombinada = dataJaTemHora || !horaStr ? dataStr : `${dataStr} ${horaStr}`;

  const descricaoCC = (r['Descrição'] || '').trim() || 'Sem CC';

  const gerenteRaw = (r['Gerente'] || '').trim();
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
    statusTransacao: (r['Status transação'] || '').trim().toUpperCase(),

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

export function onlyCombustivel(rows: Transacao[]): Transacao[] {
  return rows.filter((t) => t.tipoMercadoria === 'Combustível');
}
