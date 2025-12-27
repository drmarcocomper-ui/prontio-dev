// Pacientes.gs
// ---------------------------------------------------------------------------
// Módulo backend de Pacientes do PRONTIO
//
// ✅ ATUALIZAÇÃO (v2 - aba profissional):
// - Suporta nova estrutura da aba "Pacientes":
//   idPaciente	status	nomeCompleto	nomeSocial	sexo	dataNascimento	estadoCivil	cpf	rg	rgOrgaoEmissor
//   telefonePrincipal	telefoneSecundario	email	cep	logradouro	numero	complemento	bairro	cidade	estado
//   tipoSanguineo	alergias	observacoesClinicas	observacoesAdministrativas	criadoEm	atualizadoEm
//
// ✅ COMPATIBILIDADE (não quebra front antigo):
// - Continua retornando aliases: ID_Paciente, ativo(boolean), telefone1/telefone2,
//   dataCadastro (alias de criadoEm), enderecoCidade/enderecoBairro/enderecoUf, etc.
//
// FIX (WebApp):
// - Não usar SpreadsheetApp.getActive() diretamente (pode apontar para planilha errada no WebApp).
// - Preferir PRONTIO_getDb_() quando disponível.
//
// DIAGNÓSTICO:
// - Action Pacientes_DebugInfo para confirmar spreadsheetId/aba/linhas/amostra.
//
// ✅ UPDATE (seguro, retrocompatível):
// - _toText_ agora sanitiza "#ERROR!/#N/A/#REF!/#VALUE!" para não vazar para o front.
// - _ativoToStatus_ não defaulta INATIVO quando ativo não veio (undefined); default = ATIVO.
// - pacienteRowToObject_ inclui nomeExibicao (não quebra: campo extra).
// - handlePacientesAction aceita ctx como 3º argumento (ignora), compat com Registry/Api.
// ---------------------------------------------------------------------------

/** Nome da aba de pacientes na planilha */
var PACIENTES_SHEET_NAME = 'Pacientes';

function _pacientesThrow_(code, message, details) {
  var err = new Error(String(message || 'Erro.'));
  err.code = String(code || 'INTERNAL_ERROR');
  err.details = (details === undefined ? null : details);
  throw err;
}

/**
 * ✅ Fonte de DB correta no WebApp:
 * - Preferência: PRONTIO_getDb_() (Utils.gs) -> Spreadsheet por ID
 * - Fallback: getActiveSpreadsheet/getActive
 */
function _pacientesGetDb_() {
  try {
    if (typeof PRONTIO_getDb_ === "function") {
      var ss = PRONTIO_getDb_();
      if (ss) return ss;
    }
  } catch (_) {}

  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    return SpreadsheetApp.getActive();
  }
}

/** Helpers de data/hora */
function _tz_() {
  return Session.getScriptTimeZone() || 'America/Sao_Paulo';
}
function _formatDateYMD_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, _tz_(), 'yyyy-MM-dd');
}
function _formatDateTime_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, _tz_(), 'yyyy-MM-dd HH:mm:ss');
}

/**
 * ✅ Sanitização:
 * - Evita vazar valores de erro do Sheets para o front (#ERROR!, #N/A, etc.)
 */
function _toText_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v).trim();

  // Sanitiza erros comuns de planilha
  if (s === '#ERROR!' || s === '#N/A' || s === '#REF!' || s === '#VALUE!' || s === '#DIV/0!') return '';
  return s;
}

function _onlyDigits_(s) {
  return String(s || '').replace(/\D+/g, '');
}

/**
 * Obtém (ou cria) a aba Pacientes.
 * Observação: hoje você já está migrando no modo direto, então normalmente ela já existe.
 */
function getPacientesSheet_() {
  var ss = _pacientesGetDb_();
  if (!ss) {
    _pacientesThrow_("PACIENTES_DB_NULL", "Não foi possível obter a planilha do banco (PRONTIO_getDb_/getActive).", null);
  }

  var sh = ss.getSheetByName(PACIENTES_SHEET_NAME);
  if (!sh) {
    // Se precisar criar do zero, já cria no modelo novo (v2)
    var header = [
      'idPaciente','status','nomeCompleto','nomeSocial','sexo','dataNascimento','estadoCivil','cpf','rg','rgOrgaoEmissor',
      'telefonePrincipal','telefoneSecundario','email','cep','logradouro','numero','complemento','bairro','cidade','estado',
      'tipoSanguineo','alergias','observacoesClinicas','observacoesAdministrativas','criadoEm','atualizadoEm'
    ];
    sh = ss.insertSheet(PACIENTES_SHEET_NAME);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sh;
}

/**
 * Lê o cabeçalho da aba (linha 1) e monta um mapa:
 * { "idPaciente": 0, "nomeCompleto": 2, ... }
 */
function getPacientesHeaderMap_() {
  var sh = getPacientesSheet_();
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) {
    _pacientesThrow_('PACIENTES_HEADER_EMPTY', 'Cabeçalho da aba Pacientes está vazio.', null);
  }

  var headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  headerRow.forEach(function (colName, index) {
    var nome = String(colName || '').trim();
    if (nome) map[nome] = index; // índice 0-based
  });
  return map;
}

/** Busca a primeira coluna existente entre vários nomes possíveis */
function _colAny_(headerMap, names) {
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    if (headerMap[n] != null) return n;
  }
  return null;
}

function getCellByColName_(row, headerMap, colName) {
  var idx = headerMap[colName];
  if (idx == null) return '';
  return row[idx];
}

function setCellByColName_(row, headerMap, colName, value) {
  var idx = headerMap[colName];
  if (idx == null) return;
  row[idx] = (value === undefined || value === null) ? '' : value;
}

/**
 * Gera um ID_Paciente único e estável.
 * Mantive seu formato para não quebrar referências:
 * "PAC-<timestamp>-<random>"
 */
function gerarIdPaciente_() {
  var prefix = 'PAC-';
  var now = new Date().getTime();
  var rand = Math.floor(Math.random() * 1000); // 0–999
  var randStr = ('000' + rand).slice(-3);
  return prefix + now + '-' + randStr;
}

/** Converte qualquer célula data -> string yyyy-MM-dd, se possível */
function _readDateYMD_(cell) {
  if (cell instanceof Date) return _formatDateYMD_(cell);
  var s = _toText_(cell);
  // aceita yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // aceita dd/mm/yyyy
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return s;
}

/** Converte qualquer célula data/hora -> string yyyy-MM-dd HH:mm:ss, se possível */
function _readDateTime_(cell) {
  if (cell instanceof Date) return _formatDateTime_(cell);
  return _toText_(cell);
}

/** status -> ativo(boolean) */
function _statusToAtivo_(status) {
  var st = String(status || '').trim().toUpperCase();
  if (!st) return true; // default: ativo
  return !(st === 'INATIVO' || st === 'OBITO');
}

/**
 * ativo(boolean ou 'SIM/NAO') -> status
 * ✅ UPDATE: se ativo não veio (undefined/null) e status vazio, default ATIVO.
 */
function _ativoToStatus_(ativo, currentStatus) {
  // Se o payload trouxe status, respeita status.
  if (currentStatus) return String(currentStatus).trim().toUpperCase();

  // Se NÃO veio ativo, default ATIVO (evita criar paciente já INATIVO por engano)
  if (ativo === undefined || ativo === null) return 'ATIVO';

  // Senão converte ativo
  var b = !!ativo;
  return b ? 'ATIVO' : 'INATIVO';
}

/**
 * Converte uma linha da planilha em objeto "paciente completo" para o front.
 * ✅ Lê tanto colunas novas quanto antigas (se existirem).
 * ✅ Retorna campos novos + aliases antigos.
 * ✅ UPDATE: adiciona nomeExibicao (campo extra, não quebra compat).
 */
function pacienteRowToObject_(row, headerMap) {
  // IDs (novo e antigo)
  var colIdNew = _colAny_(headerMap, ['idPaciente']);
  var colIdOld = _colAny_(headerMap, ['ID_Paciente']);
  var idRaw = _toText_(colIdNew ? getCellByColName_(row, headerMap, colIdNew) : (colIdOld ? getCellByColName_(row, headerMap, colIdOld) : ''));

  // status/ativo
  var colStatus = _colAny_(headerMap, ['status']);
  var colAtivoOld = _colAny_(headerMap, ['Ativo', 'ativo']);
  var status = _toText_(colStatus ? getCellByColName_(row, headerMap, colStatus) : '');

  if (!status && colAtivoOld) {
    var a = String(getCellByColName_(row, headerMap, colAtivoOld) || '').trim().toUpperCase();
    var ativoBoolOld = !(a === 'NAO' || a === 'N' || a === 'FALSE' || a === '0');
    status = ativoBoolOld ? 'ATIVO' : 'INATIVO';
  }

  var statusFinal = status || 'ATIVO';
  var ativoBool = _statusToAtivo_(statusFinal);

  // Nome
  var nomeCompleto = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['nomeCompleto','NomeCompleto']) || ''));

  // Dados pessoais
  var sexo = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['sexo','Sexo']) || ''));

  var dataNascCell = getCellByColName_(row, headerMap, _colAny_(headerMap, ['dataNascimento','DataNascimento']) || '');
  var dataNascimentoStr = _readDateYMD_(dataNascCell);

  // Contatos
  var tel1 = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['telefonePrincipal','Telefone']) || ''));
  var tel2 = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['telefoneSecundario','Telefone2']) || ''));

  var emailCol = _colAny_(headerMap, ['email','E-mail','Email']);
  var email = _toText_(emailCol ? getCellByColName_(row, headerMap, emailCol) : '');

  // Doc
  var cpfCol = _colAny_(headerMap, ['cpf','CPF']);
  var cpf = _toText_(cpfCol ? getCellByColName_(row, headerMap, cpfCol) : '');
  var rg = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['rg','RG']) || ''));
  var rgOrgaoEmissor = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['rgOrgaoEmissor']) || ''));

  // Endereço (novo) + compat antigo (Cidade/Bairro/EnderecoUf)
  var cep = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['cep']) || ''));
  var logradouro = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['logradouro']) || ''));
  var numero = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['numero']) || ''));
  var complemento = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['complemento']) || ''));
  var bairro = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['bairro','Bairro']) || ''));
  var cidade = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['cidade','Cidade']) || ''));
  var estado = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['estado','EnderecoUf']) || ''));

  // Observações
  var obsClin = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['observacoesClinicas']) || ''));
  var obsAdm = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['observacoesAdministrativas','ObsImportantes','observacoes']) || ''));

  // Datas (novo: criadoEm/atualizadoEm) + compat antigo (DataCadastro)
  var criadoEmCol = _colAny_(headerMap, ['criadoEm']);
  var atualizadoEmCol = _colAny_(headerMap, ['atualizadoEm']);
  var dataCadastroCol = _colAny_(headerMap, ['DataCadastro']);

  var criadoEm = _readDateTime_(criadoEmCol ? getCellByColName_(row, headerMap, criadoEmCol) : (dataCadastroCol ? getCellByColName_(row, headerMap, dataCadastroCol) : ''));
  var atualizadoEm = _readDateTime_(atualizadoEmCol ? getCellByColName_(row, headerMap, atualizadoEmCol) : '');

  // Nome social (se existir)
  var nomeSocial = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['nomeSocial']) || ''));

  // ✅ Campo extra útil (não quebra ninguém): nome de exibição
  var nomeExibicao = nomeCompleto || nomeSocial || '';

  // Monta objeto com campos novos + compat antigos
  return {
    // novos (v2)
    idPaciente: idRaw,
    status: statusFinal,
    nomeCompleto: nomeCompleto,
    nomeSocial: nomeSocial,
    nomeExibicao: nomeExibicao, // ✅ EXTRA (seguro)
    sexo: sexo,
    dataNascimento: dataNascimentoStr,
    estadoCivil: _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['estadoCivil']) || '')),
    cpf: cpf,
    rg: rg,
    rgOrgaoEmissor: rgOrgaoEmissor,
    telefonePrincipal: tel1,
    telefoneSecundario: tel2,
    email: email,
    cep: cep,
    logradouro: logradouro,
    numero: numero,
    complemento: complemento,
    bairro: bairro,
    cidade: cidade,
    estado: estado,
    tipoSanguineo: _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['tipoSanguineo']) || '')),
    alergias: _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['alergias']) || '')),
    observacoesClinicas: obsClin,
    observacoesAdministrativas: obsAdm,
    criadoEm: criadoEm,
    atualizadoEm: atualizadoEm,

    // aliases antigos (compat)
    ID_Paciente: idRaw,
    telefone1: tel1,
    telefone2: tel2,
    telefone: tel1,
    enderecoCidade: cidade,
    enderecoBairro: bairro,
    enderecoUf: estado,
    dataCadastro: criadoEm, // alias
    ativo: ativoBool,

    // campos antigos que podem existir (mantidos se o front usar)
    profissao: _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['Profissão']) || '')),
    planoSaude: _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['PlanoSaude']) || '')),
    numeroCarteirinha: _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['NumeroCarteirinha']) || '')),
    obsImportantes: obsAdm
  };
}

/**
 * Lê todos os pacientes em forma de objetos.
 */
function readAllPacientes_() {
  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return [];

  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var list = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row.join('')).trim() === '') continue;

    var paciente = pacienteRowToObject_(row, headerMap);
    if (!paciente.idPaciente && !paciente.nomeCompleto && !paciente.nomeSocial) continue;

    list.push(paciente);
  }

  return list;
}

/**
 * ✅ Action de diagnóstico (para confirmar DB/aba/linhas)
 */
function Pacientes_DebugInfo(payload) {
  var ss = _pacientesGetDb_();
  var sh = null;
  var exists = false;

  try {
    sh = ss.getSheetByName(PACIENTES_SHEET_NAME);
    exists = !!sh;
  } catch (_) {
    exists = false;
  }

  var lastRow = exists ? sh.getLastRow() : 0;
  var lastCol = exists ? sh.getLastColumn() : 0;

  var header = [];
  if (exists && lastCol > 0) {
    header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x || ""); });
  }

  var sample = [];
  if (exists && lastRow >= 2) {
    var map = getPacientesHeaderMap_();
    var rows = sh.getRange(2, 1, Math.min(10, lastRow - 1), lastCol).getValues();
    for (var i = 0; i < rows.length; i++) {
      var p = pacienteRowToObject_(rows[i], map);
      sample.push({ idPaciente: p.idPaciente, nomeCompleto: p.nomeCompleto, nomeSocial: p.nomeSocial, nomeExibicao: p.nomeExibicao, status: p.status, ativo: p.ativo });
    }
  }

  return {
    spreadsheetId: ss.getId ? ss.getId() : "",
    spreadsheetName: ss.getName ? ss.getName() : "",
    sheetName: PACIENTES_SHEET_NAME,
    sheetExists: exists,
    lastRow: lastRow,
    lastCol: lastCol,
    header: header,
    sample: sample
  };
}

/**
 * Roteador de ações específicas de Pacientes.
 * ✅ Mantém seus aliases antigos (não quebra front)
 * ✅ UPDATE: aceita ctx como terceiro argumento (ignora) para compat com Registry/Api
 */
function handlePacientesAction(action, payload, ctx) {
  // compat: algumas chamadas podem vir como "Pacientes.ListarSelecao" etc.
  if (action === 'Pacientes.ListarSelecao') action = 'Pacientes_ListarSelecao';
  if (action === 'Pacientes.CriarBasico') action = 'Pacientes_CriarBasico';
  if (action === 'Pacientes.Criar') action = 'Pacientes_CriarBasico';
  if (action === 'Pacientes.BuscarSimples') action = 'Pacientes_BuscarSimples';
  if (action === 'Pacientes.Listar' || action === 'Pacientes.ListarTodos') action = 'Pacientes_Listar';
  if (action === 'Pacientes.ObterPorId') action = 'Pacientes_ObterPorId';
  if (action === 'Pacientes.Atualizar') action = 'Pacientes_Atualizar';
  if (action === 'Pacientes.AlterarStatus' || action === 'Pacientes.AlterarStatusAtivo') action = 'Pacientes_AlterarStatus';

  switch (action) {
    case 'Pacientes_DebugInfo':
      return Pacientes_DebugInfo(payload);

    case 'Pacientes_ListarSelecao':
      return Pacientes_ListarSelecao(payload);

    case 'Pacientes_CriarBasico':
      return Pacientes_CriarBasico(payload);

    case 'Pacientes_BuscarSimples':
      return Pacientes_BuscarSimples(payload);

    case 'Pacientes_Listar':
      return Pacientes_Listar(payload);

    case 'Pacientes_ObterPorId':
      return Pacientes_ObterPorId(payload);

    case 'Pacientes_Atualizar':
      return Pacientes_Atualizar(payload);

    case 'Pacientes_AlterarStatus':
      return Pacientes_AlterarStatus(payload);

    default:
      _pacientesThrow_('PACIENTES_UNKNOWN_ACTION', 'Ação de Pacientes desconhecida: ' + action, null);
  }
}

/**
 * Pacientes_ListarSelecao
 * ✅ Retorna seleção de pacientes ativos (compatível)
 */
function Pacientes_ListarSelecao(payload) {
  var todos = readAllPacientes_();
  var ativos = todos.filter(function (p) { return p.ativo; });

  var pacientes = ativos.map(function (p) {
    return {
      ID_Paciente: p.ID_Paciente,
      idPaciente: p.idPaciente,
      nomeCompleto: p.nomeCompleto,
      nomeSocial: p.nomeSocial,
      nomeExibicao: p.nomeExibicao,
      documento: p.cpf,
      telefone: p.telefonePrincipal || p.telefone1 || p.telefone || ''
    };
  });

  return { pacientes: pacientes };
}

/**
 * Pacientes_CriarBasico
 * ✅ Agora grava no modelo novo (se as colunas existirem), mantendo compat.
 */
function Pacientes_CriarBasico(payload) {
  payload = payload || {};
  var nomeCompleto = _toText_(payload.nomeCompleto);

  if (!nomeCompleto) {
    _pacientesThrow_('PACIENTES_MISSING_NOME', 'nomeCompleto é obrigatório para criar paciente.', null);
  }

  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastCol = sh.getLastColumn();

  var idPaciente = gerarIdPaciente_();
  var agora = new Date();
  var agoraStr = _formatDateTime_(agora);

  var linha = new Array(lastCol).fill('');

  // pega campos (aceita nomes novos e antigos do payload)
  var cpf = _toText_(payload.cpf || payload.documento || '');
  var telefone1 = _toText_(payload.telefonePrincipal || payload.telefone1 || payload.telefone || '');
  var telefone2 = _toText_(payload.telefoneSecundario || payload.telefone2 || '');
  var email = _toText_(payload.email || '');
  var sexo = _toText_(payload.sexo || '');
  var dataNascimento = _toText_(payload.dataNascimento || payload.nascimento || '');
  var status = _toText_(payload.status || '');
  var ativoPayload = (typeof payload.ativo !== 'undefined') ? !!payload.ativo : undefined;

  // endereço (novos + compat)
  var cidade = _toText_(payload.cidade || payload.enderecoCidade || '');
  var bairro = _toText_(payload.bairro || payload.enderecoBairro || '');
  var uf = _toText_(payload.estado || payload.enderecoUf || '');

  // observações
  var obsClin = _toText_(payload.observacoesClinicas || '');
  var obsAdm = _toText_(payload.observacoesAdministrativas || payload.obsImportantes || payload.observacoes || '');

  // grava ID (novo ou antigo)
  var colIdNew = _colAny_(headerMap, ['idPaciente']);
  var colIdOld = _colAny_(headerMap, ['ID_Paciente']);
  if (colIdNew) setCellByColName_(linha, headerMap, colIdNew, idPaciente);
  if (colIdOld) setCellByColName_(linha, headerMap, colIdOld, idPaciente);

  // status/ativo
  var colStatus = _colAny_(headerMap, ['status']);
  var colAtivoOld = _colAny_(headerMap, ['Ativo','ativo']);
  var statusFinal = _ativoToStatus_(ativoPayload, status);

  if (colStatus) setCellByColName_(linha, headerMap, colStatus, statusFinal);
  if (colAtivoOld) setCellByColName_(linha, headerMap, colAtivoOld, (statusFinal === 'ATIVO') ? 'SIM' : 'NAO');

  // nome
  var colNomeNew = _colAny_(headerMap, ['nomeCompleto']);
  var colNomeOld = _colAny_(headerMap, ['NomeCompleto']);
  if (colNomeNew) setCellByColName_(linha, headerMap, colNomeNew, nomeCompleto);
  if (colNomeOld) setCellByColName_(linha, headerMap, colNomeOld, nomeCompleto);

  // cpf
  var colCpfNew = _colAny_(headerMap, ['cpf']);
  var colCpfOld = _colAny_(headerMap, ['CPF']);
  if (colCpfNew) setCellByColName_(linha, headerMap, colCpfNew, cpf);
  if (colCpfOld) setCellByColName_(linha, headerMap, colCpfOld, cpf);

  // telefones / email / sexo / data nasc
  var colTelNew = _colAny_(headerMap, ['telefonePrincipal']);
  var colTelOld = _colAny_(headerMap, ['Telefone']);
  if (colTelNew) setCellByColName_(linha, headerMap, colTelNew, telefone1);
  if (colTelOld) setCellByColName_(linha, headerMap, colTelOld, telefone1);

  var colTel2New = _colAny_(headerMap, ['telefoneSecundario']);
  var colTel2Old = _colAny_(headerMap, ['Telefone2']);
  if (colTel2New) setCellByColName_(linha, headerMap, colTel2New, telefone2);
  if (colTel2Old) setCellByColName_(linha, headerMap, colTel2Old, telefone2);

  var colEmailNew = _colAny_(headerMap, ['email']);
  var colEmailOld = _colAny_(headerMap, ['E-mail','Email']);
  if (colEmailNew) setCellByColName_(linha, headerMap, colEmailNew, email);
  if (colEmailOld) setCellByColName_(linha, headerMap, colEmailOld, email);

  var colSexoNew = _colAny_(headerMap, ['sexo']);
  var colSexoOld = _colAny_(headerMap, ['Sexo']);
  if (colSexoNew) setCellByColName_(linha, headerMap, colSexoNew, sexo);
  if (colSexoOld) setCellByColName_(linha, headerMap, colSexoOld, sexo);

  var colNascNew = _colAny_(headerMap, ['dataNascimento']);
  var colNascOld = _colAny_(headerMap, ['DataNascimento']);
  if (colNascNew) setCellByColName_(linha, headerMap, colNascNew, dataNascimento);
  if (colNascOld) setCellByColName_(linha, headerMap, colNascOld, dataNascimento);

  // cidade/bairro/uf (novos + compat)
  if (_colAny_(headerMap, ['cidade'])) setCellByColName_(linha, headerMap, 'cidade', cidade);
  if (_colAny_(headerMap, ['bairro'])) setCellByColName_(linha, headerMap, 'bairro', bairro);
  if (_colAny_(headerMap, ['estado'])) setCellByColName_(linha, headerMap, 'estado', uf);

  if (_colAny_(headerMap, ['Cidade'])) setCellByColName_(linha, headerMap, 'Cidade', cidade);
  if (_colAny_(headerMap, ['Bairro'])) setCellByColName_(linha, headerMap, 'Bairro', bairro);
  if (_colAny_(headerMap, ['EnderecoUf'])) setCellByColName_(linha, headerMap, 'EnderecoUf', uf);

  // obs (novos + compat)
  if (_colAny_(headerMap, ['observacoesClinicas'])) setCellByColName_(linha, headerMap, 'observacoesClinicas', obsClin);
  if (_colAny_(headerMap, ['observacoesAdministrativas'])) setCellByColName_(linha, headerMap, 'observacoesAdministrativas', obsAdm);
  if (_colAny_(headerMap, ['ObsImportantes'])) setCellByColName_(linha, headerMap, 'ObsImportantes', obsAdm);

  // datas
  if (_colAny_(headerMap, ['criadoEm'])) setCellByColName_(linha, headerMap, 'criadoEm', agoraStr);
  if (_colAny_(headerMap, ['atualizadoEm'])) setCellByColName_(linha, headerMap, 'atualizadoEm', agoraStr);
  if (_colAny_(headerMap, ['DataCadastro'])) setCellByColName_(linha, headerMap, 'DataCadastro', agoraStr);

  // campos adicionais se existirem
  if (_colAny_(headerMap, ['rg'])) setCellByColName_(linha, headerMap, 'rg', _toText_(payload.rg || ''));
  if (_colAny_(headerMap, ['RG'])) setCellByColName_(linha, headerMap, 'RG', _toText_(payload.rg || ''));

  if (_colAny_(headerMap, ['rgOrgaoEmissor'])) setCellByColName_(linha, headerMap, 'rgOrgaoEmissor', _toText_(payload.rgOrgaoEmissor || ''));

  if (_colAny_(headerMap, ['estadoCivil'])) setCellByColName_(linha, headerMap, 'estadoCivil', _toText_(payload.estadoCivil || ''));

  if (_colAny_(headerMap, ['nomeSocial'])) setCellByColName_(linha, headerMap, 'nomeSocial', _toText_(payload.nomeSocial || ''));

  if (_colAny_(headerMap, ['cep'])) setCellByColName_(linha, headerMap, 'cep', _toText_(payload.cep || ''));
  if (_colAny_(headerMap, ['logradouro'])) setCellByColName_(linha, headerMap, 'logradouro', _toText_(payload.logradouro || payload.endereco || ''));
  if (_colAny_(headerMap, ['numero'])) setCellByColName_(linha, headerMap, 'numero', _toText_(payload.numero || ''));
  if (_colAny_(headerMap, ['complemento'])) setCellByColName_(linha, headerMap, 'complemento', _toText_(payload.complemento || ''));
  if (_colAny_(headerMap, ['tipoSanguineo'])) setCellByColName_(linha, headerMap, 'tipoSanguineo', _toText_(payload.tipoSanguineo || ''));
  if (_colAny_(headerMap, ['alergias'])) setCellByColName_(linha, headerMap, 'alergias', _toText_(payload.alergias || ''));

  var nextRow = sh.getLastRow() + 1;
  sh.getRange(nextRow, 1, 1, lastCol).setValues([linha]);

  return { ID_Paciente: idPaciente, idPaciente: idPaciente };
}

/**
 * Pacientes_BuscarSimples
 */
function Pacientes_BuscarSimples(payload) {
  payload = payload || {};
  var termo = String(payload.termo || '').toLowerCase().trim();
  var limite = Number(payload.limite || 30);
  if (!limite || limite <= 0) limite = 30;

  if (!termo) return { pacientes: [] };

  var todos = readAllPacientes_();
  if (!todos.length) return { pacientes: [] };

  var resultados = [];
  for (var i = 0; i < todos.length; i++) {
    var p = todos[i];
    if (!p.ativo) continue;

    var haystack = [p.nomeExibicao || p.nomeCompleto || '', p.cpf || '', p.telefonePrincipal || p.telefone1 || p.telefone || '']
      .join(' ')
      .toLowerCase();

    if (haystack.indexOf(termo) !== -1) {
      resultados.push({
        ID_Paciente: p.ID_Paciente,
        idPaciente: p.idPaciente,
        nome: p.nomeExibicao || p.nomeCompleto,
        documento: p.cpf,
        telefone: p.telefonePrincipal || p.telefone1 || p.telefone || '',
        data_nascimento: p.dataNascimento
      });

      if (resultados.length >= limite) break;
    }
  }

  return { pacientes: resultados };
}

/**
 * Pacientes_Listar
 */
function Pacientes_Listar(payload) {
  payload = payload || {};
  var termo = String(payload.termo || '').toLowerCase().trim();
  var somenteAtivos = !!payload.somenteAtivos;
  var ordenacao = String(payload.ordenacao || 'dataCadastroDesc');

  var todos = readAllPacientes_();

  var filtrados = todos.filter(function (p) {
    if (somenteAtivos && !p.ativo) return false;

    if (!termo) return true;

    var texto = [p.nomeExibicao || p.nomeCompleto || '', p.cpf || '', (p.telefonePrincipal || p.telefone1 || p.telefone || ''), p.email || '']
      .join(' ')
      .toLowerCase();

    return texto.indexOf(termo) !== -1;
  });

  filtrados.sort(function (a, b) {
    if (ordenacao === 'nomeAsc' || ordenacao === 'nomeDesc') {
      var na = (a.nomeExibicao || a.nomeCompleto || '').toLowerCase();
      var nb = (b.nomeExibicao || b.nomeCompleto || '').toLowerCase();
      if (na < nb) return ordenacao === 'nomeAsc' ? -1 : 1;
      if (na > nb) return ordenacao === 'nomeAsc' ? 1 : -1;
      return 0;
    }

    // dataCadastro/dataCadastroDesc -> usa criadoEm/dataCadastro (compat)
    var da = Date.parse(a.criadoEm || a.dataCadastro || '') || 0;
    var db = Date.parse(b.criadoEm || b.dataCadastro || '') || 0;

    if (da < db) return ordenacao === 'dataCadastroAsc' ? -1 : 1;
    if (da > db) return ordenacao === 'dataCadastroAsc' ? 1 : -1;
    return 0;
  });

  return { pacientes: filtrados };
}

/**
 * Pacientes_ObterPorId
 */
function Pacientes_ObterPorId(payload) {
  var id = '';
  if (payload) {
    if (payload.ID_Paciente) id = String(payload.ID_Paciente).trim();
    else if (payload.idPaciente) id = String(payload.idPaciente).trim();
  }

  if (!id) _pacientesThrow_('PACIENTES_MISSING_ID', 'ID_Paciente é obrigatório em Pacientes_ObterPorId.', null);

  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  if (lastRow < 2) _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);

  // busca pela coluna idPaciente (novo) ou ID_Paciente (antigo)
  var colId = _colAny_(headerMap, ['idPaciente','ID_Paciente']);
  if (!colId) _pacientesThrow_('PACIENTES_ID_COL_NOT_FOUND', 'Coluna idPaciente/ID_Paciente não encontrada na aba Pacientes.', null);

  var idxId = headerMap[colId];

  var range = sh.getRange(2, 1, lastRow - 1, lastCol);
  var values = range.getValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowId = String(row[idxId] || '').trim();
    if (rowId === id) {
      var paciente = pacienteRowToObject_(row, headerMap);
      return { paciente: paciente };
    }
  }

  _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);
}

/**
 * Pacientes_Atualizar
 * ✅ Atualiza tanto colunas novas quanto antigas (se existirem).
 * ✅ Não exige enviar tudo: atualiza apenas campos presentes no payload.
 */
function Pacientes_Atualizar(payload) {
  payload = payload || {};

  var id = '';
  if (payload.ID_Paciente) id = String(payload.ID_Paciente).trim();
  else if (payload.idPaciente) id = String(payload.idPaciente).trim();
  if (!id) _pacientesThrow_('PACIENTES_MISSING_ID', 'ID_Paciente é obrigatório em Pacientes_Atualizar.', null);

  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);

  var colId = _colAny_(headerMap, ['idPaciente','ID_Paciente']);
  if (!colId) _pacientesThrow_('PACIENTES_ID_COL_NOT_FOUND', 'Coluna idPaciente/ID_Paciente não encontrada na aba Pacientes.', null);
  var idxId = headerMap[colId];

  var range = sh.getRange(2, 1, lastRow - 1, lastCol);
  var values = range.getValues();

  var foundRowIndex = -1;
  for (var i = 0; i < values.length; i++) {
    var rowId = String(values[i][idxId] || '').trim();
    if (rowId === id) { foundRowIndex = i; break; }
  }

  if (foundRowIndex === -1) _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);

  var row = values[foundRowIndex];

  // helper para atualizar se veio no payload
  function setIfProvided(colNames, propNames, transformFn) {
    // detecta se algum prop foi enviado
    var has = false;
    for (var k = 0; k < propNames.length; k++) {
      if (Object.prototype.hasOwnProperty.call(payload, propNames[k])) { has = true; break; }
    }
    if (!has) return;

    // obtém valor
    var v = '';
    for (var j = 0; j < propNames.length; j++) {
      var pn = propNames[j];
      if (Object.prototype.hasOwnProperty.call(payload, pn)) { v = payload[pn]; break; }
    }
    if (transformFn) v = transformFn(v);

    // escreve nas colunas existentes (pode ter nova e antiga)
    for (var c = 0; c < colNames.length; c++) {
      var col = colNames[c];
      if (headerMap[col] != null) row[headerMap[col]] = (v === undefined || v === null) ? '' : v;
    }
  }

  // campos principais
  setIfProvided(['nomeCompleto','NomeCompleto'], ['nomeCompleto'], function (v) { return _toText_(v); });
  setIfProvided(['nomeSocial'], ['nomeSocial'], function (v) { return _toText_(v); });
  setIfProvided(['cpf','CPF'], ['cpf','documento'], function (v) { return _toText_(v); });
  setIfProvided(['rg','RG'], ['rg'], function (v) { return _toText_(v); });
  setIfProvided(['rgOrgaoEmissor'], ['rgOrgaoEmissor'], function (v) { return _toText_(v); });

  setIfProvided(['sexo','Sexo'], ['sexo'], function (v) { return _toText_(v); });
  setIfProvided(['dataNascimento','DataNascimento'], ['dataNascimento'], function (v) { return _toText_(v); });
  setIfProvided(['estadoCivil'], ['estadoCivil'], function (v) { return _toText_(v); });

  setIfProvided(['telefonePrincipal','Telefone'], ['telefonePrincipal','telefone1','telefone'], function (v) { return _toText_(v); });
  setIfProvided(['telefoneSecundario','Telefone2'], ['telefoneSecundario','telefone2'], function (v) { return _toText_(v); });

  // email
  setIfProvided(['email','E-mail','Email'], ['email'], function (v) { return _toText_(v); });

  // endereço
  setIfProvided(['cep'], ['cep'], function (v) { return _toText_(v); });
  setIfProvided(['logradouro'], ['logradouro','endereco'], function (v) { return _toText_(v); });
  setIfProvided(['numero'], ['numero'], function (v) { return _toText_(v); });
  setIfProvided(['complemento'], ['complemento'], function (v) { return _toText_(v); });
  setIfProvided(['bairro','Bairro'], ['bairro','enderecoBairro'], function (v) { return _toText_(v); });
  setIfProvided(['cidade','Cidade'], ['cidade','enderecoCidade'], function (v) { return _toText_(v); });
  setIfProvided(['estado','EnderecoUf'], ['estado','enderecoUf'], function (v) { return _toText_(v); });

  // clínico/admin
  setIfProvided(['tipoSanguineo'], ['tipoSanguineo'], function (v) { return _toText_(v); });
  setIfProvided(['alergias'], ['alergias'], function (v) { return _toText_(v); });
  setIfProvided(['observacoesClinicas'], ['observacoesClinicas'], function (v) { return _toText_(v); });
  setIfProvided(['observacoesAdministrativas','ObsImportantes'], ['observacoesAdministrativas','obsImportantes','observacoes'], function (v) { return _toText_(v); });

  // status/ativo (aceita ambos)
  var statusProvided = Object.prototype.hasOwnProperty.call(payload, 'status');
  var ativoProvided = Object.prototype.hasOwnProperty.call(payload, 'ativo');

  if (statusProvided || ativoProvided) {
    var status = statusProvided ? _toText_(payload.status).toUpperCase() : '';
    var ativoBool = ativoProvided ? !!payload.ativo : undefined;
    var statusFinal = _ativoToStatus_(ativoBool, status);

    if (headerMap['status'] != null) row[headerMap['status']] = statusFinal;
    if (headerMap['Ativo'] != null) row[headerMap['Ativo']] = (statusFinal === 'ATIVO') ? 'SIM' : 'NAO';
    if (headerMap['ativo'] != null) row[headerMap['ativo']] = (statusFinal === 'ATIVO') ? 'SIM' : 'NAO';
  }

  // atualizadoEm
  var agoraStr = _formatDateTime_(new Date());
  if (headerMap['atualizadoEm'] != null) row[headerMap['atualizadoEm']] = agoraStr;

  var writeRowIndex = foundRowIndex + 2;
  sh.getRange(writeRowIndex, 1, 1, lastCol).setValues([row]);

  var pacienteAtualizado = pacienteRowToObject_(row, headerMap);
  return { paciente: pacienteAtualizado };
}

/**
 * Pacientes_AlterarStatus
 * ✅ Continua aceitando payload.ativo (true/false) como antes.
 * ✅ Também aceita payload.status ("ATIVO" | "INATIVO" | "OBITO").
 */
function Pacientes_AlterarStatus(payload) {
  payload = payload || {};

  var id = '';
  if (payload.ID_Paciente) id = String(payload.ID_Paciente).trim();
  else if (payload.idPaciente) id = String(payload.idPaciente).trim();

  if (!id) _pacientesThrow_('PACIENTES_MISSING_ID', 'ID_Paciente é obrigatório em Pacientes_AlterarStatus.', null);

  var status = null;
  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    status = String(payload.status || '').trim().toUpperCase();
    if (!status) _pacientesThrow_('PACIENTES_MISSING_STATUS', 'Campo "status" não pode ser vazio.', null);
    if (['ATIVO','INATIVO','OBITO'].indexOf(status) === -1) {
      _pacientesThrow_('PACIENTES_INVALID_STATUS', 'status inválido. Use ATIVO | INATIVO | OBITO', { status: status });
    }
  }

  var ativoBool = null;
  if (Object.prototype.hasOwnProperty.call(payload, 'ativo')) {
    ativoBool = !!payload.ativo;
  }

  if (status === null && ativoBool === null) {
    _pacientesThrow_('PACIENTES_MISSING_ATIVO_STATUS', 'Informe "ativo" (true/false) ou "status".', null);
  }

  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);

  var colId = _colAny_(headerMap, ['idPaciente','ID_Paciente']);
  var colStatus = _colAny_(headerMap, ['status']);
  var colAtivoOld = _colAny_(headerMap, ['Ativo','ativo']);

  if (!colId) _pacientesThrow_('PACIENTES_COL_NOT_FOUND', 'Coluna idPaciente/ID_Paciente não encontrada.', null);

  var idxId = headerMap[colId];

  var range = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn());
  var values = range.getValues();

  var foundRowIndex = -1;
  for (var i = 0; i < values.length; i++) {
    var rowId = String(values[i][idxId] || '').trim();
    if (rowId === id) { foundRowIndex = i; break; }
  }

  if (foundRowIndex === -1) _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);

  var statusFinal = status ? status : (ativoBool ? 'ATIVO' : 'INATIVO');

  if (colStatus) values[foundRowIndex][headerMap[colStatus]] = statusFinal;
  if (colAtivoOld) values[foundRowIndex][headerMap[colAtivoOld]] = (statusFinal === 'ATIVO') ? 'SIM' : 'NAO';

  // atualizadoEm
  if (headerMap['atualizadoEm'] != null) values[foundRowIndex][headerMap['atualizadoEm']] = _formatDateTime_(new Date());

  var writeRowIndex = foundRowIndex + 2;
  sh.getRange(writeRowIndex, 1, 1, sh.getLastColumn()).setValues([values[foundRowIndex]]);

  return { ID_Paciente: id, idPaciente: id, status: statusFinal, ativo: (statusFinal === 'ATIVO') };
}

/* =======================================================================
   MIGRAÇÃO (opcional): ajuda a diagnosticar cabeçalho e/ou adicionar colunas
   ======================================================================= */
function Pacientes_MigrarAdicionarColunasExtras() {
  var sh = getPacientesSheet_();
  var lastCol = sh.getLastColumn();
  var headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  var existentes = {};
  for (var i = 0; i < headerRow.length; i++) {
    var nome = String(headerRow[i] || '').trim();
    if (nome) existentes[nome] = true;
  }

  // Agora as "extras" são as do modelo novo (v2) — só adiciona se estiverem faltando.
  var extras = [
    'status','nomeSocial','estadoCivil','rg','rgOrgaoEmissor',
    'telefoneSecundario','cep','logradouro','numero','complemento','bairro','cidade','estado',
    'tipoSanguineo','alergias','observacoesClinicas','observacoesAdministrativas','criadoEm','atualizadoEm'
  ];

  var colunasParaAdicionar = [];
  extras.forEach(function (nome) {
    if (!existentes[nome] && !existentes[_aliasToOld_(nome)]) {
      colunasParaAdicionar.push(nome);
    }
  });

  if (!colunasParaAdicionar.length) {
    Logger.log('Nenhuma coluna nova foi necessária. Todas já existem.');
    return;
  }

  sh.getRange(1, headerRow.length + 1, 1, colunasParaAdicionar.length).setValues([colunasParaAdicionar]);
  Logger.log('Colunas adicionadas na aba Pacientes: ' + colunasParaAdicionar.join(', '));
}

function _aliasToOld_(name) {
  // pequeno helper para evitar duplicar se existir somente no formato antigo
  var map = {
    'telefoneSecundario': 'Telefone2',
    'cidade': 'Cidade',
    'bairro': 'Bairro',
    'estado': 'EnderecoUf',
    'email': 'E-mail',
    'cpf': 'CPF',
    'sexo': 'Sexo',
    'nomeCompleto': 'NomeCompleto',
    'criadoEm': 'DataCadastro'
  };
  return map[name] || '';
}
