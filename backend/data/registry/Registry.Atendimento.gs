// backend/data/registry/Registry.Atendimento.gs
/**
 * Registry padrão para o módulo Atendimento.
 *
 * Actions:
 * - Atendimento.SyncHoje / Atendimento_SyncHoje
 * - Atendimento.SyncAPartirDeHoje / Atendimento_SyncAPartirDeHoje
 * - Atendimento.ListarFilaHoje / Atendimento_ListarFilaHoje
 * - Atendimento.ListarFilaAPartirDeHoje / Atendimento_ListarFilaAPartirDeHoje
 * - Atendimento.MarcarChegada / Atendimento_MarcarChegada
 * - Atendimento.ChamarProximo / Atendimento_ChamarProximo
 * - Atendimento.Iniciar / Atendimento_Iniciar
 * - Atendimento.Concluir / Atendimento_Concluir
 * - Atendimento.Cancelar / Atendimento_Cancelar
 * - Atendimento.MarcarFalta / Atendimento_MarcarFalta
 * - Atendimento.Remarcar / Atendimento_Remarcar
 */

function Registry_RegisterAtendimento_(map) {
  // ===================== ESCRITA (com lock) =====================

  map["Atendimento.SyncHoje"] = {
    action: "Atendimento.SyncHoje",
    handler: (typeof Atendimento_Action_SyncHoje_ === "function")
      ? Atendimento_Action_SyncHoje_
      : _Registry_missingHandler_("Atendimento_Action_SyncHoje_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.SyncAPartirDeHoje"] = {
    action: "Atendimento.SyncAPartirDeHoje",
    handler: (typeof Atendimento_Action_SyncAPartirDeHoje_ === "function")
      ? Atendimento_Action_SyncAPartirDeHoje_
      : _Registry_missingHandler_("Atendimento_Action_SyncAPartirDeHoje_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.MarcarChegada"] = {
    action: "Atendimento.MarcarChegada",
    handler: (typeof Atendimento_Action_MarcarChegada_ === "function")
      ? Atendimento_Action_MarcarChegada_
      : _Registry_missingHandler_("Atendimento_Action_MarcarChegada_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.ChamarProximo"] = {
    action: "Atendimento.ChamarProximo",
    handler: (typeof Atendimento_Action_ChamarProximo_ === "function")
      ? Atendimento_Action_ChamarProximo_
      : _Registry_missingHandler_("Atendimento_Action_ChamarProximo_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.Iniciar"] = {
    action: "Atendimento.Iniciar",
    handler: (typeof Atendimento_Action_Iniciar_ === "function")
      ? Atendimento_Action_Iniciar_
      : _Registry_missingHandler_("Atendimento_Action_Iniciar_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.Concluir"] = {
    action: "Atendimento.Concluir",
    handler: (typeof Atendimento_Action_Concluir_ === "function")
      ? Atendimento_Action_Concluir_
      : _Registry_missingHandler_("Atendimento_Action_Concluir_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.Cancelar"] = {
    action: "Atendimento.Cancelar",
    handler: (typeof Atendimento_Action_Cancelar_ === "function")
      ? Atendimento_Action_Cancelar_
      : _Registry_missingHandler_("Atendimento_Action_Cancelar_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.MarcarFalta"] = {
    action: "Atendimento.MarcarFalta",
    handler: (typeof Atendimento_Action_MarcarFalta_ === "function")
      ? Atendimento_Action_MarcarFalta_
      : _Registry_missingHandler_("Atendimento_Action_MarcarFalta_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.Remarcar"] = {
    action: "Atendimento.Remarcar",
    handler: (typeof Atendimento_Action_Remarcar_ === "function")
      ? Atendimento_Action_Remarcar_
      : _Registry_missingHandler_("Atendimento_Action_Remarcar_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  // ===================== LEITURA ================================

  map["Atendimento.ListarFilaHoje"] = {
    action: "Atendimento.ListarFilaHoje",
    handler: (typeof Atendimento_Action_ListarFilaHoje_ === "function")
      ? Atendimento_Action_ListarFilaHoje_
      : _Registry_missingHandler_("Atendimento_Action_ListarFilaHoje_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Atendimento.ListarFilaAPartirDeHoje"] = {
    action: "Atendimento.ListarFilaAPartirDeHoje",
    handler: (typeof Atendimento_Action_ListarFilaAPartirDeHoje_ === "function")
      ? Atendimento_Action_ListarFilaAPartirDeHoje_
      : _Registry_missingHandler_("Atendimento_Action_ListarFilaAPartirDeHoje_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // ===================== ALIASES UNDERSCORE =====================

  map["Atendimento_SyncHoje"] = {
    action: "Atendimento_SyncHoje",
    handler: map["Atendimento.SyncHoje"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento_SyncAPartirDeHoje"] = {
    action: "Atendimento_SyncAPartirDeHoje",
    handler: map["Atendimento.SyncAPartirDeHoje"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento_ListarFilaHoje"] = {
    action: "Atendimento_ListarFilaHoje",
    handler: map["Atendimento.ListarFilaHoje"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Atendimento_ListarFilaAPartirDeHoje"] = {
    action: "Atendimento_ListarFilaAPartirDeHoje",
    handler: map["Atendimento.ListarFilaAPartirDeHoje"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Atendimento_MarcarChegada"] = {
    action: "Atendimento_MarcarChegada",
    handler: map["Atendimento.MarcarChegada"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento_ChamarProximo"] = {
    action: "Atendimento_ChamarProximo",
    handler: map["Atendimento.ChamarProximo"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento_Iniciar"] = {
    action: "Atendimento_Iniciar",
    handler: map["Atendimento.Iniciar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento_Concluir"] = {
    action: "Atendimento_Concluir",
    handler: map["Atendimento.Concluir"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento_Cancelar"] = {
    action: "Atendimento_Cancelar",
    handler: map["Atendimento.Cancelar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento_MarcarFalta"] = {
    action: "Atendimento_MarcarFalta",
    handler: map["Atendimento.MarcarFalta"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento_Remarcar"] = {
    action: "Atendimento_Remarcar",
    handler: map["Atendimento.Remarcar"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };
}
