/**
 * Registry.Agenda.gs
 * Locks dinâmicos por profissional + data:
 *   agenda:{idProfissional}:{YYYY-MM-DD}
 *
 * Observação: para Atualizar/Cancelar, se payload não trouxer idProfissional/data,
 * buscamos o registro existente (por idAgenda) para calcular a chave do lock.
 */

/** @returns {string} YYYY-MM-DD */
function _Registry_agendaFormatYMD_(d) {
  try {
    // Usa utilitário se existir
    if (typeof _agendaFormatYYYYMMDD_ === "function") return _agendaFormatYYYYMMDD_(d);
  } catch (_) {}

  // Fallback: ISO (UTC) -> pega só data
  var iso = d.toISOString();
  return String(iso).slice(0, 10);
}

/**
 * Tenta obter { idProfissional, ymd } do payload.
 * Aceita variações comuns (compat):
 * - idProfissional / id_profissional
 * - data / inicio (ISO) / inicioEm
 */
function _Registry_agendaExtractProfAndDateFromPayload_(payload) {
  payload = payload || {};

  var idProf =
    payload.idProfissional ? String(payload.idProfissional) :
    (payload.id_profissional ? String(payload.id_profissional) : "");

  var ymd = "";

  // data explícita no payload (preferível)
  if (payload.data) {
    var ds = String(payload.data).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) ymd = ds;
  }

  // início ISO
  if (!ymd && payload.inicio) {
    var dt = null;
    try { dt = new Date(String(payload.inicio)); } catch (_) {}
    if (dt && !isNaN(dt.getTime())) ymd = _Registry_agendaFormatYMD_(dt);
  }

  // variações
  if (!ymd && payload.inicioEm) {
    var dt2 = null;
    try { dt2 = new Date(String(payload.inicioEm)); } catch (_) {}
    if (dt2 && !isNaN(dt2.getTime())) ymd = _Registry_agendaFormatYMD_(dt2);
  }

  return { idProfissional: idProf, ymd: ymd };
}

/**
 * Busca o evento existente para derivar idProfissional + data (por idAgenda).
 * Retorna { idProfissional, ymd } ou { "", "" } se não conseguir.
 */
function _Registry_agendaExtractFromExistingByIdAgenda_(idAgenda) {
  try {
    if (!idAgenda) return { idProfissional: "", ymd: "" };
    if (typeof Repo_getById_ !== "function") return { idProfissional: "", ymd: "" };

    var row = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, String(idAgenda));
    if (!row) return { idProfissional: "", ymd: "" };

    // Normaliza se o helper existir
    var dto = row;
    try {
      if (typeof _agendaNormalizeRowToDto_ === "function") dto = _agendaNormalizeRowToDto_(row);
    } catch (_) {}

    var idProf = dto && dto.idProfissional ? String(dto.idProfissional) : "";
    var ymd = "";

    if (dto && dto.inicio) {
      var dt = null;
      try { dt = new Date(String(dto.inicio)); } catch (_) {}
      if (dt && !isNaN(dt.getTime())) ymd = _Registry_agendaFormatYMD_(dt);
    }

    return { idProfissional: idProf, ymd: ymd };
  } catch (_) {
    return { idProfissional: "", ymd: "" };
  }
}

/**
 * Calcula lockKey canônica para Agenda.
 * - Tenta payload
 * - Se necessário, tenta buscar registro existente (Atualizar/Cancelar)
 * - Fallback final: "AGENDA" (não ideal, mas não quebra)
 */
function _Registry_agendaLockKey_(ctx, payload) {
  payload = payload || {};

  var ex = _Registry_agendaExtractProfAndDateFromPayload_(payload);
  var idProf = ex.idProfissional;
  var ymd = ex.ymd;

  // Se não veio no payload, tenta por idAgenda (fluxos de update/cancel)
  if ((!idProf || !ymd) && payload.idAgenda) {
    var ex2 = _Registry_agendaExtractFromExistingByIdAgenda_(payload.idAgenda);
    if (!idProf) idProf = ex2.idProfissional;
    if (!ymd) ymd = ex2.ymd;
  }

  // Ainda não tem? fallback
  if (!idProf || !ymd) return "AGENDA";

  return "agenda:" + idProf + ":" + ymd;
}

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
    lockKey: _Registry_agendaLockKey_
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
    lockKey: _Registry_agendaLockKey_
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
    lockKey: _Registry_agendaLockKey_
  };

  map["Agenda.BloquearHorario"] = {
    action: "Agenda.BloquearHorario",
    handler: _Registry_agendaBloquearHandler_(),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: _Registry_agendaLockKey_
  };

  map["Agenda.DesbloquearHorario"] = {
    action: "Agenda.DesbloquearHorario",
    handler: _Registry_agendaDesbloquearHandler_(),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: _Registry_agendaLockKey_
  };

  // Aliases legacy (mantém lock dinâmico também)
  map["Agenda_Criar"] = {
    action: "Agenda_Criar",
    handler: map["Agenda.Criar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: _Registry_agendaLockKey_
  };

  map["Agenda_Atualizar"] = {
    action: "Agenda_Atualizar",
    handler: map["Agenda.Atualizar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: _Registry_agendaLockKey_
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
      // mantém lock legado separado (não mexi aqui para não alterar sem necessidade)
      lockKey: "AGENDA_LEGACY"
    };
  }
}
