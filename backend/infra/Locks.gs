/**
 * ============================================================
 * PRONTIO - Locks.gs (FASE 1)
 * ============================================================
 * Controle centralizado de concorrência.
 *
 * Ajustes mínimos:
 * - Mantém LockService.getScriptLock() (Apps Script é script-wide).
 * - Melhora detalhes do erro (ctx/action/requestId/key) para diagnóstico.
 * - Garante releaseLock em finally.
 *
 * ✅ FIX (SEM QUEBRAR):
 * - Detecção de timeout mais robusta (mensagens variam).
 * - Usa Errors.CODES.CONFLICT quando existir (fallback "CONFLICT").
 * - Só tenta releaseLock se waitLock teve sucesso (best-effort).
 */

var LOCK_TIMEOUT_MS = 30000;

function _locksConflictCode_() {
  try {
    if (typeof Errors !== "undefined" && Errors && Errors.CODES && Errors.CODES.CONFLICT) {
      return Errors.CODES.CONFLICT;
    }
  } catch (_) {}
  return "CONFLICT";
}

function _locksIsTimeoutMessage_(msg) {
  var m = String(msg || "").toLowerCase();

  // Variações comuns no Apps Script:
  // "Lock timeout", "Timed out waiting for lock", "Exception: LockService ... timed out", etc.
  if (m.indexOf("timed out") >= 0) return true;
  if (m.indexOf("timeout") >= 0 && m.indexOf("lock") >= 0) return true;
  if (m.indexOf("lockservice") >= 0 && m.indexOf("timeout") >= 0) return true;

  return false;
}

/**
 * Executa função protegida por lock.
 * IMPORTANTE:
 * - NÃO usar "throw { }" (padroniza com Error + code/details).
 * - O "key" é usado para diagnóstico e padronização do lockKey (mesmo que o LockService seja único).
 */
function Locks_withLock_(ctx, key, fn) {
  var lock = LockService.getScriptLock();
  var lockKey = "LOCK_" + String(key || "GLOBAL");
  var acquired = false;

  try {
    lock.waitLock(LOCK_TIMEOUT_MS);
    acquired = true;
    return fn();
  } catch (e) {
    // waitLock lança erro quando expira timeout.
    // Também pode cair aqui se fn() lançar (nesse caso, rethrow sem mascarar).
    var msg = String(e && e.message ? e.message : e);

    if (_locksIsTimeoutMessage_(msg)) {
      var err = new Error("Recurso em uso. Tente novamente.");
      err.code = _locksConflictCode_();
      err.details = {
        lockKey: lockKey,
        key: String(key || "GLOBAL"),
        requestId: (ctx && ctx.requestId) ? ctx.requestId : null,
        action: (ctx && ctx.action) ? ctx.action : null,
        cause: msg
      };
      throw err;
    }

    // Se não é timeout, é erro do handler/funcão protegida -> rethrow original
    throw e;
  } finally {
    // Só tenta release se waitLock teve sucesso (best-effort)
    if (acquired) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}
