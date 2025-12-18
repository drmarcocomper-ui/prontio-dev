/**
 * PRONTIO - Utils.gs
 * Banco por ambiente (DEV/PROD) via IDs fixos.
 *
 * ID é o trecho entre /d/ e /edit na URL da planilha.
 */

var PRONTIO_DB_ID_DEV = "1h6zr6ultbjK8Dx0c1hrlI0K8UF45plzJE8vHQe7JMck";
var PRONTIO_DB_ID_PROD = "1Gy84gjpf0pGHqUzuYpY6xaEYBlvf-8oztUE5D8_hjew";

function PRONTIO_getDb_() {
  var env = (typeof PRONTIO_ENV !== "undefined" ? String(PRONTIO_ENV) : "DEV").toUpperCase();
  var id = (env === "PROD") ? PRONTIO_DB_ID_PROD : PRONTIO_DB_ID_DEV;

  if (!id) {
    throw new Error("PRONTIO_getDb_: ID da planilha não configurado para env=" + env);
  }

  return SpreadsheetApp.openById(id);
}
