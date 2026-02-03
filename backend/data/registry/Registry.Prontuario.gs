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

  // ===================== PACIENTE (RESUMO) ===================
  map["Prontuario.Paciente.ObterResumo"] = {
    action: "Prontuario.Paciente.ObterResumo",
    handler: _prontuarioHandler_("Prontuario.Paciente.ObterResumo"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // ===================== EVOLUÇÃO ===========================
  map["Prontuario.Evolucao.ListarPorPaciente"] = {
    action: "Prontuario.Evolucao.ListarPorPaciente",
    handler: _prontuarioHandler_("Prontuario.Evolucao.ListarPorPaciente"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Evolucao.ListarPorPacientePaged"] = {
    action: "Prontuario.Evolucao.ListarPorPacientePaged",
    handler: _prontuarioHandler_("Prontuario.Evolucao.ListarPorPacientePaged"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Evolucao.Salvar"] = {
    action: "Prontuario.Evolucao.Salvar",
    handler: _prontuarioHandler_("Prontuario.Evolucao.Salvar"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "PRONTUARIO"
  };

  // ===================== CHAT ===============================
  map["Prontuario.Chat.ListByPaciente"] = {
    action: "Prontuario.Chat.ListByPaciente",
    handler: _prontuarioHandler_("Prontuario.Chat.ListByPaciente"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Chat.SendByPaciente"] = {
    action: "Prontuario.Chat.SendByPaciente",
    handler: _prontuarioHandler_("Prontuario.Chat.SendByPaciente"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "PRONTUARIO"
  };

  // ===================== TIMELINE ===========================
  map["Prontuario.Timeline.ListarPorPaciente"] = {
    action: "Prontuario.Timeline.ListarPorPaciente",
    handler: _prontuarioHandler_("Prontuario.Timeline.ListarPorPaciente"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // ===================== DOCUMENTOS =========================
  map["Prontuario.Atestado.GerarPdf"] = {
    action: "Prontuario.Atestado.GerarPdf",
    handler: _prontuarioHandler_("Prontuario.Atestado.GerarPdf"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Comparecimento.GerarPdf"] = {
    action: "Prontuario.Comparecimento.GerarPdf",
    handler: _prontuarioHandler_("Prontuario.Comparecimento.GerarPdf"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Laudo.GerarPdf"] = {
    action: "Prontuario.Laudo.GerarPdf",
    handler: _prontuarioHandler_("Prontuario.Laudo.GerarPdf"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Encaminhamento.GerarPdf"] = {
    action: "Prontuario.Encaminhamento.GerarPdf",
    handler: _prontuarioHandler_("Prontuario.Encaminhamento.GerarPdf"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // ===================== BUSCAS / AUTOCOMPLETE ==============
  map["Prontuario.CID.Buscar"] = {
    action: "Prontuario.CID.Buscar",
    handler: _prontuarioHandler_("Prontuario.CID.Buscar"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Prontuario.Encaminhamento.Buscar"] = {
    action: "Prontuario.Encaminhamento.Buscar",
    handler: _prontuarioHandler_("Prontuario.Encaminhamento.Buscar"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };
}
