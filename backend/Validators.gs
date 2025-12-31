/**
 * ============================================================
 * PRONTIO - Validators.gs (FASE 2)
 * ============================================================
 * Validações reutilizáveis + runner.
 *
 * Modelo de "validation spec" aceito:
 * - { field, rule, message?, ...params }
 *   Exemplos:
 *   { field:"inicio", rule:"required" }
 *   { field:"inicio", rule:"date" }
 *   { field:"status", rule:"enum", values:["AGENDADO","CANCELADO"] }
 *   { field:"duracaoMin", rule:"min", value:1 }
 *   { field:"nome", rule:"maxLength", value:120 }
 *
 * Ajuste mínimo aplicado:
 * - Validators_run_ retorna envelope compatível com Errors.gs (quando disponível),
 *   e fallback seguro quando Errors não estiver carregado.
 *
 * ✅ FIX (SEM QUEBRAR):
 * - Não assume que Errors existe dentro das regras (evita ReferenceError).
 * - _vRegex_ protege RegExp inválido (não derruba request).
 * - Runner usa Errors.response/Errors.ok quando disponível.
 *
 * ✅ PASSO 2 (padronização global):
 * - Todos os erros de validação usam code: VALIDATION_ERROR (canônico)
 * - details padronizado inclui { field, rule, ... }
 */

function Validators_run_(ctx, validations, payload) {
  payload = payload || {};
  validations = validations || [];

  var errors = [];
  for (var i = 0; i < validations.length; i++) {
    var v = validations[i];
    var res = Validators_validateOne_(v, payload);
    if (res && res.length) errors = errors.concat(res);
  }

  if (errors.length) {
    var out = {
      success: false,
      data: null,
      errors: errors,
      requestId: (ctx && ctx.requestId) ? ctx.requestId : null
    };

    // meta compat (alinhado com Api.gs/Errors.gs)
    if (typeof PRONTIO_API_VERSION !== "undefined" || typeof PRONTIO_ENV !== "undefined") {
      out.meta = {
        request_id: (ctx && ctx.requestId) ? ctx.requestId : null,
        action: (ctx && ctx.action) ? ctx.action : null,
        api_version: (typeof PRONTIO_API_VERSION !== "undefined") ? PRONTIO_API_VERSION : null,
        env: (typeof PRONTIO_ENV !== "undefined") ? PRONTIO_ENV : null
      };
    }

    return out;
  }

  // Sucesso padronizado
  if (typeof Errors !== "undefined" && Errors && typeof Errors.ok === "function") {
    return Errors.ok(ctx, { ok: true });
  }

  // Fallback
  return { success: true, data: { ok: true }, errors: [], requestId: (ctx && ctx.requestId) ? ctx.requestId : null };
}

function Validators_validateOne_(spec, payload) {
  if (!spec) return [];
  var field = spec.field;
  var rule = spec.rule;

  if (!field || !rule) {
    return [_vMakeError_("VALIDATION_ERROR", "Spec de validação inválida.", { spec: spec, rule: rule, field: field })];
  }

  var value = _getValueByPath_(payload, field);
  var msg = spec.message;

  switch (rule) {
    case "required":
      return _vRequired_(field, value, msg);

    case "type":
      return _vType_(field, value, spec.value, msg); // spec.value = "string" | "number" | "boolean" | "object" | "array"

    case "maxLength":
      return _vMaxLength_(field, value, spec.value, msg);

    case "minLength":
      return _vMinLength_(field, value, spec.value, msg);

    case "min":
      return _vMin_(field, value, spec.value, msg);

    case "max":
      return _vMax_(field, value, spec.value, msg);

    case "date":
      return _vDate_(field, value, msg); // aceita Date, ISO, timestamp numérico

    case "enum":
      return _vEnum_(field, value, spec.values || [], msg);

    case "object":
      return _vObject_(field, value, msg);

    case "array":
      return _vArray_(field, value, msg);

    case "match":
      return _vRegex_(field, value, spec.pattern, msg);

    default:
      return [_vMakeError_("VALIDATION_ERROR", "Regra de validação desconhecida: " + rule, { field: field, rule: rule })];
  }
}

// ======================
// Error helper (SEM QUEBRAR)
// ======================

function _vMakeError_(code, message, details) {
  // Sempre canônico em validações
  var finalCode = "VALIDATION_ERROR";

  // Usa Errors.make se existir; senão cria objeto compatível
  try {
    if (typeof Errors !== "undefined" && Errors && typeof Errors.make === "function") {
      return Errors.make(finalCode, message, (details === undefined ? null : details));
    }
  } catch (_) {}

  return {
    code: finalCode,
    message: String(message || "Erro de validação."),
    details: (details === undefined ? null : details)
  };
}

// ======================
// Rules
// ======================

function _vRequired_(field, value, msg) {
  var ok = !(value === null || value === undefined || (typeof value === "string" && value.trim() === ""));
  return ok ? [] : [_vMakeError_("VALIDATION_ERROR", msg || ("Campo obrigatório: " + field), { field: field, rule: "required" })];
}

function _vType_(field, value, expected, msg) {
  if (value === null || value === undefined) return []; // type check doesn't imply required
  var t = expected;

  var ok = true;
  if (t === "array") ok = Array.isArray(value);
  else if (t === "object") ok = (typeof value === "object" && value !== null && !Array.isArray(value));
  else ok = (typeof value === t);

  return ok ? [] : [_vMakeError_(
    "VALIDATION_ERROR",
    msg || ("Tipo inválido em " + field),
    { field: field, rule: "type", expected: expected, got: (Array.isArray(value) ? "array" : typeof value) }
  )];
}

function _vMaxLength_(field, value, max, msg) {
  if (value === null || value === undefined) return [];
  var m = parseInt(String(max), 10);
  if (!isFinite(m) || m <= 0) {
    return [_vMakeError_("VALIDATION_ERROR", "Spec inválida (maxLength).", { field: field, rule: "maxLength", max: max })];
  }
  var s = String(value);
  return (s.length <= m) ? [] : [_vMakeError_("VALIDATION_ERROR", msg || ("Tamanho máximo excedido: " + field), { field: field, rule: "maxLength", max: m, length: s.length })];
}

function _vMinLength_(field, value, min, msg) {
  if (value === null || value === undefined) return [];
  var m = parseInt(String(min), 10);
  if (!isFinite(m) || m < 0) {
    return [_vMakeError_("VALIDATION_ERROR", "Spec inválida (minLength).", { field: field, rule: "minLength", min: min })];
  }
  var s = String(value);
  return (s.length >= m) ? [] : [_vMakeError_("VALIDATION_ERROR", msg || ("Tamanho mínimo não atingido: " + field), { field: field, rule: "minLength", min: m, length: s.length })];
}

function _vMin_(field, value, min, msg) {
  if (value === null || value === undefined) return [];
  var n = Number(value);
  if (isNaN(n)) return [_vMakeError_("VALIDATION_ERROR", msg || ("Número inválido: " + field), { field: field, rule: "min" })];
  return (n >= min) ? [] : [_vMakeError_("VALIDATION_ERROR", msg || ("Valor mínimo não atingido: " + field), { field: field, rule: "min", min: min, got: n })];
}

function _vMax_(field, value, max, msg) {
  if (value === null || value === undefined) return [];
  var n = Number(value);
  if (isNaN(n)) return [_vMakeError_("VALIDATION_ERROR", msg || ("Número inválido: " + field), { field: field, rule: "max" })];
  return (n <= max) ? [] : [_vMakeError_("VALIDATION_ERROR", msg || ("Valor máximo excedido: " + field), { field: field, rule: "max", max: max, got: n })];
}

function _vDate_(field, value, msg) {
  if (value === null || value === undefined) return [];
  var d = _parseDate_(value);
  return d ? [] : [_vMakeError_("VALIDATION_ERROR", msg || ("Data inválida: " + field), { field: field, rule: "date", value: value })];
}

function _vEnum_(field, value, values, msg) {
  if (value === null || value === undefined) return [];
  // compara por string para reduzir inconsistências entre number/string
  var got = String(value);
  var allowed = (values || []).map(function (x) { return String(x); });
  var ok = allowed.indexOf(got) >= 0;
  return ok ? [] : [_vMakeError_("VALIDATION_ERROR", msg || ("Valor inválido: " + field), { field: field, rule: "enum", allowed: values, got: value })];
}

function _vObject_(field, value, msg) {
  if (value === null || value === undefined) return [];
  var ok = (typeof value === "object" && value !== null && !Array.isArray(value));
  return ok ? [] : [_vMakeError_("VALIDATION_ERROR", msg || ("Objeto inválido: " + field), { field: field, rule: "object" })];
}

function _vArray_(field, value, msg) {
  if (value === null || value === undefined) return [];
  var ok = Array.isArray(value);
  return ok ? [] : [_vMakeError_("VALIDATION_ERROR", msg || ("Array inválido: " + field), { field: field, rule: "array" })];
}

function _vRegex_(field, value, pattern, msg) {
  if (value === null || value === undefined) return [];
  if (!pattern) return [_vMakeError_("VALIDATION_ERROR", "Regex pattern ausente em validação.", { field: field, rule: "match" })];

  var re;
  try {
    re = new RegExp(pattern);
  } catch (e) {
    return [_vMakeError_("VALIDATION_ERROR", "Regex inválido na validação.", { field: field, rule: "match", pattern: pattern, error: String(e) })];
  }

  var ok = re.test(String(value));
  return ok ? [] : [_vMakeError_("VALIDATION_ERROR", msg || ("Formato inválido: " + field), { field: field, rule: "match", pattern: pattern })];
}

// ======================
// Utils
// ======================

function _getValueByPath_(obj, path) {
  if (!path) return undefined;
  if (path.indexOf(".") < 0) return obj[path];

  var parts = path.split(".");
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

function _parseDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    var dNum = new Date(v);
    return isNaN(dNum.getTime()) ? null : dNum;
  }
  if (typeof v === "string") {
    var dStr = new Date(v);
    return isNaN(dStr.getTime()) ? null : dStr;
  }
  return null;
}
