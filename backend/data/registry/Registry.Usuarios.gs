function Registry_RegisterUsuarios_(map) {
  function _usuariosHandler_(actionName) {
    return function (ctx, payload) { return handleUsuariosAction(actionName, payload, ctx); };
  }

  map["Usuarios_Listar"] = {
    action: "Usuarios_Listar",
    handler: _usuariosHandler_("Usuarios_Listar"),
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Usuarios_Criar"] = {
    action: "Usuarios_Criar",
    handler: _usuariosHandler_("Usuarios_Criar"),
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_Criar"
  };

  map["Usuarios_Atualizar"] = {
    action: "Usuarios_Atualizar",
    handler: _usuariosHandler_("Usuarios_Atualizar"),
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_Atualizar"
  };

  map["Usuarios_AlterarSenha"] = {
    action: "Usuarios_AlterarSenha",
    handler: _usuariosHandler_("Usuarios_AlterarSenha"),
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_AlterarSenha"
  };

  map["Usuarios_ResetSenhaAdmin"] = {
    action: "Usuarios_ResetSenhaAdmin",
    handler: _usuariosHandler_("Usuarios_ResetSenhaAdmin"),
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_ResetSenhaAdmin"
  };

  map["Usuarios_AlterarMinhaSenha"] = {
    action: "Usuarios_AlterarMinhaSenha",
    handler: _usuariosHandler_("Usuarios_AlterarMinhaSenha"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_AlterarMinhaSenha"
  };

  map["Usuarios_EnsureSchema"] = {
    action: "Usuarios_EnsureSchema",
    handler: _usuariosHandler_("Usuarios_EnsureSchema"),
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_EnsureSchema"
  };
}
