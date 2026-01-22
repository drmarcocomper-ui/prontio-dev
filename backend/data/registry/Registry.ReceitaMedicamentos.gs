function Registry_RegisterReceitaMedicamentos_(map) {
  function _receitaHandler_(actionName) {
    return function (ctx, payload) {
      if (typeof handleReceitaAction !== "function") {
        var e = new Error("handleReceitaAction não disponível.");
        e.code = "INTERNAL_ERROR";
        e.details = { action: actionName };
        throw e;
      }
      return handleReceitaAction(actionName, payload || {});
    };
  }

  // RECEITA
  map["Receita.GerarPdf"] = {
    action: "Receita.GerarPdf",
    handler: _receitaHandler_("Receita.GerarPdf"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Receita.SalvarRascunho"] = {
    action: "Receita.SalvarRascunho",
    handler: _receitaHandler_("Receita.SalvarRascunho"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "RECEITA"
  };

  map["Receita.SalvarFinal"] = {
    action: "Receita.SalvarFinal",
    handler: _receitaHandler_("Receita.SalvarFinal"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "RECEITA"
  };

  map["Receita.ListarPorPaciente"] = {
    action: "Receita.ListarPorPaciente",
    handler: _receitaHandler_("Receita.ListarPorPaciente"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // aliases
  map["Receita.GerarPDF"] = {
    action: "Receita.GerarPDF",
    handler: map["Receita.GerarPdf"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Receita_ListarPorPaciente"] = {
    action: "Receita_ListarPorPaciente",
    handler: map["Receita.ListarPorPaciente"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Receita_SalvarRascunho"] = {
    action: "Receita_SalvarRascunho",
    handler: map["Receita.SalvarRascunho"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "RECEITA"
  };

  map["Receita_SalvarFinal"] = {
    action: "Receita_SalvarFinal",
    handler: map["Receita.SalvarFinal"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "RECEITA"
  };

  // MEDICAMENTOS
  function _medHandler_(actionName) {
    return function (ctx, payload) {
      if (typeof handleMedicamentosAction !== "function") {
        var e = new Error("handleMedicamentosAction não disponível.");
        e.code = "INTERNAL_ERROR";
        e.details = { action: actionName };
        throw e;
      }
      return handleMedicamentosAction(actionName, payload || {});
    };
  }

  map["Medicamentos.ListarAtivos"] = {
    action: "Medicamentos.ListarAtivos",
    handler: _medHandler_("Medicamentos.ListarAtivos"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Medicamentos_ListarAtivos"] = {
    action: "Medicamentos_ListarAtivos",
    handler: map["Medicamentos.ListarAtivos"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Remedios.ListarAtivos"] = {
    action: "Remedios.ListarAtivos",
    handler: map["Medicamentos.ListarAtivos"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Remedios_ListarAtivos"] = {
    action: "Remedios_ListarAtivos",
    handler: map["Medicamentos.ListarAtivos"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Medicamentos.ListarTodos"] = {
    action: "Medicamentos.ListarTodos",
    handler: _medHandler_("Medicamentos.ListarTodos"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Medicamentos_ListarTodos"] = {
    action: "Medicamentos_ListarTodos",
    handler: map["Medicamentos.ListarTodos"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Medicamentos.Listar"] = {
    action: "Medicamentos.Listar",
    handler: _medHandler_("Medicamentos.Listar"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Medicamentos_Listar"] = {
    action: "Medicamentos_Listar",
    handler: map["Medicamentos.Listar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };
}
