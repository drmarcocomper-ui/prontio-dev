/**
 * ============================================================
 * PRONTIO - AuthDebug.gs (DEV ONLY)
 * ============================================================
 * Action temporária para diagnosticar login sem precisar autenticar.
 *
 * Action: Auth_DebugUser
 * Permissão: requiresAuth=false (DEV)
 *
 * payload:
 * { login: string }
 *
 * Retorno:
 * - qual Spreadsheet está sendo usado (ID)
 * - qual env o backend está usando
 * - resultado de Usuarios_findByLoginForAuth_(login)
 *
 * ⚠️ REMOVER este arquivo e a action do Registry depois do diagnóstico.
 */

function Auth_DebugUser(ctx, payload) {
  payload = payload || {};
  var login = String(payload.login || "").trim();
  if (!login) {
    var e = new Error("Informe login.");
    e.code = (Errors && Errors.CODES && Errors.CODES.VALIDATION_ERROR) ? Errors.CODES.VALIDATION_ERROR : "VALIDATION_ERROR";
    e.details = { field: "login" };
    throw e;
  }

  // Qual DB o sistema está usando?
  var env = (typeof PRONTIO_ENV !== "undefined" ? String(PRONTIO_ENV) : "DEV").toUpperCase();
  var dbInfo = _authDebug_getDbInfo_();

  // Puxa usuário exatamente como o Auth usa
  if (typeof Usuarios_findByLoginForAuth_ !== "function") {
    var e2 = new Error("Usuarios_findByLoginForAuth_ não disponível.");
    e2.code = (Errors && Errors.CODES && Errors.CODES.INTERNAL_ERROR) ? Errors.CODES.INTERNAL_ERROR : "INTERNAL_ERROR";
    e2.details = { missing: "Usuarios_findByLoginForAuth_" };
    throw e2;
  }

  var u = Usuarios_findByLoginForAuth_(login);

  // Não retorna hash completo (apenas snippet) para não expor demais no DEV
  var outUser = null;
  if (u) {
    outUser = {
      id: u.id || null,
      login: u.login || null,
      nome: u.nome || null,
      email: u.email || null,
      perfil: u.perfil || null,
      ativo: !!u.ativo,
      senhaHash_len: (u.senhaHash ? String(u.senhaHash).length : 0),
      senhaHash_snippet: (u.senhaHash ? String(u.senhaHash).slice(0, 8) + "..." + String(u.senhaHash).slice(-6) : null)
    };
  }

  return {
    env: env,
    db: dbInfo,
    requestedLogin: login,
    found: !!u,
    user: outUser
  };
}

function _authDebug_getDbInfo_() {
  try {
    var ss = null;

    if (typeof PRONTIO_getDb_ === "function") {
      ss = PRONTIO_getDb_();
      return {
        source: "PRONTIO_getDb_()",
        spreadsheetId: ss ? ss.getId() : null,
        name: ss ? ss.getName() : null
      };
    }

    // fallback (legado)
    ss = SpreadsheetApp.getActiveSpreadsheet();
    return {
      source: "SpreadsheetApp.getActiveSpreadsheet()",
      spreadsheetId: ss ? ss.getId() : null,
      name: ss ? ss.getName() : null
    };
  } catch (e) {
    return { source: "ERROR", error: String(e) };
  }
}
