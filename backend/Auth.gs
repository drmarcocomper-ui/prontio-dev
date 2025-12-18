/**
 * ============================================================
 * PRONTIO - Auth.gs
 * Autenticação real via aba "Usuarios"
 *
 * Colunas esperadas na aba "Usuarios":
 * ID_Usuario | Nome | Login | Email | Perfil | Ativo | SenhaHash | UltimoLoginEm | Created_At | Updated_At
 * ============================================================
 */

var AUTH_CACHE_PREFIX = "PRONTIO_AUTH_";
var AUTH_TTL_SECONDS = 60 * 60 * 10; // 10 horas

function handleAuthAction(action, payload) {
  switch (action) {
    case "Auth_Login":
      return Auth_Login_(payload);
    case "Auth_Me":
      return Auth_Me_(payload);
    case "Auth_Logout":
      return Auth_Logout_(payload);
    default:
      throw {
        code: "AUTH_UNKNOWN_ACTION",
        message: "Ação de autenticação desconhecida: " + action,
        details: { action: action }
      };
  }
}

function Auth_Login_(payload) {
  payload = payload || {};

  // compat: aceita login/senha OU usuario/senha (para não quebrar chamadas antigas)
  var login = (payload.login || payload.usuario || "").toString().trim();
  var senha = (payload.senha || "").toString();

  if (!login || !senha) {
    throw { code: "AUTH_MISSING_CREDENTIALS", message: "Informe login e senha.", details: null };
  }

  if (typeof hashSenha_ !== "function") {
    throw { code: "AUTH_HASH_FN_MISSING", message: "Função hashSenha_ não encontrada (Usuarios.gs).", details: null };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
  if (!sheet) throw { code: "AUTH_SHEET_NOT_FOUND", message: 'Aba "Usuarios" não encontrada.', details: null };

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) throw { code: "AUTH_NO_USERS", message: "Nenhum usuário cadastrado.", details: null };

  var header = values[0].map(function (h) { return (h || "").toString().trim(); });

  var idx = {
  id: header.indexOf("ID_Usuario"),
  nome: header.indexOf("NomeCompleto"),
  login: header.indexOf("Login"),
  email: header.indexOf("Email"),
  perfil: header.indexOf("Perfil"),
  ativo: header.indexOf("Ativo"),
  senhaHash: header.indexOf("SenhaHash"),
  ultimoLoginEm: header.indexOf("UltimoLoginEm")
};


  if (idx.login < 0 || idx.ativo < 0 || idx.senhaHash < 0) {
    throw { code: "AUTH_BAD_SCHEMA", message: 'Cabeçalho da aba "Usuarios" incompleto.', details: idx };
  }

  var senhaHash = hashSenha_(senha);
  var userRow = null;
  var rowIndex = -1;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowLogin = (row[idx.login] || "").toString().trim().toLowerCase();
    if (rowLogin !== login.toLowerCase()) continue;

    var ativo = row[idx.ativo] === true || row[idx.ativo] === "TRUE";
    if (!ativo) throw { code: "AUTH_USER_INACTIVE", message: "Usuário inativo.", details: null };

    var storedHash = (row[idx.senhaHash] || "").toString().trim();
    if (!storedHash || storedHash !== senhaHash) {
      throw { code: "AUTH_INVALID_CREDENTIALS", message: "Login ou senha inválidos.", details: null };
    }

    userRow = row;
    rowIndex = i + 1; // 1-based no Sheets
    break;
  }

  if (!userRow) throw { code: "AUTH_INVALID_CREDENTIALS", message: "Login ou senha inválidos.", details: null };

  var user = {
    id: idx.id >= 0 ? (userRow[idx.id] || "") : "",
    nome: idx.nome >= 0 ? (userRow[idx.nome] || "") : "",
    login: userRow[idx.login] || "",
    email: idx.email >= 0 ? (userRow[idx.email] || "") : "",
    perfil: idx.perfil >= 0 ? (userRow[idx.perfil] || "") : "usuario",
    ativo: true
  };

  var token = Utilities.getUuid();
  CacheService.getScriptCache().put(AUTH_CACHE_PREFIX + token, JSON.stringify(user), AUTH_TTL_SECONDS);

  if (idx.ultimoLoginEm >= 0 && rowIndex > 0) {
    sheet.getRange(rowIndex, idx.ultimoLoginEm + 1).setValue(new Date());
  }

  return { token: token, user: user, expiresIn: AUTH_TTL_SECONDS };
}

function Auth_Me_(payload) {
  payload = payload || {};
  var token = (payload.token || "").toString().trim();
  if (!token) throw { code: "AUTH_NO_TOKEN", message: "Sem token.", details: null };

  var raw = CacheService.getScriptCache().get(AUTH_CACHE_PREFIX + token);
  if (!raw) throw { code: "AUTH_TOKEN_EXPIRED", message: "Sessão expirada. Faça login novamente.", details: null };

  return { user: JSON.parse(raw) };
}

function Auth_Logout_(payload) {
  payload = payload || {};
  var token = (payload.token || "").toString().trim();
  if (token) CacheService.getScriptCache().remove(AUTH_CACHE_PREFIX + token);
  return { ok: true };
}
