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
// ✅ IMPLEMENTAÇÃO (LEGACY): _agendaLegacyBuildResumo_
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

/**
 * Adapter usado pela validação de conflitos do front
 * (você mencionou na primeira parte; mantido aqui porque é LEGACY/de apoio ao front antigo)
 */
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
