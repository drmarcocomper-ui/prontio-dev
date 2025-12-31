/**
 * ============================================================
 * PRONTIO - Errors.gs (FASE 2)
 * ============================================================
 * Catálogo de códigos de erro + helpers padronizados.
 *
 * Envelope padrão esperado:
 * { success:boolean, data:any, errors:[{code,message,details?}], requestId }
 *
 * ✅ UPDATE (SEM QUEBRAR):
 * - Mantém todos os códigos existentes.
 * - Adiciona códigos AUTH adicionais usados no front (api.js):
 *   AUTH_EXPIRED, AUTH_TOKEN_EXPIRED, AUTH_NO_TOKEN
 * - Não altera formato do envelope.
 *
 * ✅ MELHORIAS (SEM QUEBRAR):
 * - Helpers utilitários: primary(), normalizeCode(), isCode(), assert()
 * - Ajuda a impedir variações de code e reduzir lógica duplicada nos módulos.
 */

var Errors = (function () {
  var CODES = {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    INTERNAL_ERROR: "INTERNAL_ERROR",

    // ✅ AUTH (padronização; não quebra legado)
    AUTH_REQUIRED: "AUTH_REQUIRED",
    AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",

    // ✅ AUTH extras (compat com front)
    AUTH_EXPIRED: "AUTH_EXPIRED",
    AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
    AUTH_NO_TOKEN: "AUTH_NO_TOKEN"
  };

  function make(code, message, details) {
    return {
      code: normalizeCode(code || CODES.INTERNAL_ERROR),
      message: message || "Erro.",
      details: (details === undefined ? null : details)
    };
  }

  /**
   * Normaliza códigos para o conjunto canônico.
   * - Mantém compat: códigos desconhecidos permanecem (para não quebrar logs),
   *   mas corrige alguns legados comuns.
   */
  function normalizeCode(code) {
    var c = String(code || "").trim();
    if (!c) return CODES.INTERNAL_ERROR;

    // Normalizações legadas comuns
    if (c === "AGENDA_CONFLITO_HORARIO") return CODES.CONFLICT;
    if (c === "CONFLICT_HOUR") return CODES.CONFLICT;
    if (c === "VALIDACAO" || c === "VALIDATION") return CODES.VALIDATION_ERROR;

    // Códigos canônicos que já conhecemos
    if (CODES[c]) return CODES[c];

    // Mantém códigos custom para compat/diagnóstico
    return c;
  }

  /**
   * Builder de resposta de erro no envelope padrão.
   * ctx pode ser null; requestId pode ser passado explicitamente.
   */
  function response(ctx, code, message, details) {
    var requestId = (ctx && ctx.requestId) ? ctx.requestId : null;
    var out = {
      success: false,
      data: null,
      errors: [make(code, message, details)],
      requestId: requestId
    };

    // Compatibilidade legada (se Api.gs estiver incluindo meta)
    if (typeof PRONTIO_API_VERSION !== "undefined" || typeof PRONTIO_ENV !== "undefined") {
      out.meta = {
        request_id: requestId,
        action: (ctx && ctx.action) ? ctx.action : null,
        api_version: (typeof PRONTIO_API_VERSION !== "undefined") ? PRONTIO_API_VERSION : null,
        env: (typeof PRONTIO_ENV !== "undefined") ? PRONTIO_ENV : null
      };
    }

    return out;
  }

  /**
   * Builder de resposta de sucesso no envelope padrão.
   */
  function ok(ctx, data) {
    var requestId = (ctx && ctx.requestId) ? ctx.requestId : null;
    var out = {
      success: true,
      data: (data === undefined ? null : data),
      errors: [],
      requestId: requestId
    };

    if (typeof PRONTIO_API_VERSION !== "undefined" || typeof PRONTIO_ENV !== "undefined") {
      out.meta = {
        request_id: requestId,
        action: (ctx && ctx.action) ? ctx.action : null,
        api_version: (typeof PRONTIO_API_VERSION !== "undefined") ? PRONTIO_API_VERSION : null,
        env: (typeof PRONTIO_ENV !== "undefined") ? PRONTIO_ENV : null
      };
    }

    return out;
  }

  /**
   * Converte exception (objeto {code,message,details} ou Error/string)
   * em resposta INTERNAL_ERROR (ou usa code se existir).
   */
  function fromException(ctx, err, fallbackMessage) {
    var code = CODES.INTERNAL_ERROR;
    var message = fallbackMessage || "Erro interno.";
    var details = null;

    if (err && typeof err === "object") {
      if (err.code) code = normalizeCode(String(err.code));
      if (err.message) message = String(err.message);
      if (err.details !== undefined) details = err.details;
      else if (err.stack) details = String(err.stack).slice(0, 4000);
    } else if (err !== undefined) {
      message = String(err);
    }

    return response(ctx, code, message, details);
  }

  /**
   * Retorna o "primeiro erro" de um envelope ou lista.
   * Útil para tomadas de decisão por code.
   */
  function primary(envelopeOrErrors) {
    if (!envelopeOrErrors) return make("UNKNOWN", "Erro desconhecido.", null);

    // envelope {success,data,errors}
    if (typeof envelopeOrErrors === "object" && Array.isArray(envelopeOrErrors.errors)) {
      var e0 = envelopeOrErrors.errors[0];
      return e0 ? make(e0.code, e0.message, (e0.details === undefined ? null : e0.details)) : make("UNKNOWN", "Falha na operação.", null);
    }

    // array errors
    if (Array.isArray(envelopeOrErrors)) {
      var e1 = envelopeOrErrors[0];
      if (!e1) return make("UNKNOWN", "Falha na operação.", null);
      if (typeof e1 === "string") return make("UNKNOWN", e1, null);
      return make(e1.code, e1.message || String(e1), (e1.details === undefined ? null : e1.details));
    }

    // Error
    if (envelopeOrErrors instanceof Error) {
      return make(envelopeOrErrors.code || "INTERNAL_ERROR", envelopeOrErrors.message, envelopeOrErrors.details);
    }

    return make("UNKNOWN", String(envelopeOrErrors), null);
  }

  /**
   * Checa se um error/envelope tem um code específico.
   */
  function isCode(errOrEnvelope, code) {
    var p = primary(errOrEnvelope);
    return String(p.code || "").toUpperCase() === String(code || "").toUpperCase();
  }

  /**
   * Assert helper (lança Error com code/details).
   */
  function assert(condition, code, message, details) {
    if (condition) return true;
    var e = new Error(String(message || "Erro."));
    e.code = normalizeCode(code || CODES.VALIDATION_ERROR);
    e.details = (details === undefined ? null : details);
    throw e;
  }

  return {
    CODES: CODES,
    make: make,
    response: response,
    ok: ok,
    fromException: fromException,

    // ✅ Helpers extras
    normalizeCode: normalizeCode,
    primary: primary,
    isCode: isCode,
    assert: assert
  };
})();

/**
 * Helper procedural (para uso direto, sem depender do objeto Errors)
 */
function Errors_build_(ctx, code, message, details) {
  return Errors.response(ctx, code, message, details);
}
