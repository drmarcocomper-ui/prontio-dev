/**
 * ============================================================
 * PRONTIO - AuditSecurity.gs
 * ============================================================
 * Pilar G: Auditoria e trilha de segurança
 *
 * Função principal:
 * - Audit_securityEvent_(ctx, action, eventType, outcome, details, target)
 *
 * Regras:
 * - NUNCA logar senha/token/segredos.
 * - details deve ser pequeno e sem PII sensível.
 */

function Audit_securityEvent_(ctx, action, eventType, outcome, details, target) {
  ctx = ctx || {};
  action = String(action || ctx.action || "").trim();
  eventType = String(eventType || "").trim() || "EVENT";
  outcome = String(outcome || "").trim() || "INFO";

  // best-effort: garante schema
  try {
    if (typeof Audit_ensureSchema_ === "function") Audit_ensureSchema_();
  } catch (_) {}

  var ss;
  try {
    ss = (typeof PRONTIO_getDb_ === "function") ? PRONTIO_getDb_() : SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  var sheet = ss.getSheetByName("Audit");
  if (!sheet) return { ok: false, reason: "AUDIT_SHEET_NOT_AVAILABLE" };

  var user = _Audit_userFromCtx_(ctx);
  var tgt = _Audit_targetSafe_(target);

  var row = [
    new Date(),                          // Timestamp
    String(ctx.requestId || ""),         // RequestId
    String(ctx.env || ""),               // Env
    action,                              // Action
    eventType,                           // EventType
    outcome,                             // Outcome
    String(user.id || ""),               // UserId
    String(user.login || ""),            // UserLogin
    String(user.perfil || ""),           // UserPerfil
    String(tgt.id || ""),                // TargetUserId
    String(tgt.login || ""),             // TargetLogin
    String(_Audit_ipHint_() || ""),      // IpHint
    _Audit_safeJson_(details)            // DetailsJson
  ];

  try {
    sheet.appendRow(row);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "APPEND_FAILED", error: String(e) };
  }
}

function _Audit_userFromCtx_(ctx) {
  var u = (ctx && ctx.user) ? ctx.user : null;
  if (!u) return { id: "", login: "", perfil: "" };
  return {
    id: u.id ? String(u.id) : (u.ID_Usuario ? String(u.ID_Usuario) : ""),
    login: u.login ? String(u.login) : (u.Login ? String(u.Login) : (u.email ? String(u.email) : "")),
    perfil: u.perfil ? String(u.perfil) : (u.Perfil ? String(u.Perfil) : "")
  };
}

function _Audit_targetSafe_(target) {
  target = target || {};
  return {
    id: target.id ? String(target.id) : (target.targetUserId ? String(target.targetUserId) : ""),
    login: target.login ? String(target.login) : (target.targetLogin ? String(target.targetLogin) : "")
  };
}

function _Audit_safeJson_(obj) {
  // remove segredos
  try {
    var safe = obj || {};
    if (safe && typeof safe === "object") {
      delete safe.senha;
      delete safe.senhaAtual;
      delete safe.novaSenha;
      delete safe.token;
      delete safe.authToken;
      delete safe.Authorization;
      delete safe.authorization;
      delete safe.password;
      delete safe.passwordHash;
      delete safe.SenhaHash;
      delete safe.senhaHash;
    }
    return JSON.stringify(safe);
  } catch (_) {
    return "{}";
  }
}

function _Audit_ipHint_() {
  // Apps Script WebApp não fornece IP confiável: deixe vazio.
  return "";
}
