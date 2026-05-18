import * as XLSX from 'xlsx';
import { parseDate, parseNumber } from './utils';
import type { OciosoDia, OciosoRow, Transacao, VeloeRow } from './types';

/**
 * Baixa o XLSX "Painel Aderência - KPI Combustivel.xlsx" direto do Google Drive,
 * parsea localmente com SheetJS, e extrai as abas usadas pelo dashboard.
 *
 * Workflow do pessoal da frota:
 *  - Substituir o arquivo XLSX no Drive usando "Gerenciar versões" (preserva o ID)
 *  - Em até 5 minutos os dados atualizados aparecem (botão "Atualizar agora" força)
 *
 * Requisitos:
 *  - O arquivo precisa ter permissão "Qualquer pessoa com link pode ver"
 *  - Variáveis de ambiente:
 *      VITE_XLSX_FILE_ID    → ID do arquivo XLSX no Drive
 *      VITE_ABA_VELOE       → nome da aba Veloe (default: "Base veloe")
 *      VITE_ABA_OCIOSO      → nome da aba ZUQ (default: "Base ZUQ")
 */

const FILE_ID = import.meta.env.VITE_XLSX_FILE_ID || '';
const ABA_VELOE = import.meta.env.VITE_ABA_VELOE || 'Base veloe';
const ABA_OCIOSO = import.meta.env.VITE_ABA_OCIOSO || 'Base ZUQ';

function getXlsxUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
}

let cachedWorkbook: XLSX.WorkBook | null = null;
let cachedAt: number = 0;

async function loadWorkbook(): Promise<XLSX.WorkBook> {
  if (!FILE_ID) {
    throw new Error('VITE_XLSX_FILE_ID não configurado. Defina nas env vars do Vercel.');
  }

  // Cache em memória de 5 min (caso o usuário navegue entre páginas)
  const agora = Date.now();
  if (cachedWorkbook && agora - cachedAt < 5 * 60 * 1000) {
    return cachedWorkbook;
  }

  const url = getXlsxUrl(FILE_ID);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Falha ao baixar XLSX: HTTP ${res.status}. Verifique se o arquivo é público.`);
  }

  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellNF: false });

  cachedWorkbook = workbook;
  cachedAt = agora;
  return workbook;
}

export function invalidateCache() {
  cachedWorkbook = null;
  cachedAt = 0;
}

export async function fetchVeloeData(): Promise<Transacao[]> {
  const workbook = await loadWorkbook();
  const sheet = workbook.Sheets[ABA_VELOE];
  if (!sheet) {
    throw new Error(`Aba "${ABA_VELOE}" não encontrada. Abas: ${workbook.SheetNames.join(', ')}`);
  }
  const raw = XLSX.utils.sheet_to_json<VeloeRow>(sheet, { range: 0, defval: '', raw: false });
  return raw.map(normalizeVeloeRow).filter((t) => t.placa);
}

export async function fetchOciosoData(): Promise<OciosoDia[]> {
  const workbook = await loadWorkbook();
  const sheet = workbook.Sheets[ABA_OCIOSO];
  if (!sheet) {
    throw new Error(`Aba "${ABA_OCIOSO}" não encontrada. Abas: ${workbook.SheetNames.join(', ')}`);
  }
  // Base ZUQ: linha 1 é vazia/junk, header na linha 2 (index 1)
  const raw = XLSX.utils.sheet_to_json<OciosoRow>(sheet, { range: 1, defval: '', raw: false });
  return raw.map(normalizeOciosoRow).filter((r) => r.placa);
}

export async function fetchAll(): Promise<{
  veloe: Transacao[];
  ocioso: OciosoDia[];
  placasGerente: Map<string, string>;
  placasGrupo: Map<string, string>;
}> {
  const workbook = await loadWorkbook();

  const veloeSheet = workbook.Sheets[ABA_VELOE];
  if (!veloeSheet) {
    throw new Error(`Aba "${ABA_VELOE}" não encontrada. Abas: ${workbook.SheetNames.join(', ')}`);
  }
  const veloeRaw = XLSX.utils
    .sheet_to_json<VeloeRow>(veloeSheet, { range: 0, defval: '', raw: false })
    .map(normalizeVeloeRow)
    .filter((t) => t.placa);

  const ociosoSheet = workbook.Sheets[ABA_OCIOSO];
  const ociosoResult = ociosoSheet
    ? XLSX.utils
        .sheet_to_json<OciosoRow>(ociosoSheet, { range: 1, defval: '', raw: false })
        .map(normalizeOciosoRow)
        .filter((r) => r.placa)
    : [];

  // Lookups placa→gerente e placa→grupo a partir da ZUQ
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
  const dataStr = r['Data/ Hora'] || '';
  const horaStr = r['Hora'] || '';
  const dataHoraCombinada = horaStr ? `${dataStr} ${horaStr}` : dataStr;

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
