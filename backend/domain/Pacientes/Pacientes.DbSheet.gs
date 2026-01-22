// ---------------------------------------------------------------------------
// Infra repo-first de DB/Sheet/Schema do módulo Pacientes
// ---------------------------------------------------------------------------

var PACIENTES_SHEET_NAME = 'Pacientes';
var PACIENTES_ENTITY = 'Pacientes';

function _pacientesThrow_(code, message, details) {
  var err = new Error(String(message || 'Erro.'));
  err.code = String(code || 'INTERNAL_ERROR');
  err.details = (details === undefined ? null : details);
  throw err;
}

/**
 * ✅ Repo-first: pega DB via PRONTIO_getDb_ ou Repo_getDb_
 * (evita SpreadsheetApp.getActiveSpreadsheet())
 */
function Pacientes_getDb_() {
  var ss = null;

  try {
    if (typeof PRONTIO_getDb_ === "function") ss = PRONTIO_getDb_();
  } catch (_) {}

  try {
    if (!ss && typeof Repo_getDb_ === "function") ss = Repo_getDb_();
  } catch (_) {}

  if (!ss) {
    _pacientesThrow_("INTERNAL_ERROR", "Pacientes: DB não disponível. Esperado PRONTIO_getDb_ ou Repo_getDb_.", {
      missing: ["PRONTIO_getDb_", "Repo_getDb_"]
    });
  }

  return ss;
}

/**
 * Apenas para EnsureSchema (header).
 */
function Pacientes_getSheet_() {
  var ss = Pacientes_getDb_();
  var sh = ss.getSheetByName(PACIENTES_SHEET_NAME);
  if (!sh) {
    // cria com header v2 (oficial)
    var header = [
      'idPaciente','status','nomeCompleto','nomeSocial','sexo','dataNascimento','estadoCivil','cpf','rg','rgOrgaoEmissor',
      'telefonePrincipal','telefoneSecundario','email',
      'planoSaude','numeroCarteirinha',
      'profissao',
      'cep','logradouro','numero','complemento','bairro','cidade','estado',
      'tipoSanguineo','alergias','observacoesClinicas','observacoesAdministrativas',
      'criadoEm','atualizadoEm'
    ];
    sh = ss.insertSheet(PACIENTES_SHEET_NAME);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sh;
}

/**
 * EnsureSchema repo-first:
 * - garante colunas oficiais (não remove, só adiciona)
 */
function Pacientes_EnsureSchema_(payload) {
  var sh = Pacientes_getSheet_();
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) _pacientesThrow_('PACIENTES_HEADER_EMPTY', 'Cabeçalho da aba Pacientes está vazio.', null);

  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var needed = [
    'idPaciente','status','nomeCompleto','nomeSocial','sexo','dataNascimento','estadoCivil','cpf','rg','rgOrgaoEmissor',
    'telefonePrincipal','telefoneSecundario','email',
    'planoSaude','numeroCarteirinha',
    'profissao',
    'cep','logradouro','numero','complemento','bairro','cidade','estado',
    'tipoSanguineo','alergias','observacoesClinicas','observacoesAdministrativas',
    'criadoEm','atualizadoEm'
  ];

  var added = [];
  for (var i = 0; i < needed.length; i++) {
    if (header.indexOf(needed[i]) < 0) {
      header.push(needed[i]);
      added.push(needed[i]);
    }
  }

  if (added.length) sh.getRange(1, 1, 1, header.length).setValues([header]);
  return { ok: true, added: added, totalCols: header.length };
}
