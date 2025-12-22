/**
 * ============================================================
 * PRONTIO - AuditSchema.gs
 * ============================================================
 * Pilar G: Auditoria e trilha de segurança
 *
 * - Garante aba "Audit"
 * - Garante colunas oficiais (não remove nem reordena)
 */

var AUDIT_SHEET_NAME = "Audit";

function Audit_ensureSchema_() {
  var ss;
  try {
    ss = (typeof PRONTIO_getDb_ === "function") ? PRONTIO_getDb_() : SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  var sheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(AUDIT_SHEET_NAME);

  var needed = [
    "Timestamp",
    "RequestId",
    "Env",
    "Action",
    "EventType",
    "Outcome",
    "UserId",
    "UserLogin",
    "UserPerfil",
    "TargetUserId",
    "TargetLogin",
    "IpHint",
    "DetailsJson"
  ];

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || "").trim(); });

  // aba nova / header vazio
  if (header.join("").trim() === "" || (header.length === 1 && header[0] === "")) {
    sheet.getRange(1, 1, 1, needed.length).setValues([needed]);
    return { ok: true, created: true, added: needed };
  }

  // garante colunas faltantes no final
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
