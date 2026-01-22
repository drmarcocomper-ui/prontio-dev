// ---------------------------------------------------------------------------
// Auditoria (best-effort) Pacientes
// ---------------------------------------------------------------------------

function _pacientesAudit_(ctx, action, eventType, outcome, details, target) {
  try {
    ctx = ctx || {};
    action = String(action || ctx.action || "").trim();
    eventType = String(eventType || "").trim() || "PACIENTES_EVENT";
    outcome = String(outcome || "").trim() || "INFO";

    var safeDetails = details || {};
    if (safeDetails && typeof safeDetails === "object") {
      delete safeDetails.token;
      delete safeDetails.authToken;
      delete safeDetails.Authorization;
      delete safeDetails.authorization;
      delete safeDetails.password;
      delete safeDetails.senha;
      delete safeDetails.senhaAtual;
      delete safeDetails.novaSenha;
    }

    if (typeof Audit_securityEvent_ === "function") {
      Audit_securityEvent_(ctx, action, eventType, outcome, safeDetails, target || {});
      return true;
    }

    if (typeof Audit_log_ === "function") {
      Audit_log_(ctx, {
        outcome: outcome,
        entity: "PACIENTE",
        entityId: (target && (target.id || target.entityId)) ? String(target.id || target.entityId) : null,
        extra: { eventType: eventType, details: safeDetails }
      });
      return true;
    }

    return false;
  } catch (_) {
    return false;
  }
}
