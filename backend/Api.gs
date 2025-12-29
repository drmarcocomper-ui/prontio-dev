// backend/Api.gs
/**
 * ============================================================
 * PRONTIO - Api.gs
 * ============================================================
 * Mantém doPost como API principal.
 * ✅ doGet aceita ?action=...&payload=...&callback=...
 * - Se action estiver presente, executa a action (via Registry) e responde:
 *   - JSONP (callback(...)) se callback existir
 *   - JSON normal caso contrário
 *
 * Melhorias (retrocompatíveis):
 * - Headers no-cache (reduz risco de cachear JSONP/GET)
 * - meta inclui duration_ms
 * - higiene extra do JSONP (sem alterar contrato)
 *
 * ✅ UPDATE (retrocompatível):
 * - Fallback LEGADO também no doGet (igual doPost):
 *   Se action não estiver registrada no Registry, tenta routeAction_ (se existir)
 *   ou PRONTIO_routeAction_ (router legado padrão incluído aqui).
 *
 * ✅ UPDATE (retrocompatível - AGENDA):
 * - PRONTIO_routeAction_ agora também roteia actions de Agenda_* para handleAgendaAction,
 *   igual já fazia para Pacientes_*.
 *
 * ✅ UPDATE (retrocompatível - PRONTUÁRIO):
 * - PRONTIO_routeAction_ agora também roteia actions de Prontuario.* para handleProntuarioAction,
 *   garantindo funcionamento mesmo sem Registry.
 */

var PRONTIO_API_VERSION = typeof PRONTIO_API_VERSION !== "undefined" ? PRONTIO_API_VERSION : "1.0.0-DEV";
var PRONTIO_ENV = typeof PRONTIO_ENV !== "undefined" ? PRONTIO_ENV : "DEV";

// CORS (DEV)
var CORS_ALLOW_ORIGIN = typeof CORS_ALLOW_ORIGIN !== "undefined" ? CORS_ALLOW_ORIGIN : "*";
var CORS_ALLOW_METHODS = typeof CORS_ALLOW_METHODS !== "undefined" ? CORS_ALLOW_METHODS : "GET,POST,OPTIONS";
var CORS_ALLOW_HEADERS = typeof CORS_ALLOW_HEADERS !== "undefined" ? CORS_ALLOW_HEADERS : "Content-Type, Authorization";

// ======================
// WebApp entrypoints
// ======================

function doOptions(e) {
  var requestId = _makeRequestId_();
  return _withCors_(
    _jsonOutput_(
      (typeof Errors !== "undefined" && Errors && typeof Errors.ok === "function")
        ? Errors.ok({ requestId: requestId, action: "OPTIONS" }, { ok: true, preflight: true })
        : _ok_(requestId, { ok: true, preflight: true }, { action: "OPTIONS" })
    )
  );
}

/**
 * ✅ doGet:
 * - Se NÃO houver action, mantém o endpoint informativo.
 * - Se houver action, executa action e responde em JSON ou JSONP (se callback existir).
 */
function doGet(e) {
  // 1) Modo JSONP/GET-action (GitHub Pages)
  try {
    if (e && e.parameter && e.parameter.action) {
      var requestId = _makeRequestId_();
      var startedAt = new Date();

      var req = _parseRequestBody_(e);
      var action = String(req.action || "").trim();
      var payload = req.payload || {};

      if (!action) {
        return _respondMaybeJsonp_(e, _err_(requestId, [
          { code: "VALIDATION_ERROR", message: 'Campo "action" é obrigatório.', details: { field: "action" } }
        ], { action: "GET(action)", startedAt: startedAt }));
      }

      var ctx = {
        requestId: requestId,
        timestamp: startedAt.toISOString(),
        startedAtMs: startedAt.getTime(),
        action: action,
        env: PRONTIO_ENV,
        apiVersion: PRONTIO_API_VERSION,
        user: null
      };

      var entry = Registry_getAction_(action);

      // ✅ UPDATE: fallback legado (também no GET)
      if (!entry) {
        var legacyDataGet = _tryLegacyRoute_(action, payload, ctx);
        if (legacyDataGet !== null) {
          return _respondMaybeJsonp_(e, _ok_(requestId, legacyDataGet, { action: action, legacy: true, startedAt: startedAt }));
        }

        return _respondMaybeJsonp_(e, _err_(requestId, [
          { code: "NOT_FOUND", message: "Action não registrada.", details: { action: action } }
        ], { action: action, startedAt: startedAt }));
      }

      // Resolve user (token vem no payload)
      if (typeof Auth_getUserContext_ === "function") {
        ctx.user = Auth_getUserContext_(payload);
      } else {
        ctx.user = null;
      }

      // AUTH
      if (entry.requiresAuth) {
        if (typeof Auth_requireAuth_ === "function" && typeof Errors !== "undefined" && Errors) {
          var authRes = Auth_requireAuth_(ctx, payload);
          if (!authRes.success) return _respondMaybeJsonp_(e, _withMetaDuration_(authRes, startedAt));
        } else {
          return _respondMaybeJsonp_(e, _err_(requestId, [
            { code: "INTERNAL_ERROR", message: "Auth requerido, mas Auth.gs/Errors.gs não disponível.", details: { action: action } }
          ], { action: action, startedAt: startedAt }));
        }
      }

      // ROLES
      if (entry.roles && entry.roles.length) {
        if (typeof Auth_requireRoles_ === "function" && typeof Errors !== "undefined" && Errors) {
          var roleRes = Auth_requireRoles_(ctx, entry.roles);
          if (!roleRes.success) return _respondMaybeJsonp_(e, _withMetaDuration_(roleRes, startedAt));
        } else {
          return _respondMaybeJsonp_(e, _err_(requestId, [
            { code: "INTERNAL_ERROR", message: "Roles requeridas, mas Auth.gs/Errors.gs não disponível.", details: { action: action, roles: entry.roles } }
          ], { action: action, startedAt: startedAt }));
        }
      }

      // Validations
      if (entry.validations && entry.validations.length && typeof Validators_run_ === "function") {
        var vRes = Validators_run_(ctx, entry.validations, payload);
        if (!vRes.success) return _respondMaybeJsonp_(e, _withMetaDuration_(vRes, startedAt));
      }

      // Locks
      var data;
      if (entry.requiresLock && typeof Locks_withLock_ === "function") {
        data = Locks_withLock_(ctx, entry.lockKey || action, function () {
          return entry.handler(ctx, payload);
        });
      } else {
        data = entry.handler(ctx, payload);
      }

      return _respondMaybeJsonp_(e, _ok_(requestId, data, { action: action, startedAt: startedAt }));
    }
  } catch (err) {
    var rid = _makeRequestId_();
    return _respondMaybeJsonp_(e, _exceptionToErrorResponse_(rid, err));
  }

  // 2) Modo informativo original
  var requestId2 = _makeRequestId_();
  var data2 = {
    name: "PRONTIO API",
    version: PRONTIO_API_VERSION,
    env: PRONTIO_ENV,
    time: new Date().toISOString()
  };
  return _withCors_(_jsonOutput_(_ok_(requestId2, data2, { action: "GET" })));
}

function doPost(e) {
  var requestId = _makeRequestId_();
  var startedAt = new Date();

  try {
    var req = _parseRequestBody_(e);
    var action = String(req.action || "").trim();
    var payload = req.payload || {};

    if (!action) {
      return _withCors_(_jsonOutput_(_err_(requestId, [
        { code: "VALIDATION_ERROR", message: 'Campo "action" é obrigatório.', details: { field: "action" } }
      ], { startedAt: startedAt })));
    }

    var ctx = {
      requestId: requestId,
      timestamp: startedAt.toISOString(),
      startedAtMs: startedAt.getTime(),
      action: action,
      env: PRONTIO_ENV,
      apiVersion: PRONTIO_API_VERSION,
      user: null
    };

    var entry = Registry_getAction_(action);

    if (!entry) {
      // ✅ Mantém seu fallback legado, mas agora tenta também PRONTIO_routeAction_
      var legacyDataPost = _tryLegacyRoute_(action, payload, ctx);
      if (legacyDataPost !== null) {
        var okLegacy = _ok_(requestId, legacyDataPost, { action: action, legacy: true, startedAt: startedAt });
        return _withCors_(_jsonOutput_(okLegacy));
      }

      return _withCors_(_jsonOutput_(_err_(requestId, [
        { code: "NOT_FOUND", message: "Action não registrada.", details: { action: action } }
      ], { action: action, startedAt: startedAt })));
    }

    if (typeof Auth_getUserContext_ === "function") {
      ctx.user = Auth_getUserContext_(payload);
    } else {
      ctx.user = null;
    }

    if (entry.requiresAuth) {
      if (typeof Auth_requireAuth_ === "function" && typeof Errors !== "undefined" && Errors) {
        var authRes2 = Auth_requireAuth_(ctx, payload);
        if (!authRes2.success) return _withCors_(_jsonOutput_(_withMetaDuration_(authRes2, startedAt)));
      } else {
        return _withCors_(_jsonOutput_(_err_(requestId, [
          { code: "INTERNAL_ERROR", message: "Auth requerido, mas Auth.gs/Errors.gs não disponível.", details: { action: action } }
        ], { action: action, startedAt: startedAt })));
      }
    }

    if (entry.roles && entry.roles.length) {
      if (typeof Auth_requireRoles_ === "function" && typeof Errors !== "undefined" && Errors) {
        var roleRes2 = Auth_requireRoles_(ctx, entry.roles);
        if (!roleRes2.success) return _withCors_(_jsonOutput_(_withMetaDuration_(roleRes2, startedAt)));
      } else {
        return _withCors_(_jsonOutput_(_err_(requestId, [
          { code: "INTERNAL_ERROR", message: "Roles requeridas, mas Auth.gs/Errors.gs não disponível.", details: { action: action, roles: entry.roles } }
        ], { action: action, startedAt: startedAt })));
      }
    }

    if (entry.validations && entry.validations.length && typeof Validators_run_ === "function") {
      var vRes2 = Validators_run_(ctx, entry.validations, payload);
      if (!vRes2.success) return _withCors_(_jsonOutput_(_withMetaDuration_(vRes2, startedAt)));
    }

    var data;
    if (entry.requiresLock && typeof Locks_withLock_ === "function") {
      data = Locks_withLock_(ctx, entry.lockKey || action, function () {
        return entry.handler(ctx, payload);
      });
    } else {
      data = entry.handler(ctx, payload);
    }

    var ok = _ok_(requestId, data, { action: action, startedAt: startedAt });
    return _withCors_(_jsonOutput_(ok));

  } catch (err) {
    return _withCors_(_jsonOutput_(_exceptionToErrorResponse_(requestId, err)));
  }
}

// ======================
// Legacy routing helpers
// ======================

function _tryLegacyRoute_(action, payload, ctx) {
  try {
    if (typeof routeAction_ === "function") {
      try { return routeAction_(action, payload, ctx); } catch (_) { return routeAction_(action, payload); }
    }
  } catch (_) { }

  try {
    if (typeof PRONTIO_routeAction_ === "function") {
      try { return PRONTIO_routeAction_(action, payload, ctx); } catch (_) { return PRONTIO_routeAction_(action, payload); }
    }
  } catch (_) { }

  return null;
}

/**
 * Router legado padrão.
 * ✅ Suporte direto para:
 * - Pacientes_* via handlePacientesAction
 * - Agenda_* via handleAgendaAction
 * - ✅ Prontuario.* via handleProntuarioAction
 */
function PRONTIO_routeAction_(action, payload, ctx) {
  var a = String(action || "");

  // ✅ Prontuário (fachada)
  if (a.indexOf("Prontuario.") === 0 || a.indexOf("Prontuario_") === 0) {
    if (typeof handleProntuarioAction !== "function") {
      _apiThrow_("INTERNAL_ERROR", "handleProntuarioAction não está disponível (Prontuario.gs não carregado?).", { action: action });
    }
    return handleProntuarioAction(action, payload);
  }

  // Pacientes (novo/antigo)
  if (a.indexOf("Pacientes") === 0) {
    if (typeof handlePacientesAction !== "function") {
      _apiThrow_("INTERNAL_ERROR", "handlePacientesAction não está disponível (Pacientes.gs não carregado?).", { action: action });
    }
    return handlePacientesAction(action, payload);
  }

  // Agenda (novo/antigo)
  if (a.indexOf("Agenda_") === 0 || a.indexOf("Agenda") === 0) {
    if (typeof handleAgendaAction !== "function") {
      _apiThrow_("INTERNAL_ERROR", "handleAgendaAction não está disponível (Agenda.gs não carregado?).", { action: action });
    }
    return handleAgendaAction(action, payload);
  }

  _apiThrow_("NOT_FOUND", "Action não registrada (Registry) e não suportada no legado.", { action: action });
}

// ======================
// JSONP helpers
// ======================

function _respondMaybeJsonp_(e, obj) {
  try {
    var cb = e && e.parameter ? String(e.parameter.callback || "") : "";
    cb = cb.trim();
    if (cb) return _jsonpOutput_(cb, obj);
  } catch (_) { }
  return _withCors_(_jsonOutput_(obj));
}

function _jsonpOutput_(callbackName, obj) {
  var cb = String(callbackName || "").replace(/[^\w.$]/g, "");
  if (!cb) cb = "__cb";
  var js = cb + "(" + JSON.stringify(obj) + ");";
  return _withCors_(
    ContentService
      .createTextOutput(js)
      .setMimeType(ContentService.MimeType.JAVASCRIPT)
  );
}

// ======================
// Parsing + Response helpers
// ======================

function _makeRequestId_() {
  try { return Utilities.getUuid(); } catch (e) { return "req_" + String(new Date().getTime()); }
}

function _parseRequestBody_(e) {
  if (e && e.parameter && (e.parameter.action || e.parameter.payload)) {
    var payloadObj1 = {};
    try {
      payloadObj1 = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
    } catch (err1) {
      _apiThrow_("VALIDATION_ERROR", "payload inválido em e.parameter.payload", { error: String(err1) });
    }
    return { action: e.parameter.action || "", payload: payloadObj1 || {} };
  }

  if (!e || !e.postData || !e.postData.contents) {
    _apiThrow_("VALIDATION_ERROR", "Corpo da requisição vazio.", { reason: "EMPTY_BODY" });
  }

  var raw = String(e.postData.contents || "").trim();
  if (!raw) _apiThrow_("VALIDATION_ERROR", "Corpo da requisição vazio.", { reason: "EMPTY_BODY" });

  if (raw[0] === "{" || raw[0] === "[") {
    try {
      var json = JSON.parse(raw);
      return { action: json.action, payload: json.payload || {} };
    } catch (errJson) {
      _apiThrow_("VALIDATION_ERROR", "JSON inválido.", { error: String(errJson) });
    }
  }

  if (raw.indexOf("action=") >= 0) {
    var parsed = _parseFormUrlEncoded_(raw);

    var action = parsed.action ? String(parsed.action) : "";
    var payloadRaw = parsed.payload !== undefined ? String(parsed.payload || "") : "";

    var payloadObj2 = {};
    if (payloadRaw) {
      try {
        payloadObj2 = JSON.parse(payloadRaw);
      } catch (err2) {
        _apiThrow_("VALIDATION_ERROR", "payload inválido em form-urlencoded.", {
          error: String(err2),
          payloadSnippet: payloadRaw.slice(0, 200)
        });
      }
    }

    return { action: action, payload: payloadObj2 || {} };
  }

  _apiThrow_("VALIDATION_ERROR", "Formato de requisição não suportado.", {
    hint: "Envie JSON {action,payload} ou form-urlencoded action=...&payload=...",
    rawSnippet: raw.slice(0, 200)
  });
}

function _parseFormUrlEncoded_(raw) {
  var out = {};
  var parts = raw.split("&");
  for (var i = 0; i < parts.length; i++) {
    var kv = parts[i].split("=");
    if (!kv.length) continue;

    var k = _decodeForm_(kv[0] || "");
    var v = kv.length > 1 ? _decodeForm_(kv.slice(1).join("=")) : "";
    if (k) out[k] = v;
  }
  return out;
}

function _decodeForm_(s) {
  s = String(s || "");
  s = s.replace(/\+/g, " ");
  try { return decodeURIComponent(s); } catch (_) { return s; }
}

function _apiThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
}

function _jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function _withCors_(textOutput) {
  try {
    textOutput.setHeader("Access-Control-Allow-Origin", CORS_ALLOW_ORIGIN);
    textOutput.setHeader("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
    textOutput.setHeader("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);

    textOutput.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    textOutput.setHeader("Pragma", "no-cache");
    textOutput.setHeader("Expires", "0");
  } catch (e) { }
  return textOutput;
}

function _withMetaDuration_(envelope, startedAt) {
  try {
    if (!envelope || typeof envelope !== "object") return envelope;
    if (!envelope.meta) envelope.meta = {};
    if (startedAt && startedAt.getTime) {
      envelope.meta.duration_ms = new Date().getTime() - startedAt.getTime();
    }
  } catch (_) { }
  return envelope;
}

function _ok_(requestId, data, meta) {
  meta = meta || {};
  var startedAt = meta.startedAt || null;

  var out = {
    success: true,
    data: (data === undefined ? null : data),
    errors: [],
    requestId: requestId,
    meta: {
      request_id: requestId,
      action: meta.action || null,
      api_version: PRONTIO_API_VERSION,
      env: PRONTIO_ENV,
      legacy: meta.legacy === true
    }
  };

  if (startedAt && startedAt.getTime) {
    out.meta.duration_ms = new Date().getTime() - startedAt.getTime();
  }

  return out;
}

function _err_(requestId, errors, meta) {
  meta = meta || {};
  var startedAt = meta.startedAt || null;

  var out = {
    success: false,
    data: null,
    errors: errors || [],
    requestId: requestId,
    meta: {
      request_id: requestId,
      action: meta.action || null,
      api_version: PRONTIO_API_VERSION,
      env: PRONTIO_ENV
    }
  };

  if (startedAt && startedAt.getTime) {
    out.meta.duration_ms = new Date().getTime() - startedAt.getTime();
  }

  return out;
}

function _exceptionToErrorResponse_(requestId, err) {
  var code = "INTERNAL_ERROR";
  var message = "Erro interno.";
  var details = null;

  if (err && typeof err === "object") {
    if (err.code) code = String(err.code);
    if (err.message) message = String(err.message);
    if (err.details !== undefined) details = err.details;
    else if (err.stack) details = String(err.stack).slice(0, 4000);
  } else if (err !== undefined) {
    message = String(err);
  }

  return _err_(requestId, [{ code: code, message: message, details: details }]);
}
