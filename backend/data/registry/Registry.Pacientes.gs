function Registry_RegisterPacientes_(map) {
  function _pacientesHandler_(actionName) {
    return function (ctx, payload) {
      if (typeof handlePacientesAction !== "function") {
        var e = new Error("handlePacientesAction não disponível.");
        e.code = "INTERNAL_ERROR";
        e.details = { action: actionName };
        throw e;
      }
      return handlePacientesAction(actionName, payload || {}, ctx);
    };
  }

  map["Pacientes_DebugInfo"] = {
    action: "Pacientes_DebugInfo",
    handler: _pacientesHandler_("Pacientes_DebugInfo"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Pacientes_Criar"] = {
    action: "Pacientes_Criar",
    handler: _pacientesHandler_("Pacientes_Criar"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "PACIENTES"
  };

  map["Pacientes_Listar"] = {
    action: "Pacientes_Listar",
    handler: _pacientesHandler_("Pacientes_Listar"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Pacientes_BuscarSimples"] = {
    action: "Pacientes_BuscarSimples",
    handler: _pacientesHandler_("Pacientes_BuscarSimples"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Pacientes_AlterarStatusAtivo"] = {
    action: "Pacientes_AlterarStatusAtivo",
    handler: _pacientesHandler_("Pacientes_AlterarStatus"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "PACIENTES"
  };

  // ✅ Actions adicionadas (faltavam no Registry)
  map["Pacientes_Atualizar"] = {
    action: "Pacientes_Atualizar",
    handler: _pacientesHandler_("Pacientes_Atualizar"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "PACIENTES"
  };

  map["Pacientes_ObterPorId"] = {
    action: "Pacientes_ObterPorId",
    handler: _pacientesHandler_("Pacientes_ObterPorId"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Pacientes_ListarSelecao"] = {
    action: "Pacientes_ListarSelecao",
    handler: _pacientesHandler_("Pacientes_ListarSelecao"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // aliases canônicos
  map["Pacientes.Listar"] = {
    action: "Pacientes.Listar",
    handler: map["Pacientes_Listar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Pacientes.BuscarSimples"] = {
    action: "Pacientes.BuscarSimples",
    handler: map["Pacientes_BuscarSimples"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Pacientes.AlterarStatusAtivo"] = {
    action: "Pacientes.AlterarStatusAtivo",
    handler: map["Pacientes_AlterarStatusAtivo"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "PACIENTES"
  };

  map["Pacientes.Criar"] = {
    action: "Pacientes.Criar",
    handler: map["Pacientes_Criar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "PACIENTES"
  };

  // ✅ Aliases canônicos adicionados
  map["Pacientes.Atualizar"] = {
    action: "Pacientes.Atualizar",
    handler: map["Pacientes_Atualizar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "PACIENTES"
  };

  map["Pacientes.ObterPorId"] = {
    action: "Pacientes.ObterPorId",
    handler: map["Pacientes_ObterPorId"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Pacientes.ListarSelecao"] = {
    action: "Pacientes.ListarSelecao",
    handler: map["Pacientes_ListarSelecao"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };
}
