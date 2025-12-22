/**
 * ============================================================
 * PRONTIO - Auth.gs (FASE 5)
 * ============================================================
 * + Pilar G: Auditoria (best-effort)
 *
 * Actions:
 * - Auth_Login
 * - Auth_Me
 * - Auth_Logout
 */

var AUTH_CACHE_PREFIX = typeof AUTH_CACHE_PREFIX !== "undefined" ? AUTH_CACHE_PREFIX : "PRONTIO_AUTH_";
var AUTH_TTL_SECONDS = typeof AUTH_TTL_SECONDS !== "undefined" ? AUTH_TTL_SECONDS : (60 * 60 * 10);

var AUTH_ROLES = {
  admin: "admin",
  medico: "medico",
  recepcao: "recepcao",
  profissional: "profissional",
  secretaria: "secretaria"
};

var AUTH_ALLOW_PAYLOAD_USER = typeof AUTH_ALLOW_PAYLOAD_USER !== "undefined" ? AUTH_ALLOW_PAYLOAD_USER : false;

function Auth_getUserContext_(payload) {
  payload = payload || {};

  if (AUTH_ALLOW_PAYLOAD_USER && payload.user && typeof payload.user === "object") {
    return _authNormalizeUser_(payload.user);
  }

  var token = Auth_getTokenFromPayload_(payload);
  if (!token) return null;

  var raw = CacheService.getScriptCache().get(AUTH_CACHE_PREFIX + token);
  if (!raw) return null;

  try {
    var user = JSON.parse(raw);
    return _authNormalizeUser_(user);
  } catch (e) {
    return null;
  }
}

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

  if (perfil === AUTH_ROLES.admin) {
    return [
      AUTH_ROLES.admin,
      AUTH_ROLES.medico,
      AUTH_ROLES.recepcao,
      AUTH_ROLES.profissional,
      AUTH_ROLES.secretaria
    ];
  }

  if (perfil === AUTH_ROLES.medico || perfil === AUTH_ROLES.profissional) {
    return [AUTH_ROLES.medico, AUTH_ROLES.profissional];
  }

  if (perfil === AUTH_ROLES.recepcao || perfil === AUTH_ROLES.secretaria) {
    return [AUTH_ROLES.recepcao, AUTH_ROLES.secretaria];
  }

  return [perfil];
}

function Auth_createSession_(user) {
  user = _authNormalizeUser_(user || {});
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put(AUTH_CACHE_PREFIX + token, JSON.stringify(user), AUTH_TTL_SECONDS);
  return { token: token, user: user, expiresIn: AUTH_TTL_SECONDS };
}

function Auth_destroySession_(token) {
  token = (token || "").toString().trim();
  if (token) CacheService.getScriptCache().remove(AUTH_CACHE_PREFIX + token);
  return { ok: true };
}

// Actions

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
