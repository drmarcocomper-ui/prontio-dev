/**
 * ============================================================
 * PRONTIO - AuditSecurity.gs
 * ============================================================
 * Pilar G: Auditoria e trilha de segurança
 *
 * ✅ Importante:
 * - Escreve POR NOME DE COLUNA (header mapping), não por posição.
 * - Prioriza schema novo (Timestamp/RequestId/Env/Action/...) e faz fallback para legado (ts/requestId/env/action/...).
 * - Nunca loga senha/token (sanitização).
 */

function Audit_securityEvent_(ctx, action, eventType, outcome, details, target) {
  ctx = ctx || {};
  action = String(action || ctx.action || "").trim();
  eventType = String(eventType || "").trim() || "EVENT";
  outcome = String(outcome || "").trim() || "INFO";

  // garante schema (best-effort)
  try { if (typeof Audit_ensureSchema_ === "function") Audit_ensureSchema_(); } catch (_) {}

  var ss;
  try {
    ss = (typeof PRONTIO_getDb_ === "function") ? PRONTIO_getDb_() : SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  var sheet = ss.getSheetByName("Audit");
  if (!sheet) return { ok: false, reason: "AUDIT_SHEET_NOT_AVAILABLE" };

  // header map
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || "").trim(); });
  var col = _Audit_buildHeaderMap_(header);

  // resolve actor + target
  var user = _Audit_userFromCtx_(ctx);
  var tgt = _Audit_targetSafe_(target);

  // prepara valores (sem segredos)
  var valuesByName = {};
  var now = new Date();

  // ✅ escreve sempre no schema novo se existir
  _Audit_setFirstAvailable_(valuesByName, col, ["Timestamp", "ts"], now);
  _Audit_setFirstAvailable_(valuesByName, col, ["RequestId", "requestId"], String(ctx.requestId || ""));
  _Audit_setFirstAvailable_(valuesByName, col, ["Env", "env"], String(ctx.env || ""));
  _Audit_setFirstAvailable_(valuesByName, col, ["Action", "action"], action);
  _Audit_setFirstAvailable_(valuesByName, col, ["EventType", "entity"], eventType);
  _Audit_setFirstAvailable_(valuesByName, col, ["Outcome", "outcome"], outcome);

  _Audit_setFirstAvailable_(valuesByName, col, ["UserId", "userId"], String(user.id || ""));
  _Audit_setFirstAvailable_(valuesByName, col, ["UserLogin", "userLogin"], String(user.login || ""));
  _Audit_setFirstAvailable_(valuesByName, col, ["UserPerfil", "userPerfil"], String(user.perfil || ""));

  _Audit_setFirstAvailable_(valuesByName, col, ["TargetUserId", "entityId"], String(tgt.id || ""));
  _Audit_setFirstAvailable_(valuesByName, col, ["TargetLogin"], String(tgt.login || ""));

  _Audit_setFirstAvailable_(valuesByName, col, ["IpHint"], String(_Audit_ipHint_() || ""));

  // detalhes: novo = DetailsJson, legado = extra
  _Audit_setFirstAvailable_(valuesByName, col, ["DetailsJson", "extra"], _Audit_safeJson_(details));

  // grava em uma nova linha
  var rowIndex = Math.max(sheet.getLastRow() + 1, 2);

  try {
    _Audit_writeByHeader_(sheet, rowIndex, valuesByName, col);
    return { ok: true, row: rowIndex };
  } catch (e) {
    return { ok: false, reason: "WRITE_FAILED", error: String(e) };
  }
}

/**
 * Header map: { "Timestamp": 1, "RequestId": 2, ... } indices 1-based
 */
function _Audit_buildHeaderMap_(header) {
  var map = {};
  for (var i = 0; i < header.length; i++) {
    var key = String(header[i] || "").trim();
    if (!key) continue;
    // mantém o primeiro (evita confusão em duplicados)
    if (!map[key]) map[key] = i + 1;
  }
  return map;
}

/**
 * Escolhe o primeiro nome de coluna existente e seta valor.
 */
function _Audit_setFirstAvailable_(valuesByName, colMap, names, value) {
  names = names || [];
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    if (colMap[name]) {
      valuesByName[name] = value;
      return;
    }
  }
}

/**
 * Escreve apenas as colunas presentes em valuesByName.
 */
function _Audit_writeByHeader_(sheet, rowIndex, valuesByName, colMap) {
  var keys = Object.keys(valuesByName || {});
  if (!keys.length) return;

  // escreve célula a célula (poucas colunas, simples e robusto)
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var col = colMap[k];
    if (!col) continue;
    sheet.getRange(rowIndex, col).setValue(valuesByName[k]);
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
