/**
 * ============================================================
 * PRONTIO - AuthRecovery.gs
 * ============================================================
 * Pilar H: Recuperação de senha ("Esqueci minha senha")
 *
 * Actions:
 * - Auth_ForgotPassword_Request        payload: { identifier }  // login ou email
 * - Auth_ForgotPassword_ValidateToken  payload: { token }
 * - Auth_ForgotPassword_Reset          payload: { token, novaSenha }
 *
 * Regras:
 * - Nunca revelar se usuário existe
 * - Token expira em 30 minutos
 * - Token é uso único (UsedAt)
 * - Nunca gravar token puro (apenas hash)
 * - Após reset: invalida TODAS as sessões do usuário
 * - Auditoria best-effort via Audit_securityEvent_
 *
 * Config (sem hardcode de domínio):
 * - PRONTIO_PUBLIC_BASE_URL (string, sem barra final)
 *   Ex.: "https://app.prontio.com.br"
 *   (se vazio, link gerado será relativo: reset-password.html?token=...)
 *
 * Segurança adicional (ITEM ATUAL):
 * - Rate limit por identifier (anti-abuso), sem vazar informação
 */

var RECOVERY_TOKEN_TTL_MINUTES = 30;
var RECOVERY_MIN_PASSWORD_LEN = 6;

// ============================================================
// Rate limit (backend) - ajuste aqui se quiser
// Ex.: para 10 tentativas, coloque RECOVERY_RATE_LIMIT_MAX = 10
// ============================================================
var RECOVERY_RATE_LIMIT_MAX = typeof RECOVERY_RATE_LIMIT_MAX !== "undefined" ? RECOVERY_RATE_LIMIT_MAX : 3;
var RECOVERY_RATE_LIMIT_WINDOW_MIN = typeof RECOVERY_RATE_LIMIT_WINDOW_MIN !== "undefined" ? RECOVERY_RATE_LIMIT_WINDOW_MIN : 15;
var RECOVERY_RATE_LIMIT_PREFIX = typeof RECOVERY_RATE_LIMIT_PREFIX !== "undefined" ? RECOVERY_RATE_LIMIT_PREFIX : "PRONTIO_RECOVERY_RL_";

function Auth_ForgotPassword_Request(ctx, payload) {
  payload = payload || {};
  ctx = ctx || {};

  var identifier = String(payload.identifier || payload.login || payload.email || "").trim();
  // Resposta sempre genérica
  var response = { ok: true, message: "Se o usuário existir, um e-mail será enviado com instruções." };

  try { if (typeof Recovery_ensureSchema_ === "function") Recovery_ensureSchema_(); } catch (_) {}

  // Se não informar nada, ainda assim responde genérico (não vaza)
  if (!identifier) {
    try { Audit_securityEvent_(ctx, "Auth_ForgotPassword_Request", "PASSWORD_RECOVERY_REQUEST", "DENY", { reason: "MISSING_IDENTIFIER" }, {}); } catch (_) {}
    return response;
  }

  // ✅ Rate limit (anti-abuso) — SEMPRE resposta genérica
  try {
    var allowed = _Recovery_rateLimitConsume_(identifier);
    if (!allowed) {
      try {
        Audit_securityEvent_(
          ctx,
          "Auth_ForgotPassword_Request",
          "PASSWORD_RECOVERY_REQUEST",
          "DENY",
          { reason: "RATE_LIMIT", windowMin: RECOVERY_RATE_LIMIT_WINDOW_MIN, max: RECOVERY_RATE_LIMIT_MAX },
          {}
        );
      } catch (_) {}
      return response;
    }
  } catch (_) {
    // Se rate-limit falhar, não derruba request (best-effort)
  }

  // Localiza usuário (login ou email) sem vazar resultado
  var userRow = null;
  try {
    if (typeof Usuarios_findRowByIdentifier_ === "function") {
      userRow = Usuarios_findRowByIdentifier_(identifier);
    }
  } catch (_) {
    userRow = null;
  }

  // Se usuário não existe, responde igual (não vaza)
  if (!userRow || !userRow.idx || userRow.idx.id < 0) {
    try { Audit_securityEvent_(ctx, "Auth_ForgotPassword_Request", "PASSWORD_RECOVERY_REQUEST", "INFO", { identifierHint: identifier.slice(0, 80), result: "NO_MATCH" }, {}); } catch (_) {}
    return response;
  }

  // Extrai email do usuário; se não houver email, não envia, mas responde igual
  var idx = userRow.idx;
  var row = userRow.row;
  var userId = String(row[idx.id] || "").trim();
  var email = (idx.email >= 0) ? String(row[idx.email] || "").trim() : "";

  if (!userId || !email) {
    try { Audit_securityEvent_(ctx, "Auth_ForgotPassword_Request", "PASSWORD_RECOVERY_REQUEST", "INFO", { userId: userId || "", result: "NO_EMAIL" }, { id: userId, login: "" }); } catch (_) {}
    return response;
  }

  // Gera token e grava hash
  var token = _Recovery_generateToken_();
  var tokenHash = _Recovery_hashToken_(token);

  var now = new Date();
  var expiresAt = new Date(now.getTime() + RECOVERY_TOKEN_TTL_MINUTES * 60 * 1000);

  // Cria registro na aba PasswordRecovery
  try {
    var sheet = Recovery_getSheet_();
    var header = Recovery_header_(sheet);

    var colIdRecovery = Recovery_colIndex_(header, "ID_Recovery");
    var colUserId = Recovery_colIndex_(header, "ID_Usuario");
    var colTokenHash = Recovery_colIndex_(header, "TokenHash");
    var colExpiresAt = Recovery_colIndex_(header, "ExpiresAt");
    var colUsedAt = Recovery_colIndex_(header, "UsedAt");
    var colRequestedAt = Recovery_colIndex_(header, "RequestedAt");
    var colIpHint = Recovery_colIndex_(header, "RequestIpHint");
    var colUserAgent = Recovery_colIndex_(header, "UserAgent");
    var colCriadoEm = Recovery_colIndex_(header, "CriadoEm");

    var idRecovery = "REC_" + Utilities.getUuid().split("-")[0].toUpperCase();

    var rowOut = new Array(header.length);
    if (colIdRecovery >= 0) rowOut[colIdRecovery] = idRecovery;
    if (colUserId >= 0) rowOut[colUserId] = userId;
    if (colTokenHash >= 0) rowOut[colTokenHash] = tokenHash;
    if (colExpiresAt >= 0) rowOut[colExpiresAt] = expiresAt;
    if (colUsedAt >= 0) rowOut[colUsedAt] = ""; // vazio
    if (colRequestedAt >= 0) rowOut[colRequestedAt] = now;
    if (colIpHint >= 0) rowOut[colIpHint] = ""; // Apps Script não fornece IP confiável
    if (colUserAgent >= 0) rowOut[colUserAgent] = ""; // não temos UA no Apps Script
    if (colCriadoEm >= 0) rowOut[colCriadoEm] = now;

    sheet.appendRow(rowOut);
  } catch (e) {
    // Falha ao gravar recovery -> responde genérico e audita
    try { Audit_securityEvent_(ctx, "Auth_ForgotPassword_Request", "PASSWORD_RECOVERY_REQUEST", "ERROR", { reason: "WRITE_FAILED", error: String(e) }, { id: userId, login: "" }); } catch (_) {}
    return response;
  }

  // Envia email (Gmail do Apps Script)
  try {
    var link = _Recovery_buildResetLink_(token);
    var subject = "PRONTIO - Redefinição de senha";
    var body =
      "Você solicitou a redefinição de senha no PRONTIO.\n\n" +
      "Clique no link abaixo para criar uma nova senha:\n" +
      link + "\n\n" +
      "Este link expira em " + RECOVERY_TOKEN_TTL_MINUTES + " minutos.\n" +
      "Se você não solicitou, ignore este e-mail.\n";

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body
    });

    try {
      Audit_securityEvent_(ctx, "Auth_ForgotPassword_Request", "PASSWORD_RECOVERY_REQUEST", "SUCCESS", { ttlMin: RECOVERY_TOKEN_TTL_MINUTES }, { id: userId, login: "" });
    } catch (_) {}
  } catch (e2) {
    // Se email falhar, responde genérico mas audita
    try { Audit_securityEvent_(ctx, "Auth_ForgotPassword_Request", "PASSWORD_RECOVERY_REQUEST", "ERROR", { reason: "EMAIL_FAILED", error: String(e2) }, { id: userId, login: "" }); } catch (_) {}
  }

  return response;
}

function Auth_ForgotPassword_ValidateToken(ctx, payload) {
  payload = payload || {};
  ctx = ctx || {};
  var token = String(payload.token || "").trim();

  // resposta genérica, mas útil para a tela (não revela usuário)
  if (!token) return { valid: false };

  var res = _Recovery_findValidTokenRow_(token);
  return { valid: !!res };
}

function Auth_ForgotPassword_Reset(ctx, payload) {
  payload = payload || {};
  ctx = ctx || {};

  var token = String(payload.token || "").trim();
  var novaSenha = String(payload.novaSenha || payload.senha || "").toString();

  // resposta genérica
  if (!token || !novaSenha) {
    var err = new Error("Dados inválidos.");
    err.code = (Errors && Errors.CODES) ? Errors.CODES.VALIDATION_ERROR : "VALIDATION_ERROR";
    err.details = { fields: ["token", "novaSenha"] };
    throw err;
  }

  if (novaSenha.length < RECOVERY_MIN_PASSWORD_LEN) {
    var eWeak = new Error("A nova senha deve ter pelo menos " + RECOVERY_MIN_PASSWORD_LEN + " caracteres.");
    eWeak.code = (Errors && Errors.CODES) ? Errors.CODES.VALIDATION_ERROR : "VALIDATION_ERROR";
    eWeak.details = { minLen: RECOVERY_MIN_PASSWORD_LEN };
    throw eWeak;
  }

  var match = _Recovery_findValidTokenRow_(token);
  if (!match) {
    try { Audit_securityEvent_(ctx, "Auth_ForgotPassword_Reset", "PASSWORD_RECOVERY_RESET", "DENY", { reason: "INVALID_OR_EXPIRED_TOKEN" }, {}); } catch (_) {}
    var e = new Error("Token inválido ou expirado.");
    e.code = (Errors && Errors.CODES && Errors.CODES.PERMISSION_DENIED) ? Errors.CODES.PERMISSION_DENIED : "PERMISSION_DENIED";
    e.details = { reason: "INVALID_OR_EXPIRED_TOKEN" };
    throw e;
  }

  // Marca UsedAt (uso único)
  try {
    match.sheet.getRange(match.rowIndex, match.colUsedAt).setValue(new Date());
  } catch (_) {}

  // Atualiza SenhaHash do usuário
  try {
    var uFound = Usuarios_findRowById_(match.userId);
    if (!uFound) {
      try { Audit_securityEvent_(ctx, "Auth_ForgotPassword_Reset", "PASSWORD_RECOVERY_RESET", "ERROR", { reason: "USER_NOT_FOUND", userId: match.userId }, { id: match.userId, login: "" }); } catch (_) {}
      var e2 = new Error("Token inválido ou expirado.");
      e2.code = (Errors && Errors.CODES && Errors.CODES.PERMISSION_DENIED) ? Errors.CODES.PERMISSION_DENIED : "PERMISSION_DENIED";
      e2.details = { reason: "USER_NOT_FOUND" };
      throw e2;
    }

    // precisa de SenhaHash
    var idx = uFound.idx;
    if (idx.senhaHash < 0) {
      var e3 = new Error("Schema de usuários inválido.");
      e3.code = (Errors && Errors.CODES) ? Errors.CODES.INTERNAL_ERROR : "INTERNAL_ERROR";
      e3.details = { missing: "SenhaHash" };
      throw e3;
    }

    var newHash = hashSenha_(novaSenha);
    uFound.sheet.getRange(uFound.rowIndex, idx.senhaHash + 1).setValue(newHash);

    if (idx.atualizadoEm >= 0) uFound.sheet.getRange(uFound.rowIndex, idx.atualizadoEm + 1).setValue(new Date());
    if (idx.ativo >= 0) uFound.sheet.getRange(uFound.rowIndex, idx.ativo + 1).setValue(true); // reativa por segurança operacional
  } catch (err) {
    // se falhar, audita e repassa como erro interno/denied genérico
    try { Audit_securityEvent_(ctx, "Auth_ForgotPassword_Reset", "PASSWORD_RECOVERY_RESET", "ERROR", { reason: "PASSWORD_UPDATE_FAILED", error: String(err) }, { id: match.userId, login: "" }); } catch (_) {}
    throw err;
  }

  // Invalida todas as sessões do usuário (Pilar H item 3)
  try {
    if (typeof Auth_destroyAllSessionsForUser_ === "function") {
      Auth_destroyAllSessionsForUser_(match.userId);
    }
  } catch (_) {}

  try { Audit_securityEvent_(ctx, "Auth_ForgotPassword_Reset", "PASSWORD_RECOVERY_RESET", "SUCCESS", { invalidateSessions: true }, { id: match.userId, login: "" }); } catch (_) {}

  return { ok: true };
}

/**
 * ------------------------------------------------------------
 * Helpers internos
 * ------------------------------------------------------------
 */

function _Recovery_generateToken_() {
  // token forte (não criptográfico perfeito, mas suficiente para WebApp + TTL curto)
  // combina UUIDs + bytes aleatórios
  var uuid1 = Utilities.getUuid();
  var uuid2 = Utilities.getUuid();
  var bytes = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  return (uuid1 + uuid2 + bytes).replace(/-/g, "");
}

function _Recovery_hashToken_(token) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token));
  return Utilities.base64Encode(bytes);
}

/**
 * ✅ Atualizado (sem hardcode):
 * - Usa PRONTIO_PUBLIC_BASE_URL se definido (sem barra no final)
 * - Se vazio, retorna link relativo (DEV)
 * - NÃO usa window (backend Apps Script)
 */
function _Recovery_buildResetLink_(token) {
  var base = "";
  try {
    if (typeof PRONTIO_PUBLIC_BASE_URL === "string") {
      base = String(PRONTIO_PUBLIC_BASE_URL || "").trim();
    }
  } catch (_) {
    base = "";
  }

  var path = "reset-password.html?token=" + encodeURIComponent(token);

  if (!base) return path;

  base = base.replace(/\/+$/, "");
  return base + "/" + path;
}

function _Recovery_findValidTokenRow_(token) {
  try { if (typeof Recovery_ensureSchema_ === "function") Recovery_ensureSchema_(); } catch (_) {}

  var tokenHash = _Recovery_hashToken_(token);
  var sheet = Recovery_getSheet_();
  var header = Recovery_header_(sheet);

  var colUserIdIdx = Recovery_colIndex_(header, "ID_Usuario");
  var colTokenHashIdx = Recovery_colIndex_(header, "TokenHash");
  var colExpiresAtIdx = Recovery_colIndex_(header, "ExpiresAt");
  var colUsedAtIdx = Recovery_colIndex_(header, "UsedAt");

  if (colUserIdIdx < 0 || colTokenHashIdx < 0 || colExpiresAtIdx < 0 || colUsedAtIdx < 0) return null;

  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return null;

  var now = new Date();

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var h = String(row[colTokenHashIdx] || "").trim();
    if (!h) continue;
    if (h !== tokenHash) continue;

    var usedAt = row[colUsedAtIdx];
    if (String(usedAt || "").trim()) return null; // já usado

    var expiresAt = row[colExpiresAtIdx];
    if (expiresAt && expiresAt.getTime && expiresAt.getTime() < now.getTime()) return null;

    var userId = String(row[colUserIdIdx] || "").trim();
    if (!userId) return null;

    return {
      sheet: sheet,
      rowIndex: i + 1,
      userId: userId,
      colUsedAt: colUsedAtIdx + 1
    };
  }

  return null;
}

/**
 * ------------------------------------------------------------
 * Rate-limit helpers (backend)
 * - Best-effort via CacheService
 * - Nunca vaza informação
 * ------------------------------------------------------------
 */
function _Recovery_rlKey_(identifier) {
  identifier = String(identifier || "").trim().toLowerCase();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, identifier);
  var key = RECOVERY_RATE_LIMIT_PREFIX + Utilities.base64EncodeWebSafe(digest);
  // ScriptCache key limit safety
  return key.slice(0, 240);
}

/**
 * Consome 1 tentativa e retorna:
 * - true = permitido
 * - false = bloqueado (rate-limit)
 */
function _Recovery_rateLimitConsume_(identifier) {
  var cache = CacheService.getScriptCache();
  var key = _Recovery_rlKey_(identifier);

  var now = new Date().getTime();
  var windowMs = RECOVERY_RATE_LIMIT_WINDOW_MIN * 60 * 1000;

  var state = { start: now, count: 0 };

  try {
    var raw = cache.get(key);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") state = parsed;
    }
  } catch (_) {}

  // reset janela se expirou
  if (!state.start || (now - state.start) > windowMs) {
    state = { start: now, count: 0 };
  }

  state.count = (state.count || 0) + 1;

  // TTL do cache = janela
  try {
    cache.put(key, JSON.stringify(state), Math.max(60, RECOVERY_RATE_LIMIT_WINDOW_MIN * 60));
  } catch (_) {}

  return state.count <= RECOVERY_RATE_LIMIT_MAX;
}
