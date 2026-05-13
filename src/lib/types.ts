/**
 * Linha bruta da base "Veloe GO Consolidado" — espelha o header da planilha.
 * Os nomes preservam acentos/maiúsculas exatamente como vêm do Sheets.
 */
export interface VeloeRow {
  Contrato: string;
  'CNPJ Filial': string;
  'Nome Filial': string;
  Base: string;
  'Perfil de uso': string; // GERAL, PICK-UP LEVE, CAMINHAO GUINDAUTO, FROTA LEVE, FROTA PESADA, PICK-UP
  Placa: string;
  'Modelo veículo': string;
  'Nome Veículo': string;
  'Tipo de Frota': string; // Alugada, Própria, Nenhuma
  'Capacidade Tanque': string;
  'Centro de custo veículo': string;
  'Descrição Centro de custo placa': string;
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
  'Data/ Hora transação': string;
  'Data postagem': string;
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
  'Tipo Mercadoria': string; // Combustível, Aditivos e Lubrificantes
  Mercadoria: string; // Diesel S10, Gasolina Comum, Arla 32, Diesel
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
  'Descrição Desvio na Transação': string; // Desvio Abaixo, Desvio Acima, Sem Desvio
  'Centro Custo Transação': string;
  'Código Frota - Dig.Motorista': string;
  'Placa - Dig.Motorista': string;
  'Ordem Serviço - Dig.Motorista': string;
  [key: string]: string;
}

/** Linha normalizada — tipos numéricos parseados, data como Date. */
export interface Transacao {
  // dimensões
  contrato: string;
  filial: string;
  base: string;
  perfilUso: string;       // "Tipo do Carro" no filtro (FROTA LEVE, CAMINHAO GUINDAUTO, etc)
  placa: string;
  modelo: string;
  nomeVeiculo: string;
  tipoFrota: string;       // "Grupo do Carro" no filtro (Alugada, Própria, Nenhuma)
  centroCustoVeiculo: string;
  descricaoCC: string;     // "Gerência" (proxy)
  estado: string;
  cidade: string;
  motorista: string;
  cpfMotorista: string;
  matriculaMotorista: string;

  // gerente real — populado via lookup placa→gerente da Base ZUQ.
  // Cai pra descricaoCC quando a placa não tem correspondência.
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
  tipoMercadoria: string;  // Combustível, Aditivos e Lubrificantes
  mercadoria: string;      // Diesel S10, Gasolina Comum, etc

  // métricas
  qtdMercadoria: number;   // litros (se Combustível)
  valorUnitario: number;   // preço por litro
  valorTotal: number;      // R$ gasto (original)
  valorComDesconto: number;
  valorEconomizado: number;
  capacidadeTanque: number;

  hodometroAnterior: number;
  hodometroTransacao: number;
  rendimentoMedio: number;     // meta KM/L do veículo
  kmHrPercorrido: number;
  mediaEfetiva: number;        // KM/L real
  tolerancia: number;          // % tolerância da meta
  desvioPercentual: number;
  desvioNumero: number;
  descricaoDesvio: string;     // "Desvio Abaixo", "Desvio Acima", "Sem Desvio"

  // bruto pra debug
  raw: VeloeRow;
}

/** Filtros globais — aplicados em todas as páginas. */
export interface FilterState {
  centroCusto: string[];      // valores de descricaoCC
  gerente: string[];          // proxy: descricaoCC também (mesma coluna)
  dataInicio: Date | null;
  dataFim: Date | null;
  tipoCarro: string[];        // perfilUso
  grupoCarro: string[];       // tipoFrota
}

export const emptyFilters: FilterState = {
  centroCusto: [],
  gerente: [],
  dataInicio: null,
  dataFim: null,
  tipoCarro: [],
  grupoCarro: [],
};

/**
 * Linha bruta da Base ZUQ (telemetria) — gid=1024045145 na planilha antiga.
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
  motorOciosoHoras: number;   // já vem calculado na planilha (paradoIgnicaoMin / 60)
  velocidadeMaxima: number;
  velocidadeMedia: number;
  semana: string;             // "Semana 5"
  mes: string;                // "Abril"
  gerente: string;            // nome real
  grupo: string;              // categoria (Pick-Up, Caminhao Sky, etc)
  operacao: string;           // "141020202 - Multiservicos Itapaje"
  raw: OciosoRow;
}
