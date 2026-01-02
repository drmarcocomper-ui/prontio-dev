// Pacientes.gs
// ---------------------------------------------------------------------------
// Módulo backend de Pacientes do PRONTIO
//
// ✅ Estrutura da aba "Pacientes" (v2):
//   idPaciente	status	nomeCompleto	nomeSocial	sexo	dataNascimento	estadoCivil	cpf	rg	rgOrgaoEmissor
//   telefonePrincipal	telefoneSecundario	email
//   planoSaude	numeroCarteirinha
//   profissao                           ✅ (novo, agora oficial)
//   cep	logradouro	numero	complemento	bairro	cidade	estado
//   tipoSanguineo	alergias	observacoesClinicas	observacoesAdministrativas	criadoEm	atualizadoEm
//
// ✅ COMPATIBILIDADE (não quebra front antigo):
// - Retorna aliases: ID_Paciente, ativo(boolean), telefone1/telefone2,
//   dataCadastro (alias de criadoEm), enderecoCidade/enderecoBairro/enderecoUf, etc.
//
// ✅ UPDATE (Profissão):
// - garante coluna "profissao" na planilha (migração best-effort se aba já existe)
// - inclui "profissao" em RowToObject / Criar / Atualizar
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
  if (s === '#ERROR!' || s === '#N/A' || s === '#REF!' || s === '#VALUE!' || s === '#DIV/0!') return '';
  return s;
}

function _onlyDigits_(s) {
  return String(s || '').replace(/\D+/g, '');
}

/** =========================
 *  NORMALIZAÇÃO
 *  ========================= */

/** CPF: retorna só dígitos (se tiver), sem forçar tamanho */
function _cpfDigits_(cpf) {
  return _onlyDigits_(_toText_(cpf));
}

/** CPF: formata ###.###.###-## se tiver 11 dígitos, senão retorna texto limpo */
function _cpfFormat_(cpf) {
  var d = _cpfDigits_(cpf);
  if (d.length !== 11) return _toText_(cpf);
  return d.substring(0, 3) + '.' + d.substring(3, 6) + '.' + d.substring(6, 9) + '-' + d.substring(9, 11);
}

/**
 * Telefone BR (best-effort):
 * - Se 10 dígitos -> (DD) NNNN-NNNN
 * - Se 11 dígitos -> (DD) NNNNN-NNNN
 * - Caso contrário, retorna texto limpo como veio
 */
function _phoneFormat_(tel) {
  var raw = _toText_(tel);
  var d = _onlyDigits_(raw);
  if (d.length === 10) {
    return '(' + d.substring(0, 2) + ') ' + d.substring(2, 6) + '-' + d.substring(6, 10);
  }
  if (d.length === 11) {
    return '(' + d.substring(0, 2) + ') ' + d.substring(2, 7) + '-' + d.substring(7, 11);
  }
  return raw;
}

/**
 * Detecta possíveis duplicidades por CPF (não bloqueia)
 */
function _warningsDuplicidadeCpf_(cpfInput, excludeId) {
  var cpfDigits = _cpfDigits_(cpfInput);
  if (cpfDigits.length !== 11) return [];

  excludeId = excludeId ? String(excludeId) : '';

  var todos = readAllPacientes_();
  var matches = [];
  for (var i = 0; i < todos.length; i++) {
    var p = todos[i];
    var pid = String(p.idPaciente || p.ID_Paciente || '');
    if (!pid) continue;
    if (excludeId && pid === excludeId) continue;

    var pd = _cpfDigits_(p.cpf || '');
    if (pd.length === 11 && pd === cpfDigits) {
      matches.push({ idPaciente: pid, nomeCompleto: p.nomeCompleto || p.nomeExibicao || '' });
      if (matches.length >= 3) break;
    }
  }

  if (!matches.length) return [];

  return [{
    code: "POSSIVEL_DUPLICIDADE_CPF",
    message: "CPF já existe cadastrado para outro paciente (verifique possível duplicidade).",
    details: {
      cpf: _cpfFormat_(cpfDigits),
      matches: matches
    }
  }];
}

/** =========================
 *  AUDITORIA (best-effort)
 *  ========================= */
function _pacientesAudit_(ctx, action, eventType, outcome, details, target) {
  try {
    ctx = ctx || {};
    action = String(action || ctx.action || "").trim();
    eventType = String(eventType || "").trim() || "PACIENTES_EVENT";
    outcome = String(outcome || "").trim() || "INFO";

    var safeDetails = details || {};
    if (safeDetails && typeof safeDetails === "object") {
      delete safeDetails.token;
      delete safeDetails.authToken;
      delete safeDetails.Authorization;
      delete safeDetails.authorization;
      delete safeDetails.password;
      delete safeDetails.senha;
      delete safeDetails.senhaAtual;
      delete safeDetails.novaSenha;
    }

    if (typeof Audit_securityEvent_ === "function") {
      Audit_securityEvent_(ctx, action, eventType, outcome, safeDetails, target || {});
      return true;
    }

    if (typeof Audit_log_ === "function") {
      Audit_log_(ctx, {
        outcome: outcome,
        entity: "PACIENTE",
        entityId: (target && (target.id || target.entityId)) ? String(target.id || target.entityId) : null,
        extra: { eventType: eventType, details: safeDetails }
      });
      return true;
    }

    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Garante que a coluna exista no header.
 * Se não existir, cria no final (migração best-effort).
 */
function _ensureHeaderColumn_(sh, colName) {
  colName = String(colName || '').trim();
  if (!colName) return;

  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return;

  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === colName) return; // já existe
  }

  // adiciona no final
  sh.insertColumnAfter(lastCol);
  sh.getRange(1, lastCol + 1).setValue(colName);
}

/**
 * Obtém (ou cria) a aba Pacientes e garante colunas obrigatórias.
 */
function getPacientesSheet_() {
  var ss = _pacientesGetDb_();
  if (!ss) {
    _pacientesThrow_("PACIENTES_DB_NULL", "Não foi possível obter a planilha do banco (PRONTIO_getDb_/getActive).", null);
  }

  var sh = ss.getSheetByName(PACIENTES_SHEET_NAME);
  if (!sh) {
    var header = [
      'idPaciente','status','nomeCompleto','nomeSocial','sexo','dataNascimento','estadoCivil','cpf','rg','rgOrgaoEmissor',
      'telefonePrincipal','telefoneSecundario','email',
      'planoSaude','numeroCarteirinha',
      'profissao', // ✅ novo no schema oficial
      'cep','logradouro','numero','complemento','bairro','cidade','estado',
      'tipoSanguineo','alergias','observacoesClinicas','observacoesAdministrativas',
      'criadoEm','atualizadoEm'
    ];
    sh = ss.insertSheet(PACIENTES_SHEET_NAME);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }

  // ✅ MIGRAÇÃO: garante coluna profissao em bases já existentes
  try { _ensureHeaderColumn_(sh, 'profissao'); } catch (_) {}

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
    if (nome) map[nome] = index; // 0-based
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
 * "PAC-<timestamp>-<random>"
 */
function gerarIdPaciente_() {
  var prefix = 'PAC-';
  var now = new Date().getTime();
  var rand = Math.floor(Math.random() * 1000); // 0–999
  var randStr = ('000' + rand).slice(-3);
  return prefix + now + '-' + randStr;
}

/** Converte célula data -> yyyy-MM-dd se possível */
function _readDateYMD_(cell) {
  if (cell instanceof Date) return _formatDateYMD_(cell);
  var s = _toText_(cell);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return s;
}

/** Converte célula data/hora -> yyyy-MM-dd HH:mm:ss se possível */
function _readDateTime_(cell) {
  if (cell instanceof Date) return _formatDateTime_(cell);
  return _toText_(cell);
}

/** status -> ativo(boolean) */
function _statusToAtivo_(status) {
  var st = String(status || '').trim().toUpperCase();
  if (!st) return true;
  return !(st === 'INATIVO' || st === 'OBITO');
}

/** ativo/status -> status final */
function _ativoToStatus_(ativo, currentStatus) {
  if (currentStatus) return String(currentStatus).trim().toUpperCase();
  if (ativo === undefined || ativo === null) return 'ATIVO';
  return (!!ativo) ? 'ATIVO' : 'INATIVO';
}

/** Linha -> objeto (para front) */
function pacienteRowToObject_(row, headerMap) {
  var colIdNew = _colAny_(headerMap, ['idPaciente']);
  var colIdOld = _colAny_(headerMap, ['ID_Paciente']);
  var idRaw = _toText_(colIdNew ? getCellByColName_(row, headerMap, colIdNew) : (colIdOld ? getCellByColName_(row, headerMap, colIdOld) : ''));

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

  var nomeCompleto = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['nomeCompleto','NomeCompleto']) || ''));
  var nomeSocial = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['nomeSocial']) || ''));
  var nomeExibicao = nomeCompleto || nomeSocial || '';

  var sexo = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['sexo','Sexo']) || ''));
  var dataNascCell = getCellByColName_(row, headerMap, _colAny_(headerMap, ['dataNascimento','DataNascimento']) || '');
  var dataNascimentoStr = _readDateYMD_(dataNascCell);

  var tel1 = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['telefonePrincipal','Telefone']) || ''));
  var tel2 = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['telefoneSecundario','Telefone2']) || ''));

  var emailCol = _colAny_(headerMap, ['email','E-mail','Email']);
  var email = _toText_(emailCol ? getCellByColName_(row, headerMap, emailCol) : '');

  var cpfCol = _colAny_(headerMap, ['cpf','CPF']);
  var cpf = _toText_(cpfCol ? getCellByColName_(row, headerMap, cpfCol) : '');

  var rg = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['rg','RG']) || ''));
  var rgOrgaoEmissor = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['rgOrgaoEmissor']) || ''));

  var planoSaude = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['planoSaude','PlanoSaude']) || ''));
  var numeroCarteirinha = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['numeroCarteirinha','NumeroCarteirinha']) || ''));

  // ✅ profissão agora oficial
  var profissao = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['profissao','Profissão','Profissao']) || ''));

  var cep = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['cep']) || ''));
  var logradouro = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['logradouro']) || ''));
  var numero = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['numero']) || ''));
  var complemento = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['complemento']) || ''));
  var bairro = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['bairro','Bairro']) || ''));
  var cidade = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['cidade','Cidade']) || ''));
  var estado = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['estado','EnderecoUf']) || ''));

  var obsClin = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['observacoesClinicas']) || ''));
  var obsAdm = _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['observacoesAdministrativas','ObsImportantes','observacoes']) || ''));

  var criadoEmCol = _colAny_(headerMap, ['criadoEm']);
  var atualizadoEmCol = _colAny_(headerMap, ['atualizadoEm']);
  var dataCadastroCol = _colAny_(headerMap, ['DataCadastro']);

  var criadoEm = _readDateTime_(criadoEmCol ? getCellByColName_(row, headerMap, criadoEmCol) : (dataCadastroCol ? getCellByColName_(row, headerMap, dataCadastroCol) : ''));
  var atualizadoEm = _readDateTime_(atualizadoEmCol ? getCellByColName_(row, headerMap, atualizadoEmCol) : '');

  return {
    // v2
    idPaciente: idRaw,
    status: statusFinal,
    nomeCompleto: nomeCompleto,
    nomeSocial: nomeSocial,
    nomeExibicao: nomeExibicao,
    sexo: sexo,
    dataNascimento: dataNascimentoStr,
    estadoCivil: _toText_(getCellByColName_(row, headerMap, _colAny_(headerMap, ['estadoCivil']) || '')),
    cpf: cpf,
    rg: rg,
    rgOrgaoEmissor: rgOrgaoEmissor,
    telefonePrincipal: tel1,
    telefoneSecundario: tel2,
    email: email,
    planoSaude: planoSaude,
    numeroCarteirinha: numeroCarteirinha,
    profissao: profissao,
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

    // aliases (compat)
    ID_Paciente: idRaw,
    telefone1: tel1,
    telefone2: tel2,
    telefone: tel1,
    enderecoCidade: cidade,
    enderecoBairro: bairro,
    enderecoUf: estado,
    dataCadastro: criadoEm,
    ativo: ativoBool,

    // antigos ocasionais
    obsImportantes: obsAdm
  };
}

/** Lê todos os pacientes */
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

/** Debug */
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
      sample.push({
        idPaciente: p.idPaciente,
        nomeCompleto: p.nomeCompleto,
        status: p.status,
        cpf: p.cpf,
        telefonePrincipal: p.telefonePrincipal,
        planoSaude: p.planoSaude,
        profissao: p.profissao
      });
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
 * Roteador de ações
 */
function handlePacientesAction(action, payload, ctx) {
  if (action === 'Pacientes.ListarSelecao') action = 'Pacientes_ListarSelecao';
  if (action === 'Pacientes.Criar') action = 'Pacientes_Criar';
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

    case 'Pacientes_Criar':
      return Pacientes_Criar(payload, ctx);

    case 'Pacientes_BuscarSimples':
      return Pacientes_BuscarSimples(payload);

    case 'Pacientes_Listar':
      return Pacientes_Listar(payload);

    case 'Pacientes_ObterPorId':
      return Pacientes_ObterPorId(payload);

    case 'Pacientes_Atualizar':
      return Pacientes_Atualizar(payload, ctx);

    case 'Pacientes_AlterarStatus':
      return Pacientes_AlterarStatus(payload, ctx);

    default:
      _pacientesThrow_('PACIENTES_UNKNOWN_ACTION', 'Ação de Pacientes desconhecida: ' + action, null);
  }
}

/**
 * Pacientes_ListarSelecao
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
      telefone: p.telefonePrincipal || p.telefone1 || p.telefone || '',
      planoSaude: p.planoSaude || '',
      numeroCarteirinha: p.numeroCarteirinha || '',
      profissao: p.profissao || ''
    };
  });

  return { pacientes: pacientes };
}

/**
 * Pacientes_Criar (OFICIAL)
 */
function Pacientes_Criar(payload, ctx) {
  payload = payload || {};
  ctx = ctx || { action: "Pacientes_Criar" };

  var nomeCompleto = _toText_(payload.nomeCompleto);
  if (!nomeCompleto) {
    _pacientesAudit_(ctx, "Pacientes_Criar", "PACIENTE_CREATE", "ERROR", { reason: "MISSING_NOME" }, { id: "" });
    _pacientesThrow_('PACIENTES_MISSING_NOME', 'nomeCompleto é obrigatório para criar paciente.', null);
  }

  var cpfFmt = _cpfFormat_(payload.cpf || payload.documento || '');
  var tel1Fmt = _phoneFormat_(payload.telefonePrincipal || payload.telefone1 || payload.telefone || '');
  var tel2Fmt = _phoneFormat_(payload.telefoneSecundario || payload.telefone2 || '');

  var warnings = _warningsDuplicidadeCpf_(cpfFmt, '');

  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastCol = sh.getLastColumn();

  var idPaciente = gerarIdPaciente_();
  var agoraStr = _formatDateTime_(new Date());
  var linha = new Array(lastCol).fill('');

  var email = _toText_(payload.email || '');
  var sexo = _toText_(payload.sexo || '');
  var dataNascimento = _toText_(payload.dataNascimento || payload.nascimento || '');
  var status = _toText_(payload.status || '');
  var ativoPayload = (typeof payload.ativo !== 'undefined') ? !!payload.ativo : undefined;

  var planoSaude = _toText_(payload.planoSaude || '');
  var numeroCarteirinha = _toText_(payload.numeroCarteirinha || '');

  // ✅ profissão
  var profissao = _toText_(payload.profissao || payload.Profissao || '');

  var cidade = _toText_(payload.cidade || payload.enderecoCidade || '');
  var bairro = _toText_(payload.bairro || payload.enderecoBairro || '');
  var uf = _toText_(payload.estado || payload.enderecoUf || '');

  var obsClin = _toText_(payload.observacoesClinicas || '');
  var obsAdm = _toText_(payload.observacoesAdministrativas || payload.obsImportantes || payload.observacoes || '');

  var colIdNew = _colAny_(headerMap, ['idPaciente']);
  var colIdOld = _colAny_(headerMap, ['ID_Paciente']);
  if (colIdNew) setCellByColName_(linha, headerMap, colIdNew, idPaciente);
  if (colIdOld) setCellByColName_(linha, headerMap, colIdOld, idPaciente);

  var colStatus = _colAny_(headerMap, ['status']);
  var colAtivoOld = _colAny_(headerMap, ['Ativo','ativo']);
  var statusFinal = _ativoToStatus_(ativoPayload, status);
  if (colStatus) setCellByColName_(linha, headerMap, colStatus, statusFinal);
  if (colAtivoOld) setCellByColName_(linha, headerMap, colAtivoOld, (statusFinal === 'ATIVO') ? 'SIM' : 'NAO');

  var colNomeNew = _colAny_(headerMap, ['nomeCompleto']);
  var colNomeOld = _colAny_(headerMap, ['NomeCompleto']);
  if (colNomeNew) setCellByColName_(linha, headerMap, colNomeNew, nomeCompleto);
  if (colNomeOld) setCellByColName_(linha, headerMap, colNomeOld, nomeCompleto);

  var colCpfNew = _colAny_(headerMap, ['cpf']);
  var colCpfOld = _colAny_(headerMap, ['CPF']);
  if (colCpfNew) setCellByColName_(linha, headerMap, colCpfNew, cpfFmt);
  if (colCpfOld) setCellByColName_(linha, headerMap, colCpfOld, cpfFmt);

  var colTelNew = _colAny_(headerMap, ['telefonePrincipal']);
  var colTelOld = _colAny_(headerMap, ['Telefone']);
  if (colTelNew) setCellByColName_(linha, headerMap, colTelNew, tel1Fmt);
  if (colTelOld) setCellByColName_(linha, headerMap, colTelOld, tel1Fmt);

  var colTel2New = _colAny_(headerMap, ['telefoneSecundario']);
  var colTel2Old = _colAny_(headerMap, ['Telefone2']);
  if (colTel2New) setCellByColName_(linha, headerMap, colTel2New, tel2Fmt);
  if (colTel2Old) setCellByColName_(linha, headerMap, colTel2Old, tel2Fmt);

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

  var colPlanoNew = _colAny_(headerMap, ['planoSaude']);
  var colPlanoOld = _colAny_(headerMap, ['PlanoSaude']);
  if (colPlanoNew) setCellByColName_(linha, headerMap, colPlanoNew, planoSaude);
  if (colPlanoOld) setCellByColName_(linha, headerMap, colPlanoOld, planoSaude);

  var colCartNew = _colAny_(headerMap, ['numeroCarteirinha']);
  var colCartOld = _colAny_(headerMap, ['NumeroCarteirinha']);
  if (colCartNew) setCellByColName_(linha, headerMap, colCartNew, numeroCarteirinha);
  if (colCartOld) setCellByColName_(linha, headerMap, colCartOld, numeroCarteirinha);

  // ✅ profissão na linha
  if (_colAny_(headerMap, ['profissao','Profissao','Profissão'])) {
    setCellByColName_(linha, headerMap, _colAny_(headerMap, ['profissao','Profissao','Profissão']), profissao);
  }

  if (_colAny_(headerMap, ['cidade'])) setCellByColName_(linha, headerMap, 'cidade', cidade);
  if (_colAny_(headerMap, ['bairro'])) setCellByColName_(linha, headerMap, 'bairro', bairro);
  if (_colAny_(headerMap, ['estado'])) setCellByColName_(linha, headerMap, 'estado', uf);

  if (_colAny_(headerMap, ['observacoesClinicas'])) setCellByColName_(linha, headerMap, 'observacoesClinicas', obsClin);
  if (_colAny_(headerMap, ['observacoesAdministrativas'])) setCellByColName_(linha, headerMap, 'observacoesAdministrativas', obsAdm);

  if (_colAny_(headerMap, ['criadoEm'])) setCellByColName_(linha, headerMap, 'criadoEm', agoraStr);
  if (_colAny_(headerMap, ['atualizadoEm'])) setCellByColName_(linha, headerMap, 'atualizadoEm', agoraStr);

  var nextRow = sh.getLastRow() + 1;
  sh.getRange(nextRow, 1, 1, lastCol).setValues([linha]);

  _pacientesAudit_(
    ctx,
    "Pacientes_Criar",
    "PACIENTE_CREATE",
    warnings.length ? "WARN" : "SUCCESS",
    { idPaciente: idPaciente, warningsCount: warnings.length },
    { id: idPaciente, login: "" }
  );

  return { ID_Paciente: idPaciente, idPaciente: idPaciente, warnings: warnings };
}

/**
 * Pacientes_BuscarSimples (mantida)
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
 * Pacientes_Listar (mantida)
 */
function Pacientes_Listar(payload) {
  payload = payload || {};
  var termo = String(payload.termo || '').toLowerCase().trim();
  var somenteAtivos = !!payload.somenteAtivos;
  var ordenacao = String(payload.ordenacao || 'dataCadastroDesc');

  var wantsPaging =
    Object.prototype.hasOwnProperty.call(payload, 'page') ||
    Object.prototype.hasOwnProperty.call(payload, 'pageSize');

  var page = wantsPaging ? parseInt(payload.page, 10) : null;
  var pageSize = wantsPaging ? parseInt(payload.pageSize, 10) : null;

  if (!wantsPaging) {
    page = null;
    pageSize = null;
  } else {
    if (!page || page < 1) page = 1;
    if (!pageSize || pageSize < 1) pageSize = 50;
    if (pageSize > 500) pageSize = 500;
  }

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

    var da = Date.parse(a.criadoEm || a.dataCadastro || '') || 0;
    var db = Date.parse(b.criadoEm || b.dataCadastro || '') || 0;

    if (da < db) return ordenacao === 'dataCadastroAsc' ? -1 : 1;
    if (da > db) return ordenacao === 'dataCadastroAsc' ? 1 : -1;
    return 0;
  });

  if (!wantsPaging) return { pacientes: filtrados };

  var total = filtrados.length;
  var start = (page - 1) * pageSize;
  var end = start + pageSize;

  var items = [];
  if (start < total) items = filtrados.slice(start, Math.min(end, total));

  var totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) {
    page = totalPages;
    start = (page - 1) * pageSize;
    end = start + pageSize;
    items = filtrados.slice(start, Math.min(end, total));
  }

  return {
    pacientes: items,
    paging: {
      enabled: true,
      page: page,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages
    }
  };
}

/**
 * Pacientes_ObterPorId (mantida)
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
 * Pacientes_Atualizar (mantida + profissão)
 */
function Pacientes_Atualizar(payload, ctx) {
  payload = payload || {};
  ctx = ctx || { action: "Pacientes_Atualizar" };

  var id = '';
  if (payload.ID_Paciente) id = String(payload.ID_Paciente).trim();
  else if (payload.idPaciente) id = String(payload.idPaciente).trim();
  if (!id) {
    _pacientesAudit_(ctx, "Pacientes_Atualizar", "PACIENTE_UPDATE", "ERROR", { reason: "MISSING_ID" }, { id: "" });
    _pacientesThrow_('PACIENTES_MISSING_ID', 'ID_Paciente é obrigatório em Pacientes_Atualizar.', null);
  }

  var warnings = [];
  if (Object.prototype.hasOwnProperty.call(payload, "cpf") || Object.prototype.hasOwnProperty.call(payload, "documento")) {
    var cpfCandidate = payload.cpf || payload.documento || '';
    warnings = warnings.concat(_warningsDuplicidadeCpf_(cpfCandidate, id));
  }

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
  var changed = [];

  function setIfProvided(colNames, propNames, transformFn, auditFieldName) {
    var has = false;
    for (var k = 0; k < propNames.length; k++) {
      if (Object.prototype.hasOwnProperty.call(payload, propNames[k])) { has = true; break; }
    }
    if (!has) return;

    var v = '';
    for (var j = 0; j < propNames.length; j++) {
      var pn = propNames[j];
      if (Object.prototype.hasOwnProperty.call(payload, pn)) { v = payload[pn]; break; }
    }
    if (transformFn) v = transformFn(v);

    for (var c = 0; c < colNames.length; c++) {
      var col = colNames[c];
      if (headerMap[col] != null) row[headerMap[col]] = (v === undefined || v === null) ? '' : v;
    }

    changed.push(auditFieldName || propNames[0] || colNames[0] || "field");
  }

  setIfProvided(['nomeCompleto','NomeCompleto'], ['nomeCompleto'], function (v) { return _toText_(v); }, "nomeCompleto");
  setIfProvided(['nomeSocial'], ['nomeSocial'], function (v) { return _toText_(v); }, "nomeSocial");

  setIfProvided(['cpf','CPF'], ['cpf','documento'], function (v) { return _cpfFormat_(v); }, "cpf");
  setIfProvided(['rg','RG'], ['rg'], function (v) { return _toText_(v); }, "rg");
  setIfProvided(['rgOrgaoEmissor'], ['rgOrgaoEmissor'], function (v) { return _toText_(v); }, "rgOrgaoEmissor");

  setIfProvided(['sexo','Sexo'], ['sexo'], function (v) { return _toText_(v); }, "sexo");
  setIfProvided(['dataNascimento','DataNascimento'], ['dataNascimento'], function (v) { return _toText_(v); }, "dataNascimento");
  setIfProvided(['estadoCivil'], ['estadoCivil'], function (v) { return _toText_(v); }, "estadoCivil");

  setIfProvided(['telefonePrincipal','Telefone'], ['telefonePrincipal','telefone1','telefone'], function (v) { return _phoneFormat_(v); }, "telefonePrincipal");
  setIfProvided(['telefoneSecundario','Telefone2'], ['telefoneSecundario','telefone2'], function (v) { return _phoneFormat_(v); }, "telefoneSecundario");

  setIfProvided(['email','E-mail','Email'], ['email'], function (v) { return _toText_(v); }, "email");

  setIfProvided(['planoSaude','PlanoSaude'], ['planoSaude'], function (v) { return _toText_(v); }, "planoSaude");
  setIfProvided(['numeroCarteirinha','NumeroCarteirinha'], ['numeroCarteirinha'], function (v) { return _toText_(v); }, "numeroCarteirinha");

  // ✅ profissão
  setIfProvided(['profissao','Profissao','Profissão'], ['profissao','Profissao'], function (v) { return _toText_(v); }, "profissao");

  setIfProvided(['cep'], ['cep'], function (v) { return _toText_(v); }, "cep");
  setIfProvided(['logradouro'], ['logradouro','endereco'], function (v) { return _toText_(v); }, "logradouro");
  setIfProvided(['numero'], ['numero'], function (v) { return _toText_(v); }, "numero");
  setIfProvided(['complemento'], ['complemento'], function (v) { return _toText_(v); }, "complemento");
  setIfProvided(['bairro','Bairro'], ['bairro','enderecoBairro'], function (v) { return _toText_(v); }, "bairro");
  setIfProvided(['cidade','Cidade'], ['cidade','enderecoCidade'], function (v) { return _toText_(v); }, "cidade");
  setIfProvided(['estado','EnderecoUf'], ['estado','enderecoUf'], function (v) { return _toText_(v); }, "estado");

  setIfProvided(['tipoSanguineo'], ['tipoSanguineo'], function (v) { return _toText_(v); }, "tipoSanguineo");
  setIfProvided(['alergias'], ['alergias'], function (v) { return _toText_(v); }, "alergias");
  setIfProvided(['observacoesClinicas'], ['observacoesClinicas'], function (v) { return _toText_(v); }, "observacoesClinicas");
  setIfProvided(['observacoesAdministrativas','ObsImportantes'], ['observacoesAdministrativas','obsImportantes','observacoes'], function (v) { return _toText_(v); }, "observacoesAdministrativas");

  var agoraStr = _formatDateTime_(new Date());
  if (headerMap['atualizadoEm'] != null) row[headerMap['atualizadoEm']] = agoraStr;

  var writeRowIndex = foundRowIndex + 2;
  sh.getRange(writeRowIndex, 1, 1, lastCol).setValues([row]);

  var pacienteAtualizado = pacienteRowToObject_(row, headerMap);

  _pacientesAudit_(
    ctx,
    "Pacientes_Atualizar",
    "PACIENTE_UPDATE",
    warnings.length ? "WARN" : "SUCCESS",
    { idPaciente: id, changedFields: changed, warningsCount: warnings.length },
    { id: id, login: "" }
  );

  return { paciente: pacienteAtualizado, warnings: warnings };
}

/**
 * Pacientes_AlterarStatus (mantida)
 * (restante do arquivo continua igual ao seu atual)
 */
function Pacientes_AlterarStatus(payload, ctx) {
  payload = payload || {};
  ctx = ctx || { action: "Pacientes_AlterarStatus" };

  var id = '';
  if (payload.ID_Paciente) id = String(payload.ID_Paciente).trim();
  else if (payload.idPaciente) id = String(payload.idPaciente).trim();

  if (!id) {
    _pacientesAudit_(ctx, "Pacientes_AlterarStatus", "PACIENTE_STATUS", "ERROR", { reason: "MISSING_ID" }, { id: "" });
    _pacientesThrow_('PACIENTES_MISSING_ID', 'ID_Paciente é obrigatório em Pacientes_AlterarStatus.', null);
  }

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
    _pacientesAudit_(ctx, "Pacientes_AlterarStatus", "PACIENTE_STATUS", "ERROR", { reason: "MISSING_ATIVO_STATUS" }, { id: id });
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

  if (headerMap['atualizadoEm'] != null) values[foundRowIndex][headerMap['atualizadoEm']] = _formatDateTime_(new Date());

  var writeRowIndex = foundRowIndex + 2;
  sh.getRange(writeRowIndex, 1, 1, sh.getLastColumn()).setValues([values[foundRowIndex]]);

  _pacientesAudit_(
    ctx,
    "Pacientes_AlterarStatus",
    "PACIENTE_STATUS",
    "SUCCESS",
    { idPaciente: id, status: statusFinal },
    { id: id, login: "" }
  );

  return { ID_Paciente: id, idPaciente: id, status: statusFinal, ativo: (statusFinal === 'ATIVO') };
}
