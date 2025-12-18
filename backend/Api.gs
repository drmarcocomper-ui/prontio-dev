/**
 * ============================================================
 * PRONTIO - API + AUTH (Apps Script WebApp) - AMBIENTE DEV
 * ============================================================
 * Ajustes (sem quebrar compatibilidade):
 * - CORS (doOptions + headers)
 * - request_id no envelope
 * - parseRequestBody_ mais resiliente
 * - mantém roteamento "agenda" -> handleAgendaAction(action, payload)
 */

var PRONTIO_API_VERSION = '1.0.0-DEV';
var PRONTIO_ENV = 'DEV';

var AUTH_ENFORCE = false;
var AUTH_CACHE_PREFIX = "PRONTIO_AUTH_";
var AUTH_TTL_SECONDS = 60 * 60 * 10;

// ====== CORS ======
var CORS_ALLOW_ORIGIN = "*";
var CORS_ALLOW_METHODS = "GET,POST,OPTIONS";
var CORS_ALLOW_HEADERS = "Content-Type, Authorization";

// Preflight CORS
function doOptions(e) {
  return buildSuccessResponse_({ ok: true, preflight: true }, { request_id: makeRequestId_() });
}

function doPost(e) {
  var reqId = makeRequestId_();

  try {
    var req = parseRequestBody_(e);

    var action = req.action;
    var payload = req.payload || {};

    if (!action) {
      throw { code: 'API_MISSING_ACTION', message: 'Campo "action" é obrigatório.' };
    }

    requireAuthIfEnabled_(action, payload);

    var data = routeAction_(action, payload);

    return buildSuccessResponse_(data, { request_id: reqId, action: action });
  } catch (err) {
    return buildErrorResponse_(err, { request_id: reqId });
  }
}

function doGet(e) {
  var reqId = makeRequestId_();
  return buildSuccessResponse_({
    name: 'PRONTIO API',
    version: PRONTIO_API_VERSION,
    env: PRONTIO_ENV,
    time: new Date()
  }, { request_id: reqId });
}

// ======================
// Helpers
// ======================
function makeRequestId_() {
  try {
    return Utilities.getUuid();
  } catch (e) {
    return String(new Date().getTime());
  }
}

/**
 * Tenta ler JSON de:
 * - e.postData.contents (padrão)
 * - fallback: e.parameter (quando chamado como querystring)
 */
function parseRequestBody_(e) {
  // Caso não tenha corpo (ou esteja vazio), tenta fallback para e.parameter
  if (!e || !e.postData || !e.postData.contents) {
    // Fallback: permite POST/GET via querystring/parameter (útil em debug)
    if (e && e.parameter && (e.parameter.action || e.parameter.payload)) {
      var payloadObj = {};
      try {
        payloadObj = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
      } catch (err) {
        throw { code: 'API_INVALID_JSON', message: 'payload inválido em e.parameter.payload', details: String(err) };
      }
      return { action: e.parameter.action || '', payload: payloadObj || {} };
    }

    throw { code: 'API_EMPTY_BODY', message: 'Corpo da requisição vazio.' };
  }

  var raw = String(e.postData.contents || '').trim();
  if (!raw) throw { code: 'API_EMPTY_BODY', message: 'Corpo da requisição vazio.' };

  try {
    var json = JSON.parse(raw);
    return { action: json.action, payload: json.payload || {} };
  } catch (err) {
    throw { code: 'API_INVALID_JSON', message: 'JSON inválido.', details: String(err) };
  }
}

function routeAction_(action, payload) {
  var prefix = action;
  var idxUnd = action.indexOf('_');
  var idxDot = action.indexOf('.');

  var cut = -1;
  if (idxUnd >= 0 && idxDot >= 0) cut = Math.min(idxUnd, idxDot);
  else if (idxUnd >= 0) cut = idxUnd;
  else if (idxDot >= 0) cut = idxDot;

  if (cut >= 0) prefix = action.substring(0, cut);

  var p = String(prefix || '').toLowerCase();

  switch (p) {
    case 'pacientes':
      return handlePacientesAction(action, payload);
    case 'agenda':
      return handleAgendaAction(action, payload);
    case 'agendaconfig':
      return handleAgendaConfigAction(action, payload);
    case 'evolucao':
      return handleEvolucaoAction(action, payload);
    case 'receita':
      return handleReceitaAction(action, payload);
    case 'prontuario':
      return handleProntuarioAction(action, payload);
    case 'laudos':
      return handleLaudosAction(action, payload);
    case 'docscabecalho':
      return handleDocsCabecalhoAction(action, payload);
    case 'config':
      return handleConfigAction(action, payload);
    case 'exames':
      return handleExamesAction(action, payload);
    case 'medicamentos':
    case 'remedios':
      return handleMedicamentosAction(action, payload);
    case 'usuarios':
      return handleUsuariosAction(action, payload);
    case 'chat':
      return handleChatAction(action, payload);
    case 'auth':
      return handleAuthAction(action, payload);
  }

  throw { code: 'API_UNKNOWN_ACTION', message: 'Ação desconhecida: ' + action };
}

/* AUTH (inalterado funcionalmente) */

function handleAuthAction(action, payload) {
  switch (action) {
    case "Auth_Login":
      return Auth_Login_(payload);
    case "Auth_Me":
      return Auth_Me_(payload);
    case "Auth_Logout":
      return Auth_Logout_(payload);
    default:
      throw { code: "AUTH_UNKNOWN_ACTION", message: "Ação Auth desconhecida: " + action };
  }
}

function Auth_Login_(payload) {
  payload = payload || {};
  var login = (payload.login || "").trim();
  var senha = (payload.senha || "");

  if (!login || !senha) throw { code: "AUTH_MISSING", message: "Login e senha obrigatórios." };
  if (typeof hashSenha_ !== "function") throw { code: "AUTH_HASH_MISSING", message: "hashSenha_ não encontrada." };

  var sheet = SpreadsheetApp.getActive().getSheetByName("Usuarios");
  if (!sheet) throw { code: "AUTH_SHEET", message: "Aba Usuarios não encontrada." };

  var rows = sheet.getDataRange().getValues();
  var header = rows[0];

  var idx = {
    id: header.indexOf("ID_Usuario"),
    nome: header.indexOf("Nome"),
    login: header.indexOf("Login"),
    email: header.indexOf("Email"),
    perfil: header.indexOf("Perfil"),
    ativo: header.indexOf("Ativo"),
    senhaHash: header.indexOf("SenhaHash"),
    ultimoLogin: header.indexOf("UltimoLoginEm")
  };

  var senhaHash = hashSenha_(senha);

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[idx.login]).toLowerCase() !== login.toLowerCase()) continue;

    if (r[idx.ativo] !== true && r[idx.ativo] !== "TRUE") throw { code: "AUTH_INACTIVE", message: "Usuário inativo." };
    if (String(r[idx.senhaHash]) !== senhaHash) throw { code: "AUTH_INVALID", message: "Credenciais inválidas." };

    var user = {
      id: r[idx.id],
      nome: r[idx.nome],
      login: r[idx.login],
      email: r[idx.email],
      perfil: r[idx.perfil] || "usuario"
    };

    var token = Utilities.getUuid();
    CacheService.getScriptCache().put(AUTH_CACHE_PREFIX + token, JSON.stringify(user), AUTH_TTL_SECONDS);

    if (idx.ultimoLogin >= 0) sheet.getRange(i + 1, idx.ultimoLogin + 1).setValue(new Date());

    return { token: token, user: user };
  }

  throw { code: "AUTH_INVALID", message: "Credenciais inválidas." };
}

function Auth_Me_(payload) {
  payload = payload || {};
  var token = (payload.token || "").trim();
  var raw = CacheService.getScriptCache().get(AUTH_CACHE_PREFIX + token);
  if (!raw) throw { code: "AUTH_EXPIRED", message: "Sessão expirada." };
  return { user: JSON.parse(raw) };
}

function Auth_Logout_(payload) {
  payload = payload || {};
  var token = (payload.token || "").trim();
  if (token) CacheService.getScriptCache().remove(AUTH_CACHE_PREFIX + token);
  return { ok: true };
}

function requireAuthIfEnabled_(action, payload) {
  if (!AUTH_ENFORCE) return;
  if (String(action).toLowerCase().indexOf("auth_") === 0) return;

  payload = payload || {};
  var token = (payload.token || "").trim();
  var raw = CacheService.getScriptCache().get(AUTH_CACHE_PREFIX + token);

  if (!raw) {
    throw { code: "AUTH_REQUIRED", message: "Login obrigatório." };
  }
}

// ======================
// Responses + CORS headers
// ======================
function withCors_(textOutput) {
  // Apps Script WebApp não permite setar headers diretamente como Node,
  // mas o ContentService expõe setHeader (WebApp V8 costuma aceitar).
  // Se seu ambiente não aceitar, não quebra: apenas ignora.
  try {
    textOutput.setHeader("Access-Control-Allow-Origin", CORS_ALLOW_ORIGIN);
    textOutput.setHeader("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
    textOutput.setHeader("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
  } catch (e) {}
  return textOutput;
}

function buildSuccessResponse_(data, meta) {
  meta = meta || {};
  var out = ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: data || null,
    errors: [],
    meta: {
      request_id: meta.request_id || null,
      action: meta.action || null,
      api_version: PRONTIO_API_VERSION,
      env: PRONTIO_ENV
    }
  })).setMimeType(ContentService.MimeType.JSON);

  return withCors_(out);
}

function buildErrorResponse_(err, meta) {
  meta = meta || {};
  err = err || {};

  var out = ContentService.createTextOutput(JSON.stringify({
    success: false,
    data: null,
    errors: [{
      code: err.code || "UNKNOWN",
      message: err.message || String(err),
      details: err.details || null
    }],
    meta: {
      request_id: meta.request_id || null,
      api_version: PRONTIO_API_VERSION,
      env: PRONTIO_ENV
    }
  })).setMimeType(ContentService.MimeType.JSON);

  return withCors_(out);
}
