/**
 * ============================================================
 * PRONTIO - Auth.gs (FASE 5)
 * ============================================================
 * + Pilar G: Auditoria (best-effort)
 * + Pilar H: invalidar todas as sessões do usuário (índice por userId)
 *
 * FIX (estabilidade):
 * - Sessões NÃO ficam só no CacheService (cache é volátil/evictável).
 * - Persistimos sessão em Planilha (aba AuthSessions) e usamos cache como acelerador.
 *
 * Actions:
 * - Auth_Login
 * - Auth_Me
 * - Auth_Logout
 *
 * ✅ FIX (SEM QUEBRAR):
 * - Auth_requireAuth_ agora tenta devolver code AUTH_REQUIRED (quando disponível),
 *   evitando que o front trate "sem login" como PERMISSION_DENIED.
 * - Auth_requireRoles_ mantém PERMISSION_DENIED para "sem role", mas com reason ROLE_REQUIRED.
 * - Pilar H: se o índice em cache (por userId) estiver vazio, deriva tokens pela coluna UserId
 *   na aba AuthSessions e revoga mesmo assim (não depende só do cache).
 * - DB provider: tenta PRONTIO_getDb_ -> Repo_getDb_ -> ActiveSpreadsheet.
 *
 * ✅ PASSO 2 (padronização global de erro):
 * - Diferencia:
 *   - AUTH_NO_TOKEN (sem token)
 *   - AUTH_TOKEN_EXPIRED (token expirado)
 *   - AUTH_REQUIRED (token inválido/revogado ou login obrigatório)
 */

var AUTH_CACHE_PREFIX = typeof AUTH_CACHE_PREFIX !== "undefined" ? AUTH_CACHE_PREFIX : "PRONTIO_AUTH_";
var AUTH_TTL_SECONDS = typeof AUTH_TTL_SECONDS !== "undefined" ? AUTH_TTL_SECONDS : (60 * 60 * 10);

// ✅ Pilar H: índice de sessões por usuário (para invalidar todas)
var AUTH_USER_SESSIONS_PREFIX = typeof AUTH_USER_SESSIONS_PREFIX !== "undefined"
  ? AUTH_USER_SESSIONS_PREFIX
  : "PRONTIO_AUTH_USER_SESSIONS_";

var AUTH_ROLES = {
  admin: "admin",
  medico: "medico",
  recepcao: "recepcao",
  profissional: "profissional",
  secretaria: "secretaria"
};

var AUTH_ALLOW_PAYLOAD_USER = typeof AUTH_ALLOW_PAYLOAD_USER !== "undefined" ? AUTH_ALLOW_PAYLOAD_USER : false;

// ✅ Persistência (Planilha)
var AUTH_SESSIONS_SHEET = typeof AUTH_SESSIONS_SHEET !== "undefined" ? AUTH_SESSIONS_SHEET : "AuthSessions";

/**
 * ============================================================
 * Sessões persistentes (Sheets)
 * ============================================================
 * Aba: AuthSessions (backend-only)
 * Colunas:
 * - Token
 * - UserJson
 * - ExpiresAtIso
 * - RevokedAtIso
 * - UserId
 */

// =====================
// Error code helpers (SEM QUEBRAR)
// =====================

function _authCode_(preferred, fallback) {
  // preferred: string, fallback: string
  try {
    if (typeof Errors !== "undefined" && Errors && Errors.CODES) {
      if (preferred && Errors.CODES[preferred]) return Errors.CODES[preferred];
      if (fallback && Errors.CODES[fallback]) return Errors.CODES[fallback];
    }
  } catch (_) {}
  return preferred || fallback || "INTERNAL_ERROR";
}

function _authResp_(ctx, code, message, details) {
  if (typeof Errors !== "undefined" && Errors && typeof Errors.response === "function") {
    return Errors.response(ctx, code, message, details);
  }
  // Fallback mínimo (mantém compat com Api.gs que espera envelope em Errors.*)
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = details === undefined ? null : details;
  throw err;
}

function _authOk_(ctx, data) {
  if (typeof Errors !== "undefined" && Errors && typeof Errors.ok === "function") {
    return Errors.ok(ctx, data || { ok: true });
  }
  return { success: true, data: data || { ok: true }, errors: [] };
}

// =====================
// DB helpers
// =====================

function Auth__getDb_() {
  try {
    if (typeof PRONTIO_getDb_ === "function") {
      var ss0 = PRONTIO_getDb_();
      if (ss0) return ss0;
    }
  } catch (_) {}

  try {
    if (typeof Repo_getDb_ === "function") {
      var ss1 = Repo_getDb_();
      if (ss1) return ss1;
    }
  } catch (_) {}

  return SpreadsheetApp.getActiveSpreadsheet();
}

function Auth__getSessionsSheet_() {
  var ss = Auth__getDb_();
  var sh = ss.getSheetByName(AUTH_SESSIONS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(AUTH_SESSIONS_SHEET);
    sh.getRange(1, 1, 1, 5).setValues([[
      "Token",
      "UserJson",
      "ExpiresAtIso",
      "RevokedAtIso",
      "UserId"
    ]]);
  }
  return sh;
}

function Auth__findSessionRowByToken_(token) {
  token = String(token || "").trim();
  if (!token) return null;

  var sh = Auth__getSessionsSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  var values = sh.getRange(2, 1, lastRow - 1, 5).getValues();
  for (var i = 0; i < values.length; i++) {
    var t = String(values[i][0] || "").trim();
    if (t === token) return { rowIndex: i + 2, row: values[i] };
  }
  return null;
}

function Auth__persistSession_(token, user, expiresAtIso) {
  token = String(token || "").trim();
  if (!token) return;

  var u = _authNormalizeUser_(user || {});
  var userId = u && u.id ? String(u.id) : "";

  var sh = Auth__getSessionsSheet_();
  var found = Auth__findSessionRowByToken_(token);

  var row = [
    token,
    JSON.stringify(u || {}),
    String(expiresAtIso || ""),
    "", // RevokedAtIso
    userId
  ];

  if (found && found.rowIndex) sh.getRange(found.rowIndex, 1, 1, 5).setValues([row]);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, 5).setValues([row]);
}

function Auth__revokeSession_(token) {
  token = String(token || "").trim();
  if (!token) return;

  var found = Auth__findSessionRowByToken_(token);
  if (!found) return;

  var sh = Auth__getSessionsSheet_();
  sh.getRange(found.rowIndex, 4, 1, 1).setValue(new Date().toISOString());
}

/**
 * ✅ NOVO (SEM QUEBRAR):
 * Deriva tokens ativos do usuário diretamente da planilha (coluna UserId),
 * ignorando sessões revogadas/expiradas.
 */
function Auth__findActiveTokensByUserIdFromSheet_(userId) {
  userId = String(userId || "").trim();
  if (!userId) return [];

  var sh = Auth__getSessionsSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var values = sh.getRange(2, 1, lastRow - 1, 5).getValues();
  var out = [];
  var nowMs = Date.now();

  for (var i = 0; i < values.length; i++) {
    var token = String(values[i][0] || "").trim();
    var expiresAtIso = String(values[i][2] || "").trim();
    var revokedAtIso = String(values[i][3] || "").trim();
    var uid = String(values[i][4] || "").trim();

    if (!token) continue;
    if (uid !== userId) continue;
    if (revokedAtIso) continue;

    if (expiresAtIso) {
      var expMs = Date.parse(expiresAtIso);
      if (isFinite(expMs) && expMs > 0 && expMs < nowMs) continue;
    }

    out.push(token);
  }

  var uniq = [];
  var seen = {};
  for (var j = 0; j < out.length; j++) {
    var t = out[j];
    if (!seen[t]) {
      seen[t] = true;
      uniq.push(t);
    }
  }
  return uniq;
}

/**
 * ✅ PASSO 2:
 * Retorna status detalhado da sessão.
 * { status:"VALID"|"EXPIRED"|"REVOKED"|"NOT_FOUND", user?:obj, expiresAtIso?:string }
 */
function Auth__getSessionStatus_(token) {
  token = String(token || "").trim();
  if (!token) return { status: "NOT_FOUND" };

  // 1) Cache primeiro (se existe no cache, consideramos válido pois TTL acompanha expiração)
  try {
    var raw = CacheService.getScriptCache().get(AUTH_CACHE_PREFIX + token);
    if (raw) {
      try {
        var u0 = _authNormalizeUser_(JSON.parse(raw));
        if (u0) return { status: "VALID", user: u0 };
      } catch (_) {}
    }
  } catch (_) {}

  // 2) Sheets
  var found = Auth__findSessionRowByToken_(token);
  if (!found || !found.row) return { status: "NOT_FOUND" };

  var userJson = String(found.row[1] || "").trim();
  var expiresAtIso = String(found.row[2] || "").trim();
  var revokedAtIso = String(found.row[3] || "").trim();

  if (revokedAtIso) return { status: "REVOKED", expiresAtIso: expiresAtIso };

  if (expiresAtIso) {
    var expMs = Date.parse(expiresAtIso);
    if (isFinite(expMs) && expMs > 0 && expMs < Date.now()) {
      return { status: "EXPIRED", expiresAtIso: expiresAtIso };
    }
  }

  // Se não está revogado/expirado, tenta carregar user
  try {
    var u = userJson ? JSON.parse(userJson) : null;
    u = _authNormalizeUser_(u);
    if (!u) return { status: "NOT_FOUND" };

    // rehidrata cache (best-effort)
    try { CacheService.getScriptCache().put(AUTH_CACHE_PREFIX + token, JSON.stringify(u), AUTH_TTL_SECONDS); } catch (_) {}

    return { status: "VALID", user: u, expiresAtIso: expiresAtIso };
  } catch (_) {
    return { status: "NOT_FOUND" };
  }
}

function Auth__loadSessionUser_(token) {
  var st = Auth__getSessionStatus_(token);
  if (st && st.status === "VALID") return st.user || null;
  return null;
}

/**
 * ============================================================
 * Context / Token helpers
 * ============================================================
 */

function Auth_getUserContext_(payload) {
  payload = payload || {};

  if (AUTH_ALLOW_PAYLOAD_USER && payload.user && typeof payload.user === "object") {
    return _authNormalizeUser_(payload.user);
  }

  var token = Auth_getTokenFromPayload_(payload);
  if (!token) return null;

  return Auth__loadSessionUser_(token);
}

/**
 * ✅ Mantém payload.token (legado) e aceita payload.authToken (opcional)
 */
function Auth_getTokenFromPayload_(payload) {
  payload = payload || {};
  var token = (payload.token || payload.authToken || "").toString().trim();
  return token || null;
}

function Auth_requireAuth_(ctx, payload) {
  payload = payload || {};
  var token = Auth_getTokenFromPayload_(payload);

  // ✅ PASSO 2: distinguir "sem token"
  if (!token) {
    var codeNoToken = _authCode_("AUTH_NO_TOKEN", "AUTH_REQUIRED");
    return _authResp_(ctx, codeNoToken, "Token ausente.", { reason: "AUTH_NO_TOKEN" });
  }

  // Verifica status detalhado
  var st = Auth__getSessionStatus_(token);

  if (!st || st.status !== "VALID") {
    if (st && st.status === "EXPIRED") {
      var codeExp = _authCode_("AUTH_TOKEN_EXPIRED", "AUTH_EXPIRED");
      return _authResp_(ctx, codeExp, "Sessão expirada.", { reason: "AUTH_TOKEN_EXPIRED", expiresAtIso: st.expiresAtIso || null });
    }

    // Revogado ou não encontrado -> exigir login
    var codeReq = _authCode_("AUTH_REQUIRED", "PERMISSION_DENIED");
    return _authResp_(ctx, codeReq, "Login obrigatório.", { reason: "AUTH_REQUIRED" });
  }

  ctx.user = st.user;
  return _authOk_(ctx, { ok: true });
}

function Auth_requireRoles_(ctx, roles) {
  roles = roles || [];
  if (!roles.length) return _authOk_(ctx, { ok: true });

  var user = ctx && ctx.user ? ctx.user : null;
  if (!user) {
    var code = _authCode_("AUTH_REQUIRED", "PERMISSION_DENIED");
    return _authResp_(ctx, code, "Login obrigatório.", { reason: "AUTH_REQUIRED" });
  }

  var userRoles = Auth_rolesForUser_(user);
  var required = roles.map(function (r) { return String(r || "").trim().toLowerCase(); });
  var allowed = required.some(function (r) { return userRoles.indexOf(r) >= 0; });

  if (!allowed) {
    var code2 = _authCode_("PERMISSION_DENIED", "PERMISSION_DENIED");
    return _authResp_(ctx, code2, "Sem permissão para esta ação.", {
      reason: "ROLE_REQUIRED",
      requiredRoles: required,
      userRoles: userRoles
    });
  }

  return _authOk_(ctx, { ok: true });
}

function Auth_rolesForUser_(user) {
  user = user || {};
  var perfil = (user.perfil || user.role || "").toString().trim().toLowerCase();
  if (!perfil) return [];

  if (perfil === AUTH_ROLES.admin) {
    return [AUTH_ROLES.admin, AUTH_ROLES.medico, AUTH_ROLES.recepcao, AUTH_ROLES.profissional, AUTH_ROLES.secretaria];
  }
  if (perfil === AUTH_ROLES.medico || perfil === AUTH_ROLES.profissional) return [AUTH_ROLES.medico, AUTH_ROLES.profissional];
  if (perfil === AUTH_ROLES.recepcao || perfil === AUTH_ROLES.secretaria) return [AUTH_ROLES.recepcao, AUTH_ROLES.secretaria];
  return [perfil];
}

/**
 * ============================================================
 * Pilar H: Índice de sessões por usuário (Cache)
 * ============================================================
 */

function Auth__sessionsKey_(userId) {
  return AUTH_USER_SESSIONS_PREFIX + String(userId || "").trim();
}

function Auth__getUserTokenList_(userId) {
  userId = String(userId || "").trim();
  if (!userId) return [];

  var cache = CacheService.getScriptCache();
  var raw = cache.get(Auth__sessionsKey_(userId));
  var list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch (_) { list = []; }
  if (!Array.isArray(list)) list = [];
  return list;
}

function Auth__setUserTokenList_(userId, list) {
  userId = String(userId || "").trim();
  if (!userId) return;

  var cache = CacheService.getScriptCache();
  if (!Array.isArray(list)) list = [];
  cache.put(Auth__sessionsKey_(userId), JSON.stringify(list), AUTH_TTL_SECONDS);
}

function Auth__addTokenToUserIndex_(userId, token) {
  userId = String(userId || "").trim();
  token = String(token || "").trim();
  if (!userId || !token) return;

  var list = Auth__getUserTokenList_(userId);
  if (list.indexOf(token) < 0) list.push(token);
  Auth__setUserTokenList_(userId, list);
}

function Auth__removeTokenFromUserIndex_(userId, token) {
  userId = String(userId || "").trim();
  token = String(token || "").trim();
  if (!userId || !token) return;

  var list = Auth__getUserTokenList_(userId);
  var idx = list.indexOf(token);
  if (idx >= 0) list.splice(idx, 1);
  Auth__setUserTokenList_(userId, list);
}

function Auth_destroyAllSessionsForUser_(userId) {
  userId = String(userId || "").trim();
  if (!userId) return { ok: true, removed: 0 };

  var cache = CacheService.getScriptCache();

  // 1) tenta pelo índice (cache)
  var list = Auth__getUserTokenList_(userId);

  // 2) ✅ FIX: se índice vazio, deriva pelo Sheet (UserId)
  if (!list || !list.length) {
    try { list = Auth__findActiveTokensByUserIdFromSheet_(userId); } catch (_) { list = []; }
  }

  // 3) revoga/remover cache e marca revoked em Sheets
  var removed = 0;
  for (var i = 0; i < list.length; i++) {
    var token = String(list[i] || "").trim();
    if (!token) continue;
    removed++;

    try { cache.remove(AUTH_CACHE_PREFIX + token); } catch (_) {}
    try { Auth__revokeSession_(token); } catch (_) {}
  }

  // limpa índice do cache
  try { cache.remove(Auth__sessionsKey_(userId)); } catch (_) {}

  return { ok: true, removed: removed };
}

function Auth_createSession_(user) {
  user = _authNormalizeUser_(user || {});
  var token = Utilities.getUuid();

  // cache (acelerador)
  CacheService.getScriptCache().put(AUTH_CACHE_PREFIX + token, JSON.stringify(user), AUTH_TTL_SECONDS);

  // persistente
  var expiresAtIso = new Date(Date.now() + (AUTH_TTL_SECONDS * 1000)).toISOString();
  try { Auth__persistSession_(token, user, expiresAtIso); } catch (_) {}

  // índice por user
  try { if (user && user.id) Auth__addTokenToUserIndex_(user.id, token); } catch (_) {}

  return { token: token, user: user, expiresIn: AUTH_TTL_SECONDS };
}

function Auth_destroySession_(token) {
  token = (token || "").toString().trim();
  if (!token) return { ok: true };

  try {
    var raw = CacheService.getScriptCache().get(AUTH_CACHE_PREFIX + token);
    if (raw) {
      var u = _authNormalizeUser_(JSON.parse(raw));
      if (u && u.id) Auth__removeTokenFromUserIndex_(u.id, token);
    } else {
      var found = Auth__findSessionRowByToken_(token);
      if (found && found.row) {
        var uid = String(found.row[4] || "").trim();
        if (uid) Auth__removeTokenFromUserIndex_(uid, token);
      }
    }
  } catch (_) {}

  try { Auth__revokeSession_(token); } catch (_) {}
  CacheService.getScriptCache().remove(AUTH_CACHE_PREFIX + token);
  return { ok: true };
}

// ============================================================
// Actions
// ============================================================

function Auth_Login(ctx, payload) {
  payload = payload || {};
  var login = (payload.login || "").toString().trim();
  var senha = (payload.senha || "").toString();

  if (!login || !senha) {
    var err = new Error("Informe login e senha.");
    err.code = (Errors && Errors.CODES) ? (Errors.CODES.VALIDATION_ERROR || "VALIDATION_ERROR") : "VALIDATION_ERROR";
    err.details = { fields: ["login", "senha"] };
    throw err;
  }

  if (typeof Usuarios_findByLoginForAuth_ !== "function") {
    var e1 = new Error("Módulo de usuários não disponível para autenticação.");
    e1.code = (Errors && Errors.CODES) ? (Errors.CODES.INTERNAL_ERROR || "INTERNAL_ERROR") : "INTERNAL_ERROR";
    e1.details = { missing: "Usuarios_findByLoginForAuth_" };
    throw e1;
  }

  var u = Usuarios_findByLoginForAuth_(login);

  if (!u || !u.ativo) {
    try { Audit_securityEvent_(ctx, "Auth_Login", "AUTH_LOGIN", "DENY", { reason: "INVALID_CREDENTIALS", loginHint: String(login).slice(0, 80) }, {}); } catch (_) {}
    var e2 = new Error("Usuário ou senha inválidos.");
    e2.code = (Errors && Errors.CODES && Errors.CODES.AUTH_INVALID_CREDENTIALS) ? Errors.CODES.AUTH_INVALID_CREDENTIALS : "AUTH_INVALID_CREDENTIALS";
    e2.details = null;
    throw e2;
  }

  if (typeof Usuarios_verifyPassword_ !== "function") {
    var e3 = new Error("Validação de senha indisponível.");
    e3.code = (Errors && Errors.CODES) ? (Errors.CODES.INTERNAL_ERROR || "INTERNAL_ERROR") : "INTERNAL_ERROR";
    e3.details = { missing: "Usuarios_verifyPassword_" };
    throw e3;
  }

  var ok = Usuarios_verifyPassword_(senha, u.senhaHash);
  if (!ok) {
    try { Audit_securityEvent_(ctx, "Auth_Login", "AUTH_LOGIN", "DENY", { reason: "INVALID_CREDENTIALS", loginHint: String(login).slice(0, 80) }, {}); } catch (_) {}
    var e4 = new Error("Usuário ou senha inválidos.");
    e4.code = (Errors && Errors.CODES && Errors.CODES.AUTH_INVALID_CREDENTIALS) ? Errors.CODES.AUTH_INVALID_CREDENTIALS : "AUTH_INVALID_CREDENTIALS";
    e4.details = null;
    throw e4;
  }

  try { if (typeof Usuarios_markUltimoLogin_ === "function") Usuarios_markUltimoLogin_(u.id); } catch (_) {}

  var nomeCompleto = (u.nomeCompleto || u.NomeCompleto || u.nome || u.Nome || "").toString().trim();

  var session = Auth_createSession_({
    id: u.id,
    nome: u.nome,
    nomeCompleto: nomeCompleto,
    login: u.login,
    email: u.email,
    perfil: u.perfil,
    idProfissional: u.idProfissional || null
  });

  try { ctx.user = _authNormalizeUser_(session.user); } catch (_) {}
  try { Audit_securityEvent_(ctx, "Auth_Login", "AUTH_LOGIN", "SUCCESS", {}, {}); } catch (_) {}

  return session;
}

function Auth_Me(ctx, payload) {
  payload = payload || {};
  var token = Auth_getTokenFromPayload_(payload);

  if (!token) {
    var e = new Error("Token ausente.");
    e.code = (Errors && Errors.CODES && Errors.CODES.AUTH_NO_TOKEN) ? Errors.CODES.AUTH_NO_TOKEN : "AUTH_NO_TOKEN";
    e.details = { field: "token", reason: "AUTH_NO_TOKEN" };
    throw e;
  }

  // ✅ PASSO 2: diferencia expirado vs inválido
  var st = Auth__getSessionStatus_(token);
  if (!st || st.status !== "VALID") {
    if (st && st.status === "EXPIRED") {
      var eExp = new Error("Sessão expirada.");
      eExp.code = (Errors && Errors.CODES && Errors.CODES.AUTH_TOKEN_EXPIRED) ? Errors.CODES.AUTH_TOKEN_EXPIRED : "AUTH_TOKEN_EXPIRED";
      eExp.details = { reason: "AUTH_TOKEN_EXPIRED", expiresAtIso: st.expiresAtIso || null };
      throw eExp;
    }
    var e2 = new Error("Login obrigatório.");
    e2.code = (Errors && Errors.CODES && Errors.CODES.AUTH_REQUIRED) ? Errors.CODES.AUTH_REQUIRED : "AUTH_REQUIRED";
    e2.details = { reason: "AUTH_REQUIRED" };
    throw e2;
  }

  // garante ctx.user
  if (ctx) ctx.user = st.user;
  return { user: _authNormalizeUser_(st.user) };
}

function Auth_Logout(ctx, payload) {
  payload = payload || {};
  var token = Auth_getTokenFromPayload_(payload);
  if (!token) return { ok: true };

  try { Audit_securityEvent_(ctx, "Auth_Logout", "AUTH_LOGOUT", "SUCCESS", {}, {}); } catch (_) {}
  return Auth_destroySession_(token);
}

function _authNormalizeUser_(user) {
  if (!user || typeof user !== "object") return null;

  var perfil = (user.perfil !== undefined ? user.perfil : (user.Perfil || user.role || "usuario"));
  perfil = (perfil || "usuario").toString().trim().toLowerCase();

  var nomeCompleto = (user.nomeCompleto || user.NomeCompleto || user.nome || user.Nome || "").toString().trim();

  var idProfissional = (user.idProfissional !== undefined ? user.idProfissional : (user.ID_Profissional || user.idProfissionalRef || null));
  idProfissional = idProfissional ? String(idProfissional).trim() : null;

  return {
    id: user.id !== undefined ? user.id : (user.ID_Usuario || user.idUsuario || null),
    nome: user.nome !== undefined ? user.nome : (user.Nome || null),
    nomeCompleto: nomeCompleto || null,
    login: user.login !== undefined ? user.login : (user.Login || null),
    email: user.email !== undefined ? user.email : (user.Email || null),
    perfil: perfil,
    idProfissional: idProfissional
  };
}
