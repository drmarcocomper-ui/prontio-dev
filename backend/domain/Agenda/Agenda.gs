/**
 * ============================================================
 * PRONTIO - Agenda.gs (MÓDULO NOVO - compatível com arquitetura API-first)
 * ============================================================
 * IMPORTANTE:
 * - NÃO usa SpreadsheetApp diretamente (Sheets só via Repository).
 * - NÃO usa colunas/abas no front.
 * - NÃO lança "throw { }". (ok)
 * - IDs são gerados no backend via Ids.gs
 * - Locks: aplicados no Api.gs via Registry.requiresLock
 *
 * Actions NOVAS (Registry):
 * - Agenda.ListarPorPeriodo
 * - Agenda.Criar
 * - Agenda.Atualizar
 * - Agenda.Cancelar
 *
 * ✅ LEGACY (front atual):
 * - Agenda_ListarDia
 * - Agenda_ListarSemana
 * - Agenda_Criar
 * - Agenda_Atualizar
 * - Agenda_BloquearHorario
 * - Agenda_MudarStatus
 * - Agenda_RemoverBloqueio
 * - Agenda_ValidarConflito
 *
 * ============================================================
 * PASSO 1 - Contrato Oficial da Agenda (LOCAL TIME)
 * ============================================================
 * 🔒 Regra oficial:
 * - Front envia { data:"YYYY-MM-DD", hora_inicio:"HH:MM", duracao_minutos:N, permitirEncaixe:boolean }
 * - Backend constrói Date LOCAL e decide inicio/fim
 * - Persistência pode ser ISO, mas o backend deve sempre:
 *   - construir datas locais via new Date(y,m,d,H,M)
 *   - e para ler, converter ISO -> Date e operar sempre como local
 *
 * ✅ VALIDAR == SALVAR:
 * - _agendaAssertSemConflitos_ é a única fonte da verdade
 * - Pré-validação chama a MESMA função, com MESMOS args (inclui permitirEncaixe)
 *
 * ✅ Erros:
 * - code: CONFLICT | VALIDATION_ERROR | NOT_FOUND
 * - Front decide por code, não por texto
 *
 * ============================================================
 * ✅ ATUALIZAÇÃO DE CONTRATO (2026-01-01):
 * - Nome oficial do paciente: Pacientes.nomeCompleto
 * - Remover "nome_paciente" e usar "nomeCompleto" nas respostas.
 *   (Tanto nas actions NOVAS quanto nas LEGACY)
 */

function handleAgendaAction(action, payload) {
  payload = payload || {};

  var ctx = {
    action: String(action || ""),
    user: null,
    env: (typeof PRONTIO_ENV !== "undefined" ? PRONTIO_ENV : "DEV"),
    apiVersion: (typeof PRONTIO_API_VERSION !== "undefined" ? PRONTIO_API_VERSION : "1.0.0-DEV")
  };

  var a = String(action || "").trim();

  // Actions NOVAS
  if (a === "Agenda.ListarPorPeriodo") return Agenda_Action_ListarPorPeriodo_(ctx, payload);
  if (a === "Agenda.Criar") return Agenda_Action_Criar_(ctx, payload);
  if (a === "Agenda.Atualizar") return Agenda_Action_Atualizar_(ctx, payload);
  if (a === "Agenda.Cancelar") return Agenda_Action_Cancelar_(ctx, payload);

  // ✅ PASSO 1: validar conflito oficial (fonte da verdade no novo módulo)
  if (a === "Agenda_ValidarConflito") return Agenda_Action_ValidarConflito_(ctx, payload);

  // Actions LEGACY
  if (a === "Agenda_ListarDia") return Agenda_Legacy_ListarDia_(ctx, payload);
  if (a === "Agenda_ListarSemana") return Agenda_Legacy_ListarSemana_(ctx, payload);
  if (a === "Agenda_Criar") return Agenda_Legacy_Criar_(ctx, payload);
  if (a === "Agenda_Atualizar") return Agenda_Legacy_Atualizar_(ctx, payload);
  if (a === "Agenda_BloquearHorario") return Agenda_Legacy_BloquearHorario_(ctx, payload);
  if (a === "Agenda_MudarStatus") return Agenda_Legacy_MudarStatus_(ctx, payload);
  if (a === "Agenda_RemoverBloqueio") return Agenda_Legacy_RemoverBloqueio_(ctx, payload);

  // Adapter antigo
  if (a === "Agenda_ListarEventosDiaParaValidacao") {
    var ds = payload && payload.data ? String(payload.data) : "";
    return { items: Agenda_ListarEventosDiaParaValidacao_(ds) };
  }

  _agendaThrow_("NOT_FOUND", "Action de Agenda não reconhecida.", { action: a });
}

var AGENDA_ENTITY = "Agenda";
var AGENDA_ID_FIELD = "idAgenda";

/**
 * ✅ STATUS CANÔNICO
 */
var AGENDA_STATUS = {
  MARCADO: "MARCADO",
  CONFIRMADO: "CONFIRMADO",
  AGUARDANDO: "AGUARDANDO",
  EM_ATENDIMENTO: "EM_ATENDIMENTO",
  ATENDIDO: "ATENDIDO",
  FALTOU: "FALTOU",
  CANCELADO: "CANCELADO",
  REMARCADO: "REMARCADO"
};

var AGENDA_TIPO = {
  CONSULTA: "CONSULTA",
  RETORNO: "RETORNO",
  PROCEDIMENTO: "PROCEDIMENTO",
  BLOQUEIO: "BLOQUEIO",
  OUTRO: "OUTRO"
};

var AGENDA_ORIGEM = {
  RECEPCAO: "RECEPCAO",
  MEDICO: "MEDICO",
  SISTEMA: "SISTEMA"
};

// ============================================================
// ✅ NomeCompleto (resolução por idPaciente) — usado pelas actions NOVAS e LEGACY
// ============================================================

var _agendaPacienteCache_ = null;

function _agendaTryGetPacienteById_(idPaciente) {
  var id = String(idPaciente || "").trim();
  if (!id) return null;

  if (!_agendaPacienteCache_) _agendaPacienteCache_ = {};
  if (Object.prototype.hasOwnProperty.call(_agendaPacienteCache_, id)) return _agendaPacienteCache_[id];

  var p = null;
  try {
    // ✅ conforme sua planilha/repo
    p = Repo_getById_("Pacientes", "idPaciente", id);
  } catch (_) {
    p = null;
  }

  _agendaPacienteCache_[id] = p;
  return p;
}

function _agendaGetNomeCompletoOficial_(pacienteObj) {
  if (!pacienteObj || typeof pacienteObj !== "object") return "";
  return String(pacienteObj.nomeCompleto || "").trim();
}

/**
 * Anexa nomeCompleto ao DTO de agenda (não persiste; só resposta).
 * Regra:
 * - Se BLOQUEIO: nomeCompleto="Bloqueio"
 * - Se não: resolve por idPaciente em Pacientes.nomeCompleto
 */
function _agendaAttachNomeCompleto_(dto) {
  dto = _agendaNormalizeRowToDto_(dto || {});
  var tipo = _agendaNormalizeTipo_(dto.tipo);
  var isBloqueio = (tipo === AGENDA_TIPO.BLOQUEIO);

  if (isBloqueio) {
    dto.nomeCompleto = "Bloqueio";
    return dto;
  }

  var nome = "";
  if (dto.idPaciente) {
    var p = _agendaTryGetPacienteById_(dto.idPaciente);
    nome = _agendaGetNomeCompletoOficial_(p);
  }
  dto.nomeCompleto = nome || "(sem nome)";
  return dto;
}

// ============================================================
// Handlers NOVOS
// ============================================================

function Agenda_Action_ListarPorPeriodo_(ctx, payload) {
  payload = payload || {};

  var ini = _agendaParseDateRequired_(payload.inicio, "inicio");
  var fim = _agendaParseDateRequired_(payload.fim, "fim");

  if (fim.getTime() < ini.getTime()) {
    _agendaThrow_("VALIDATION_ERROR", '"fim" não pode ser menor que "inicio".', {
      inicio: ini.toISOString(),
      fim: fim.toISOString()
    });
  }

  var incluirCancelados = payload.incluirCancelados === true;
  var idPaciente = payload.idPaciente ? String(payload.idPaciente) : null;

  var all = Repo_list_(AGENDA_ENTITY);

  var out = [];
  for (var i = 0; i < all.length; i++) {
    var e = _agendaNormalizeRowToDto_(all[i]);

    e.tipo = _agendaNormalizeTipo_(e.tipo);
    e.status = _agendaNormalizeStatus_(e.status);
    e.origem = _agendaNormalizeOrigem_(e.origem);

    if (!incluirCancelados && e.status === AGENDA_STATUS.CANCELADO) continue;
    if (idPaciente && String(e.idPaciente || "") !== idPaciente) continue;

    var evIni = _agendaParseDate_(e.inicio);
    var evFim = _agendaParseDate_(e.fim);
    if (!evIni || !evFim) continue;

    var overlaps = (evIni.getTime() <= fim.getTime()) && (evFim.getTime() >= ini.getTime());
    if (!overlaps) continue;

    // ✅ anexa nomeCompleto para o front (novo contrato)
    out.push(_agendaAttachNomeCompleto_(e));
  }

  out.sort(function (a, b) {
    var da = _agendaParseDate_(a.inicio);
    var db = _agendaParseDate_(b.inicio);
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });

  return { items: out, count: out.length };
}

function Agenda_Action_Criar_(ctx, payload) {
  payload = payload || {};

  var params = (typeof Config_getAgendaParams_ === "function") ? Config_getAgendaParams_() : {
    duracaoPadraoMin: 30,
    slotMin: 10,
    permiteSobreposicao: false
  };

  var norm = _agendaNormalizeCreateInput_(payload, params);

  if (norm.tipo === AGENDA_TIPO.BLOQUEIO) {
    norm.idPaciente = "";
    norm.status = AGENDA_STATUS.MARCADO;
  }

  _agendaAssertSemConflitos_(ctx, {
    inicio: norm.inicio,
    fim: norm.fim,
    permitirEncaixe: norm.permitirEncaixe === true,
    modoBloqueio: norm.tipo === AGENDA_TIPO.BLOQUEIO,
    ignoreIdAgenda: null
  }, params);

  var idAgenda = Ids_nextId_("AGENDA");
  var now = new Date();

  var dto = {
    idAgenda: idAgenda,
    idPaciente: norm.idPaciente || "",
    inicio: norm.inicio.toISOString(),
    fim: norm.fim.toISOString(),
    titulo: norm.titulo || "",
    notas: norm.notas || "",
    tipo: norm.tipo || AGENDA_TIPO.CONSULTA,
    status: norm.status || AGENDA_STATUS.MARCADO,
    origem: norm.origem || AGENDA_ORIGEM.RECEPCAO,
    criadoEm: now.toISOString(),
    atualizadoEm: now.toISOString(),
    canceladoEm: "",
    canceladoMotivo: ""
  };

  Repo_insert_(AGENDA_ENTITY, dto);

  // ✅ anexa nomeCompleto na resposta
  return { item: _agendaAttachNomeCompleto_(dto) };
}

function Agenda_Action_Atualizar_(ctx, payload) {
  payload = payload || {};

  var idAgenda = payload.idAgenda ? String(payload.idAgenda) : "";
  if (!idAgenda) _agendaThrow_("VALIDATION_ERROR", '"idAgenda" é obrigatório.', { field: "idAgenda" });

  var existing = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda);
  if (!existing) _agendaThrow_("NOT_FOUND", "Agendamento não encontrado.", { idAgenda: idAgenda });

  existing = _agendaNormalizeRowToDto_(existing);
  existing.tipo = _agendaNormalizeTipo_(existing.tipo);
  existing.status = _agendaNormalizeStatus_(existing.status);
  existing.origem = _agendaNormalizeOrigem_(existing.origem);

  var params = (typeof Config_getAgendaParams_ === "function") ? Config_getAgendaParams_() : {
    duracaoPadraoMin: 30,
    slotMin: 10,
    permiteSobreposicao: false
  };

  var patchIn = (payload.patch && typeof payload.patch === "object") ? payload.patch : {};
  var mergedPatch = _agendaBuildUpdatePatch_(existing, patchIn, payload, params);

  if (mergedPatch.status !== undefined) {
    var s = _agendaNormalizeStatus_(mergedPatch.status);
    if (s === AGENDA_STATUS.CANCELADO) {
      _agendaThrow_("VALIDATION_ERROR", 'Use "Agenda.Cancelar" para cancelar um agendamento.', { idAgenda: idAgenda });
    }
    mergedPatch.status = s;
  }

  var isCancelado = (String(existing.status || "") === AGENDA_STATUS.CANCELADO);
  if (isCancelado) {
    var blocked = ["inicio", "fim", "tipo", "status", "idPaciente"];
    for (var k = 0; k < blocked.length; k++) {
      if (mergedPatch[blocked[k]] !== undefined) {
        _agendaThrow_("VALIDATION_ERROR", "Agendamento cancelado não pode ter data/tipo/status/paciente alterados.", {
          idAgenda: idAgenda,
          field: blocked[k]
        });
      }
    }
  }

  var newInicio = (mergedPatch.inicio !== undefined) ? _agendaParseDate_(mergedPatch.inicio) : _agendaParseDate_(existing.inicio);
  var newFim = (mergedPatch.fim !== undefined) ? _agendaParseDate_(mergedPatch.fim) : _agendaParseDate_(existing.fim);

  if (!newInicio || !newFim) _agendaThrow_("VALIDATION_ERROR", "Datas inválidas em atualização.", { idAgenda: idAgenda });
  if (newFim.getTime() < newInicio.getTime()) _agendaThrow_("VALIDATION_ERROR", '"fim" não pode ser menor que "inicio".', {});

  var tipoFinal = (mergedPatch.tipo !== undefined)
    ? String(_agendaNormalizeTipo_(mergedPatch.tipo))
    : String(existing.tipo || AGENDA_TIPO.CONSULTA);

  mergedPatch.tipo = (mergedPatch.tipo !== undefined) ? _agendaNormalizeTipo_(mergedPatch.tipo) : undefined;

  if (tipoFinal === AGENDA_TIPO.BLOQUEIO) mergedPatch.idPaciente = "";

  var permitirEncaixe = (typeof payload.permitirEncaixe !== "undefined") ? (payload.permitirEncaixe === true) : false;

  _agendaAssertSemConflitos_(ctx, {
    inicio: newInicio,
    fim: newFim,
    permitirEncaixe: permitirEncaixe,
    modoBloqueio: (tipoFinal === AGENDA_TIPO.BLOQUEIO),
    ignoreIdAgenda: idAgenda
  }, params);

  mergedPatch.atualizadoEm = new Date().toISOString();

  var ok = Repo_update_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda, mergedPatch);
  if (!ok) _agendaThrow_("NOT_FOUND", "Agendamento não encontrado para atualizar.", { idAgenda: idAgenda });

  var after = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda);
  return { item: _agendaAttachNomeCompleto_(after) };
}

function Agenda_Action_Cancelar_(ctx, payload) {
  payload = payload || {};
  var idAgenda = payload.idAgenda ? String(payload.idAgenda) : "";
  if (!idAgenda) _agendaThrow_("VALIDATION_ERROR", '"idAgenda" é obrigatório.', { field: "idAgenda" });

  var existing = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda);
  if (!existing) _agendaThrow_("NOT_FOUND", "Agendamento não encontrado.", { idAgenda: idAgenda });

  existing = _agendaNormalizeRowToDto_(existing);
  existing.status = _agendaNormalizeStatus_(existing.status);
  if (existing.status === AGENDA_STATUS.CANCELADO) return { item: _agendaAttachNomeCompleto_(existing) };

  var nowIso = new Date().toISOString();
  var patch = {
    status: AGENDA_STATUS.CANCELADO,
    canceladoEm: nowIso,
    canceladoMotivo: payload.motivo ? String(payload.motivo).slice(0, 500) : "",
    atualizadoEm: nowIso
  };

  var ok = Repo_update_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda, patch);
  if (!ok) _agendaThrow_("NOT_FOUND", "Agendamento não encontrado para cancelar.", { idAgenda: idAgenda });

  var after = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda);
  return { item: _agendaAttachNomeCompleto_(after) };
}

function Agenda_Action_ValidarConflito_(ctx, payload) {
  payload = payload || {};

  var dataStr = String(payload.data || "").trim();
  var horaStr = String(payload.hora_inicio || "").trim();
  var dur = Number(payload.duracao_minutos || 0);
  var ignoreId = String(payload.ignoreIdAgenda || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) _agendaThrow_("VALIDATION_ERROR", '"data" inválida.', { field: "data" });
  if (!/^\d{2}:\d{2}$/.test(horaStr)) _agendaThrow_("VALIDATION_ERROR", '"hora_inicio" inválida.', { field: "hora_inicio" });
  if (!dur || isNaN(dur) || dur <= 0) _agendaThrow_("VALIDATION_ERROR", '"duracao_minutos" inválida.', { field: "duracao_minutos" });

  var params = (typeof Config_getAgendaParams_ === "function") ? Config_getAgendaParams_() : {
    duracaoPadraoMin: 30,
    slotMin: 10,
    permiteSobreposicao: false
  };

  var ini = _agendaBuildDateTime_(dataStr, horaStr);
  var fim = new Date(ini.getTime() + dur * 60000);

  var permitirEncaixe = (payload.permite_encaixe === true) || (payload.permitirEncaixe === true);

  try {
    _agendaAssertSemConflitos_(ctx, {
      inicio: ini,
      fim: fim,
      permitirEncaixe: permitirEncaixe,
      modoBloqueio: false,
      ignoreIdAgenda: ignoreId || null
    }, params);

    return { ok: true, conflitos: [], intervalo: { data: dataStr, hora_inicio: horaStr, duracao_minutos: dur } };
  } catch (err) {
    var conflitos = [];
    try {
      var det = err && err.details ? err.details : null;
      var arr = det && det.conflitos ? det.conflitos : null;

      if (arr && arr.length) {
        for (var i = 0; i < arr.length; i++) {
          var c = arr[i];
          var ci = _agendaParseDate_(c.inicio);
          var cf = _agendaParseDate_(c.fim);
          conflitos.push({
            ID_Agenda: c.idAgenda || "",
            bloqueio: String(c.tipo || "").toUpperCase().indexOf("BLOQ") >= 0,
            hora_inicio: ci ? _agendaFormatHHMM_(ci) : "",
            hora_fim: cf ? _agendaFormatHHMM_(cf) : ""
          });
        }
      }
    } catch (_) {}

    return {
      ok: false,
      erro: (err && err.message) ? String(err.message) : "Conflito de horário.",
      conflitos: conflitos,
      intervalo: { data: dataStr, hora_inicio: horaStr, duracao_minutos: dur },
      code: (err && err.code) ? String(err.code) : "CONFLICT"
    };
  }
}

// ============================================================
// Regras de conflito / normalização
// ============================================================

function _agendaAssertSemConflitos_(ctx, args, params) {
  params = params || {};
  args = args || {};

  var inicio = args.inicio;
  var fim = args.fim;

  if (!(inicio instanceof Date) || isNaN(inicio.getTime())) _agendaThrow_("VALIDATION_ERROR", "inicio inválido.", {});
  if (!(fim instanceof Date) || isNaN(fim.getTime())) _agendaThrow_("VALIDATION_ERROR", "fim inválido.", {});

  var ignoreId = args.ignoreIdAgenda ? String(args.ignoreIdAgenda) : null;
  var isBloqueioNovo = args.modoBloqueio === true;

  var cfgPermiteSobreposicao = params.permiteSobreposicao === true;
  var permitirEncaixe = args.permitirEncaixe === true;

  var all = Repo_list_(AGENDA_ENTITY);

  for (var i = 0; i < all.length; i++) {
    var e = _agendaNormalizeRowToDto_(all[i]);
    if (ignoreId && String(e.idAgenda || "") === ignoreId) continue;

    var evIni = _agendaParseDate_(e.inicio);
    var evFim = _agendaParseDate_(e.fim);
    if (!evIni || !evFim) continue;

    var overlaps = (inicio.getTime() < evFim.getTime()) && (fim.getTime() > evIni.getTime());
    if (!overlaps) continue;

    var evTipo = _agendaNormalizeTipo_(e.tipo || AGENDA_TIPO.CONSULTA);
    var evStatus = _agendaNormalizeStatus_(e.status || AGENDA_STATUS.MARCADO);

    if (evStatus === AGENDA_STATUS.CANCELADO) continue;

    var evIsBloqueio = (evTipo === AGENDA_TIPO.BLOQUEIO);

    if (evIsBloqueio) {
      _agendaThrow_("CONFLICT", "Horário bloqueado no intervalo.", {
        conflitos: [{
          idAgenda: e.idAgenda,
          inicio: e.inicio,
          fim: e.fim,
          tipo: e.tipo,
          status: e.status
        }],
        intervalo: { inicio: inicio.toISOString(), fim: fim.toISOString() }
      });
    }

    if (isBloqueioNovo) {
      _agendaThrow_("CONFLICT", "Não é possível bloquear: existe agendamento no intervalo.", {
        conflitos: [{
          idAgenda: e.idAgenda,
          inicio: e.inicio,
          fim: e.fim,
          tipo: e.tipo,
          status: e.status
        }],
        intervalo: { inicio: inicio.toISOString(), fim: fim.toISOString() }
      });
    }

    if (cfgPermiteSobreposicao) continue;
    if (permitirEncaixe) continue;

    _agendaThrow_("CONFLICT", "Já existe agendamento no intervalo.", {
      conflitos: [{
        idAgenda: e.idAgenda,
        inicio: e.inicio,
        fim: e.fim,
        tipo: e.tipo,
        status: e.status
      }],
      intervalo: { inicio: inicio.toISOString(), fim: fim.toISOString() }
    });
  }

  return true;
}

function _agendaNormalizeCreateInput_(payload, params) {
  params = params || {};
  payload = payload || {};

  var idPaciente = payload.idPaciente ? String(payload.idPaciente) : (payload.ID_Paciente ? String(payload.ID_Paciente) : "");

  var titulo = payload.titulo || payload.motivo || "";
  var notas = payload.notas || "";
  var tipo = payload.tipo ? String(payload.tipo) : (payload.Bloqueio === true ? AGENDA_TIPO.BLOQUEIO : AGENDA_TIPO.CONSULTA);
  var origem = payload.origem ? String(payload.origem) : AGENDA_ORIGEM.RECEPCAO;

  var status = payload.status ? String(payload.status) : AGENDA_STATUS.MARCADO;
  status = _agendaNormalizeStatus_(status);

  var permitirEncaixe = payload.permitirEncaixe === true || payload.permite_encaixe === true;

  if (payload.inicio && payload.fim) {
    var ini = _agendaParseDateRequired_(payload.inicio, "inicio");
    var fim = _agendaParseDateRequired_(payload.fim, "fim");
    return {
      idPaciente: idPaciente,
      inicio: ini,
      fim: fim,
      titulo: String(titulo || ""),
      notas: String(notas || ""),
      tipo: _agendaNormalizeTipo_(tipo),
      status: status,
      origem: _agendaNormalizeOrigem_(origem),
      permitirEncaixe: permitirEncaixe
    };
  }

  var dataStr = payload.data ? String(payload.data) : null;
  var horaInicio = payload.hora_inicio ? String(payload.hora_inicio) : null;
  if (!dataStr) _agendaThrow_("VALIDATION_ERROR", 'Campo "data" é obrigatório.', { field: "data" });
  if (!horaInicio) _agendaThrow_("VALIDATION_ERROR", 'Campo "hora_inicio" é obrigatório.', { field: "hora_inicio" });

  var duracao = (payload.duracao_minutos !== undefined) ? Number(payload.duracao_minutos) : Number(params.duracaoPadraoMin || 30);
  if (isNaN(duracao) || duracao <= 0) duracao = Number(params.duracaoPadraoMin || 30);

  var ini2 = _agendaBuildDateTime_(dataStr, horaInicio);
  var fim2 = new Date(ini2.getTime() + duracao * 60000);

  return {
    idPaciente: idPaciente,
    inicio: ini2,
    fim: fim2,
    titulo: String(titulo || ""),
    notas: String(notas || ""),
    tipo: _agendaNormalizeTipo_(tipo),
    status: status,
    origem: _agendaNormalizeOrigem_(origem),
    permitirEncaixe: permitirEncaixe
  };
}

function _agendaBuildUpdatePatch_(existing, patch, topCompat, params) {
  patch = patch || {};
  topCompat = topCompat || {};
  params = params || {};

  var out = {};

  var fields = ["idPaciente", "titulo", "notas", "tipo", "status", "origem", "canceladoMotivo"];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (patch[f] !== undefined) out[f] = patch[f];
  }

  if (topCompat.ID_Paciente !== undefined) out.idPaciente = topCompat.ID_Paciente;

  if (out.tipo !== undefined) out.tipo = _agendaNormalizeTipo_(out.tipo);
  if (out.status !== undefined) out.status = _agendaNormalizeStatus_(out.status);
  if (out.origem !== undefined) out.origem = _agendaNormalizeOrigem_(out.origem);

  var hasNewDates = (patch.inicio !== undefined) || (patch.fim !== undefined);
  if (hasNewDates) {
    if (patch.inicio !== undefined) out.inicio = _agendaParseDateRequired_(patch.inicio, "inicio").toISOString();
    if (patch.fim !== undefined) out.fim = _agendaParseDateRequired_(patch.fim, "fim").toISOString();
  } else {
    var dataStr = (topCompat.data !== undefined) ? String(topCompat.data) : null;
    var horaInicio = (topCompat.hora_inicio !== undefined) ? String(topCompat.hora_inicio) : null;
    var duracao = (topCompat.duracao_minutos !== undefined) ? Number(topCompat.duracao_minutos) : null;

    if (dataStr || horaInicio || duracao !== null) {
      var exIni = _agendaParseDate_(existing.inicio);
      var exFim = _agendaParseDate_(existing.fim);

      var baseData = dataStr || (exIni ? _agendaFormatDate_(exIni) : null);
      var baseHora = horaInicio || (exIni ? _agendaFormatHHMM_(exIni) : null);

      if (!baseData || !baseHora) _agendaThrow_("VALIDATION_ERROR", "Não foi possível determinar data/hora para atualização legado.", {});

      var durMin;
      if (duracao !== null && !isNaN(duracao) && duracao > 0) durMin = duracao;
      else {
        if (exIni && exFim) durMin = Math.max(1, Math.round((exFim.getTime() - exIni.getTime()) / 60000));
        else durMin = Number(params.duracaoPadraoMin || 30);
      }

      var ini = _agendaBuildDateTime_(baseData, baseHora);
      var fim = new Date(ini.getTime() + durMin * 60000);

      out.inicio = ini.toISOString();
      out.fim = fim.toISOString();
    }
  }

  return out;
}

function _agendaNormalizeRowToDto_(rowObj) {
  rowObj = rowObj || {};
  return {
    idAgenda: rowObj.idAgenda || rowObj.ID_Agenda || "",
    idPaciente: rowObj.idPaciente || rowObj.ID_Paciente || "",
    inicio: rowObj.inicio || "",
    fim: rowObj.fim || "",
    titulo: rowObj.titulo || "",
    notas: rowObj.notas || "",
    tipo: rowObj.tipo || AGENDA_TIPO.CONSULTA,
    status: rowObj.status || AGENDA_STATUS.MARCADO,
    origem: rowObj.origem || AGENDA_ORIGEM.RECEPCAO,
    criadoEm: rowObj.criadoEm || "",
    atualizadoEm: rowObj.atualizadoEm || "",
    canceladoEm: rowObj.canceladoEm || "",
    canceladoMotivo: rowObj.canceladoMotivo || "",
    // ✅ garante que o campo exista (mesmo que vazio) para o front novo
    nomeCompleto: rowObj.nomeCompleto || ""
  };
}

// ============================================================
// Adapter usado pela validação de conflitos do front
// ============================================================

function Agenda_ListarEventosDiaParaValidacao_(dataStr) {
  dataStr = String(dataStr || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return [];

  var ini = new Date(Number(dataStr.slice(0, 4)), Number(dataStr.slice(5, 7)) - 1, Number(dataStr.slice(8, 10)), 0, 0, 0, 0);
  var fim = new Date(Number(dataStr.slice(0, 4)), Number(dataStr.slice(5, 7)) - 1, Number(dataStr.slice(8, 10)), 23, 59, 59, 999);

  var res = Agenda_Action_ListarPorPeriodo_(
    { action: "Agenda_ListarEventosDiaParaValidacao_", user: null, env: (typeof PRONTIO_ENV !== "undefined" ? PRONTIO_ENV : "DEV"), apiVersion: (typeof PRONTIO_API_VERSION !== "undefined" ? PRONTIO_API_VERSION : "1.0.0-DEV") },
    { inicio: ini, fim: fim, incluirCancelados: true }
  );

  var items = (res && res.items) ? res.items : [];
  var out = [];

  for (var i = 0; i < items.length; i++) {
    var dto = _agendaNormalizeRowToDto_(items[i]);
    var status = _agendaNormalizeStatus_(dto.status);
    if (status === AGENDA_STATUS.CANCELADO) continue;

    var dtIni = _agendaParseDate_(dto.inicio);
    var dtFim = _agendaParseDate_(dto.fim);
    if (!dtIni || !dtFim) continue;

    if (_agendaFormatDate_(dtIni) !== dataStr) continue;

    var dur = Math.max(1, Math.round((dtFim.getTime() - dtIni.getTime()) / 60000));
    var tipo = _agendaNormalizeTipo_(dto.tipo);

    out.push({
      ID_Agenda: String(dto.idAgenda || ""),
      data: dataStr,
      hora_inicio: _agendaFormatHHMM_(dtIni),
      hora_fim: _agendaFormatHHMM_(dtFim),
      duracao_minutos: dur,
      bloqueio: (tipo === AGENDA_TIPO.BLOQUEIO)
    });
  }

  return out;
}

// ============================================================
// LEGACY API (front atual)
// ============================================================

function Agenda_Legacy_ListarDia_(ctx, payload) {
  payload = payload || {};
  var dataStr = String(payload.data || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) _agendaThrow_("VALIDATION_ERROR", '"data" inválida (YYYY-MM-DD).', { field: "data" });

  var ini = new Date(Number(dataStr.slice(0, 4)), Number(dataStr.slice(5, 7)) - 1, Number(dataStr.slice(8, 10)), 0, 0, 0, 0);
  var fim = new Date(Number(dataStr.slice(0, 4)), Number(dataStr.slice(5, 7)) - 1, Number(dataStr.slice(8, 10)), 23, 59, 59, 999);

  var res = Agenda_Action_ListarPorPeriodo_(ctx, { inicio: ini, fim: fim, incluirCancelados: false });
  var items = (res && res.items) ? res.items : [];

  var ags = items.map(function (dto) { return _agendaLegacyDtoToFront_(dto); });

  var map = {};
  for (var i = 0; i < ags.length; i++) {
    var h = String(ags[i].hora_inicio || "");
    if (!map[h]) map[h] = [];
    map[h].push(ags[i]);
  }

  var horas = Object.keys(map).sort(function (a, b) { return a.localeCompare(b); });
  var horarios = horas.map(function (h) { return { hora: h, agendamentos: map[h] }; });

  return { resumo: _agendaLegacyBuildResumo_(ags), horarios: horarios };
}

function Agenda_Legacy_ListarSemana_(ctx, payload) {
  payload = payload || {};
  var refStr = String(payload.data_referencia || payload.data || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refStr)) _agendaThrow_("VALIDATION_ERROR", '"data_referencia" inválida (YYYY-MM-DD).', { field: "data_referencia" });

  var ref = new Date(Number(refStr.slice(0, 4)), Number(refStr.slice(5, 7)) - 1, Number(refStr.slice(8, 10)), 0, 0, 0, 0);
  var day = ref.getDay();
  var diffToMon = (day === 0) ? -6 : (1 - day);
  var mon = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMon, 0, 0, 0, 0);

  var dias = [];
  for (var d = 0; d < 7; d++) {
    var cur = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + d, 0, 0, 0, 0);
    var curEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);

    var r = Agenda_Action_ListarPorPeriodo_(ctx, { inicio: cur, fim: curEnd, incluirCancelados: false });
    var items = (r && r.items) ? r.items : [];
    var ags = items.map(function (dto) { return _agendaLegacyDtoToFront_(dto); });

    var map = {};
    for (var i = 0; i < ags.length; i++) {
      var h = String(ags[i].hora_inicio || "");
      if (!map[h]) map[h] = [];
      map[h].push(ags[i]);
    }

    var horas = Object.keys(map).sort(function (a, b) { return a.localeCompare(b); });
    var horarios = horas.map(function (h) { return { hora: h, agendamentos: map[h] }; });

    dias.push({ data: _agendaFormatDate_(cur), horarios: horarios });
  }

  return { dias: dias };
}

function Agenda_Legacy_Criar_(ctx, payload) {
  payload = payload || {};
  var packedNotas = _agendaLegacyPackNotas_(payload);

  var createPayload = {
    data: payload.data,
    hora_inicio: payload.hora_inicio,
    duracao_minutos: payload.duracao_minutos,
    ID_Paciente: payload.ID_Paciente || "",
    tipo: payload.tipo || "",
    motivo: payload.motivo || payload.titulo || "",
    origem: payload.origem || "",
    permite_encaixe: payload.permite_encaixe === true,
    notas: packedNotas,
    status: payload.status ? String(payload.status) : undefined
  };

  var r = Agenda_Action_Criar_(ctx, createPayload);
  var dto = r && r.item ? r.item : null;
  return { ok: true, item: dto ? _agendaLegacyDtoToFront_(dto) : null };
}

function Agenda_Legacy_Atualizar_(ctx, payload) {
  payload = payload || {};
  var idAgenda = String(payload.ID_Agenda || payload.idAgenda || "").trim();
  if (!idAgenda) _agendaThrow_("VALIDATION_ERROR", '"ID_Agenda" é obrigatório.', { field: "ID_Agenda" });

  var existing = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda);
  if (!existing) _agendaThrow_("NOT_FOUND", "Agendamento não encontrado.", { idAgenda: idAgenda });

  var packedNotas = _agendaLegacyMergeNotas_(existing.notas, payload);

  var updatePayload = {
    idAgenda: idAgenda,
    data: payload.data,
    hora_inicio: payload.hora_inicio,
    duracao_minutos: payload.duracao_minutos,
    ID_Paciente: (payload.ID_Paciente !== undefined) ? payload.ID_Paciente : undefined,
    tipo: payload.tipo,
    origem: payload.origem,
    titulo: payload.motivo || payload.titulo,
    notas: packedNotas,
    permitirEncaixe: payload.permite_encaixe === true
  };

  if (payload.status !== undefined) {
    updatePayload.patch = updatePayload.patch || {};
    updatePayload.patch.status = payload.status;
  }

  var r = Agenda_Action_Atualizar_(ctx, updatePayload);
  return { ok: true, item: r && r.item ? _agendaLegacyDtoToFront_(r.item) : null };
}

function Agenda_Legacy_BloquearHorario_(ctx, payload) {
  payload = payload || {};
  var dataStr = String(payload.data || "").trim();
  var horaStr = String(payload.hora_inicio || "").trim();
  var dur = Number(payload.duracao_minutos || 0);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) _agendaThrow_("VALIDATION_ERROR", '"data" inválida.', { field: "data" });
  if (!/^\d{2}:\d{2}$/.test(horaStr)) _agendaThrow_("VALIDATION_ERROR", '"hora_inicio" inválida.', { field: "hora_inicio" });
  if (!dur || isNaN(dur) || dur <= 0) _agendaThrow_("VALIDATION_ERROR", '"duracao_minutos" inválida.', { field: "duracao_minutos" });

  var createPayload = {
    data: dataStr,
    hora_inicio: horaStr,
    duracao_minutos: dur,
    tipo: "BLOQUEIO",
    motivo: "BLOQUEIO",
    origem: "SISTEMA",
    notas: _agendaLegacyPackNotas_({ bloqueio: true })
  };

  var r = Agenda_Action_Criar_(ctx, createPayload);
  return { ok: true, item: r && r.item ? _agendaLegacyDtoToFront_(r.item) : null };
}

function Agenda_Legacy_RemoverBloqueio_(ctx, payload) {
  payload = payload || {};
  var idAgenda = String(payload.ID_Agenda || "").trim();
  if (!idAgenda) _agendaThrow_("VALIDATION_ERROR", '"ID_Agenda" é obrigatório.', { field: "ID_Agenda" });

  Agenda_Action_Cancelar_(ctx, { idAgenda: idAgenda, motivo: "Remover bloqueio" });
  return { ok: true };
}

function Agenda_Legacy_MudarStatus_(ctx, payload) {
  payload = payload || {};
  var idAgenda = String(payload.ID_Agenda || "").trim();
  var novo = String(payload.novo_status || "").trim();

  if (!idAgenda) _agendaThrow_("VALIDATION_ERROR", '"ID_Agenda" é obrigatório.', { field: "ID_Agenda" });
  if (!novo) _agendaThrow_("VALIDATION_ERROR", '"novo_status" é obrigatório.', { field: "novo_status" });

  var existing = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda);
  if (!existing) _agendaThrow_("NOT_FOUND", "Agendamento não encontrado.", { idAgenda: idAgenda });

  var core = _agendaLegacyMapUiStatusToCore_(novo);
  var packedNotas = _agendaLegacyMergeNotas_(existing.notas, { status_label: novo });

  if (core === AGENDA_STATUS.CANCELADO) {
    Agenda_Action_Cancelar_(ctx, { idAgenda: idAgenda, motivo: "Cancelado pela Agenda" });
    return { ok: true };
  }

  var upd = { idAgenda: idAgenda, patch: { status: core, notas: packedNotas } };
  Agenda_Action_Atualizar_(ctx, upd);
  return { ok: true };
}

function Agenda_Legacy_ValidarConflito_(ctx, payload) {
  payload = payload || {};
  var dataStr = String(payload.data || "").trim();
  var horaStr = String(payload.hora_inicio || "").trim();
  var dur = Number(payload.duracao_minutos || 0);
  var ignoreId = String(payload.ignoreIdAgenda || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) _agendaThrow_("VALIDATION_ERROR", '"data" inválida.', { field: "data" });
  if (!/^\d{2}:\d{2}$/.test(horaStr)) _agendaThrow_("VALIDATION_ERROR", '"hora_inicio" inválida.', { field: "hora_inicio" });
  if (!dur || isNaN(dur) || dur <= 0) _agendaThrow_("VALIDATION_ERROR", '"duracao_minutos" inválida.', { field: "duracao_minutos" });

  var params = (typeof Config_getAgendaParams_ === "function") ? Config_getAgendaParams_() : {
    duracaoPadraoMin: 30,
    slotMin: 10,
    permiteSobreposicao: false
  };

  var ini = _agendaBuildDateTime_(dataStr, horaStr);
  var fim = new Date(ini.getTime() + dur * 60000);

  var permitirEncaixe = payload.permite_encaixe === true || payload.permitirEncaixe === true;

  try {
    _agendaAssertSemConflitos_(ctx, {
      inicio: ini,
      fim: fim,
      permitirEncaixe: permitirEncaixe,
      modoBloqueio: false,
      ignoreIdAgenda: ignoreId || null
    }, params);

    return { ok: true, conflitos: [], intervalo: { data: dataStr, hora_inicio: horaStr, duracao_minutos: dur } };

  } catch (err) {
    var conflitos = [];
    try {
      var det = err && err.details ? err.details : null;
      var arr = det && det.conflitos ? det.conflitos : null;

      if (arr && arr.length) {
        for (var i = 0; i < arr.length; i++) {
          var c = arr[i];
          var ci = _agendaParseDate_(c.inicio);
          var cf = _agendaParseDate_(c.fim);
          conflitos.push({
            ID_Agenda: c.idAgenda || "",
            bloqueio: String(c.tipo || "").toUpperCase().indexOf("BLOQ") >= 0,
            hora_inicio: ci ? _agendaFormatHHMM_(ci) : "",
            hora_fim: cf ? _agendaFormatHHMM_(cf) : ""
          });
        }
      }
    } catch (_) {}

    return {
      ok: false,
      erro: (err && err.message) ? String(err.message) : "Conflito de horário.",
      conflitos: conflitos,
      intervalo: { data: dataStr, hora_inicio: horaStr, duracao_minutos: dur },
      code: (err && err.code) ? String(err.code) : "CONFLICT"
    };
  }
}

// ============================================================
// Helpers LEGACY internos
// ============================================================

function _agendaLegacyPackNotas_(payload) {
  payload = payload || {};
  var obj = {
    __legacy: true,
    motivo: payload.motivo || payload.titulo || "",
    canal: payload.canal || "",
    // ✅ REMOVIDO: nome_paciente
    documento_paciente: payload.documento_paciente || "",
    telefone_paciente: payload.telefone_paciente || "",
    data_nascimento: payload.data_nascimento || "",
    permite_encaixe: payload.permite_encaixe === true,
    status_label: payload.status_label || "",
    tipo_ui: payload.tipo || ""
  };

  if (payload.bloqueio === true) obj.bloqueio = true;

  try { return JSON.stringify(obj); } catch (e) { return ""; }
}

function _agendaLegacyTryParseNotas_(notas) {
  var s = String(notas || "").trim();
  if (!s) return {};
  if (s[0] !== "{") return {};
  try {
    var obj = JSON.parse(s);
    if (obj && typeof obj === "object") return obj;
  } catch (_) {}
  return {};
}

function _agendaLegacyMergeNotas_(existingNotas, payload) {
  var base = _agendaLegacyTryParseNotas_(existingNotas);
  if (!base || typeof base !== "object") base = {};
  base.__legacy = true;

  payload = payload || {};

  if (payload.motivo !== undefined) base.motivo = String(payload.motivo || "");
  if (payload.canal !== undefined) base.canal = String(payload.canal || "");
  // ✅ REMOVIDO: nome_paciente
  if (payload.documento_paciente !== undefined) base.documento_paciente = String(payload.documento_paciente || "");
  if (payload.telefone_paciente !== undefined) base.telefone_paciente = String(payload.telefone_paciente || "");
  if (payload.data_nascimento !== undefined) base.data_nascimento = String(payload.data_nascimento || "");
  if (payload.permite_encaixe !== undefined) base.permite_encaixe = payload.permite_encaixe === true;
  if (payload.status_label !== undefined) base.status_label = String(payload.status_label || "");
  if (payload.tipo !== undefined) base.tipo_ui = String(payload.tipo || "");
  if (payload.bloqueio === true) base.bloqueio = true;

  try { return JSON.stringify(base); } catch (e) { return String(existingNotas || ""); }
}

function _agendaLegacyMapUiStatusToCore_(label) {
  var s = String(label || "").trim().toLowerCase();

  if (s.indexOf("cancel") >= 0) return AGENDA_STATUS.CANCELADO;
  if (s.indexOf("remarc") >= 0) return AGENDA_STATUS.REMARCADO;
  if (s.indexOf("falt") >= 0) return AGENDA_STATUS.FALTOU;
  if (s.indexOf("confirm") >= 0) return AGENDA_STATUS.CONFIRMADO;
  if (s.indexOf("aguard") >= 0 || s.indexOf("cheg") >= 0) return AGENDA_STATUS.AGUARDANDO;
  if (s.indexOf("em atend") >= 0 || s.indexOf("em_atend") >= 0) return AGENDA_STATUS.EM_ATENDIMENTO;
  if (s.indexOf("atendid") >= 0 || s.indexOf("concl") >= 0) return AGENDA_STATUS.ATENDIDO;

  return AGENDA_STATUS.MARCADO;
}

function _agendaNormalizeStatus_(status) {
  var s = String(status || "").trim().toUpperCase();
  if (!s) return AGENDA_STATUS.MARCADO;

  if (s === "AGENDADO") return AGENDA_STATUS.MARCADO;
  if (s === "CHEGOU") return AGENDA_STATUS.AGUARDANDO;
  if (s === "CHAMADO") return AGENDA_STATUS.AGUARDANDO;
  if (s === "CONCLUIDO") return AGENDA_STATUS.ATENDIDO;

  if (s === "EM ATENDIMENTO" || s === "EM-ATENDIMENTO") s = "EM_ATENDIMENTO";

  if (s.indexOf("REMARC") >= 0) return AGENDA_STATUS.REMARCADO;
  if (s.indexOf("CANCEL") >= 0) return AGENDA_STATUS.CANCELADO;
  if (s.indexOf("FALT") >= 0) return AGENDA_STATUS.FALTOU;

  if (s.indexOf("ATENDID") >= 0) return AGENDA_STATUS.ATENDIDO;
  if (s.indexOf("EM_ATEND") >= 0) return AGENDA_STATUS.EM_ATENDIMENTO;

  if (s.indexOf("AGUARD") >= 0) return AGENDA_STATUS.AGUARDANDO;
  if (s.indexOf("CONFIRM") >= 0) return AGENDA_STATUS.CONFIRMADO;
  if (s.indexOf("MARC") >= 0) return AGENDA_STATUS.MARCADO;

  return AGENDA_STATUS.MARCADO;
}

// ============================================================
// Utils
// ============================================================

function _agendaNormalizeTipo_(tipo) {
  var t = String(tipo || "").trim().toUpperCase();
  if (!t) return AGENDA_TIPO.CONSULTA;

  if (t.indexOf("BLOQ") >= 0) return AGENDA_TIPO.BLOQUEIO;
  if (t.indexOf("RET") >= 0) return AGENDA_TIPO.RETORNO;
  if (t.indexOf("PROC") >= 0) return AGENDA_TIPO.PROCEDIMENTO;
  if (t.indexOf("CONS") >= 0) return AGENDA_TIPO.CONSULTA;

  if (t === AGENDA_TIPO.CONSULTA || t === AGENDA_TIPO.RETORNO || t === AGENDA_TIPO.PROCEDIMENTO || t === AGENDA_TIPO.BLOQUEIO || t === AGENDA_TIPO.OUTRO) return t;
  return AGENDA_TIPO.OUTRO;
}

function _agendaNormalizeOrigem_(origem) {
  var o = String(origem || "").trim().toUpperCase();
  if (!o) return AGENDA_ORIGEM.RECEPCAO;
  if (o.indexOf("RECEP") >= 0) return AGENDA_ORIGEM.RECEPCAO;
  if (o.indexOf("MED") >= 0) return AGENDA_ORIGEM.MEDICO;
  if (o.indexOf("SIS") >= 0) return AGENDA_ORIGEM.SISTEMA;
  if (o === AGENDA_ORIGEM.RECEPCAO || o === AGENDA_ORIGEM.MEDICO || o === AGENDA_ORIGEM.SISTEMA) return o;
  return AGENDA_ORIGEM.RECEPCAO;
}

function _agendaParseDateRequired_(v, fieldName) {
  var d = _agendaParseDate_(v);
  if (!d) _agendaThrow_("VALIDATION_ERROR", "Data inválida: " + String(fieldName || ""), { field: fieldName, value: v });
  return d;
}

function _agendaParseDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  if (typeof v === "number") {
    var dNum = new Date(v);
    return isNaN(dNum.getTime()) ? null : dNum;
  }

  if (typeof v === "string") {
    var dStr = new Date(v);
    if (!isNaN(dStr.getTime())) return dStr;

    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      var parts = v.split("-");
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  return null;
}

function _agendaBuildDateTime_(dateStr, hhmm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) {
    _agendaThrow_("VALIDATION_ERROR", "data inválida (esperado YYYY-MM-DD).", { value: dateStr });
  }
  if (!/^\d{2}:\d{2}$/.test(String(hhmm || ""))) {
    _agendaThrow_("VALIDATION_ERROR", "hora_inicio inválida (esperado HH:MM).", { value: hhmm });
  }

  var p = String(dateStr).split("-");
  var y = Number(p[0]);
  var m = Number(p[1]) - 1;
  var d = Number(p[2]);

  var t = String(hhmm).split(":");
  var H = Number(t[0]);
  var M = Number(t[1]);

  var dt = new Date(y, m, d, H, M, 0, 0);
  if (isNaN(dt.getTime())) _agendaThrow_("VALIDATION_ERROR", "data/hora inválida.", { dateStr: dateStr, hhmm: hhmm });
  return dt;
}

function _agendaFormatDate_(d) {
  var y = d.getFullYear();
  var m = ("0" + (d.getMonth() + 1)).slice(-2);
  var dd = ("0" + d.getDate()).slice(-2);
  return y + "-" + m + "-" + dd;
}

function _agendaFormatHHMM_(d) {
  var h = ("0" + d.getHours()).slice(-2);
  var m = ("0" + d.getMinutes()).slice(-2);
  return h + ":" + m;
}

function _agendaThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
}

// ============================================================
// ✅ IMPLEMENTAÇÃO (LEGACY): _agendaLegacyDtoToFront_ (SEM nome_paciente)
// ============================================================

function _agendaLegacyDtoToFront_(dto) {
  dto = _agendaNormalizeRowToDto_(dto || {});

  var tipo = _agendaNormalizeTipo_(dto.tipo);
  var status = _agendaNormalizeStatus_(dto.status);
  var origem = _agendaNormalizeOrigem_(dto.origem);

  var dtIni = _agendaParseDate_(dto.inicio);
  var dtFim = _agendaParseDate_(dto.fim);

  var dataStr = dtIni ? _agendaFormatDate_(dtIni) : "";
  var hIni = dtIni ? _agendaFormatHHMM_(dtIni) : "";
  var hFim = dtFim ? _agendaFormatHHMM_(dtFim) : "";
  var durMin = 0;
  if (dtIni && dtFim) durMin = Math.max(1, Math.round((dtFim.getTime() - dtIni.getTime()) / 60000));

  var notasObj = _agendaLegacyTryParseNotas_(dto.notas);

  var telefonePaciente = String((notasObj && notasObj.telefone_paciente) ? notasObj.telefone_paciente : "").trim();
  var documentoPaciente = String((notasObj && notasObj.documento_paciente) ? notasObj.documento_paciente : "").trim();
  var motivo = String((notasObj && notasObj.motivo) ? notasObj.motivo : (dto.titulo || "")).trim();
  var canal = String((notasObj && notasObj.canal) ? notasObj.canal : "").trim();

  var isBloqueio = (tipo === AGENDA_TIPO.BLOQUEIO) || (notasObj && notasObj.bloqueio === true);
  var permiteEncaixe = (notasObj && notasObj.permite_encaixe === true);

  // ✅ Nome oficial: sempre vem de Pacientes.nomeCompleto (via idPaciente)
  var nomeCompleto = "";
  if (isBloqueio) {
    nomeCompleto = "Bloqueio";
  } else {
    var p = _agendaTryGetPacienteById_(dto.idPaciente);
    nomeCompleto = _agendaGetNomeCompletoOficial_(p);
    if (!nomeCompleto) nomeCompleto = "(sem nome)";
  }

  return {
    ID_Agenda: String(dto.idAgenda || ""),
    ID_Paciente: String(dto.idPaciente || ""),
    data: dataStr,
    hora_inicio: hIni,
    hora_fim: hFim,
    duracao_minutos: durMin,
    nomeCompleto: nomeCompleto,
    telefone_paciente: telefonePaciente,
    documento_paciente: documentoPaciente,
    motivo: motivo,
    canal: canal,
    origem: String(origem || ""),
    status: String(status || ""),
    tipo: String(tipo || ""),
    bloqueio: isBloqueio,
    permite_encaixe: permiteEncaixe
  };
}

// ============================================================
// ✅ IMPLEMENTAÇÃO FALTANTE (LEGACY): _agendaLegacyBuildResumo_
// ============================================================

function _agendaLegacyBuildResumo_(ags) {
  var resumo = {
    total: 0,
    confirmados: 0,
    faltas: 0,
    cancelados: 0,
    concluidos: 0,
    em_atendimento: 0
  };

  var list = Array.isArray(ags) ? ags : [];
  for (var i = 0; i < list.length; i++) {
    var ag = list[i];
    if (!ag) continue;
    if (ag.bloqueio === true) continue;

    resumo.total++;

    var st = String(ag.status || "").toUpperCase();

    if (st.indexOf("CANCEL") >= 0) { resumo.cancelados++; continue; }
    if (st.indexOf("FALT") >= 0) { resumo.faltas++; continue; }
    if (st.indexOf("EM_ATEND") >= 0) { resumo.em_atendimento++; continue; }
    if (st.indexOf("CONCL") >= 0 || st.indexOf("ATENDID") >= 0) { resumo.concluidos++; continue; }
    if (st.indexOf("CONFIRM") >= 0 || st.indexOf("AGUARD") >= 0) { resumo.confirmados++; continue; }
  }

  return resumo;
}
