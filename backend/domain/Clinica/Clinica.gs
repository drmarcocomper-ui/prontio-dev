/**
 * PRONTIO - Módulo Clínica
 * Actions:
 * - Clinica_Get    (qualquer usuário autenticado)
 * - Clinica_Update (somente ADMIN)
 *
 * Requisitos:
 * - Front nunca acessa planilha diretamente (apenas API/action).
 * - Regra de negócio no backend.
 * - Retorno JSON padronizado feito pelo Api/Registry (success/data/errors).
 *
 * Dependências esperadas no projeto (já existentes no seu core):
 * - Auth_requireSession(e) -> session { idUsuario, perfil, ... } ou lança erro padronizado
 * - Auth_requireAdmin(session) -> lança FORBIDDEN se não for ADMIN
 * - ApiError(code, message, details?) -> erro padronizado
 *
 * Auditoria (seu core real):
 * - Audit_log_(ctx, event) -> padrão do Audit.gs
 */

var CLINICA_SHEET_NAME = 'Clinica';

// Colunas esperadas (cabeçalho)
var CLINICA_COLS = {
  ID: 'ID_Clinica',
  NOME: 'Nome',
  ENDERECO: 'Endereco',
  TELEFONE: 'Telefone',
  EMAIL: 'Email',
  TIMEZONE: 'Timezone',
  LOGO_URL: 'LogoUrl',
  TEMPLATES_JSON: 'TemplatesJson',
  ATIVO: 'Ativo',
  CRIADO_EM: 'CriadoEm',
  ATUALIZADO_EM: 'AtualizadoEm'
};

var CLINICA_DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * ============================================================
 * ✅ HANDLERS PÚBLICOS (compatíveis com Api.gs/Registry.gs)
 * Registry chama: handler(ctx, payload)
 * ============================================================
 */
function Clinica_Get(ctx, payload) {
  return Clinica_Get_(payload, ctx);
}

function Clinica_Update(ctx, payload) {
  return Clinica_Update_(payload, ctx);
}

/**
 * Handler do módulo Clínica para o roteador/registry (opcional).
 */
function handleClinicaAction_(action, payload, context) {
  if (action === 'Clinica_Get') return Clinica_Get_(payload, context);
  if (action === 'Clinica_Update') return Clinica_Update_(payload, context);
  throw ApiError('NOT_IMPLEMENTED', 'Action não implementada no módulo Clínica: ' + action);
}

/**
 * Clinica_Get
 * Permissão: qualquer usuário autenticado.
 * Payload esperado: {}
 * Retorno: { clinica: <objeto padronizado> }
 */
function Clinica_Get_(payload, context) {
  _requireSessionOrThrow(context);

  var clinicaRow = _findClinicaAtivaOrThrow_();
  var clinicaObj = _rowToClinicaObject_(clinicaRow);

  return { clinica: clinicaObj };
}

/**
 * Clinica_Update
 * Permissão: SOMENTE ADMIN
 */
function Clinica_Update_(payload, context) {
  var session = _requireSessionOrThrow(context);
  _requireAdminOrThrow(session);

  payload = payload || {};
  _validateClinicaUpdatePayloadOrThrow_(payload);

  var sheetInfo = _getClinicaSheetInfo_();
  var clinicaRow = _findClinicaAtivaOrThrow_(sheetInfo);
  var beforeObj = _rowToClinicaObject_(clinicaRow);

  var updatedValues = clinicaRow.values.slice();
  var headerMap = clinicaRow.headerMap;

  function setCol(colName, value) {
    var idx = headerMap[colName];
    if (idx == null) return;
    updatedValues[idx] = value;
  }

  if (payload.hasOwnProperty('nome')) {
    var nome = String(payload.nome == null ? '' : payload.nome).trim();
    setCol(CLINICA_COLS.NOME, nome);
  }

  if (payload.hasOwnProperty('endereco')) setCol(CLINICA_COLS.ENDERECO, _normalizeNullableString_(payload.endereco));
  if (payload.hasOwnProperty('telefone')) setCol(CLINICA_COLS.TELEFONE, _normalizeNullableString_(payload.telefone));
  if (payload.hasOwnProperty('email')) setCol(CLINICA_COLS.EMAIL, _normalizeNullableString_(payload.email));
  if (payload.hasOwnProperty('timezone')) setCol(CLINICA_COLS.TIMEZONE, String(payload.timezone || '').trim());
  if (payload.hasOwnProperty('logoUrl')) setCol(CLINICA_COLS.LOGO_URL, _normalizeNullableString_(payload.logoUrl));

  if (payload.hasOwnProperty('templates')) {
    var templatesObj = payload.templates;
    if (!_isPlainObject_(templatesObj)) {
      throw ApiError('TEMPLATES_INVALID_JSON', 'templates deve ser um objeto JSON válido');
    }
    setCol(CLINICA_COLS.TEMPLATES_JSON, JSON.stringify(templatesObj));
  }

  if (payload.hasOwnProperty('ativo')) {
    setCol(CLINICA_COLS.ATIVO, payload.ativo === true);
  }

  var nowIso = new Date().toISOString();
  setCol(CLINICA_COLS.ATUALIZADO_EM, nowIso);

  var tzIdx = headerMap[CLINICA_COLS.TIMEZONE];
  if (tzIdx != null) {
    var tzVal = String(updatedValues[tzIdx] == null ? '' : updatedValues[tzIdx]).trim();
    if (!tzVal) updatedValues[tzIdx] = CLINICA_DEFAULT_TIMEZONE;
  }

  var range = clinicaRow.sheet.getRange(clinicaRow.rowIndex, 1, 1, clinicaRow.values.length);
  range.setValues([updatedValues]);

  var afterRow = _getRowByIndex_(clinicaRow.sheet, clinicaRow.rowIndex, clinicaRow.values.length, headerMap);
  var afterObj = _rowToClinicaObject_(afterRow);

  // Auditoria obrigatória (checklist)
  _auditLogSafe({
    Action: 'Clinica_Update',
    EntidadeAlvo: 'Clinica',
    ID_Alvo: afterObj.idClinica,
    ID_Usuario: session && session.idUsuario ? session.idUsuario : null,
    AntesJson: JSON.stringify(beforeObj),
    DepoisJson: JSON.stringify(afterObj),
    Timestamp: nowIso
  }, context);

  return { clinica: afterObj };
}

/* ---------------------------
 * Validações
 * -------------------------*/

function _validateClinicaUpdatePayloadOrThrow_(payload) {
  var keys = Object.keys(payload || {});
  if (!keys.length) {
    throw ApiError('VALIDATION_ERROR', 'Payload vazio. Envie ao menos 1 campo para atualizar.', {
      fields: [{ field: '_payload', reason: 'empty' }]
    });
  }

  var invalidFields = [];

  if (payload.hasOwnProperty('nome')) {
    var nome = String(payload.nome == null ? '' : payload.nome).trim();
    if (!nome) invalidFields.push({ field: 'nome', reason: 'empty' });
    if (nome.length > 0 && nome.length < 3) invalidFields.push({ field: 'nome', reason: 'min_length_3' });
  }

  if (payload.hasOwnProperty('email')) {
    var email = _normalizeNullableString_(payload.email);
    if (email != null && email !== '') {
      var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(email)) invalidFields.push({ field: 'email', reason: 'invalid_format' });
    }
  }

  if (payload.hasOwnProperty('timezone')) {
    var tz = String(payload.timezone == null ? '' : payload.timezone).trim();
    if (!tz) invalidFields.push({ field: 'timezone', reason: 'empty' });
  }

  if (payload.hasOwnProperty('ativo')) {
    if (typeof payload.ativo !== 'boolean') invalidFields.push({ field: 'ativo', reason: 'not_boolean' });
  }

  if (payload.hasOwnProperty('templates')) {
    if (!_isPlainObject_(payload.templates)) {
      throw ApiError('TEMPLATES_INVALID_JSON', 'templates deve ser um objeto JSON válido');
    }
  }

  if (invalidFields.length) {
    throw ApiError('VALIDATION_ERROR', 'Campos inválidos no payload.', { fields: invalidFields });
  }
}

/* ---------------------------
 * Leitura/Escrita na planilha
 * -------------------------*/

function _getClinicaSheetInfo_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CLINICA_SHEET_NAME);
  if (!sheet) {
    throw ApiError('INTERNAL_ERROR', 'Aba "' + CLINICA_SHEET_NAME + '" não encontrada.');
  }

  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw ApiError('INTERNAL_ERROR', 'Aba Clinica sem cabeçalho.');

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerMap = {};
  for (var c = 0; c < header.length; c++) {
    var name = String(header[c] || '').trim();
    if (name) headerMap[name] = c;
  }

  return { sheet: sheet, headerMap: headerMap, lastCol: lastCol };
}

function _findClinicaAtivaOrThrow_(sheetInfoOpt) {
  var sheetInfo = sheetInfoOpt || _getClinicaSheetInfo_();
  var sheet = sheetInfo.sheet;
  var headerMap = sheetInfo.headerMap;
  var lastCol = sheetInfo.lastCol;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw ApiError('CLINICA_NOT_FOUND', 'Não existe clínica ativa.');
  }

  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var ativoIdx = headerMap[CLINICA_COLS.ATIVO];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var ativo = false;

    if (ativoIdx != null) {
      ativo = row[ativoIdx] === true || String(row[ativoIdx]).toLowerCase() === 'true' || String(row[ativoIdx]) === '1';
    }

    if (ativo) {
      var rowIndex = 2 + i;
      return { sheet: sheet, headerMap: headerMap, values: row, rowIndex: rowIndex };
    }
  }

  throw ApiError('CLINICA_NOT_FOUND', 'Não existe clínica ativa.');
}

function _getRowByIndex_(sheet, rowIndex, lastCol, headerMap) {
  var values = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  return { sheet: sheet, headerMap: headerMap, values: values, rowIndex: rowIndex };
}

/* ---------------------------
 * Mapeamento -> objeto padronizado
 * -------------------------*/

function _rowToClinicaObject_(rowObj) {
  var headerMap = rowObj.headerMap;
  var v = rowObj.values;

  function get(colName) {
    var idx = headerMap[colName];
    if (idx == null) return null;
    return v[idx];
  }

  var templatesJson = get(CLINICA_COLS.TEMPLATES_JSON);
  var templatesObj = {};
  if (templatesJson != null && String(templatesJson).trim() !== '') {
    try {
      var parsed = JSON.parse(String(templatesJson));
      templatesObj = _isPlainObject_(parsed) ? parsed : {};
    } catch (e) {
      templatesObj = {};
    }
  }

  var ativoVal = get(CLINICA_COLS.ATIVO);
  var ativoBool = (ativoVal === true) || (String(ativoVal).toLowerCase() === 'true') || (String(ativoVal) === '1');

  var tz = get(CLINICA_COLS.TIMEZONE);
  tz = String(tz == null ? '' : tz).trim();
  if (!tz) tz = CLINICA_DEFAULT_TIMEZONE;

  return {
    idClinica: String(get(CLINICA_COLS.ID) || ''),
    nome: String(get(CLINICA_COLS.NOME) || ''),
    endereco: _normalizeNullableString_(get(CLINICA_COLS.ENDERECO)),
    telefone: _normalizeNullableString_(get(CLINICA_COLS.TELEFONE)),
    email: _normalizeNullableString_(get(CLINICA_COLS.EMAIL)),
    timezone: tz,
    logoUrl: _normalizeNullableString_(get(CLINICA_COLS.LOGO_URL)),
    templates: templatesObj,
    ativo: ativoBool,
    criadoEm: _toIsoOrNull_(get(CLINICA_COLS.CRIADO_EM)) || '',
    atualizadoEm: _toIsoOrNull_(get(CLINICA_COLS.ATUALIZADO_EM)) || ''
  };
}

function _toIsoOrNull_(value) {
  if (value == null || value === '') return null;
  if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
  var s = String(value).trim();
  if (!s) return null;
  return s;
}

/* ---------------------------
 * Utils
 * -------------------------*/

function _normalizeNullableString_(val) {
  if (val == null) return null;
  var s = String(val).trim();
  return s === '' ? null : s;
}

function _isPlainObject_(obj) {
  if (obj == null) return false;
  if (typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return false;
  return Object.prototype.toString.call(obj) === '[object Object]';
}

/* ---------------------------
 * Wrappers de integração com seu Core (Auth/Audit)
 * -------------------------*/

function _requireSessionOrThrow(context) {
  // Seu Api.gs cria ctx.user, mas aqui precisamos apenas garantir "autenticado".
  // Se ctx.session existir, ok. Se existir Auth_requireSession, usa.
  if (context && context.session) return context.session;

  if (typeof Auth_requireSession === 'function') {
    return Auth_requireSession(context && context.request ? context.request : context);
  }

  // Fallback: se o core estiver usando ctx.user ao invés de session,
  // consideramos autenticado quando ctx.user existe.
  if (context && context.user) return { idUsuario: context.user.id || null, perfil: context.user.perfil || context.user.role || null };

  throw ApiError('UNAUTHENTICATED', 'Token inválido ou ausente.');
}

function _requireAdminOrThrow(session) {
  if (typeof Auth_requireAdmin === 'function') {
    return Auth_requireAdmin(session);
  }

  var perfil = (session && (session.perfil || session.role || session.profile))
    ? String(session.perfil || session.role || session.profile).trim()
    : '';

  if (perfil.toLowerCase() !== 'admin') {
    throw ApiError('FORBIDDEN', 'Usuário não é ADMIN.');
  }
  return true;
}

/**
 * ✅ Auditoria alinhada ao Audit.gs real (Audit_log_)
 * - Converte o "entry" do módulo (checklist) para (ctx,event).
 * - Não quebra request se falhar (best-effort).
 */
function _auditLogSafe(entry, context) {
  try {
    // Preferência: Audit_log_ (padrão do seu projeto)
    if (typeof Audit_log_ === 'function') {
      var ctx = context || {};
      if (!ctx.action) ctx.action = (entry && entry.Action) ? entry.Action : 'Clinica_Update';
      // ctx.user já é definido no Api.gs; se não existir, tenta montar algo mínimo
      if (!ctx.user) {
        ctx.user = (context && context.user) ? context.user : null;
      }

      var event = {
        outcome: 'SUCCESS',
        entity: entry && (entry.EntidadeAlvo || entry.entity || entry.Entity) ? (entry.EntidadeAlvo || entry.entity || entry.Entity) : 'Clinica',
        entityId: entry && (entry.ID_Alvo || entry.entityId) ? (entry.ID_Alvo || entry.entityId) : null,
        // "extra" é onde guardamos Antes/Depois como o checklist pede
        extra: {
          Action: entry && entry.Action ? entry.Action : 'Clinica_Update',
          EntidadeAlvo: entry && entry.EntidadeAlvo ? entry.EntidadeAlvo : 'Clinica',
          ID_Alvo: entry && entry.ID_Alvo ? entry.ID_Alvo : null,
          ID_Usuario: entry && entry.ID_Usuario ? entry.ID_Usuario : null,
          AntesJson: entry && entry.AntesJson ? entry.AntesJson : null,
          DepoisJson: entry && entry.DepoisJson ? entry.DepoisJson : null,
          Timestamp: entry && entry.Timestamp ? entry.Timestamp : (new Date().toISOString())
        }
      };

      Audit_log_(ctx, event);
      return;
    }

    // Compatibilidade: se existir algum Audit_log sem underscore (legado)
    if (typeof Audit_log === 'function') {
      Audit_log(entry);
      return;
    }

    // Último recurso: log
    console.warn('[AUDIT_MISSING] Audit_log_/Audit_log não encontrado. Entry:', JSON.stringify(entry));
  } catch (e) {
    try { console.warn('[AUDIT_FAIL]', String(e)); } catch (_) {}
  }
}
