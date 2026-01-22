/**
 * ✅ Altera/reset senha de um usuário (admin).
 * payload: { id, senha }
 *
 * Agora via Repository (sem SpreadsheetApp).
 */
function Usuarios_AlterarSenha_(payload) {
  payload = payload || {};

  var id = String(payload.id || "").trim();
  var senha = String(payload.senha || "");

  if (!id) _usuariosThrow_("USUARIOS_ID_OBRIGATORIO", "ID é obrigatório.", null);
  if (!senha) _usuariosThrow_("USUARIOS_SENHA_OBRIGATORIA", "Senha é obrigatória.", null);

  // garante schema (best-effort)
  try { Usuarios_EnsureSchema_({}); } catch (_) {}

  // valida existência
  var existing = Usuarios_Repo_GetById_(id);
  if (!existing) _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id });

  var patch = {
    SenhaHash: hashSenha_(senha),
    AtualizadoEm: new Date().toISOString()
  };

  var ok = Usuarios_Repo_UpdateById_(id, patch);
  if (!ok) _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id });

  return { ok: true, id: id };
}

/**
 * ============================================================
 * Pilar C — Reset de senha ADMIN (PROD)
 * ============================================================
 *
 * payload:
 * { id?, identifier?/login?/email?, senha, ativar? }
 */
function Usuarios_ResetSenhaAdmin_(payload, ctx) {
  payload = payload || {};
  ctx = ctx || {};

  try { Usuarios_EnsureSchema_({}); } catch (_) {}

  var id = String(payload.id || "").trim();
  var identifier = String(payload.identifier || payload.login || payload.email || "").trim();
  var senha = String(payload.senha || "");

  var ativar;
  if (typeof payload.ativar === "boolean") ativar = payload.ativar;
  else if (payload.ativar !== undefined) ativar = boolFromCell_(payload.ativar);
  else ativar = null;

  if (!senha) _usuariosThrow_("USUARIOS_SENHA_OBRIGATORIA", "Senha é obrigatória.", null);
  if (!id && !identifier) _usuariosThrow_("USUARIOS_ID_OU_IDENTIFICADOR_OBRIGATORIO", "Informe id ou identifier (login/email).", null);

  var row = null;

  if (id) {
    row = Usuarios_Repo_GetById_(id);
  } else {
    var q = identifier.toLowerCase();
    row = Usuarios_Repo_FindByIdentifier_(q);
  }

  if (!row) {
    _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: id || null, identifier: identifier || null });
  }

  var targetId = String(_usrPick_(row, ["ID_Usuario", "idUsuario", "id_usuario", "id"]) || "").trim();
  var targetLogin = String(_usrPick_(row, ["Login", "login", "emailLogin"]) || "").trim();
  var targetEmail = String(_usrPick_(row, ["Email", "E-mail", "email"]) || "").trim();

  if (!targetId) {
    _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Registro inválido: ID_Usuario ausente.', { identifier: identifier || null });
  }

  // monta patch
  var patch = {
    SenhaHash: hashSenha_(senha),
    AtualizadoEm: new Date().toISOString()
  };

  if (ativar === true) patch.Ativo = true;

  var ok = Usuarios_Repo_UpdateById_(targetId, patch);
  if (!ok) {
    _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: targetId });
  }

  // Auditoria best-effort (sem senha)
  try {
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

  // retorna estado final (best-effort)
  var after = Usuarios_Repo_GetById_(targetId) || row;

  return {
    ok: true,
    id: String(_usrPick_(after, ["ID_Usuario", "idUsuario", "id_usuario", "id"]) || "").trim(),
    login: String(_usrPick_(after, ["Login", "login", "emailLogin"]) || "").trim(),
    email: String(_usrPick_(after, ["Email", "E-mail", "email"]) || "").trim(),
    ativo: boolFromCell_(_usrPick_(after, ["Ativo", "ativo", "Ativa"]))
  };
}

/**
 * ============================================================
 * Pilar E — Alterar senha do PRÓPRIO usuário
 * ============================================================
 *
 * payload: { senhaAtual, novaSenha }
 * ctx.user obrigatório: { id, login? }
 */
function Usuarios_AlterarMinhaSenha_(payload, ctx) {
  payload = payload || {};
  ctx = ctx || {};

  try { Usuarios_EnsureSchema_({}); } catch (_) {}

  if (!ctx.user || !ctx.user.id) {
    _usuariosThrow_("AUTH_REQUIRED", "Usuário não autenticado.", null);
  }

  var userId = String(ctx.user.id || "").trim();
  if (!userId) _usuariosThrow_("AUTH_REQUIRED", "Usuário não autenticado.", null);

  var senhaAtual = String(payload.senhaAtual || "");
  var novaSenha = String(payload.novaSenha || "");

  if (!senhaAtual) _usuariosThrow_("USUARIOS_SENHA_ATUAL_OBRIGATORIA", "Senha atual é obrigatória.", null);
  if (!novaSenha) _usuariosThrow_("USUARIOS_NOVA_SENHA_OBRIGATORIA", "Nova senha é obrigatória.", null);
  if (novaSenha.length < 6) _usuariosThrow_("USUARIOS_SENHA_FRACA", "Nova senha deve ter pelo menos 6 caracteres.", null);

  var row = Usuarios_Repo_GetById_(userId);
  if (!row) _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: userId });

  var senhaHashAtual = String(_usrPick_(row, ["SenhaHash", "senhaHash", "PasswordHash", "passwordHash"]) || "").trim();
  if (!senhaHashAtual) _usuariosThrow_("USUARIOS_BAD_SCHEMA", 'Coluna "SenhaHash" não encontrada.', { id: userId });

  if (!Usuarios_verifyPassword_(senhaAtual, senhaHashAtual)) {
    try {
      if (typeof Audit_securityEvent_ === "function") {
        Audit_securityEvent_(
          ctx,
          "Usuarios_AlterarMinhaSenha",
          "PASSWORD_CHANGE",
          "DENY",
          { reason: "CURRENT_PASSWORD_INVALID" },
          { id: userId, login: ctx.user.login || "" }
        );
      }
    } catch (_) {}

    _usuariosThrow_("USUARIOS_SENHA_ATUAL_INVALIDA", "Senha atual inválida.", null);
  }

  var novaHash = hashSenha_(novaSenha);
  var patch = {
    SenhaHash: novaHash,
    AtualizadoEm: new Date().toISOString()
  };

  var ok = Usuarios_Repo_UpdateById_(userId, patch);
  if (!ok) _usuariosThrow_("USUARIOS_NAO_ENCONTRADO", "Usuário não encontrado.", { id: userId });

  try {
    if (typeof Audit_securityEvent_ === "function") {
      Audit_securityEvent_(
        ctx,
        "Usuarios_AlterarMinhaSenha",
        "PASSWORD_CHANGE",
        "SUCCESS",
        {},
        { id: userId, login: ctx.user.login || "" }
      );
    }
  } catch (_) {}

  return { ok: true, id: userId };
}
