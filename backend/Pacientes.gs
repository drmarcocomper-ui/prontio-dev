// Pacientes.gs
// ---------------------------------------------------------------------------
// Módulo backend de Pacientes do PRONTIO
//
// *** CABEÇALHO ATUAL DA SUA ABA "Pacientes" (linha 1) ***
//  A: ID_Paciente
//  B: NomeCompleto
//  C: CPF
//  D: Telefone
//  E: DataNascimento
//  F: E-mail
//  G: Sexo
//  H: Cidade
//  I: Bairro
//  J: Profissão
//  K: PlanoSaude
//  L: DataCadastro
//  M: Ativo   (SIM / NAO)
//
// *** COLUNAS OPCIONAIS (criadas pelo script de migração) ***
//  N: RG
//  O: Telefone2
//  P: EnderecoUf
//  Q: NumeroCarteirinha
//  R: ObsImportantes
//
// OBSERVAÇÕES IMPORTANTES:
// - O FRONT NÃO SABE DOS NOMES/ORDENS DAS COLUNAS.
// - O FRONT conversa APENAS via ações de API, por exemplo:
//
//   Leves (agenda, seleção):
//   - Pacientes_ListarSelecao      (ou Pacientes.ListarSelecao)
//   - Pacientes_CriarBasico        (ou Pacientes.CriarBasico / Pacientes.Criar)
//   - Pacientes_BuscarSimples
//
//   CRUD mais completo (tela de pacientes):
//   - Pacientes_Listar             (ou Pacientes.Listar / Pacientes.ListarTodos)
//   - Pacientes_ObterPorId         (ou Pacientes.ObterPorId)
//   - Pacientes_Atualizar          (ou Pacientes.Atualizar)
//   - Pacientes_AlterarStatus      (ou Pacientes.AlterarStatusAtivo)
//
// ESTE MÓDULO:
// - devolve APENAS o "data" (objeto / array);
// - em caso de erro, lança Error com code/message/details.
// - Api.gs é quem monta { success, data, errors }.
//
// Ajuste retrocompatível:
/// - Substitui "throw { ... }" por Error com err.code/err.details.
// ---------------------------------------------------------------------------

/** Nome da aba de pacientes na planilha */
var PACIENTES_SHEET_NAME = 'Pacientes';

function _pacientesThrow_(code, message, details) {
  var err = new Error(String(message || 'Erro.'));
  err.code = String(code || 'INTERNAL_ERROR');
  err.details = (details === undefined ? null : details);
  throw err;
}

/** Obtém (ou cria) a aba Pacientes */
function getPacientesSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(PACIENTES_SHEET_NAME);
  if (!sh) {
    var header = [
      'ID_Paciente',
      'NomeCompleto',
      'CPF',
      'Telefone',
      'DataNascimento',
      'E-mail',
      'Sexo',
      'Cidade',
      'Bairro',
      'Profissão',
      'PlanoSaude',
      'DataCadastro',
      'Ativo'
    ];
    sh = ss.insertSheet(PACIENTES_SHEET_NAME);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sh;
}

/**
 * Lê o cabeçalho da aba (linha 1) e monta um mapa:
 * { "ID_Paciente": 0, "NomeCompleto": 1, ... }
 */
function getPacientesHeaderMap_() {
  var sh = getPacientesSheet_();
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) {
    _pacientesThrow_(
      'PACIENTES_HEADER_EMPTY',
      'Cabeçalho da aba Pacientes está vazio.',
      null
    );
  }

  var headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};

  headerRow.forEach(function (colName, index) {
    var nome = String(colName || '').trim();
    if (nome) {
      map[nome] = index; // índice baseado em 0
    }
  });

  return map;
}

function getCellByColName_(row, headerMap, colName) {
  var idx = headerMap[colName];
  if (idx == null) return '';
  return row[idx];
}

function setCellByColName_(row, headerMap, colName, value) {
  var idx = headerMap[colName];
  if (idx == null) return;
  row[idx] = value || '';
}

/**
 * Gera um ID_Paciente único e estável.
 * Formato: "PAC-<timestamp>-<random>"
 */
function gerarIdPaciente_() {
  var prefix = 'PAC-';
  var now = new Date().getTime();
  var rand = Math.floor(Math.random() * 1000); // 0–999
  var randStr = ('000' + rand).slice(-3);
  return prefix + now + '-' + randStr;
}

/**
 * Converte Date -> "yyyy-MM-dd".
 */
function formatDateYMD_(date) {
  if (!(date instanceof Date)) return '';
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() || 'America/Sao_Paulo',
    'yyyy-MM-dd'
  );
}

/**
 * Converte uma linha da planilha em objeto "paciente completo" para o front.
 */
function pacienteRowToObject_(row, headerMap) {
  var idRaw = String(getCellByColName_(row, headerMap, 'ID_Paciente') || '').trim();

  var dataNascCell = getCellByColName_(row, headerMap, 'DataNascimento');
  var dataNascimentoStr = '';
  if (dataNascCell instanceof Date) {
    dataNascimentoStr = formatDateYMD_(dataNascCell);
  } else if (dataNascCell) {
    dataNascimentoStr = String(dataNascCell).trim();
  }

  var dataCadCell = getCellByColName_(row, headerMap, 'DataCadastro');
  var dataCadastroStr = '';
  if (dataCadCell instanceof Date) {
    dataCadastroStr = new Date(dataCadCell).toISOString();
  } else if (dataCadCell) {
    dataCadastroStr = String(dataCadCell).trim();
  }

  var ativoCell = String(getCellByColName_(row, headerMap, 'Ativo') || '').trim().toUpperCase();
  var ativoBool = !(
    ativoCell === 'NAO' ||
    ativoCell === 'N' ||
    ativoCell === 'FALSE' ||
    ativoCell === '0'
  );

  var telefone1Cell = '';
  if (headerMap['Telefone'] != null) {
    telefone1Cell = getCellByColName_(row, headerMap, 'Telefone');
  }

  var telefone2Cell = '';
  if (headerMap['Telefone2'] != null) {
    telefone2Cell = getCellByColName_(row, headerMap, 'Telefone2');
  }

  var emailCell = '';
  if (headerMap['E-mail'] != null) {
    emailCell = getCellByColName_(row, headerMap, 'E-mail');
  } else if (headerMap['Email'] != null) {
    emailCell = getCellByColName_(row, headerMap, 'Email');
  }

  var cidadeCell = getCellByColName_(row, headerMap, 'Cidade');
  var bairroCell = getCellByColName_(row, headerMap, 'Bairro');
  var ufCell = getCellByColName_(row, headerMap, 'EnderecoUf');
  var rgCell = getCellByColName_(row, headerMap, 'RG');
  var numCartCell = getCellByColName_(row, headerMap, 'NumeroCarteirinha');
  var obsCell = getCellByColName_(row, headerMap, 'ObsImportantes');

  var paciente = {
    idPaciente: idRaw,
    ID_Paciente: idRaw, // alias para compatibilidade
    nomeCompleto: String(getCellByColName_(row, headerMap, 'NomeCompleto') || '').trim(),
    cpf: String(getCellByColName_(row, headerMap, 'CPF') || '').trim(),
    rg: String(rgCell || '').trim(),
    telefone1: String(telefone1Cell || '').trim(),
    telefone2: String(telefone2Cell || '').trim(),
    telefone: String(telefone1Cell || '').trim(),
    dataNascimento: dataNascimentoStr,
    email: String(emailCell || '').trim(),
    sexo: String(getCellByColName_(row, headerMap, 'Sexo') || '').trim(),
    enderecoCidade: String(cidadeCell || '').trim(),
    enderecoBairro: String(bairroCell || '').trim(),
    enderecoUf: String(ufCell || '').trim(),
    cidade: String(cidadeCell || '').trim(),
    bairro: String(bairroCell || '').trim(),
    profissao: String(getCellByColName_(row, headerMap, 'Profissão') || '').trim(),
    planoSaude: String(getCellByColName_(row, headerMap, 'PlanoSaude') || '').trim(),
    numeroCarteirinha: String(numCartCell || '').trim(),
    obsImportantes: String(obsCell || '').trim(),
    dataCadastro: dataCadastroStr,
    ativo: ativoBool
  };

  return paciente;
}

/**
 * Lê todos os pacientes em forma de objetos.
 */
function readAllPacientes_() {
  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    return [];
  }

  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var list = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row.join('')).trim() === '') continue;

    var paciente = pacienteRowToObject_(row, headerMap);
    if (!paciente.ID_Paciente && !paciente.nomeCompleto) continue;

    list.push(paciente);
  }

  return list;
}

/**
 * Roteador de ações específicas de Pacientes.
 * Chamado a partir da API com (action, payload).
 */
function handlePacientesAction(action, payload) {
  if (action === 'Pacientes.ListarSelecao') action = 'Pacientes_ListarSelecao';
  if (action === 'Pacientes.CriarBasico') action = 'Pacientes_CriarBasico';
  if (action === 'Pacientes.Criar') action = 'Pacientes_CriarBasico';
  if (action === 'Pacientes.BuscarSimples') action = 'Pacientes_BuscarSimples';
  if (action === 'Pacientes.Listar' || action === 'Pacientes.ListarTodos') action = 'Pacientes_Listar';
  if (action === 'Pacientes.ObterPorId') action = 'Pacientes_ObterPorId';
  if (action === 'Pacientes.Atualizar') action = 'Pacientes_Atualizar';
  if (action === 'Pacientes.AlterarStatus' || action === 'Pacientes.AlterarStatusAtivo') action = 'Pacientes_AlterarStatus';

  switch (action) {
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
      _pacientesThrow_(
        'PACIENTES_UNKNOWN_ACTION',
        'Ação de Pacientes desconhecida: ' + action,
        null
      );
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
      nomeCompleto: p.nomeCompleto,
      documento: p.cpf,
      telefone: p.telefone1 || p.telefone || ''
    };
  });

  return { pacientes: pacientes };
}

/**
 * Pacientes_CriarBasico
 */
function Pacientes_CriarBasico(payload) {
  payload = payload || {};
  if (!payload.nomeCompleto) {
    _pacientesThrow_(
      'PACIENTES_MISSING_NOME',
      'nomeCompleto é obrigatório para criar paciente.',
      null
    );
  }

  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastCol = sh.getLastColumn();

  var idPaciente = gerarIdPaciente_();
  var agoraISO = new Date().toISOString();

  var linha = new Array(lastCol).fill('');

  var cpf = payload.cpf || payload.documento || '';
  var telefone1 = payload.telefone1 || payload.telefone || '';
  var telefone2 = payload.telefone2 || '';
  var cidade = payload.enderecoCidade || payload.cidade || '';
  var bairro = payload.enderecoBairro || payload.bairro || '';
  var uf = payload.enderecoUf || '';
  var rg = payload.rg || '';
  var numeroCarteirinha = payload.numeroCarteirinha || '';
  var obsImportantes = payload.obsImportantes || '';

  setCellByColName_(linha, headerMap, 'ID_Paciente', idPaciente);
  setCellByColName_(linha, headerMap, 'NomeCompleto', payload.nomeCompleto);
  setCellByColName_(linha, headerMap, 'CPF', cpf);

  if (headerMap['Telefone'] != null) {
    setCellByColName_(linha, headerMap, 'Telefone', telefone1);
  }
  if (headerMap['Telefone2'] != null) {
    setCellByColName_(linha, headerMap, 'Telefone2', telefone2);
  }

  setCellByColName_(linha, headerMap, 'DataNascimento', payload.dataNascimento || '');
  setCellByColName_(linha, headerMap, 'E-mail', payload.email || '');
  setCellByColName_(linha, headerMap, 'Sexo', payload.sexo || '');
  setCellByColName_(linha, headerMap, 'Cidade', cidade);
  setCellByColName_(linha, headerMap, 'Bairro', bairro);
  setCellByColName_(linha, headerMap, 'Profissão', payload.profissao || '');
  setCellByColName_(linha, headerMap, 'PlanoSaude', payload.planoSaude || '');
  setCellByColName_(linha, headerMap, 'DataCadastro', agoraISO);
  setCellByColName_(linha, headerMap, 'Ativo', 'SIM');
  setCellByColName_(linha, headerMap, 'RG', rg);
  setCellByColName_(linha, headerMap, 'EnderecoUf', uf);
  setCellByColName_(linha, headerMap, 'NumeroCarteirinha', numeroCarteirinha);
  setCellByColName_(linha, headerMap, 'ObsImportantes', obsImportantes);

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

  if (!termo) {
    return { pacientes: [] };
  }

  var todos = readAllPacientes_();
  if (!todos.length) {
    return { pacientes: [] };
  }

  var resultados = [];

  for (var i = 0; i < todos.length; i++) {
    var p = todos[i];
    if (!p.ativo) continue;

    var haystack = [p.nomeCompleto || '', p.cpf || '', p.telefone1 || p.telefone || '']
      .join(' ')
      .toLowerCase();

    if (haystack.indexOf(termo) !== -1) {
      resultados.push({
        ID_Paciente: p.ID_Paciente,
        idPaciente: p.idPaciente,
        nome: p.nomeCompleto,
        documento: p.cpf,
        telefone: p.telefone1 || p.telefone || '',
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

    var texto = [p.nomeCompleto || '', p.cpf || '', (p.telefone1 || p.telefone || ''), p.email || '']
      .join(' ')
      .toLowerCase();

    return texto.indexOf(termo) !== -1;
  });

  filtrados.sort(function (a, b) {
    if (ordenacao === 'nomeAsc' || ordenacao === 'nomeDesc') {
      var na = (a.nomeCompleto || '').toLowerCase();
      var nb = (b.nomeCompleto || '').toLowerCase();
      if (na < nb) return ordenacao === 'nomeAsc' ? -1 : 1;
      if (na > nb) return ordenacao === 'nomeAsc' ? 1 : -1;
      return 0;
    }

    var da = Date.parse(a.dataCadastro || '') || 0;
    var db = Date.parse(b.dataCadastro || '') || 0;
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

  if (!id) {
    _pacientesThrow_(
      'PACIENTES_MISSING_ID',
      'ID_Paciente é obrigatório em Pacientes_ObterPorId.',
      null
    );
  }

  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  if (lastRow < 2) {
    _pacientesThrow_(
      'PACIENTES_NOT_FOUND',
      'Paciente não encontrado para ID_Paciente: ' + id,
      null
    );
  }

  var idxId = headerMap['ID_Paciente'];
  if (idxId == null) {
    _pacientesThrow_(
      'PACIENTES_ID_COL_NOT_FOUND',
      'Coluna ID_Paciente não encontrada na aba Pacientes.',
      null
    );
  }

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

  _pacientesThrow_(
    'PACIENTES_NOT_FOUND',
    'Paciente não encontrado para ID_Paciente: ' + id,
    null
  );
}

/**
 * Pacientes_Atualizar
 */
function Pacientes_Atualizar(payload) {
  payload = payload || {};

  var id = '';
  if (payload.ID_Paciente) id = String(payload.ID_Paciente).trim();
  else if (payload.idPaciente) id = String(payload.idPaciente).trim();

  if (!id) {
    _pacientesThrow_(
      'PACIENTES_MISSING_ID',
      'ID_Paciente é obrigatório em Pacientes_Atualizar.',
      null
    );
  }

  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  if (lastRow < 2) {
    _pacientesThrow_(
      'PACIENTES_NOT_FOUND',
      'Paciente não encontrado para ID_Paciente: ' + id,
      null
    );
  }

  var idxId = headerMap['ID_Paciente'];
  if (idxId == null) {
    _pacientesThrow_(
      'PACIENTES_ID_COL_NOT_FOUND',
      'Coluna ID_Paciente não encontrada na aba Pacientes.',
      null
    );
  }

  var range = sh.getRange(2, 1, lastRow - 1, lastCol);
  var values = range.getValues();

  var foundRowIndex = -1;
  for (var i = 0; i < values.length; i++) {
    var rowId = String(values[i][idxId] || '').trim();
    if (rowId === id) {
      foundRowIndex = i;
      break;
    }
  }

  if (foundRowIndex === -1) {
    _pacientesThrow_(
      'PACIENTES_NOT_FOUND',
      'Paciente não encontrado para ID_Paciente: ' + id,
      null
    );
  }

  var row = values[foundRowIndex];

  function setFieldFromPayload(colName, propNames) {
    var hasDefined = false;
    for (var i = 0; i < propNames.length; i++) {
      var prop = propNames[i];
      if (Object.prototype.hasOwnProperty.call(payload, prop)) {
        hasDefined = true;
        break;
      }
    }
    if (!hasDefined) return;

    var idx = headerMap[colName];
    if (idx == null) return;

    var value = '';
    for (var j = 0; j < propNames.length; j++) {
      var pName = propNames[j];
      if (Object.prototype.hasOwnProperty.call(payload, pName)) {
        value = payload[pName] || '';
        break;
      }
    }
    row[idx] = value;
  }

  setFieldFromPayload('NomeCompleto', ['nomeCompleto']);
  setFieldFromPayload('CPF', ['cpf', 'documento']);

  if (headerMap['Telefone'] != null) {
    var telefone1 = payload.telefone1;
    if (telefone1 === undefined) telefone1 = payload.telefone;
    if (telefone1 !== undefined) row[headerMap['Telefone']] = telefone1 || '';
  }

  if (headerMap['Telefone2'] != null && payload.telefone2 !== undefined) {
    row[headerMap['Telefone2']] = payload.telefone2 || '';
  }

  setFieldFromPayload('DataNascimento', ['dataNascimento']);
  setFieldFromPayload('E-mail', ['email']);
  setFieldFromPayload('Sexo', ['sexo']);

  var cidade = payload.enderecoCidade;
  if (cidade === undefined) cidade = payload.cidade;
  if (cidade !== undefined) setCellByColName_(row, headerMap, 'Cidade', cidade);

  var bairro = payload.enderecoBairro;
  if (bairro === undefined) bairro = payload.bairro;
  if (bairro !== undefined) setCellByColName_(row, headerMap, 'Bairro', bairro);

  if (payload.enderecoUf !== undefined) {
    setCellByColName_(row, headerMap, 'EnderecoUf', payload.enderecoUf);
  }

  setFieldFromPayload('Profissão', ['profissao']);
  setFieldFromPayload('PlanoSaude', ['planoSaude']);
  setFieldFromPayload('NumeroCarteirinha', ['numeroCarteirinha']);
  setFieldFromPayload('ObsImportantes', ['obsImportantes']);
  setFieldFromPayload('RG', ['rg']);

  var writeRowIndex = foundRowIndex + 2;
  sh.getRange(writeRowIndex, 1, 1, lastCol).setValues([row]);

  var pacienteAtualizado = pacienteRowToObject_(row, headerMap);
  return { paciente: pacienteAtualizado };
}

/**
 * Pacientes_AlterarStatus
 */
function Pacientes_AlterarStatus(payload) {
  payload = payload || {};

  var id = '';
  if (payload.ID_Paciente) id = String(payload.ID_Paciente).trim();
  else if (payload.idPaciente) id = String(payload.idPaciente).trim();

  if (!id) {
    _pacientesThrow_(
      'PACIENTES_MISSING_ID',
      'ID_Paciente é obrigatório em Pacientes_AlterarStatus.',
      null
    );
  }

  if (typeof payload.ativo === 'undefined') {
    _pacientesThrow_(
      'PACIENTES_MISSING_ATIVO',
      'Campo "ativo" (true/false) é obrigatório em Pacientes_AlterarStatus.',
      null
    );
  }

  var ativoBool = !!payload.ativo;
  var novoValor = ativoBool ? 'SIM' : 'NAO';

  var sh = getPacientesSheet_();
  var headerMap = getPacientesHeaderMap_();
  var lastRow = sh.getLastRow();

  if (lastRow < 2) {
    _pacientesThrow_(
      'PACIENTES_NOT_FOUND',
      'Paciente não encontrado para ID_Paciente: ' + id,
      null
    );
  }

  var idxId = headerMap['ID_Paciente'];
  var idxAtivo = headerMap['Ativo'];

  if (idxId == null || idxAtivo == null) {
    _pacientesThrow_(
      'PACIENTES_COL_NOT_FOUND',
      'Colunas ID_Paciente ou Ativo não encontradas na aba Pacientes.',
      null
    );
  }

  var range = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn());
  var values = range.getValues();

  var foundRowIndex = -1;
  for (var i = 0; i < values.length; i++) {
    var rowId = String(values[i][idxId] || '').trim();
    if (rowId === id) {
      foundRowIndex = i;
      break;
    }
  }

  if (foundRowIndex === -1) {
    _pacientesThrow_(
      'PACIENTES_NOT_FOUND',
      'Paciente não encontrado para ID_Paciente: ' + id,
      null
    );
  }

  values[foundRowIndex][idxAtivo] = novoValor;

  var writeRowIndex = foundRowIndex + 2;
  sh.getRange(writeRowIndex, 1, 1, sh.getLastColumn()).setValues([values[foundRowIndex]]);

  return {
    ID_Paciente: id,
    idPaciente: id,
    ativo: ativoBool
  };
}

/* =======================================================================
   MIGRAÇÃO: CRIAR COLUNAS EXTRAS (RG, Telefone2, EnderecoUf, etc.)
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

  var extras = [
    'RG',
    'Telefone2',
    'EnderecoUf',
    'NumeroCarteirinha',
    'ObsImportantes'
  ];

  var colunasParaAdicionar = [];
  extras.forEach(function (nome) {
    if (!existentes[nome]) colunasParaAdicionar.push(nome);
  });

  if (!colunasParaAdicionar.length) {
    Logger.log('Nenhuma coluna extra nova foi necessária. Todas já existem.');
    return;
  }

  sh.getRange(1, headerRow.length + 1, 1, colunasParaAdicionar.length)
    .setValues([colunasParaAdicionar]);

  Logger.log('Colunas extras adicionadas na aba Pacientes: ' + colunasParaAdicionar.join(', '));
}
