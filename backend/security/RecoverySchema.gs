/**
 * ============================================================
 * PRONTIO - RecoverySchema.gs
 * ============================================================
 * Pilar H: Recuperação de senha
 *
 * Aba: "PasswordRecovery"
 * - Guarda tokens HASH (nunca token puro)
 * - Expiração: 30 minutos (config em AuthRecovery.gs)
 * - Uso único (UsedAt)
 */

var RECOVERY_SHEET_NAME = "PasswordRecovery";

function Recovery_ensureSchema_() {
  var ss;
  try {
    ss = (typeof PRONTIO_getDb_ === "function") ? PRONTIO_getDb_() : SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  var sheet = ss.getSheetByName(RECOVERY_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(RECOVERY_SHEET_NAME);

  var needed = [
    "ID_Recovery",
    "ID_Usuario",
    "TokenHash",
    "ExpiresAt",
    "UsedAt",
    "RequestedAt",
    "RequestIpHint",
    "UserAgent",
    "CriadoEm"
  ];

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || "").trim(); });

  // Header vazio
  if (header.join("").trim() === "" || (header.length === 1 && header[0] === "")) {
    sheet.getRange(1, 1, 1, needed.length).setValues([needed]);
    return { ok: true, created: true, added: needed };
  }

  // Garante colunas faltantes no final
  var added = [];
  needed.forEach(function (col) {
    if (header.indexOf(col) < 0) {
      header.push(col);
      added.push(col);
    }
  });

  if (added.length) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }

  return { ok: true, created: false, added: added };
}

function Recovery_getSheet_() {
  var ss;
  try {
    ss = (typeof PRONTIO_getDb_ === "function") ? PRONTIO_getDb_() : SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  var sheet = ss.getSheetByName(RECOVERY_SHEET_NAME);
  if (!sheet) {
    // best-effort: cria
    sheet = ss.insertSheet(RECOVERY_SHEET_NAME);
    Recovery_ensureSchema_();
  }
  return sheet;
}

function Recovery_header_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || "").trim(); });
  return header;
}

function Recovery_colIndex_(header, name) {
  return header.indexOf(name);
}
