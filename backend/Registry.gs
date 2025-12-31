// backend/Registry.gs
/**
 * ============================================================
 * PRONTIO - Registry.gs
 * ============================================================
 * Registry central de actions para Api.gs (doPost e doGet/JSONP).
 *
 * Inclui:
 * - Auth / Recovery / Usuarios / Clinica / Profissionais / Meta
 * - Atendimento
 * - Agenda (novo + aliases + legados)
 * - AgendaConfig (oficial)
 * - Agenda_ValidarConflito (oficial)
 * - Pacientes (oficial + aliases) + Pacientes_DebugInfo ✅
 * - Receita (oficial + aliases)
 * - Medicamentos (oficial + aliases)
 * - Prontuário (fachada)
 * - Chat (chat.*) ✅
 * - Compat do Chat (usuarios.listAll / agenda.*Patient) ✅
 *
 * ✅ UPDATE (sem quebrar):
 * - Adiciona "Agenda_ListarEventosDiaParaValidacao" (pedido do modal/front)
 *   apontando para o adapter do Agenda.gs (Agenda_ListarEventosDiaParaValidacao_).
 *
 * ✅ UPDATE (AUDITORIA - sem quebrar):
 * - _pacientesHandler_ agora repassa ctx para handlePacientesAction(actionName, payload, ctx)
 *   (habilita auditoria completa no Pacientes.gs quando a chamada vem pelo Registry).
 *
 * ✅ FIX (SEM QUEBRAR):
 * - AgendaConfig_Obter / AgendaConfig_Salvar / Agenda_ValidarConflito agora verificam os handlers
 *   em call-time (na execução), evitando “congelar” _Registry_missingHandler_ caso a ordem de carregamento varie.
 *
 * ✅ MELHORIA (SEM QUEBRAR - USUÁRIOS):
 * - Passa ctx também para as ações administrativas de usuários (Listar/Criar/Atualizar/AlterarSenha),
 *   mantendo compat e habilitando auditoria/permissões consistentes no Usuarios.gs.
 * - Registra Usuarios_EnsureSchema (admin) para utilitário de manutenção (não afeta outros módulos).
 *
 * ✅ PASSO 1 (AGENDA) - FECHAMENTO DE CONTRATO:
 * - "Agenda_ValidarConflito" deve usar a MESMA regra do novo módulo Agenda.gs
 *   (VALIDAR == SALVAR), evitando caminhos paralelos.
 *
 * ✅ UPDATE (sem quebrar):
 * - Alias: "Agenda.ValidarConflito" -> mesmo handler canônico
 */

var REGISTRY_ACTIONS = null;

function Registry_getAction_(action) {
  action = String(action || "").trim();
  if (!action) return null;

  if (!REGISTRY_ACTIONS) {
    REGISTRY_ACTIONS = _Registry_build_();
  }

  return REGISTRY_ACTIONS[action] || null;
}

function _Registry_missingHandler_(fnName) {
  return function (ctx, payload) {
    var err = new Error("Handler não disponível no deploy: " + String(fnName));
    err.code = "INTERNAL_ERROR";
    err.details = { missingHandler: String(fnName) };
    throw err;
  };
}

/**
 * Fallback LEGADO via routeAction_ (para actions antigas não migradas).
 * Útil para instalações antigas.
 */
function _Registry_legacyHandler_(legacyActionName) {
  var actionName = String(legacyActionName || "").trim();
  return function (ctx, payload) {
    if (typeof routeAction_ === "function") {
      return routeAction_(actionName, payload || {});
    }
    var err = new Error("Action legada não disponível (routeAction_ ausente).");
    err.code = "NOT_FOUND";
    err.details = { action: actionName };
    throw err;
  };
}

/**
 * ✅ NOVO (maturação, sem quebrar):
 * Cria handler que tenta chamar um handler "moderno" (ex.: Agenda_Legacy_ListarDia_)
 * e, se não existir, cai no legado via routeAction_ (instalações antigas).
 */
function _Registry_tryModernElseLegacy_(modernFnName, legacyActionName) {
  var fnName = String(modernFnName || "").trim();
  var legacy = String(legacyActionName || "").trim();

  return function (ctx, payload) {
    try {
      var fn = (typeof globalThis !== "undefined" ? globalThis[fnName] : this[fnName]);
      if (typeof fn === "function") {
        return fn(ctx, payload || {});
      }
    } catch (_) {}

    // fallback
    return _Registry_legacyHandler_(legacy)(ctx, payload || {});
  };
}

/**
 * ✅ PASSO 1 (Agenda) - handler canônico para validação de conflito
 * Prioridade:
 * 1) handleAgendaAction("Agenda_ValidarConflito", payload)  -> fonte da verdade (novo)
 * 2) Agenda_Legacy_ValidarConflito_(ctx,payload)            -> legado adaptado (novo módulo, compat)
 * 3) Agenda_Action_ValidarConflito(payload)                -> legado antigo (instalações antigas)
 */
function _Registry_agendaValidarConflitoHandler_() {
  return function (ctx, payload) {
    payload = payload || {};

    // 1) Fonte da verdade: Agenda.gs via handleAgendaAction
    if (typeof handleAgendaAction === "function") {
      return handleAgendaAction("Agenda_ValidarConflito", payload);
    }

    // 2) Se existir adaptador legado do novo módulo
    if (typeof Agenda_Legacy_ValidarConflito_ === "function") {
      return Agenda_Legacy_ValidarConflito_(ctx, payload);
    }

    // 3) Instalações antigas (helper solto)
    if (typeof Agenda_Action_ValidarConflito === "function") {
      return Agenda_Action_ValidarConflito(payload);
    }

    return _Registry_missingHandler_("handleAgendaAction / Agenda_Legacy_ValidarConflito_ / Agenda_Action_ValidarConflito")(ctx, payload);
  };
}

function _Registry_build_() {
  var map = {};

  // =========================
  // DIAGNÓSTICO (DEV)
  // =========================
  map["Registry_ListActions"] = {
    action: "Registry_ListActions",
    handler: Registry_ListActions,
    requiresAuth: false, // DEV: false. (Em PROD, sugiro true + roles:["admin"])
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // =========================
  // AUTH
  // =========================
  map["Auth_Login"] = {
    action: "Auth_Login",
    handler: Auth_Login,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Auth_Login"
  };

  map["Auth_Me"] = {
    action: "Auth_Me",
    handler: Auth_Me,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Auth_Logout"] = {
    action: "Auth_Logout",
    handler: Auth_Logout,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  if (
    String(PRONTIO_ENV).toUpperCase() === "DEV" &&
    typeof Auth_ResetSenhaDev === "function"
  ) {
    map["Auth_ResetSenhaDev"] = {
      action: "Auth_ResetSenhaDev",
      handler: Auth_ResetSenhaDev,
      requiresAuth: false,
      roles: [],
      validations: [],
      requiresLock: true,
      lockKey: "Auth_ResetSenhaDev"
    };
  }

  // =========================
  // AUTH RECOVERY (públicas)
  // =========================
  map["Auth_ForgotPassword_Request"] = {
    action: "Auth_ForgotPassword_Request",
    handler: Auth_ForgotPassword_Request,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Auth_ForgotPassword_Request"
  };

  map["Auth_ForgotPassword_ValidateToken"] = {
    action: "Auth_ForgotPassword_ValidateToken",
    handler: Auth_ForgotPassword_ValidateToken,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Auth_ForgotPassword_Reset"] = {
    action: "Auth_ForgotPassword_Reset",
    handler: Auth_ForgotPassword_Reset,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Auth_ForgotPassword_Reset"
  };

  // =========================
  // USUÁRIOS (admin / self-service)
  // =========================
  map["Usuarios_Listar"] = {
    action: "Usuarios_Listar",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_Listar", payload, ctx); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Usuarios_Criar"] = {
    action: "Usuarios_Criar",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_Criar", payload, ctx); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_Criar"
  };

  map["Usuarios_Atualizar"] = {
    action: "Usuarios_Atualizar",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_Atualizar", payload, ctx); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_Atualizar"
  };

  map["Usuarios_AlterarSenha"] = {
    action: "Usuarios_AlterarSenha",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_AlterarSenha", payload, ctx); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_AlterarSenha"
  };

  map["Usuarios_ResetSenhaAdmin"] = {
    action: "Usuarios_ResetSenhaAdmin",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_ResetSenhaAdmin", payload, ctx); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_ResetSenhaAdmin"
  };

  map["Usuarios_AlterarMinhaSenha"] = {
    action: "Usuarios_AlterarMinhaSenha",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_AlterarMinhaSenha", payload, ctx); },
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_AlterarMinhaSenha"
  };

  map["Usuarios_EnsureSchema"] = {
    action: "Usuarios_EnsureSchema",
    handler: function (ctx, payload) { return handleUsuariosAction("Usuarios_EnsureSchema", payload, ctx); },
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Usuarios_EnsureSchema"
  };

  // =========================
  // CLÍNICA
  // =========================
  map["Clinica_Get"] = {
    action: "Clinica_Get",
    handler: Clinica_Get,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Clinica_Update"] = {
    action: "Clinica_Update",
    handler: Clinica_Update,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Clinica_Update"
  };

  // =========================
  // PROFISSIONAIS
  // =========================
  map["Profissionais_List"] = {
    action: "Profissionais_List",
    handler: Profissionais_List,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Profissionais_Create"] = {
    action: "Profissionais_Create",
    handler: Profissionais_Create,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Profissionais_Create"
  };

  map["Profissionais_Update"] = {
    action: "Profissionais_Update",
    handler: Profissionais_Update,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Profissionais_Update"
  };

  map["Profissionais_SetActive"] = {
    action: "Profissionais_SetActive",
    handler: Profissionais_SetActive,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Profissionais_SetActive"
  };

  // =========================
  // META / MIGRATIONS (admin)
  // =========================
  map["Meta_BootstrapDb"] = {
    action: "Meta_BootstrapDb",
    handler: Meta_BootstrapDb,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: true,
    lockKey: "Meta_BootstrapDb"
  };

  map["Meta_DbStatus"] = {
    action: "Meta_DbStatus",
    handler: Meta_DbStatus,
    requiresAuth: true,
    roles: ["admin"],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // =========================
  // ATENDIMENTO
  // =========================
  map["Atendimento.ListarFilaHoje"] = {
    action: "Atendimento.ListarFilaHoje",
    handler: Atendimento_Action_ListarFilaHoje_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Atendimento.MarcarChegada"] = {
    action: "Atendimento.MarcarChegada",
    handler: Atendimento_Action_MarcarChegada_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.ChamarProximo"] = {
    action: "Atendimento.ChamarProximo",
    handler: Atendimento_Action_ChamarProximo_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.Iniciar"] = {
    action: "Atendimento.Iniciar",
    handler: Atendimento_Action_Iniciar_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.Concluir"] = {
    action: "Atendimento.Concluir",
    handler: Atendimento_Action_Concluir_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.Cancelar"] = {
    action: "Atendimento.Cancelar",
    handler: Atendimento_Action_Cancelar_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  map["Atendimento.SyncHoje"] = {
    action: "Atendimento.SyncHoje",
    handler: Atendimento_Action_SyncHoje_,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  // =========================
  // AGENDA (novo + aliases + legados)
  // =========================
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

  // ✅ PASSO 1: validação de conflito (fonte da verdade no novo Agenda.gs)
  map["Agenda_ValidarConflito"] = {
    action: "Agenda_ValidarConflito",
    handler: _Registry_agendaValidarConflitoHandler_(), // call-time
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // ✅ Alias sem quebrar (caso alguém chame no formato dotted)
  map["Agenda.ValidarConflito"] = {
    action: "Agenda.ValidarConflito",
    handler: map["Agenda_ValidarConflito"].handler,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // =========================
  // AGENDA (legados / compat)
  // =========================
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

  // ============================================================
  // PRONTUÁRIO (fachada)
  // ============================================================
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

  // =========================
  // CHAT ✅
  // =========================
  map["chat.sendMessage"] = {
    action: "chat.sendMessage",
    handler: (typeof Chat_Action_SendMessage_ === "function")
      ? Chat_Action_SendMessage_
      : _Registry_missingHandler_("Chat_Action_SendMessage_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "CHAT"
  };

  map["chat.listMessages"] = {
    action: "chat.listMessages",
    handler: (typeof Chat_Action_ListMessages_ === "function")
      ? Chat_Action_ListMessages_
      : _Registry_missingHandler_("Chat_Action_ListMessages_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["chat.listMessagesSince"] = {
    action: "chat.listMessagesSince",
    handler: (typeof Chat_Action_ListMessagesSince_ === "function")
      ? Chat_Action_ListMessagesSince_
      : _Registry_missingHandler_("Chat_Action_ListMessagesSince_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["chat.markAsRead"] = {
    action: "chat.markAsRead",
    handler: (typeof Chat_Action_MarkAsRead_ === "function")
      ? Chat_Action_MarkAsRead_
      : _Registry_missingHandler_("Chat_Action_MarkAsRead_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "CHAT"
  };

  map["chat.getUnreadSummary"] = {
    action: "chat.getUnreadSummary",
    handler: (typeof Chat_Action_GetUnreadSummary_ === "function")
      ? Chat_Action_GetUnreadSummary_
      : _Registry_missingHandler_("Chat_Action_GetUnreadSummary_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["chat.listByPaciente"] = {
    action: "chat.listByPaciente",
    handler: (typeof Chat_Action_ListByPaciente_ === "function")
      ? Chat_Action_ListByPaciente_
      : _Registry_missingHandler_("Chat_Action_ListByPaciente_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["chat.sendByPaciente"] = {
    action: "chat.sendByPaciente",
    handler: (typeof Chat_Action_SendByPaciente_ === "function")
      ? Chat_Action_SendByPaciente_
      : _Registry_missingHandler_("Chat_Action_SendByPaciente_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "CHAT"
  };

  // =========================
  // COMPAT DO CHAT ✅
  // =========================
  map["usuarios.listAll"] = {
    action: "usuarios.listAll",
    handler: (typeof ChatCompat_Usuarios_ListAll_ === "function")
      ? ChatCompat_Usuarios_ListAll_
      : _Registry_missingHandler_("ChatCompat_Usuarios_ListAll_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["agenda.peekNextPatient"] = {
    action: "agenda.peekNextPatient",
    handler: (typeof ChatCompat_Agenda_PeekNextPatient_ === "function")
      ? ChatCompat_Agenda_PeekNextPatient_
      : _Registry_missingHandler_("ChatCompat_Agenda_PeekNextPatient_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["agenda.nextPatient"] = {
    action: "agenda.nextPatient",
    handler: (typeof ChatCompat_Agenda_NextPatient_ === "function")
      ? ChatCompat_Agenda_NextPatient_
      : _Registry_missingHandler_("ChatCompat_Agenda_NextPatient_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };

  // =========================
  // PACIENTES ✅ (inclui DebugInfo)
  // =========================
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

  // =========================
  // RECEITA
  // =========================
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

  // =========================
  // MEDICAMENTOS
  // =========================
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

  return map;
}

function Registry_ListActions(ctx, payload) {
  if (!REGISTRY_ACTIONS) REGISTRY_ACTIONS = _Registry_build_();

  var keys = Object.keys(REGISTRY_ACTIONS || {}).sort();
  return {
    count: keys.length,
    actions: keys,
    hasAuthLogin: keys.indexOf("Auth_Login") >= 0,
    hasUsuariosAlterarSenha: keys.indexOf("Usuarios_AlterarSenha") >= 0,
    hasClinica: keys.indexOf("Clinica_Get") >= 0 && keys.indexOf("Clinica_Update") >= 0,
    hasProfissionais: keys.indexOf("Profissionais_List") >= 0,
    hasMetaBootstrap: keys.indexOf("Meta_BootstrapDb") >= 0,
    hasAuthResetSenhaDev: keys.indexOf("Auth_ResetSenhaDev") >= 0,
    hasUsuariosResetSenhaAdmin: keys.indexOf("Usuarios_ResetSenhaAdmin") >= 0,
    hasAgendaNew: keys.indexOf("Agenda.Criar") >= 0 && keys.indexOf("Agenda.Atualizar") >= 0,
    hasAgendaConfig: keys.indexOf("AgendaConfig_Obter") >= 0 && keys.indexOf("AgendaConfig_Salvar") >= 0,
    hasAgendaValidarConflito: keys.indexOf("Agenda_ValidarConflito") >= 0,
    hasProntuario: keys.indexOf("Prontuario.Ping") >= 0 && keys.indexOf("Prontuario.Receita.GerarPdf") >= 0,
    hasChat: keys.indexOf("chat.sendMessage") >= 0 && keys.indexOf("chat.listMessages") >= 0,
    hasChatCompat: keys.indexOf("usuarios.listAll") >= 0 && keys.indexOf("agenda.nextPatient") >= 0,
    hasPacientes: keys.indexOf("Pacientes_Listar") >= 0 && keys.indexOf("Pacientes_BuscarSimples") >= 0,
    hasPacientesDebug: keys.indexOf("Pacientes_DebugInfo") >= 0,
    hasReceita: keys.indexOf("Receita.GerarPdf") >= 0,
    hasMedicamentos: keys.indexOf("Medicamentos.ListarAtivos") >= 0,
    hasAgendaListarEventosDiaParaValidacao: keys.indexOf("Agenda_ListarEventosDiaParaValidacao") >= 0,
    hasPacientesCriar: keys.indexOf("Pacientes_Criar") >= 0,
    hasUsuariosEnsureSchema: keys.indexOf("Usuarios_EnsureSchema") >= 0
  };
}
