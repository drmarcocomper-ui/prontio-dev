function Registry_RegisterAgenda_(map) {
  map["Agenda.ListarPorPeriodo"] = {
    action: "Agenda.ListarPorPeriodo",
    handler: (typeof Agenda_Action_ListarPorPeriodo_ === "function")
      ? Agenda_Action_ListarPorPeriodo_
      : _Registry_missingHandler_("Agenda_Action_ListarPorPeriodo_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Agenda.Listar"] = {
    action: "Agenda.Listar",
    handler: _Registry_agendaListarHandler_(),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Agenda.Criar"] = {
    action: "Agenda.Criar",
    handler: (typeof Agenda_Action_Criar_ === "function")
      ? Agenda_Action_Criar_
      : _Registry_missingHandler_("Agenda_Action_Criar_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "AGENDA"
  };

  map["Agenda.Atualizar"] = {
    action: "Agenda.Atualizar",
    handler: (typeof Agenda_Action_Atualizar_ === "function")
      ? Agenda_Action_Atualizar_
      : _Registry_missingHandler_("Agenda_Action_Atualizar_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "AGENDA"
  };

  map["Agenda.Cancelar"] = {
    action: "Agenda.Cancelar",
    handler: (typeof Agenda_Action_Cancelar_ === "function")
      ? Agenda_Action_Cancelar_
      : _Registry_missingHandler_("Agenda_Action_Cancelar_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "AGENDA"
  };

  map["Agenda.BloquearHorario"] = {
    action: "Agenda.BloquearHorario",
    handler: _Registry_agendaBloquearHandler_(),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "AGENDA"
  };

  map["Agenda.DesbloquearHorario"] = {
    action: "Agenda.DesbloquearHorario",
    handler: _Registry_agendaDesbloquearHandler_(),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "AGENDA"
  };

  // Aliases legacy
  map["Agenda_Criar"] = {
    action: "Agenda_Criar",
    handler: map["Agenda.Criar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "AGENDA"
  };

  map["Agenda_Atualizar"] = {
    action: "Agenda_Atualizar",
    handler: map["Agenda.Atualizar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "AGENDA"
  };

  map["Agenda_ListarEventosDiaParaValidacao"] = {
    action: "Agenda_ListarEventosDiaParaValidacao",
    handler: (typeof Agenda_ListarEventosDiaParaValidacao_ === "function")
      ? function (ctx, payload) {
          payload = payload || {};
          var dataStr = payload.data ? String(payload.data) : "";
          return { items: Agenda_ListarEventosDiaParaValidacao_(dataStr) };
        }
      : _Registry_missingHandler_("Agenda_ListarEventosDiaParaValidacao_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // AgendaConfig (call-time)
  map["AgendaConfig_Obter"] = {
    action: "AgendaConfig_Obter",
    handler: function (ctx, payload) {
      if (typeof handleAgendaConfigAction !== "function") {
        return _Registry_missingHandler_("handleAgendaConfigAction")(ctx, payload);
      }
      return handleAgendaConfigAction("AgendaConfig_Obter", payload || {});
    },
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["AgendaConfig_Salvar"] = {
    action: "AgendaConfig_Salvar",
    handler: function (ctx, payload) {
      if (typeof handleAgendaConfigAction !== "function") {
        return _Registry_missingHandler_("handleAgendaConfigAction")(ctx, payload);
      }
      return handleAgendaConfigAction("AgendaConfig_Salvar", payload || {});
    },
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "AGENDA_CONFIG"
  };

  map["AgendaConfig.Obter"] = {
    action: "AgendaConfig.Obter",
    handler: map["AgendaConfig_Obter"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["AgendaConfig.Salvar"] = {
    action: "AgendaConfig.Salvar",
    handler: map["AgendaConfig_Salvar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "AGENDA_CONFIG"
  };

  // ValidarConflito (canônico + alias)
  map["Agenda_ValidarConflito"] = {
    action: "Agenda_ValidarConflito",
    handler: _Registry_agendaValidarConflitoHandler_(),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Agenda.ValidarConflito"] = {
    action: "Agenda.ValidarConflito",
    handler: map["Agenda_ValidarConflito"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // Legados / compat
  var agendaLegacyMap = [
    ["Agenda_ListarDia", "Agenda_Legacy_ListarDia_"],
    ["Agenda_ListarSemana", "Agenda_Legacy_ListarSemana_"],
    ["Agenda_MudarStatus", "Agenda_Legacy_MudarStatus_"],
    ["Agenda_RemoverBloqueio", "Agenda_Legacy_RemoverBloqueio_"],
    ["Agenda_BloquearHorario", "Agenda_Legacy_BloquearHorario_"],
    ["Agenda_ListarAFuturo", ""],
    ["Agenda.ListarAFuturo", ""]
  ];

  for (var i = 0; i < agendaLegacyMap.length; i++) {
    var legacyAction = agendaLegacyMap[i][0];
    var modernFn = agendaLegacyMap[i][1];

    map[legacyAction] = {
      action: legacyAction,
      handler: modernFn
        ? _Registry_tryModernElseLegacy_(modernFn, legacyAction)
        : _Registry_legacyHandler_(legacyAction),
      requiresAuth: true,
      roles: [],
      validations: [],
      requiresLock: true,
      lockKey: "AGENDA_LEGACY"
    };
  }
}
