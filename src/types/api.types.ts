// API Response Types
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  data: {
    code: number;
    message: string;
    status: string;
  };
}

export interface PaginatedResponse<T> {
  results: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

// Authentication
export interface AuthRequest {
  cnpj: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
}

// Common Types
export interface AuditFields {
  inseridoPor?: number;
  inseridoEm?: string;
  modificadoPor?: number;
  modificadoEm?: string;
}

// Client Types
export interface Cliente extends AuditFields {
  codigoCliente: number;
  codigoEmpresa: number;
  codigoUnidade: number;
  codigoMotivoBloqueio?: number;
  codigoOrigemCliente?: number;
  codigoFormaPagamento?: number;
  tipoCliente: string;
  razaoSocial: string;
  nomeFantasia?: string;
  logradouro?: string;
  cpf?: string;
  cnpj?: string;
  cnpjCpf?: string;
  ie?: string;
  rg?: string;
  orgaoEmissor?: string;
  complementoIdentidade?: string;
  sexo?: string;
  dataNascimento?: string;
  nomePai?: string;
  nomeMae?: string;
  tipoPessoa?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  codigoPais?: number;
  celular?: string;
  email?: string;
  telefone?: string;
  situacao?: string;
  areaAtuacao?: string;
  numeroFuncionarios?: number;
  porteEmpresa?: string;
  faturamentoAnual?: number;
  website?: string;
  observacoes?: string;
}

// Vehicle Types
export interface Veiculo extends AuditFields {
  codigoMVA: string;
  placa: string;
  codigoEmpresa: number;
  cor?: string;
  chassi?: string;
  numeroChassi?: string;
  ano?: number;
  anoModelo?: number;
  anoFabricacao?: number;
  modelo?: string;
  tipoCombustivel?: string;
  codigoCombustivel?: number;
  codigoUnidade: number;
  codigoModelo?: number;
  passageiros?: number;
  portas?: number;
  dataCompra?: string;
  nfCompra?: number;
  numeroNotaFiscal?: number;
  localCompra?: string;
  valorVeiculo?: number;
  codigoUnidadeCompra?: number;
  odometroAtual?: number;
  hodometro?: number;
  horimetro?: number;
  status?: string;
  descricaoStatus?: string;
  descricaoModelo?: string;
  codigoMarca?: number;
  descricaoMarca?: string;
  codigoGrupo?: number;
  descricaoGrupo?: string;
  codigoCliente?: number;
  razaoSocial?: string;
  valorCompra?: number;
  valorFipe?: number;
  renavam?: string;
  categoria?: number;
  codigoCategoria?: number;
  numeroMotor?: string;
  capacidadeTanque?: number;
  ativo?: string;
  codigoModeloFipe?: string;
  nomeModeloFipe?: string;
  numeroEixos?: number;
  capacidadeCarga?: number;
  capacidadePassageiros?: number;
  potenciaMotor?: number;
  cilindradaMotor?: number;
  dataVenda?: string;
  valorVenda?: number;
  motivoVenda?: string;
}

// Driver Types
export interface Condutor {
  codigoCondutor: number;
  codigoCliente: number;
  nomeCondutor: string;
  nomeMae?: string;
  nomePai?: string;
  numeroRegistro?: string;
  orgaoEmissorHabilitacao?: string;
  categoriaHabilitacao?: string;
  dataValidade?: string;
  dataPrimeiraHabilitacao?: string;
  numeroSegurancaCNH?: string;
  numeroCNH?: string;
  codigoMunicipioEmissor?: number;
  estado?: string;
  codigoPais?: number;
  dataEmissao?: string;
  cpf?: string;
  celular?: string;
  telefone?: string;
  email?: string;
}

// Contract Types
export interface Contrato {
  codigoContrato: number;
  codigoEmpresa: number;
  codigoUnidade: number;
  codigoGrupoContratos?: number;
  codigoMVA?: number;
  tipoTarifa?: string;
  periodoTarifa?: number;
  valorKmRodado?: number;
  franquiaKmRodado?: number;
  valorLocacao?: number;
  dataHoraInicioReal?: string;
  dataHoraTerminoReal?: string;
  dataFechamContrato?: string;
  usuarioAberturaContrato?: number;
  codigoCondutor?: number;
  inseridoPor?: number;
  codigoCliente?: number;
  razaoSocial?: string;
  email?: string;
  celular?: string;
  codigoContratoOriginal?: number;
  codigoContratoProx?: number;
  fechado?: string;
  fechamentoNaoRealizadoFaturamentoMaster?: string;
}

// BI Specific Types
export interface DadosVeiculoBI {
  placa: string;
  codigoMVA: number;
  chassi?: string;
  renavam?: string;
  codigoEmpresa: number;
  codigoUnidade: number;
  descricaoUnidade?: string;
  codigoMarca?: number;
  marcaVeiculo?: string;
  modelo?: string;
  anoModelo?: number;
  letra?: string;
  descricaoGrupo?: string;
  valorCompra?: number;
  status?: string;
  dataCompra?: string;
  nfCompra?: string;
  valorEntrada?: number;
  dataVenda?: string;
  valorVenda?: number;
  diasEmPosse?: number;
  codigoFipe?: string;
  valorFipe?: number;
  numeroContratoAlienacao?: string;
  inicioFinanciamento?: string;
  valorCompraVeiculo?: number;
  valorTotalCompraVeiculo?: number;
  valorAlienado?: number;
  valorMediaParcelaAlienacao?: number;
  valorTotalAlienacaoQuitado?: number;
  valorTotalAlienacaoAberto?: number;
  numeroParcelasTotal?: number;
  quantidadeParcelasQuitadas?: number;
  quantidadeParcelasAbertas?: number;
  valorMediaParcelaDoVeiculo?: number;
  financiadoPor?: string;
  primeiroVencimento?: string;
  ultimoVencimento?: string;
  situacaoContratoAlienacao?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  veiculoSubstituido?: string;
  contratoMaster?: number;
  dataInicioContrato?: string;
  dataTerminoContrato?: string;
  periodoLocacaoMaster?: string;
  ultimoContrato?: string;
  periodoLocacaoVeiculo?: string;
  totalRecebido?: number;
  parcelasRecebidas?: number;
  totalAReceber?: number;
  parcelasAReceber?: number;
  valorTarifaLocacaoAtual?: number;
}

export interface DadosClienteBI {
  razaoSocial: string;
  descricaoUnidade?: string;
  numeroDocumento?: string;
  dataEmissao?: string;
  descricaoTipoDocumento?: string;
  valorBruto?: number;
  valorDocumento?: number;
  dataVencimento?: string;
  nomeFantasia?: string;
  areaAtuacao?: string;
  previsao?: string;
  valorCentroReceita?: number;
  descricaoCentroReceita?: string;
  codigoFormaPagamento?: number;
}

// Contract Master Types
export interface ContratoMaster {
  codigoContratoMaster: number;
  codigoEmpresa: number;
  codigoUnidade: number;
  codigoCliente: number;
  razaoSocial?: string;
  email?: string;
  telefone?: string;
  dataHoraInicio?: string;
  dataHoraTermino?: string;
  tipoContrato?: string;
  valorTotal?: number;
  statusContrato?: string;
  observacoes?: string;
  criadoPor?: number;
  dataCriacao?: string;
  atualizadoPor?: number;
  dataAtualizacao?: string;
}

// Reservation Types
export interface Reserva {
  codigoReserva: number;
  codigoEmpresa: number;
  codigoUnidade: number;
  codigoCliente: number;
  razaoSocial?: string;
  codigoGrupo?: number;
  codigoMVA?: string;
  dataHoraInicioPrevista?: string;
  dataHoraTerminoPrevista?: string;
  valorPrevisto?: number;
  statusReserva?: string;
  observacoes?: string;
  criadoPor?: number;
  dataCriacao?: string;
  codigoContratoGerado?: number;
}

// Payment Method Types
export interface FormaPagamento {
  codigoFormaPagamento: number;
  descricao: string;
  tipoPagamento?: string;
  ativo?: string;
  prazoDias?: number;
  taxaJuros?: number;
  descontoPercentual?: number;
}

// OS (Service Order) Types
export interface OS {
  codigoOS: number;
  codigoEmpresa: number;
  codigoUnidade: number;
  dataAbertura?: string;
  placa?: string;
  codigoFornecedor?: number;
  numeroDocumento?: string;
  valorTotal?: number;
  quantidadeItens?: number;
}

export interface OSItem {
  numeroItem: number;
  valorItem?: number;
  quantidade?: number;
  valorTotalItem?: number;
}

export interface OSDetail extends OS {
  itens?: OSItem[];
}

export interface VehicleExpense {
  placa: string;
  codigoMVA?: number;
  totalExpenses: number;
  expenseCount: number;
  firstExpenseDate?: string;
  lastExpenseDate?: string;
  avgExpenseValue?: number;
  maxExpenseValue?: number;
  totalItems: number;
}