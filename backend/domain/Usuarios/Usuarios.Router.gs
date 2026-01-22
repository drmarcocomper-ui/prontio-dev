/**
 * Dispatcher de ações (chamado pelo Registry/Api).
 * Compatibilidade:
 * - Chamadas antigas passam apenas (action, payload)
 * - Chamadas novas passam (action, payload, ctx)
 */
function handleUsuariosAction_(action, payload, ctx) {
  switch (action) {
    case "Usuarios_Listar":
      _usuariosRequireAdminIfCtx_(ctx, action);
      return Usuarios_Listar_(payload);

    case "Usuarios_Criar":
      _usuariosRequireAdminIfCtx_(ctx, action);
      return Usuarios_Criar_(payload);

    case "Usuarios_Atualizar":
      _usuariosRequireAdminIfCtx_(ctx, action);
      return Usuarios_Atualizar_(payload);

    case "Usuarios_AlterarSenha":
      _usuariosRequireAdminIfCtx_(ctx, action);
      return Usuarios_AlterarSenha_(payload);

    case "Usuarios_ResetSenhaAdmin":
      _usuariosRequireAdminIfCtx_(ctx, action);
      return Usuarios_ResetSenhaAdmin_(payload, ctx);

    case "Usuarios_AlterarMinhaSenha":
      return Usuarios_AlterarMinhaSenha_(payload, ctx);

    case "Usuarios_EnsureSchema":
      _usuariosRequireAdminIfCtx_(ctx, action);
      return Usuarios_EnsureSchema_(payload);

    default:
      _usuariosThrow_("USUARIOS_UNKNOWN_ACTION", "Ação de usuários desconhecida: " + action, { action: action });
  }
}
