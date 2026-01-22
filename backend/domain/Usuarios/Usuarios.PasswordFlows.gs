/**
 * ✅ Altera/reset senha de um usuário (admin).
 * payload: { id, senha }
 */
function Usuarios_AlterarSenha_(payload) {
  payload = payload || {};

  var id = String(payload.id || "").trim();
  var senha = String(payload.senha || "");

  if (!id) _usuariosThrow_("USUARIOS_ID_OBRIGATORIO", "ID é obrigatório.", null);
  if (!senha) _usuariosThrow_("USUARIOS_SENHA_OBRIGATORIA", "Senha é obrigatória.", null);

  var found = Usuarios_findRowById_(id);
  if (!found) _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id });

  var idx = found.idx;

  if (idx.senhaHash < 0) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Cabeçalho deve conter "SenhaHash" (ou aliases).', { header: found.header, idx: idx });
  }

  var senhaHash = hashSenha_(senha);
  found.sheet.getRange(found.rowIndex, idx.senhaHash + 1).setValue(senhaHash);

  if (idx.atualizadoEm >= 0) {
    found.sheet.getRange(found.rowIndex, idx.atualizadoEm + 1).setValue(new Date());
  }

  return { ok: true, id: id };
}

/**
 * ============================================================
 * Pilar C — Reset de senha ADMIN (PROD)
 * ============================================================
 */
function Usuarios_ResetSenhaAdmin_(payload, ctx) {
  payload = payload || {};
  ctx = ctx || {};

  var id = String(payload.id || "").trim();
  var identifier = String(payload.identifier || payload.login || payload.email || "").trim();
  var senha = String(payload.senha || "");

  var ativar;
  if (typeof payload.ativar === "boolean") ativar = payload.ativar;
  else if (payload.ativar !== undefined) ativar = boolFromCell_(payload.ativar);
  else ativar = null;

  if (!senha) _usuariosThrow_("USUARIOS_SENHA_OBRIGATORIA", "Senha é obrigatória.", null);
  if (!id && !identifier) _usuariosThrow_("USUARIOS_ID_OU_IDENTIFICADOR_OBRIGATORIO", "Informe id ou identifier (login/email).", null);

  var found = id ? Usuarios_findRowById_(id) : Usuarios_findRowByIdentifier_(identifier);
  if (!found) {
    _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id || null, identifier: identifier || null });
  }

  var idx = found.idx;

  if (idx.senhaHash < 0) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Cabeçalho deve conter "SenhaHash" (ou aliases).', { header: found.header, idx: idx });
  }

  var senhaHash = hashSenha_(senha);
  found.sheet.getRange(found.rowIndex, idx.senhaHash + 1).setValue(senhaHash);

  if (ativar === true && idx.ativo >= 0) {
    found.sheet.getRange(found.rowIndex, idx.ativo + 1).setValue(true);
  }

  if (idx.atualizadoEm >= 0) {
    found.sheet.getRange(found.rowIndex, idx.atualizadoEm + 1).setValue(new Date());
  }

  // Auditoria best-effort (sem senha)
  try {
    var targetId = idx.id >= 0 ? String(_uGet_(found.row, idx.id) || "") : "";
    var targetLogin = idx.login >= 0 ? String(_uGet_(found.row, idx.login) || "") : "";
    if (typeof Audit_securityEvent_ === "function") {
      Audit_securityEvent_(
        ctx,
        "Usuarios_ResetSenhaAdmin",
        "ADMIN_PASSWORD_RESET",
        "SUCCESS",
        { ativar: ativar === true },
        { id: targetId, login: targetLogin }
      );
    }
  } catch (_) {}

  var rowNow = found.sheet.getRange(found.rowIndex, 1, 1, found.sheet.getLastColumn()).getValues()[0];

  return {
    ok: true,
    id: idx.id >= 0 ? String(_uGet_(rowNow, idx.id) || "") : "",
    login: idx.login >= 0 ? String(_uGet_(rowNow, idx.login) || "") : "",
    email: idx.email >= 0 ? String(_uGet_(rowNow, idx.email) || "") : "",
    ativo: idx.ativo >= 0 ? boolFromCell_(_uGet_(rowNow, idx.ativo)) : null
  };
}

/**
 * ============================================================
 * Pilar E — Alterar senha do PRÓPRIO usuário
 * ============================================================
 */
function Usuarios_AlterarMinhaSenha_(payload, ctx) {
  payload = payload || {};
  ctx = ctx || {};

  if (!ctx.user || !ctx.user.id) {
    _usuariosThrow_("AUTH_REQUIRED", "Usuário não autenticado.", null);
  }

  var senhaAtual = String(payload.senhaAtual || "");
  var novaSenha = String(payload.novaSenha || "");

  if (!senhaAtual) {
    _usuariosThrow_("USUARIOS_SENHA_ATUAL_OBRIGATORIA", "Senha atual é obrigatória.", null);
  }
  if (!novaSenha) {
    _usuariosThrow_("USUARIOS_NOVA_SENHA_OBRIGATORIA", "Nova senha é obrigatória.", null);
  }
  if (novaSenha.length < 6) {
    _usuariosThrow_("USUARIOS_SENHA_FRACA", "Nova senha deve ter pelo menos 6 caracteres.", null);
  }

  var found = Usuarios_findRowById_(ctx.user.id);
  if (!found) {
    _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: ctx.user.id });
  }

  var idx = found.idx;

  if (idx.senhaHash < 0) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Coluna "SenhaHash" não encontrada.', { header: found.header });
  }

  var senhaHashAtual = String(_uGet_(found.row, idx.senhaHash) || "");
  if (!Usuarios_verifyPassword_(senhaAtual, senhaHashAtual)) {
    try {
      if (typeof Audit_securityEvent_ === "function") {
        Audit_securityEvent_(
          ctx,
          "Usuarios_AlterarMinhaSenha",
          "PASSWORD_CHANGE",
          "DENY",
          { reason: "CURRENT_PASSWORD_INVALID" },
          { id: ctx.user.id, login: ctx.user.login || "" }
        );
      }
    } catch (_) {}

    _usuariosThrow_("USUARIOS_SENHA_ATUAL_INVALIDA", "Senha atual inválida.", null);
  }

  var novaHash = hashSenha_(novaSenha);
  found.sheet.getRange(found.rowIndex, idx.senhaHash + 1).setValue(novaHash);

  if (idx.atualizadoEm >= 0) {
    found.sheet.getRange(found.rowIndex, idx.atualizadoEm + 1).setValue(new Date());
  }

  try {
    if (typeof Audit_securityEvent_ === "function") {
      Audit_securityEvent_(
        ctx,
        "Usuarios_AlterarMinhaSenha",
        "PASSWORD_CHANGE",
        "SUCCESS",
        {},
        { id: ctx.user.id, login: ctx.user.login || "" }
      );
    }
  } catch (_) {}

  return {
    ok: true,
    id: ctx.user.id
  };
}
