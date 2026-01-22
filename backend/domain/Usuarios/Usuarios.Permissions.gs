// ======================
// Helpers de permissão (sem quebrar legado)
// ======================

function _usuariosIsAdminCtx_(ctx) {
  try {
    if (!ctx || !ctx.user) return null; // null = sem ctx (legado)
    var perfil = String(ctx.user.perfil || ctx.user.role || "").trim().toLowerCase();
    return perfil === "admin";
  } catch (_) {
    return false;
  }
}

function _usuariosRequireAdminIfCtx_(ctx, actionName) {
  var isAdmin = _usuariosIsAdminCtx_(ctx);
  // Se não veio ctx, não bloqueia (legado).
  if (isAdmin === null) return;

  if (isAdmin !== true) {
    var err = new Error("Sem permissão para esta ação.");
    err.code = (Errors && Errors.CODES && Errors.CODES.PERMISSION_DENIED)
      ? Errors.CODES.PERMISSION_DENIED
      : "PERMISSION_DENIED";
    err.details = { action: String(actionName || ""), requiredRole: "admin" };
    throw err;
  }
}

function _usuariosThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || (Errors && Errors.CODES ? Errors.CODES.INTERNAL_ERROR : "INTERNAL_ERROR"));
  err.details = (details === undefined ? null : details);
  throw err;
}
