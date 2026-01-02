/**
 * ============================================================
 * PRONTIO - AuthDev.gs (DEV ONLY)
 * ============================================================
 * Action temporária para RESETAR senha quando ninguém consegue logar.
 *
 * Action: Auth_ResetSenhaDev
 * ⚠️ REMOVER depois que o login funcionar
 */

function Auth_ResetSenhaDev(ctx, payload) {
  payload = payload || {};
  var login = String(payload.login || "").trim();
  var senha = String(payload.senha || "").trim();

  if (!login || !senha) {
    var e = new Error("Informe login e senha.");
    e.code = "VALIDATION_ERROR";
    throw e;
  }

  // Usa o mesmo método do Auth_Login
  var u = Usuarios_findByLoginForAuth_(login);
  if (!u || !u.id) {
    var e2 = new Error("Usuário não encontrado.");
    e2.code = "NOT_FOUND";
    throw e2;
  }

  // Abre a planilha REAL (via PRONTIO_getDb_)
  var ss = (typeof PRONTIO_getDb_ === "function")
    ? PRONTIO_getDb_()
    : SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName("Usuarios");
  if (!sheet) {
    var e3 = new Error('Aba "Usuarios" não encontrada.');
    e3.code = "USUARIOS_SHEET_NOT_FOUND";
    throw e3;
  }

  var data = sheet.getDataRange().getValues();
  var header = data[0];

  var colId = header.indexOf("ID_Usuario");
  var colHash = header.indexOf("SenhaHash");
  var colAtivo = header.indexOf("Ativo");

  if (colId < 0 || colHash < 0) {
    var e4 = new Error("Schema inválido (ID_Usuario / SenhaHash).");
    e4.code = "USUARIOS_BAD_SCHEMA";
    throw e4;
  }

  // Localiza linha pelo ID
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colId]) === String(u.id)) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex < 0) {
    var e5 = new Error("Usuário não localizado na planilha.");
    e5.code = "NOT_FOUND";
    throw e5;
  }

  // Gera hash no padrão oficial
  var senhaHash = hashSenha_(senha);

  sheet.getRange(rowIndex, colHash + 1).setValue(senhaHash);

  if (colAtivo >= 0) {
    sheet.getRange(rowIndex, colAtivo + 1).setValue(true);
  }

  return {
    ok: true,
    login: login,
    id: u.id
  };
}
