/**
 * ============================================================
 * PRONTIO - Auth.gs (FASE 5)
 * ============================================================
 * + Pilar G: Auditoria (best-effort)
 * + Pilar H: invalidar todas as sessões do usuário (índice por userId)
 *
 * FIX (estabilidade):
 * - Sessões NÃO ficam só no CacheService (cache é volátil/evictável).
 * - Agora persistimos sessão em Planilha (aba AuthSessions) e usamos cache como acelerador.
 *
 * Actions:
 * - Auth_Login
 * - Auth_Me
 * - Auth_Logout
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

function Auth__getDb_() {
  if (typeof PRONTIO_getDb_ !== "function") return SpreadsheetApp.getActiveSpreadsheet();
  var ss = PRONTIO_getDb_();
  return ss || SpreadsheetApp.getActiveSpreadsheet();
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

  // Busca linear (ok para início). Se crescer, dá para indexar.
  var values = sh.getRange(2, 1, lastRow - 1, 5).getValues();
  for (var i = 0; i < values.length; i++) {
    var t = String(values[i][0] || "").trim();
    if (t === token) {
      return { rowIndex: i + 2, row: values[i] };
    }
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

  if (found && found.rowIndex) {
    sh.getRange(found.rowIndex, 1, 1, 5).setValues([row]);
  } else {
    sh.getRange(sh.getLastRow() + 1, 1, 1, 5).setValues([row]);
  }
}

function Auth__revokeSession_(token) {
  token = String(token || "").trim();
  if (!token) return;

  var found = Auth__findSessionRowByToken_(token);
  if (!found) return;

  var sh = Auth__getSessionsSheet_();
  var revokedAt = new Date().toISOString();
  sh.getRange(found.rowIndex, 4, 1, 1).setValue(revokedAt);
}

function Auth__loadSessionUser_(token) {
  token = String(token || "").trim();
  if (!token) return null;

  // 1) Cache primeiro
  var raw = CacheService.getScriptCache().get(AUTH_CACHE_PREFIX + token);
  if (raw) {
    try {
      var cachedUser = JSON.parse(raw);
      return _authNormalizeUser_(cachedUser);
    } catch (_) {}
  }

  // 2) Fallback em Sheets
  var found = Auth__findSessionRowByToken_(token);
  if (!found || !found.row) return null;

  var row = found.row;

  var userJson = String(row[1] || "").trim();
  var expiresAtIso = String(row[2] || "").trim();
  var revokedAtIso = String(row[3] || "").trim();

  if (revokedAtIso) return null;

  if (expiresAtIso) {
    var expMs = Date.parse(expiresAtIso);
    if (isFinite(expMs) && expMs > 0 && expMs < Date.now()) {
      // expirou
      return null;
    }
  }

  try {
    var u = userJson ? JSON.parse(userJson) : null;
    u = _authNormalizeUser_(u);
    if (!u) return null;

    // rehidrata cache (best-effort)
    try {
      CacheService.getScriptCache().put(AUTH_CACHE_PREFIX + token, JSON.stringify(u), AUTH_TTL_SECONDS);
    } catch (_) {}

    return u;
  } catch (e) {
    return null;
  }
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

  // ✅ Agora usa cache + fallback persistente em Sheets
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
  var user = Auth_getUserContext_(payload);
  if (!user) {
    return Errors.response(ctx, Errors.CODES.PERMISSION_DENIED, "Login obrigatório.", { reason: "AUTH_REQUIRED" });
  }
  ctx.user = user;
  return Errors.ok(ctx, { ok: true });
}

function Auth_requireRoles_(ctx, roles) {
  roles = roles || [];
  if (!roles.length) return Errors.ok(ctx, { ok: true });

  var user = ctx && ctx.user ? ctx.user : null;
  if (!user) {
    return Errors.response(ctx, Errors.CODES.PERMISSION_DENIED, "Login obrigatório.", { reason: "AUTH_REQUIRED" });
  }

  var userRoles = Auth_rolesForUser_(user);
  var required = roles.map(function (r) { return String(r || "").trim().toLowerCase(); });
  var allowed = required.some(function (r) { return userRoles.indexOf(r) >= 0; });

  if (!allowed) {
    return Errors.response(ctx, Errors.CODES.PERMISSION_DENIED, "Sem permissão para esta ação.", {
      requiredRoles: required,
      userRoles: userRoles
    });
  }

  return Errors.ok(ctx, { ok: true });
}

function Auth_rolesForUser_(user) {
  user = user || {};

  var perfil = (user.perfil || user.role || "").toString().trim().toLowerCase();
  if (!perfil) return [];

  // ✅ Admin herda tudo (inclui aliases novos)
  if (perfil === AUTH_ROLES.admin) {
    return [
      AUTH_ROLES.admin,
      AUTH_ROLES.medico,
      AUTH_ROLES.recepcao,
      AUTH_ROLES.profissional,
      AUTH_ROLES.secretaria
    ];
  }

  // ✅ medico/profissional são equivalentes
  if (perfil === AUTH_ROLES.medico || perfil === AUTH_ROLES.profissional) {
    return [AUTH_ROLES.medico, AUTH_ROLES.profissional];
  }

  // ✅ recepcao/secretaria são equivalentes
  if (perfil === AUTH_ROLES.recepcao || perfil === AUTH_ROLES.secretaria) {
    return [AUTH_ROLES.recepcao, AUTH_ROLES.secretaria];
  }

  // fallback: aceita perfis customizados
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

/**
 * ✅ Pilar H: invalidar TODAS as sessões ativas do usuário
 * Usado no AuthRecovery.gs após redefinir senha.
 */
function Auth_destroyAllSessionsForUser_(userId) {
  userId = String(userId || "").trim();
  if (!userId) return { ok: true, removed: 0 };

  var cache = CacheService.getScriptCache();
  var list = Auth__getUserTokenList_(userId);

  // remove do cache
  for (var i = 0; i < list.length; i++) {
    var token = String(list[i] || "").trim();
    if (!token) continue;
    try { cache.remove(AUTH_CACHE_PREFIX + token); } catch (_) {}
    // revoke persistente (best-effort)
    try { Auth__revokeSession_(token); } catch (_) {}
  }

  // remove o índice
  try { cache.remove(Auth__sessionsKey_(userId)); } catch (_) {}

  return { ok: true, removed: list.length };
}

function Auth_createSession_(user) {
  user = _authNormalizeUser_(user || {});
  var token = Utilities.getUuid();

  // cache (acelerador)
  CacheService.getScriptCache().put(AUTH_CACHE_PREFIX + token, JSON.stringify(user), AUTH_TTL_SECONDS);

  // persistente
  var expiresAtIso = new Date(Date.now() + (AUTH_TTL_SECONDS * 1000)).toISOString();
  try { Auth__persistSession_(token, user, expiresAtIso); } catch (_) {}

  // ✅ Pilar H: registra token no índice do usuário
  try {
    if (user && user.id) Auth__addTokenToUserIndex_(user.id, token);
  } catch (_) {}

  return { token: token, user: user, expiresIn: AUTH_TTL_SECONDS };
}

function Auth_destroySession_(token) {
  token = (token || "").toString().trim();
  if (!token) return { ok: true };

  // ✅ Pilar H: remove token do índice do usuário (best-effort)
  try {
    var raw = CacheService.getScriptCache().get(AUTH_CACHE_PREFIX + token);
    if (raw) {
      var u = JSON.parse(raw);
      u = _authNormalizeUser_(u);
      if (u && u.id) Auth__removeTokenFromUserIndex_(u.id, token);
    }
  } catch (_) {}

  // revoke persistente (best-effort)
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
    err.code = (Errors && Errors.CODES) ? Errors.CODES.VALIDATION_ERROR : "VALIDATION_ERROR";
    err.details = { fields: ["login", "senha"] };
    throw err;
  }

  if (typeof Usuarios_findByLoginForAuth_ !== "function") {
    var e1 = new Error("Módulo de usuários não disponível para autenticação.");
    e1.code = (Errors && Errors.CODES) ? Errors.CODES.INTERNAL_ERROR : "INTERNAL_ERROR";
    e1.details = { missing: "Usuarios_findByLoginForAuth_" };
    throw e1;
  }

  var u = Usuarios_findByLoginForAuth_(login);

  if (!u || !u.ativo) {
    try {
      Audit_securityEvent_(ctx, "Auth_Login", "AUTH_LOGIN", "DENY", { reason: "INVALID_CREDENTIALS", loginHint: String(login).slice(0, 80) }, {});
    } catch (_) {}
    var e2 = new Error("Usuário ou senha inválidos.");
    e2.code = (Errors && Errors.CODES && Errors.CODES.AUTH_INVALID_CREDENTIALS) ? Errors.CODES.AUTH_INVALID_CREDENTIALS : "AUTH_INVALID_CREDENTIALS";
    e2.details = null;
    throw e2;
  }

  if (typeof Usuarios_verifyPassword_ !== "function") {
    var e3 = new Error("Validação de senha indisponível.");
    e3.code = (Errors && Errors.CODES) ? Errors.CODES.INTERNAL_ERROR : "INTERNAL_ERROR";
    e3.details = { missing: "Usuarios_verifyPassword_" };
    throw e3;
  }

  var ok = Usuarios_verifyPassword_(senha, u.senhaHash);
  if (!ok) {
    try {
      Audit_securityEvent_(ctx, "Auth_Login", "AUTH_LOGIN", "DENY", { reason: "INVALID_CREDENTIALS", loginHint: String(login).slice(0, 80) }, {});
    } catch (_) {}
    var e4 = new Error("Usuário ou senha inválidos.");
    e4.code = (Errors && Errors.CODES && Errors.CODES.AUTH_INVALID_CREDENTIALS) ? Errors.CODES.AUTH_INVALID_CREDENTIALS : "AUTH_INVALID_CREDENTIALS";
    e4.details = null;
    throw e4;
  }

  try {
    if (typeof Usuarios_markUltimoLogin_ === "function") {
      Usuarios_markUltimoLogin_(u.id);
    }
  } catch (_) {}

  var session = Auth_createSession_({
    id: u.id,
    nome: u.nome,
    login: u.login,
    email: u.email,
    perfil: u.perfil
  });

  // para auditoria do sucesso
  try { ctx.user = _authNormalizeUser_(session.user); } catch (_) {}
  try { Audit_securityEvent_(ctx, "Auth_Login", "AUTH_LOGIN", "SUCCESS", {}, {}); } catch (_) {}

  return session;
}

function Auth_Me(ctx, payload) {
  payload = payload || {};
  var token = Auth_getTokenFromPayload_(payload);

  if (!token) {
    var e = new Error("Token ausente.");
    e.code = (Errors && Errors.CODES && Errors.CODES.AUTH_REQUIRED) ? Errors.CODES.AUTH_REQUIRED : "AUTH_REQUIRED";
    e.details = { field: "token" };
    throw e;
  }

  var user = ctx && ctx.user ? ctx.user : Auth_getUserContext_(payload);
  if (!user) {
    var e2 = new Error("Login obrigatório.");
    e2.code = (Errors && Errors.CODES && Errors.CODES.AUTH_REQUIRED) ? Errors.CODES.AUTH_REQUIRED : "AUTH_REQUIRED";
    e2.details = { reason: "AUTH_REQUIRED" };
    throw e2;
  }

  return { user: _authNormalizeUser_(user) };
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

  return {
    id: user.id !== undefined ? user.id : (user.ID_Usuario || user.idUsuario || null),
    nome: user.nome !== undefined ? user.nome : (user.Nome || null),
    login: user.login !== undefined ? user.login : (user.Login || null),
    email: user.email !== undefined ? user.email : (user.Email || null),
    perfil: perfil
  };
}
