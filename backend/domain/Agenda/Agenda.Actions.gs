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
