// backend/data/registry/Registry.Core.gs

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
 * Tenta chamar um handler moderno e, se não existir, cai no legado via routeAction_.
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

    return _Registry_legacyHandler_(legacy)(ctx, payload || {});
  };
}

/**
 * ✅ PASSO 1 (Agenda) - handler canônico para validação de conflito
 */
function _Registry_agendaValidarConflitoHandler_() {
  return function (ctx, payload) {
    payload = payload || {};

    // 1) Fonte da verdade: Agenda (módulo)
    if (typeof handleAgendaAction === "function") {
      return handleAgendaAction("Agenda_ValidarConflito", payload);
    }

    // 2) Adaptador legado do novo módulo
    if (typeof Agenda_Legacy_ValidarConflito_ === "function") {
      return Agenda_Legacy_ValidarConflito_(ctx, payload);
    }

    // 3) Instalações antigas
    if (typeof Agenda_Action_ValidarConflito === "function") {
      return Agenda_Action_ValidarConflito(payload);
    }

    return _Registry_missingHandler_(
      "handleAgendaAction / Agenda_Legacy_ValidarConflito_ / Agenda_Action_ValidarConflito"
    )(ctx, payload);
  };
}

/**
 * ✅ Adapter profissional:
 * "Agenda.Listar" -> "Agenda.ListarPorPeriodo"
 *
 * FIX CRÍTICO: se inicio/fim for YYYY-MM-DD, converte para dia inteiro.
 */
function _Registry_agendaListarHandler_() {
  function _isYmd_(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
  }

  function _ymdStart_(ymd) {
    var s = String(ymd).trim();
    var y = Number(s.slice(0, 4));
    var m = Number(s.slice(5, 7)) - 1;
    var d = Number(s.slice(8, 10));
    return new Date(y, m, d, 0, 0, 0, 0);
  }

  function _ymdEnd_(ymd) {
    var s = String(ymd).trim();
    var y = Number(s.slice(0, 4));
    var m = Number(s.slice(5, 7)) - 1;
    var d = Number(s.slice(8, 10));
    return new Date(y, m, d, 23, 59, 59, 999);
  }

  return function (ctx, payload) {
    payload = payload || {};
    var periodo = payload.periodo || {};
    var inicioRaw = (periodo.inicio !== undefined) ? periodo.inicio : payload.inicio;
    var fimRaw = (periodo.fim !== undefined) ? periodo.fim : payload.fim;

    var filtros = payload.filtros || {};
    var incluirCancelados = filtros.incluirCancelados === true || payload.incluirCancelados === true;
    var idPaciente = filtros.idPaciente ? String(filtros.idPaciente) : (payload.idPaciente ? String(payload.idPaciente) : null);

    if (typeof Agenda_Action_ListarPorPeriodo_ !== "function") {
      return _Registry_missingHandler_("Agenda_Action_ListarPorPeriodo_")(ctx, payload);
    }

    var inicio = inicioRaw;
    var fim = fimRaw;

    if (_isYmd_(inicioRaw)) inicio = _ymdStart_(inicioRaw);
    if (_isYmd_(fimRaw)) fim = _ymdEnd_(fimRaw);

    return Agenda_Action_ListarPorPeriodo_(ctx, {
      inicio: inicio,
      fim: fim,
      incluirCancelados: incluirCancelados,
      idPaciente: idPaciente
    });
  };
}

/**
 * ✅ Wrapper profissional:
 * Agenda.BloquearHorario -> Agenda.Criar (tipo=BLOQUEIO)
 */
function _Registry_agendaBloquearHandler_() {
  return function (ctx, payload) {
    payload = payload || {};

    if (typeof Agenda_Action_Criar_ !== "function") {
      return _Registry_missingHandler_("Agenda_Action_Criar_")(ctx, payload);
    }

    var p = {
      data: payload.data,
      hora_inicio: payload.hora_inicio,
      duracao_minutos: payload.duracao_minutos,
      tipo: "BLOQUEIO",
      titulo: payload.titulo || "BLOQUEIO",
      notas: payload.notas || "",
      origem: payload.origem || "SISTEMA",
      permitirEncaixe: false
    };

    return Agenda_Action_Criar_(ctx, p);
  };
}

/**
 * ✅ Wrapper profissional:
 * Agenda.DesbloquearHorario -> Agenda.Cancelar (idempotente)
 */
function _Registry_agendaDesbloquearHandler_() {
  return function (ctx, payload) {
    payload = payload || {};
    if (typeof Agenda_Action_Cancelar_ !== "function") {
      return _Registry_missingHandler_("Agenda_Action_Cancelar_")(ctx, payload);
    }
    var idAgenda = payload.idAgenda ? String(payload.idAgenda) : "";
    if (!idAgenda) {
      var e = new Error('"idAgenda" é obrigatório.');
      e.code = "VALIDATION_ERROR";
      e.details = { field: "idAgenda" };
      throw e;
    }
    return Agenda_Action_Cancelar_(ctx, { idAgenda: idAgenda, motivo: payload.motivo || "Desbloquear horário" });
  };
}

// =========================
// Registrar ações por módulo
// =========================

function Registry_RegisterCore_(map) {
  map["Registry_ListActions"] = {
    action: "Registry_ListActions",
    handler: Registry_ListActions,
    requiresAuth: false, // DEV: false. (Em PROD, sugiro true + roles:["admin"])
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };
}

/**
 * ✅ NOVO (SEM QUEBRAR):
 * Chama Registry_RegisterX_(map) apenas se a função existir no deploy.
 * Isso evita quebrar o build do registry quando algum arquivo estiver vazio
 * ou não estiver incluído no deploy atual.
 */
function _Registry_callRegisterIfExists_(fnName, map) {
  fnName = String(fnName || "").trim();
  if (!fnName) return false;

  try {
    var root = (typeof globalThis !== "undefined") ? globalThis : this;
    var fn = root ? root[fnName] : null;
    if (typeof fn === "function") {
      fn(map);
      return true;
    }
  } catch (_) {}

  return false;
}

function _Registry_build_() {
  var map = {};

  // Núcleo (obrigatórios)
  _Registry_callRegisterIfExists_("Registry_RegisterCore_", map);
  _Registry_callRegisterIfExists_("Registry_RegisterAuth_", map);
  _Registry_callRegisterIfExists_("Registry_RegisterUsuarios_", map);

  // ✅ opcionais: não podem derrubar o boot se estiverem ausentes/vazios
  _Registry_callRegisterIfExists_("Registry_RegisterClinicaProfissionais_", map);
  _Registry_callRegisterIfExists_("Registry_RegisterMetaHealth_", map);

  // Demais módulos (dependem do deploy)
  _Registry_callRegisterIfExists_("Registry_RegisterAtendimento_", map);
  _Registry_callRegisterIfExists_("Registry_RegisterAgenda_", map);
  _Registry_callRegisterIfExists_("Registry_RegisterProntuario_", map);
  _Registry_callRegisterIfExists_("Registry_RegisterChat_", map);
  _Registry_callRegisterIfExists_("Registry_RegisterPacientes_", map);
  _Registry_callRegisterIfExists_("Registry_RegisterReceitaMedicamentos_", map);
  _Registry_callRegisterIfExists_("Registry_RegisterEvolucao_", map);
  _Registry_callRegisterIfExists_("Registry_RegisterAnamnese_", map);

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
    hasUsuariosEnsureSchema: keys.indexOf("Usuarios_EnsureSchema") >= 0,

    // ✅ novos canônicos (diagnóstico)
    hasAgendaListar: keys.indexOf("Agenda.Listar") >= 0,
    hasAgendaBloquearHorario: keys.indexOf("Agenda.BloquearHorario") >= 0,
    hasAgendaDesbloquearHorario: keys.indexOf("Agenda.DesbloquearHorario") >= 0,
    hasAgendaConfigDot: keys.indexOf("AgendaConfig.Obter") >= 0 && keys.indexOf("AgendaConfig.Salvar") >= 0
  };
}
