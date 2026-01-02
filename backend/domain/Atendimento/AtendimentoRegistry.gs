/**
 * ============================================================
 * PRONTIO - AtendimentoRegistry.gs
 * ============================================================
 * Registra actions Atendimento.* sem editar Registry.gs.
 *
 * ✅ Compatível com Registry lazy + cache (REGISTRY_ACTIONS):
 * - Patch em _Registry_build_ para injetar as actions no map na construção.
 * - Se REGISTRY_ACTIONS já existir (cache), injeta nelas também.
 * - Fallback: patch em Registry_getAction_ se _Registry_build_ não existir.
 */

(function () {
  var ACTIONS = {
    "Atendimento.ListarFilaHoje": {
      action: "Atendimento.ListarFilaHoje",
      handler: Atendimento_Action_ListarFilaHoje_,
      requiresAuth: true,
      roles: [],
      validations: [],
      requiresLock: false,
      lockKey: null
    },
    "Atendimento.MarcarChegada": {
      action: "Atendimento.MarcarChegada",
      handler: Atendimento_Action_MarcarChegada_,
      requiresAuth: true,
      roles: [],
      validations: [],
      requiresLock: true,
      lockKey: "ATENDIMENTO"
    },
    "Atendimento.ChamarProximo": {
      action: "Atendimento.ChamarProximo",
      handler: Atendimento_Action_ChamarProximo_,
      requiresAuth: true,
      roles: [],
      validations: [],
      requiresLock: true,
      lockKey: "ATENDIMENTO"
    },
    "Atendimento.Iniciar": {
      action: "Atendimento.Iniciar",
      handler: Atendimento_Action_Iniciar_,
      requiresAuth: true,
      roles: [],
      validations: [],
      requiresLock: true,
      lockKey: "ATENDIMENTO"
    },
    "Atendimento.Concluir": {
      action: "Atendimento.Concluir",
      handler: Atendimento_Action_Concluir_,
      requiresAuth: true,
      roles: [],
      validations: [],
      requiresLock: true,
      lockKey: "ATENDIMENTO"
    },
    "Atendimento.Cancelar": {
      action: "Atendimento.Cancelar",
      handler: Atendimento_Action_Cancelar_,
      requiresAuth: true,
      roles: [],
      validations: [],
      requiresLock: true,
      lockKey: "ATENDIMENTO"
    }
  };

  function injectIntoMap_(map) {
    map = map || {};
    for (var k in ACTIONS) {
      if (!ACTIONS.hasOwnProperty(k)) continue;
      map[k] = ACTIONS[k];
    }
    return map;
  }

  // 1) Patch na construção lazy do registry
  if (typeof _Registry_build_ === "function" && !_Registry_build_._atdPatched) {
    var _origBuild = _Registry_build_;
    _Registry_build_ = function () {
      var map = _origBuild();
      return injectIntoMap_(map);
    };
    _Registry_build_._atdPatched = true;
  }

  // 2) Se o cache já existe, injeta também
  try {
    if (typeof REGISTRY_ACTIONS !== "undefined" && REGISTRY_ACTIONS) {
      injectIntoMap_(REGISTRY_ACTIONS);
    }
  } catch (_) {}

  // 3) Fallback: patch direto no getter (se build não existir)
  if (typeof Registry_getAction_ === "function" && !Registry_getAction_._atdPatched) {
    var _origGet = Registry_getAction_;
    Registry_getAction_ = function (action) {
      var key = String(action || "").trim();
      if (ACTIONS[key]) return ACTIONS[key];
      return _origGet(action);
    };
    Registry_getAction_._atdPatched = true;
  }
})();
