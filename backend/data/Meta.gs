/**
 * ============================================================
 * PRONTIO - Meta.gs
 * ============================================================
 * Ações administrativas internas para manutenção do sistema.
 *
 * Objetivo:
 * - Contornar limitações do editor do Apps Script (Executar cinza / API do GAS não habilitada)
 * - Permitir rodar Migrations_bootstrap_ e consultar Migrations_getDbStatus_
 *   via API do PRONTIO (doPost + Registry).
 *
 * Segurança:
 * - As actions são registradas no Registry.gs com requiresAuth:true e roles:["admin"].
 * - Opcionalmente bloqueia em PROD.
 *
 * Actions (Registry):
 * - Meta_BootstrapDb
 * - Meta_DbStatus
 */

function Meta_BootstrapDb(ctx, payload) {
  payload = payload || {};

  // Opcional: proteger para não rodar em PROD
  var env = (typeof PRONTIO_ENV !== "undefined" ? String(PRONTIO_ENV) : "DEV").toUpperCase();
  if (env === "PROD") {
    var eProd = new Error("Bootstrap do banco não permitido em PROD.");
    eProd.code = "PERMISSION_DENIED";
    eProd.details = { env: env };
    throw eProd;
  }

  if (typeof Migrations_bootstrap_ !== "function") {
    var e1 = new Error("Migrations_bootstrap_ não disponível.");
    e1.code = "INTERNAL_ERROR";
    e1.details = { missing: "Migrations_bootstrap_" };
    throw e1;
  }

  var res = Migrations_bootstrap_();

  try {
    if (typeof Audit_log_ === "function") {
      Audit_log_(ctx, { outcome: "SUCCESS", entity: "Meta", entityId: "BootstrapDb", extra: res });
    }
  } catch (_) {}

  return res;
}

function Meta_DbStatus(ctx, payload) {
  payload = payload || {};

  if (typeof Migrations_getDbStatus_ !== "function") {
    var e2 = new Error("Migrations_getDbStatus_ não disponível.");
    e2.code = "INTERNAL_ERROR";
    e2.details = { missing: "Migrations_getDbStatus_" };
    throw e2;
  }

  return Migrations_getDbStatus_();
}
