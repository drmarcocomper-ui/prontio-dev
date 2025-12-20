/**
 * ============================================================
 * PRONTIO - Locks.gs (FASE 1)
 * ============================================================
 * Controle centralizado de concorrência.
 */

var LOCK_TIMEOUT_MS = 30000;

/**
 * Executa função protegida por lock.
 * IMPORTANTE:
 * - NÃO usar "throw { }" (padroniza com Error + code/details).
 * - O "key" é usado apenas para diagnóstico (LockService é único no script).
 */
function Locks_withLock_(ctx, key, fn) {
  var lock = LockService.getScriptLock();
  var lockKey = "LOCK_" + String(key || "GLOBAL");

  try {
    lock.waitLock(LOCK_TIMEOUT_MS);
    return fn();
  } catch (e) {
    // Em geral, waitLock lança erro quando expira o timeout.
    // Se quiser, dá para diferenciar pelo texto, mas mantemos simples e estável.
    var err = new Error("Recurso em uso. Tente novamente.");
    err.code = "CONFLICT";
    err.details = { lockKey: lockKey, cause: String(e && e.message ? e.message : e) };
    throw err;
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}
