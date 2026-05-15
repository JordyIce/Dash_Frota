/**
 * Linha bruta da aba "Base veloe" da Painel Aderência (gid=101845243).
 * Os nomes preservam acentos/maiúsculas exatamente como vêm do Sheets.
 */
export interface VeloeRow {
  Contrato: string;
  'CNPJ Filial': string;
  'Nome Filial': string;
  Base: string;
  'Perfil de uso': string;
  Placa: string;
  'Modelo veículo': string;
  'Nome Veículo': string;
  'Tipo de Frota': string;
  'Capacidade Tanque': string;
  CC: string;
  Descrição: string;
  'Estado veículo': string;
  'Cidade veículo': string;
  Patrimônio: string;
  Garagem: string;
  'CPF Motorista': string;
  'Nome motorista': string;
  'Matrícula Motorista': string;
  'RG Motorista': string;
  'Número CNH': string;
  'Categoria CNH': string;
  'Centro de Custo Motorista': string;
  'Descrição Centro de Custo Motorista': string;
  'Data/ Hora': string;
  Hora: string;
  'N° autorização': string;
  'Nota fiscal': string;
  'Tipo de cartão': string;
  'Número Cartão': string;
  'Limite Cartão': string;
  'Saldo Cartão': string;
  'CNPJ EC': string;
  'Nome EC': string;
  'Bandeira EC': string;
  'Logradouro EC': string;
  'UF EC': string;
  'Cidade EC': string;
  'Tipo Mercadoria': string;
  Mercadoria: string;
  'Qtd Mercadoria': string;
  'Valor Unit. Mercadoria': string;
  'Valor total original': string;
  'Valor total com desconto': string;
  'Valor total Economizado': string;
  'Hodômetro Anterior - Dig. Motorista': string;
  'Hodômetro Transação - Dig. Motorista': string;
  'Horímetro Anterior - Dig. Motorista': string;
  'Horímetro Transação - Dig. Motorista': string;
  'Rendimento Médio': string;
  'Km/Hr Percorrido': string;
  'Custo Km/Hr Percorrido': string;
  'Média Efetiva (Km/Hr)': string;
  'Tolerância Rendimento Veículo (%)': string;
  'Desvio na Transação (%)': string;
  'Desvio na Transação (número)': string;
  'Descrição Desvio na Transação': string;
  'Centro Custo Transação - Dig. Motorista': string;
  'Código Frota - Dig.Motorista': string;
  'Placa - Dig.Motorista': string;
  'Ordem Serviço - Dig.Motorista': string;
  'Centro de Custo': string;
  Mês: string;
  Gerente: string;
  Check: string;
  Para: string;
  'Semana do Mês': string;
  Trimestre: string;
  'Meta consumo': string;
  'Status transação': string;
  Tipo: string;
  Cidade: string;
  [key: string]: string;
}

/** Linha normalizada — tipos numéricos parseados, data como Date. */
export interface Transacao {
  // dimensões
  contrato: string;
  filial: string;
  base: string;
  perfilUso: string;
  categoriaVeiculo: string;
  placa: string;
  modelo: string;
  nomeVeiculo: string;
  tipoFrota: string;
  centroCustoVeiculo: string;
  descricaoCC: string;
  estado: string;
  cidade: string;
  motorista: string;
  cpfMotorista: string;
  matriculaMotorista: string;

  gerente: string;

  // tempo
  dataTransacao: Date | null;
  dataPostagem: Date | null;

  // EC (estabelecimento)
  nomeEC: string;
  bandeiraEC: string;
  cidadeEC: string;
  ufEC: string;

  // mercadoria
  tipoMercadoria: string;
  mercadoria: string;
  combustivel: string;

  // métricas
  qtdMercadoria: number;
  valorUnitario: number;
  valorTotal: number;
  valorComDesconto: number;
  valorEconomizado: number;
  capacidadeTanque: number;

  hodometroAnterior: number;
  hodometroTransacao: number;
  rendimentoMedio: number;
  kmHrPercorrido: number;
  mediaEfetiva: number;
  tolerancia: number;
  desvioPercentual: number;
  desvioNumero: number;
  descricaoDesvio: string;     // "Desvio Abaixo", "Desvio Acima", "Sem Desvio"
  statusTransacao: string;     // "OK" ou "NOK" — NOK = transação com restrição (Veloe negou)

  // bruto pra debug
  raw: VeloeRow;
}

/** Filtros globais — aplicados em todas as páginas. */
export interface FilterState {
  centroCusto: string[];
  gerente: string[];
  dataInicio: Date | null;
  dataFim: Date | null;
  tipoCarro: string[];
  combustivel: string[];
}

export const emptyFilters: FilterState = {
  centroCusto: [],
  gerente: [],
  dataInicio: null,
  dataFim: null,
  tipoCarro: [],
  combustivel: [],
};

/**
 * Linha bruta da Base ZUQ (telemetria).
 * IMPORTANTE: a linha 1 do CSV é vazia/#N/A, então o header está na linha 2.
 * Parser precisa usar skipRows: 1.
 */
export interface OciosoRow {
  Data: string;
  Veículo: string;
  'Distância(km)': string;
  'Ligado(min)': string;
  'Desligado(min)': string;
  'Parado(min)': string;
  'Parado com a Ignição Ligada(min)': string;
  Primeira: string;
  Última: string;
  'Sem comunicação(min)': string;
  'Velocidade Máxima(km/h)': string;
  'Velocidade Média(km/h)': string;
  'Na base(min)': string;
  'Fora da base(min)': string;
  'Odômetro Inicial(km)': string;
  'Odômetro Final(km)': string;
  'Horímetro Inicial(Hrs)': string;
  'Horímetro Final(Hrs)': string;
  'Motor ocioso': string;
  Semana: string;
  Mês: string;
  Gerente: string;
  Grupo: string;
  Operação: string;
  [key: string]: string;
}

/** Linha normalizada de Motor Ocioso (uma por placa/dia). */
export interface OciosoDia {
  data: Date | null;
  placa: string;
  distanciaKm: number;
  ligadoMin: number;
  paradoIgnicaoMin: number;
  motorOciosoHoras: number;
  velocidadeMaxima: number;
  velocidadeMedia: number;
  semana: string;
  mes: string;
  gerente: string;
  grupo: string;
  operacao: string;
  raw: OciosoRow;
}
