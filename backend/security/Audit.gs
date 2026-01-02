/**
 * ============================================================
 * PRONTIO - Audit.gs (FASE 3)
 * ============================================================
 * Log estruturado para observabilidade.
 *
 * Nesta fase, registramos:
 * - Logger.log (Stackdriver/Executions)
 * - Buffer persistente opcional em Script Properties (para debug)
 * - Persistência em aba "Audit" (quando Repository + Migrations estiverem disponíveis)
 *
 * IMPORTANTÍSSIMO:
 * - Não acessa Google Sheets diretamente.
 * - Persistência na aba "Audit" é feita via Repo_insert_ (Repository.gs).
 *
 * ✅ FIX (SEM QUEBRAR):
 * - Adiciona Audit_securityEvent_ (chamado por Auth.gs/Usuarios.gs) com sanitização.
 * - Protege Script Properties contra excesso (tamanho e itens grandes).
 * - Garante que error/extra sejam sempre strings curtas na persistência.
 */

var AUDIT_BUFFER_ENABLED = true;
var AUDIT_BUFFER_KEY = "PRONTIO_AUDIT_BUFFER";
var AUDIT_BUFFER_MAX = 200; // mantém últimos N eventos
var AUDIT_BUFFER_MAX_BYTES = 70000; // limite defensivo p/ Script Properties (best-effort)

// Persistência em sheet "Audit"
var AUDIT_PERSIST_ENABLED = true;
var AUDIT_SHEET_NAME = "Audit";

/**
 * Audit_log_(ctx, event)
 * ctx: { requestId, action, timestamp, user?, ... }
 * event: { outcome, entity?, entityId?, durationMs?, error?, extra? }
 */
function Audit_log_(ctx, event) {
  try {
    var now = new Date();
    ctx = ctx || {};
    event = event || {};

    var safeUser = _auditSafeUser_(ctx.user);

    // Formato interno do entry (para Logger/Buffer)
    var entry = {
      ts: now.toISOString(),
      requestId: ctx.requestId || null,
      action: ctx.action || null,
      env: (typeof PRONTIO_ENV !== "undefined") ? PRONTIO_ENV : null,
      apiVersion: (typeof PRONTIO_API_VERSION !== "undefined") ? PRONTIO_API_VERSION : null,

      user: safeUser,

      outcome: event.outcome || "UNKNOWN",
      entity: event.entity || null,
      entityId: event.entityId || null,
      durationMs: (typeof event.durationMs === "number") ? event.durationMs : null,

      // Nunca persistir objetos enormes aqui sem truncar no stringify
      error: event.error || null,
      extra: event.extra || null
    };

    // 1) Log em execução (sempre)
    try { Logger.log("[AUDIT] " + _auditStringifySafe_(entry, 4000)); } catch (_) {}

    // 2) Buffer persistente opcional (para debug)
    if (AUDIT_BUFFER_ENABLED) {
      _auditAppendBuffer_(entry);
    }

    // 3) Persistência em planilha (via Repository) se disponível
    if (AUDIT_PERSIST_ENABLED) {
      _auditTryPersist_(entry);
    }

    return true;
  } catch (e) {
    // Nunca quebra request por falha de audit
    try { Logger.log("[AUDIT_FAIL] " + String(e)); } catch (_) {}
    return false;
  }
}

/**
 * ✅ Helper de evento de segurança (best-effort)
 * Usado por Auth.gs e Usuarios.gs.
 *
 * Exemplo de uso:
 * Audit_securityEvent_(ctx, "Auth_Login", "AUTH_LOGIN", "SUCCESS", { ... }, { id, login })
 *
 * Regras:
 * - Não loga senha/token.
 * - Sanitiza payloads e limita tamanho.
 */
function Audit_securityEvent_(ctx, source, eventType, outcome, details, target) {
  try {
    ctx = ctx || {};
    var safeDetails = _auditSanitizeSecurityDetails_(details);
    var safeTarget = _auditSanitizeTarget_(target);

    return Audit_log_(ctx, {
      outcome: String(outcome || "UNKNOWN"),
      entity: String(eventType || source || "SECURITY"),
      entityId: safeTarget && safeTarget.id ? String(safeTarget.id) : null,
      error: null,
      extra: {
        source: String(source || ""),
        eventType: String(eventType || ""),
        details: safeDetails,
        target: safeTarget
      }
    });
  } catch (_) {
    return false;
  }
}

/**
 * Retorna os últimos eventos do buffer (para debug manual).
 * NOTA: não exposto como action por padrão.
 */
function Audit_getBuffer_() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(AUDIT_BUFFER_KEY);
  if (!raw) return [];
  try {
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

/**
 * Limpa o buffer (debug).
 */
function Audit_clearBuffer_() {
  PropertiesService.getScriptProperties().deleteProperty(AUDIT_BUFFER_KEY);
  return { ok: true };
}

// ======================
// Internals
// ======================

function _auditAppendBuffer_(entry) {
  try {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(AUDIT_BUFFER_KEY);

    var arr = [];
    if (raw) {
      try {
        arr = JSON.parse(raw);
        if (!Array.isArray(arr)) arr = [];
      } catch (_) {
        arr = [];
      }
    }

    // Evita crescer demais (trunca campos pesados)
    var slim = _auditSlimEntryForBuffer_(entry);

    arr.push(slim);
    if (arr.length > AUDIT_BUFFER_MAX) {
      arr = arr.slice(arr.length - AUDIT_BUFFER_MAX);
    }

    // Proteção de tamanho total no Script Properties (best-effort)
    var json = _auditStringifySafe_(arr, AUDIT_BUFFER_MAX_BYTES);
    props.setProperty(AUDIT_BUFFER_KEY, json);
  } catch (_) {
    // best-effort
  }
}

function _auditSlimEntryForBuffer_(entry) {
  entry = entry || {};
  // mantém estrutura, mas limita error/extra
  return {
    ts: entry.ts || null,
    requestId: entry.requestId || null,
    action: entry.action || null,
    env: entry.env || null,
    apiVersion: entry.apiVersion || null,
    user: entry.user || null,
    outcome: entry.outcome || null,
    entity: entry.entity || null,
    entityId: entry.entityId || null,
    durationMs: entry.durationMs || null,
    error: entry.error ? _auditStringifySafe_(entry.error, 400) : null,
    extra: entry.extra ? _auditStringifySafe_(entry.extra, 800) : null
  };
}

function _auditSafeUser_(user) {
  // Evita logar dados sensíveis. Mantém só identificadores básicos.
  if (!user || typeof user !== "object") return null;

  var safe = {};
  if (user.id !== undefined) safe.id = user.id;
  if (user.login !== undefined) safe.login = user.login;
  if (user.email !== undefined) safe.email = user.email;
  if (user.perfil !== undefined) safe.perfil = user.perfil;

  // Opcional: nome (depende da sua política)
  if (user.nome !== undefined) safe.nome = user.nome;
  if (user.nomeCompleto !== undefined) safe.nomeCompleto = user.nomeCompleto;

  return safe;
}

function _auditSanitizeSecurityDetails_(details) {
  // Remove campos sensíveis (senha, token etc.) e limita tamanho
  if (!details || typeof details !== "object") {
    if (typeof details === "string") return _auditStringifySafe_(details, 800);
    return details || null;
  }

  var out = {};
  var blockedKeys = {
    senha: true,
    password: true,
    token: true,
    authToken: true,
    senhaHash: true,
    passwordHash: true
  };

  try {
    Object.keys(details).forEach(function (k) {
      var key = String(k || "");
      var lk = key.toLowerCase();
      if (blockedKeys[lk]) return;

      var v = details[k];
      // não explode com objetos grandes
      if (typeof v === "string") out[key] = v.slice(0, 800);
      else if (typeof v === "number" || typeof v === "boolean" || v === null) out[key] = v;
      else out[key] = _auditStringifySafe_(v, 800);
    });
  } catch (_) {}

  return out;
}

function _auditSanitizeTarget_(target) {
  if (!target || typeof target !== "object") return null;

  var out = {};
  if (target.id !== undefined) out.id = String(target.id || "");
  if (target.login !== undefined) out.login = String(target.login || "");
  if (target.email !== undefined) out.email = String(target.email || "");
  if (target.perfil !== undefined) out.perfil = String(target.perfil || "");
  return out;
}

/**
 * Persiste em "Audit" via Repo_insert_ quando existir.
 * NÃO quebra se Repository/Migrations não estiverem carregados.
 *
 * Migrations.gs define o header da aba Audit como:
 * ["ts","requestId","action","env","apiVersion","userId","userLogin","userPerfil","outcome","entity","entityId","durationMs","error","extra"]
 */
function _auditTryPersist_(entry) {
  try {
    if (typeof Repo_insert_ !== "function") return false;

    var u = entry.user || {};
    var row = {
      ts: entry.ts,
      requestId: entry.requestId,
      action: entry.action,
      env: entry.env,
      apiVersion: entry.apiVersion,

      userId: (u && u.id !== undefined) ? u.id : null,
      userLogin: (u && u.login !== undefined) ? u.login : null,
      userPerfil: (u && u.perfil !== undefined) ? u.perfil : null,

      outcome: entry.outcome,
      entity: entry.entity,
      entityId: entry.entityId,
      durationMs: entry.durationMs,

      // Armazenar como string para não estourar limites
      error: entry.error ? _auditStringifySafe_(entry.error, 2000) : null,
      extra: entry.extra ? _auditStringifySafe_(entry.extra, 4000) : null
    };

    Repo_insert_(AUDIT_SHEET_NAME, row);
    return true;
  } catch (_) {
    // best-effort: se falhar, não quebra request
    return false;
  }
}

function _auditStringifySafe_(obj, maxLen) {
  maxLen = typeof maxLen === "number" ? maxLen : 2000;
  var s;
  try {
    if (typeof obj === "string") s = obj;
    else s = JSON.stringify(obj);
  } catch (e) {
    s = String(obj);
  }
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}
