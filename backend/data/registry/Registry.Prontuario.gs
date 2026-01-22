function Registry_RegisterProntuario_(map) {
  function _prontuarioHandler_(actionName) {
    return function (ctx, payload) {
      if (typeof handleProntuarioAction !== "function") {
        var e = new Error("handleProntuarioAction não disponível.");
        e.code = "INTERNAL_ERROR";
        e.details = { action: actionName };
        throw e;
      }
      return handleProntuarioAction(actionName, payload || {});
    };
  }

  map["Prontuario.Ping"] = {
    action: "Prontuario.Ping",
    handler: _prontuarioHandler_("Prontuario.Ping"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Receita.ListarPorPaciente"] = {
    action: "Prontuario.Receita.ListarPorPaciente",
    handler: _prontuarioHandler_("Prontuario.Receita.ListarPorPaciente"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Receita.ListarPorPacientePaged"] = {
    action: "Prontuario.Receita.ListarPorPacientePaged",
    handler: _prontuarioHandler_("Prontuario.Receita.ListarPorPacientePaged"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Receita.GerarPdf"] = {
    action: "Prontuario.Receita.GerarPdf",
    handler: _prontuarioHandler_("Prontuario.Receita.GerarPdf"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Receita.GerarPDF"] = {
    action: "Prontuario.Receita.GerarPDF",
    handler: map["Prontuario.Receita.GerarPdf"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };
}
