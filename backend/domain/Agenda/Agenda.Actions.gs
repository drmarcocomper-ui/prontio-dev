function Agenda_Action_ListarPorPeriodo_(ctx, payload) {
  payload = payload || {};

  var ini = _agendaParseDateRequired_(payload.inicio, "inicio");
  var fim = _agendaParseDateRequired_(payload.fim, "fim");

  if (fim.getTime() < ini.getTime()) {
    _agendaThrow_("VALIDATION_ERROR", '"fim" não pode ser menor que "inicio".', {});
  }

  var incluirCancelados = payload.incluirCancelados === true;
  var idPaciente = payload.idPaciente ? String(payload.idPaciente) : null;

  // Opcional: permitir filtro por profissional também (útil com "conflito por profissional")
  var idProfissional = payload.idProfissional ? String(payload.idProfissional) : null;

  var all = Repo_list_(AGENDA_ENTITY);
  var out = [];

  for (var i = 0; i < all.length; i++) {
    var e = _agendaNormalizeRowToDto_(all[i]);

    e.tipo = _agendaNormalizeTipo_(e.tipo);
    e.status = _agendaNormalizeStatus_(e.status);
    e.origem = _agendaNormalizeOrigem_(e.origem);

    if (!incluirCancelados && e.status === AGENDA_STATUS.CANCELADO) continue;
    if (idPaciente && String(e.idPaciente || "") !== idPaciente) continue;
    if (idProfissional && String(e.idProfissional || "") !== idProfissional) continue;

    var evIni = _agendaParseDate_(e.inicio);
    var evFim = _agendaParseDate_(e.fim);
    if (!evIni || !evFim) continue;

    if (evIni.getTime() > fim.getTime() || evFim.getTime() < ini.getTime()) continue;

    out.push(_agendaAttachNomeCompleto_(e));
  }

  out.sort(function (a, b) {
    return _agendaParseDate_(a.inicio).getTime() - _agendaParseDate_(b.inicio).getTime();
  });

  return {
    success: true,
    data: { items: out, count: out.length },
    errors: []
  };
}

function Agenda_Action_Criar_(ctx, payload) {
  payload = payload || {};
  var params = Config_getAgendaParams_();

  var idProfissional = payload.idProfissional ? String(payload.idProfissional) : "";
  if (!idProfissional) {
    _agendaThrow_("VALIDATION_ERROR", '"idProfissional" é obrigatório.', { field: "idProfissional" });
  }

  var norm = _agendaNormalizeCreateInput_(payload, params);

  // garante presença no DTO final (mesmo se normalize não mexer nisso)
  norm.idProfissional = idProfissional;

  if (norm.tipo === AGENDA_TIPO.BLOQUEIO) {
    norm.idPaciente = "";
    norm.status = AGENDA_STATUS.MARCADO;
  }

  var lockKey = "agenda:" + idProfissional + ":" + _agendaFormatYYYYMMDD_(norm.inicio);

  var createdDto = null;

  Locks_withLock_(lockKey, function () {

    _agendaAssertSemConflitos_(ctx, {
      inicio: norm.inicio,
      fim: norm.fim,
      idProfissional: idProfissional,
      permitirEncaixe: norm.permitirEncaixe === true,
      modoBloqueio: norm.tipo === AGENDA_TIPO.BLOQUEIO,
      ignoreIdAgenda: null
    }, params);

    var idAgenda = Ids_nextId_("AGENDA");
    var now = new Date().toISOString();

    var dto = {
      idAgenda: idAgenda,
      idProfissional: idProfissional,
      idPaciente: norm.idPaciente || "",
      inicio: norm.inicio.toISOString(),
      fim: norm.fim.toISOString(),
      titulo: norm.titulo || "",
      notas: norm.notas || "",
      tipo: norm.tipo,
      status: norm.status,
      origem: norm.origem,
      criadoEm: now,
      atualizadoEm: now,
      canceladoEm: "",
      canceladoMotivo: ""
    };

    Repo_insert_(AGENDA_ENTITY, dto);
    createdDto = dto;
  });

  return {
    success: true,
    data: { item: _agendaAttachNomeCompleto_(createdDto) },
    errors: []
  };
}

function Agenda_Action_Atualizar_(ctx, payload) {
  payload = payload || {};
  var idAgenda = String(payload.idAgenda || "");
  if (!idAgenda) _agendaThrow_("VALIDATION_ERROR", '"idAgenda" é obrigatório.', { field: "idAgenda" });

  var params = Config_getAgendaParams_();

  var existing = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda);
  if (!existing) _agendaThrow_("NOT_FOUND", "Agendamento não encontrado.", { idAgenda: idAgenda });

  existing = _agendaNormalizeRowToDto_(existing);

  // idProfissional é essencial para conflito por profissional.
  // Preferência: usar o do registro existente; permitir patch se você suportar troca (geralmente não).
  var idProfissional = String(existing.idProfissional || "");
  if (!idProfissional) {
    // fallback: aceitar do payload para registros legados sem idProfissional preenchido
    idProfissional = payload.idProfissional ? String(payload.idProfissional) : "";
  }
  if (!idProfissional) {
    _agendaThrow_("VALIDATION_ERROR", '"idProfissional" é obrigatório.', { field: "idProfissional" });
  }

  var patchIn = (payload.patch && typeof payload.patch === "object") ? payload.patch : {};
  var mergedPatch = _agendaBuildUpdatePatch_(existing, patchIn, payload, params);

  var newInicio = (mergedPatch.inicio !== undefined)
    ? _agendaParseDate_(mergedPatch.inicio)
    : _agendaParseDate_(existing.inicio);

  var newFim = (mergedPatch.fim !== undefined)
    ? _agendaParseDate_(mergedPatch.fim)
    : _agendaParseDate_(existing.fim);

  if (!newInicio || !newFim) _agendaThrow_("VALIDATION_ERROR", "Datas inválidas em atualização.", { idAgenda: idAgenda });
  if (newFim.getTime() < newInicio.getTime()) _agendaThrow_("VALIDATION_ERROR", '"fim" não pode ser menor que "inicio".', {});

  // lock por profissional + data do novo início
  var lockKey = "agenda:" + idProfissional + ":" + _agendaFormatYYYYMMDD_(newInicio);

  Locks_withLock_(lockKey, function () {

    _agendaAssertSemConflitos_(ctx, {
      inicio: newInicio,
      fim: newFim,
      idProfissional: idProfissional,
      permitirEncaixe: payload.permitirEncaixe === true,
      modoBloqueio: mergedPatch.tipo === AGENDA_TIPO.BLOQUEIO,
      ignoreIdAgenda: idAgenda
    }, params);

    mergedPatch.atualizadoEm = new Date().toISOString();

    // garante não perder idProfissional em registros legados
    if (!existing.idProfissional && mergedPatch.idProfissional === undefined) {
      mergedPatch.idProfissional = idProfissional;
    }

    var ok = Repo_update_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda, mergedPatch);
    if (!ok) _agendaThrow_("NOT_FOUND", "Agendamento não encontrado para atualizar.", { idAgenda: idAgenda });
  });

  var after = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda);

  return {
    success: true,
    data: { item: _agendaAttachNomeCompleto_(after) },
    errors: []
  };
}

function Agenda_Action_Cancelar_(ctx, payload) {
  payload = payload || {};
  var idAgenda = String(payload.idAgenda || "");
  if (!idAgenda) _agendaThrow_("VALIDATION_ERROR", '"idAgenda" é obrigatório.', { field: "idAgenda" });

  var existing = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda);
  if (!existing) _agendaThrow_("NOT_FOUND", "Agendamento não encontrado.", { idAgenda: idAgenda });

  existing = _agendaNormalizeRowToDto_(existing);

  var idProfissional = String(existing.idProfissional || "");
  if (!idProfissional) {
    idProfissional = payload.idProfissional ? String(payload.idProfissional) : "";
  }
  if (!idProfissional) {
    _agendaThrow_("VALIDATION_ERROR", '"idProfissional" é obrigatório.', { field: "idProfissional" });
  }

  var dtIni = _agendaParseDate_(existing.inicio);
  if (!dtIni) _agendaThrow_("VALIDATION_ERROR", "Agendamento com início inválido.", { idAgenda: idAgenda });

  var lockKey = "agenda:" + idProfissional + ":" + _agendaFormatYYYYMMDD_(dtIni);

  Locks_withLock_(lockKey, function () {
    var nowIso = new Date().toISOString();
    var ok = Repo_update_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda, {
      status: AGENDA_STATUS.CANCELADO,
      canceladoEm: nowIso,
      canceladoMotivo: payload.motivo ? String(payload.motivo).slice(0, 500) : "",
      atualizadoEm: nowIso
    });
    if (!ok) _agendaThrow_("NOT_FOUND", "Agendamento não encontrado para cancelar.", { idAgenda: idAgenda });
  });

  var after = Repo_getById_(AGENDA_ENTITY, AGENDA_ID_FIELD, idAgenda);

  return {
    success: true,
    data: { item: _agendaAttachNomeCompleto_(after) },
    errors: []
  };
}

function Agenda_Action_ValidarConflito_(ctx, payload) {
  payload = payload || {};

  var idProfissional = payload.idProfissional ? String(payload.idProfissional) : "";
  if (!idProfissional) {
    _agendaThrow_("VALIDATION_ERROR", '"idProfissional" é obrigatório.', { field: "idProfissional" });
  }

  var ini = _agendaBuildDateTime_(payload.data, payload.horaInicio);
  var dur = Number(payload.duracaoMin || 0);
  if (!dur || isNaN(dur) || dur <= 0) {
    _agendaThrow_("VALIDATION_ERROR", '"duracaoMin" inválida.', { field: "duracaoMin" });
  }

  var fim = new Date(ini.getTime() + dur * 60000);

  try {
    _agendaAssertSemConflitos_(ctx, {
      inicio: ini,
      fim: fim,
      idProfissional: idProfissional,
      permitirEncaixe: payload.permitirEncaixe === true,
      modoBloqueio: false,
      ignoreIdAgenda: payload.ignoreIdAgenda || null
    }, Config_getAgendaParams_());

    return {
      success: true,
      data: {
        ok: true,
        conflitos: [],
        intervalo: {
          idProfissional: idProfissional,
          data: payload.data,
          horaInicio: payload.horaInicio,
          duracaoMin: dur
        }
      },
      errors: []
    };

  } catch (err) {
    return {
      success: false,
      data: {
        ok: false,
        intervalo: {
          idProfissional: idProfissional,
          data: payload.data,
          horaInicio: payload.horaInicio,
          duracaoMin: dur
        }
      },
      errors: [{
        code: err.code || "CONFLICT",
        message: err.message || "Conflito de horário",
        details: err.details || {}
      }]
    };
  }
}
