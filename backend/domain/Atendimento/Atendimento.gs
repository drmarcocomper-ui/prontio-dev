/**
 * ============================================================
 * PRONTIO - Atendimento.gs
 * ============================================================
 * Domínio: Atendimento = fluxo operacional do dia (fila, chegada, chamado, início, conclusão).
 * NÃO substitui Agenda.gs (calendário/compromissos).
 *
 * IMPORTANTE:
 * - NÃO usa SpreadsheetApp (Sheets só via Repository).
 * - IDs: Ids_nextId_("ATENDIMENTO")
 * - Locks: aplicados no Api.gs via entry.requiresLock
 *
 * Entidade (backend-only):
 * - entity: "Atendimento"
 * - idField: "idAtendimento"
 *
 * Actions:
 * - Atendimento.SyncHoje
 * - Atendimento.ListarFilaHoje
 * - Atendimento.MarcarChegada
 * - Atendimento.ChamarProximo   (Opção A: NÃO muda status)
 * - Atendimento.Iniciar
 * - Atendimento.Concluir        (vira ATENDIDO)
 * - Atendimento.Cancelar
 *
 * ✅ NOVO:
 * - Atendimento.SyncAPartirDeHoje
 * - Atendimento.ListarFilaAPartirDeHoje
 */

var ATENDIMENTO_ENTITY = "Atendimento";
var ATENDIMENTO_ID_FIELD = "idAtendimento";

var AGENDA_SHEET_NAME = "Agenda";

var PACIENTES_ENTITY = "Pacientes";
var PACIENTES_ID_FIELD = "idPaciente";

var ATENDIMENTO_STATUS = {
  MARCADO: "MARCADO",
  CONFIRMADO: "CONFIRMADO",
  AGUARDANDO: "AGUARDANDO",
  EM_ATENDIMENTO: "EM_ATENDIMENTO",
  ATENDIDO: "ATENDIDO",
  FALTOU: "FALTOU",
  CANCELADO: "CANCELADO",
  REMARCADO: "REMARCADO"
};

/**
 * ============================================================
 * Atendimento.SyncHoje
 * ============================================================
 */
function Atendimento_Action_SyncHoje_(ctx, payload) {
  payload = payload || {};

  var dataRef = _atdNormalizeDateRef_(payload.dataRef);
  var incluirBloqueios = payload.incluirBloqueios === true;
  var incluirCancelados = payload.incluirCancelados === true;
  var resetOrdem = payload.resetOrdem === true;

  var dayStart = _atdBuildDayStart_(dataRef);
  var dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  var agendaAll = Repo_list_(AGENDA_SHEET_NAME) || [];
  var agendaDia = [];

  for (var i = 0; i < agendaAll.length; i++) {
    var e = agendaAll[i] || {};
    var idAgenda = e.idAgenda || e.ID_Agenda || "";
    if (!idAgenda) continue;

    var status = String(e.status || "").toUpperCase();
    var tipo = String(e.tipo || "").toUpperCase();

    if (!incluirCancelados && status === "CANCELADO") continue;
    if (!incluirBloqueios && (tipo === "BLOQUEIO")) continue;

    var ini = _atdParseDate_(e.inicio);
    var fim = _atdParseDate_(e.fim);
    if (!ini || !fim) continue;

    var overlaps = (ini.getTime() <= dayEnd.getTime()) && (fim.getTime() >= dayStart.getTime());
    if (!overlaps) continue;

    agendaDia.push({
      idAgenda: String(idAgenda),
      idProfissional: String(e.idProfissional || e.ID_Profissional || ""),
      idPaciente: String(e.idPaciente || e.ID_Paciente || ""),
      inicio: ini,
      fim: fim,
      tipo: String(e.tipo || ""),
      status: String(e.status || "")
    });
  }

  agendaDia.sort(function (a, b) { return a.inicio.getTime() - b.inicio.getTime(); });

  var existingAll = Repo_list_(ATENDIMENTO_ENTITY) || [];
  var existingByAgenda = {};
  for (var j = 0; j < existingAll.length; j++) {
    var a0 = _atdNormalizeRowToDto_(existingAll[j]);
    if (!a0.ativo) continue;
    if (String(a0.dataRef || "") !== dataRef) continue;
    if (a0.idAgenda) existingByAgenda[String(a0.idAgenda)] = a0;
  }

  var created = 0;
  var updated = 0;
  var skipped = 0;

  var nowIso = new Date().toISOString();

  for (var k = 0; k < agendaDia.length; k++) {
    var ag = agendaDia[k];
    var ordemCalc = k + 1;

    var exists = existingByAgenda[ag.idAgenda];

    if (!exists) {
      var dto = _atdBuildNew_(
        {
          idAgenda: ag.idAgenda,
          idProfissional: ag.idProfissional,
          idPaciente: ag.idPaciente,
          dataRef: dataRef,
          ordem: ordemCalc,
          observacoes: "",
          sala: ""
        },
        {
          idAgenda: ag.idAgenda,
          idProfissional: ag.idProfissional,
          idPaciente: ag.idPaciente,
          dataRef: dataRef,
          status: ATENDIMENTO_STATUS.AGUARDANDO
        }
      );

      dto.criadoEm = nowIso;
      dto.atualizadoEm = nowIso;

      Repo_insert_(ATENDIMENTO_ENTITY, dto);
      created++;
      continue;
    }

    var patch = {};
    var needUpdate = false;

    if (!exists.idPaciente && ag.idPaciente) {
      patch.idPaciente = ag.idPaciente;
      needUpdate = true;
    }

    if (resetOrdem) {
      var st = _atdNormalizeStatus_(exists.status);
      if (
        st !== ATENDIMENTO_STATUS.EM_ATENDIMENTO &&
        st !== ATENDIMENTO_STATUS.ATENDIDO &&
        st !== ATENDIMENTO_STATUS.CANCELADO &&
        st !== ATENDIMENTO_STATUS.FALTOU &&
        st !== ATENDIMENTO_STATUS.REMARCADO
      ) {
        patch.ordem = ordemCalc;
        needUpdate = true;
      }
    }

    if (needUpdate) {
      patch.atualizadoEm = nowIso;
      Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, exists.idAtendimento, patch);
      updated++;
    } else {
      skipped++;
    }
  }

  return { dataRef: dataRef, created: created, updated: updated, skipped: skipped, totalAgendaDia: agendaDia.length };
}

/**
 * Atendimento.ListarFilaHoje
 */
function Atendimento_Action_ListarFilaHoje_(ctx, payload) {
  payload = payload || {};
  var dataRef = _atdNormalizeDateRef_(payload.dataRef);
  return Atendimento_Action_ListarFilaAPartirDeHoje_(ctx, {
    dias: 1,
    dataRefInicio: dataRef,
    incluirConcluidos: payload.incluirConcluidos === true,
    incluirCancelados: payload.incluirCancelados === true
  });
}

/**
 * Atendimento.MarcarChegada
 */
function Atendimento_Action_MarcarChegada_(ctx, payload) {
  payload = payload || {};
  var idAgenda = payload.idAgenda ? String(payload.idAgenda) : "";
  if (!idAgenda) _atdThrow_("VALIDATION_ERROR", '"idAgenda" é obrigatório.', { field: "idAgenda" });

  var dataRef = _atdNormalizeDateRef_(payload.dataRef);
  var nowIso = new Date().toISOString();

  var existing = _atdFindByAgendaAndDate_(idAgenda, dataRef);
  if (!existing) {
    var dto = _atdBuildNew_(payload, {
      idAgenda: idAgenda,
      dataRef: dataRef,
      status: ATENDIMENTO_STATUS.AGUARDANDO,
      chegadaEm: nowIso
    });
    Repo_insert_(ATENDIMENTO_ENTITY, dto);
    return { item: dto };
  }

  var st = _atdNormalizeStatus_(existing.status);
  var patch = { status: st, atualizadoEm: nowIso };

  if (!existing.chegadaEm) patch.chegadaEm = nowIso;
  if (payload.sala !== undefined) patch.sala = String(payload.sala || "");
  if (payload.observacoes !== undefined) patch.observacoes = String(payload.observacoes || "");
  if (payload.ordem !== undefined) patch.ordem = _atdNormalizeNumberOrBlank_(payload.ordem);

  Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, existing.idAtendimento, patch);
  var after = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, existing.idAtendimento);
  return { item: _atdNormalizeRowToDto_(after) };
}

/**
 * Atendimento.ChamarProximo (Opção A: não muda status)
 */
function Atendimento_Action_ChamarProximo_(ctx, payload) {
  payload = payload || {};
  var dataRef = _atdNormalizeDateRef_(payload.dataRef);
  var nowIso = new Date().toISOString();

  var all = Repo_list_(ATENDIMENTO_ENTITY) || [];
  var candidates = [];

  for (var i = 0; i < all.length; i++) {
    var a = _atdNormalizeRowToDto_(all[i]);
    if (!a.ativo) continue;
    if (String(a.dataRef || "") !== dataRef) continue;

    a.status = _atdNormalizeStatus_(a.status);

    if (a.status === ATENDIMENTO_STATUS.ATENDIDO) continue;
    if (a.status === ATENDIMENTO_STATUS.CANCELADO) continue;
    if (a.status === ATENDIMENTO_STATUS.FALTOU) continue;
    if (a.status === ATENDIMENTO_STATUS.REMARCADO) continue;
    if (a.status === ATENDIMENTO_STATUS.EM_ATENDIMENTO) continue;

    candidates.push(a);
  }

  if (!candidates.length) return { item: null, dataRef: dataRef, message: "Fila vazia." };

  candidates.sort(function (x, y) {
    var xArrived = x.chegadaEm ? 0 : 1;
    var yArrived = y.chegadaEm ? 0 : 1;
    if (xArrived !== yArrived) return xArrived - yArrived;
    return _atdCompareFila_(x, y);
  });

  var next = candidates[0];

  var patch = {
    chamadoEm: next.chamadoEm || nowIso,
    atualizadoEm: nowIso
  };

  Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, next.idAtendimento, patch);
  var after = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, next.idAtendimento);
  return { item: _atdNormalizeRowToDto_(after), dataRef: dataRef };
}

/**
 * Atendimento.Iniciar
 */
function Atendimento_Action_Iniciar_(ctx, payload) {
  payload = payload || {};
  var nowIso = new Date().toISOString();

  var a = _atdResolveTarget_(payload);
  if (!a) _atdThrow_("NOT_FOUND", "Atendimento não encontrado.", { payload: payload });

  var st = _atdNormalizeStatus_(a.status);

  if (st === ATENDIMENTO_STATUS.CANCELADO) _atdThrow_("VALIDATION_ERROR", "Atendimento cancelado não pode iniciar.", { idAtendimento: a.idAtendimento });
  if (st === ATENDIMENTO_STATUS.ATENDIDO) return { item: a };
  if (st === ATENDIMENTO_STATUS.FALTOU) _atdThrow_("VALIDATION_ERROR", "Atendimento marcado como falta não pode iniciar.", { idAtendimento: a.idAtendimento });
  if (st === ATENDIMENTO_STATUS.REMARCADO) _atdThrow_("VALIDATION_ERROR", "Atendimento remarcado não pode iniciar.", { idAtendimento: a.idAtendimento });

  var patch = { status: ATENDIMENTO_STATUS.EM_ATENDIMENTO, inicioAtendimentoEm: a.inicioAtendimentoEm || nowIso, atualizadoEm: nowIso };

  Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento, patch);
  var after = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento);
  return { item: _atdNormalizeRowToDto_(after) };
}

/**
 * Atendimento.Concluir (vira ATENDIDO)
 */
function Atendimento_Action_Concluir_(ctx, payload) {
  payload = payload || {};
  var nowIso = new Date().toISOString();

  var a = _atdResolveTarget_(payload);
  if (!a) _atdThrow_("NOT_FOUND", "Atendimento não encontrado.", { payload: payload });

  var st = _atdNormalizeStatus_(a.status);
  if (st === ATENDIMENTO_STATUS.CANCELADO) _atdThrow_("VALIDATION_ERROR", "Atendimento cancelado não pode concluir.", { idAtendimento: a.idAtendimento });

  var patch = {
    status: ATENDIMENTO_STATUS.ATENDIDO,
    atendidoEm: a.atendidoEm || a.concluidoEm || nowIso,
    concluidoEm: a.concluidoEm || a.atendidoEm || nowIso, // compat
    atualizadoEm: nowIso
  };

  if (payload.observacoes !== undefined) patch.observacoes = String(payload.observacoes || "");

  Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento, patch);
  var after = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento);
  return { item: _atdNormalizeRowToDto_(after) };
}

/**
 * Atendimento.Cancelar
 */
function Atendimento_Action_Cancelar_(ctx, payload) {
  payload = payload || {};
  var nowIso = new Date().toISOString();

  var a = _atdResolveTarget_(payload);
  if (!a) _atdThrow_("NOT_FOUND", "Atendimento não encontrado.", { payload: payload });

  var patch = { status: ATENDIMENTO_STATUS.CANCELADO, canceladoEm: a.canceladoEm || nowIso, atualizadoEm: nowIso };
  if (payload.motivo !== undefined) patch.observacoes = String(payload.motivo || "");

  Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento, patch);
  var after = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento);
  return { item: _atdNormalizeRowToDto_(after) };
}

/**
 * Atendimento.SyncAPartirDeHoje
 */
function Atendimento_Action_SyncAPartirDeHoje_(ctx, payload) {
  payload = payload || {};
  var dias = Number(payload.dias || 30);
  if (isNaN(dias) || dias <= 0) dias = 30;
  if (dias > 365) dias = 365;

  var dataRefInicio = _atdNormalizeDateRef_(payload.dataRefInicio);
  var incluirBloqueios = payload.incluirBloqueios === true;
  var incluirCancelados = payload.incluirCancelados === true;
  var resetOrdem = payload.resetOrdem === true;

  var start = _atdBuildDayStart_(dataRefInicio);
  var end = new Date(start.getTime() + (dias * 24 * 60 * 60 * 1000) - 1);

  var agendaAll = Repo_list_(AGENDA_SHEET_NAME) || [];
  var agendaInRange = [];

  for (var i = 0; i < agendaAll.length; i++) {
    var e = agendaAll[i] || {};
    var idAgenda = e.idAgenda || e.ID_Agenda || "";
    if (!idAgenda) continue;

    var status = String(e.status || "").toUpperCase();
    var tipo = String(e.tipo || "").toUpperCase();
    if (!incluirCancelados && status === "CANCELADO") continue;
    if (!incluirBloqueios && tipo === "BLOQUEIO") continue;

    var ini = _atdParseDate_(e.inicio);
    var fim = _atdParseDate_(e.fim);
    if (!ini || !fim) continue;

    var overlaps = (ini.getTime() <= end.getTime()) && (fim.getTime() >= start.getTime());
    if (!overlaps) continue;

    var dataRef = _atdNormalizeDateRef_(ini);
    agendaInRange.push({
      idAgenda: String(idAgenda),
      idProfissional: String(e.idProfissional || e.ID_Profissional || ""),
      idPaciente: String(e.idPaciente || e.ID_Paciente || ""),
      inicio: ini,
      fim: fim,
      tipo: String(e.tipo || ""),
      status: String(e.status || ""),
      dataRef: dataRef
    });
  }

  var byDay = {};
  for (var j = 0; j < agendaInRange.length; j++) {
    var a = agendaInRange[j];
    if (!byDay[a.dataRef]) byDay[a.dataRef] = [];
    byDay[a.dataRef].push(a);
  }
  Object.keys(byDay).forEach(function (dref) {
    byDay[dref].sort(function (x, y) { return x.inicio.getTime() - y.inicio.getTime(); });
  });

  var existingAll = Repo_list_(ATENDIMENTO_ENTITY) || [];
  var existingMap = {};
  for (var k = 0; k < existingAll.length; k++) {
    var ex = _atdNormalizeRowToDto_(existingAll[k]);
    if (!ex.ativo) continue;
    if (!ex.idAgenda) continue;
    existingMap[String(ex.dataRef) + "::" + String(ex.idAgenda)] = ex;
  }

  var nowIso = new Date().toISOString();
  var created = 0, updated = 0, skipped = 0, totalAgenda = 0;

  var days = Object.keys(byDay).sort();
  for (var di = 0; di < days.length; di++) {
    var dref2 = days[di];
    var arr = byDay[dref2] || [];
    totalAgenda += arr.length;

    for (var idx = 0; idx < arr.length; idx++) {
      var ag = arr[idx];
      var ordemCalc = idx + 1;

      var key = dref2 + "::" + ag.idAgenda;
      var exists = existingMap[key];

      if (!exists) {
        var dto = _atdBuildNew_(
          { idAgenda: ag.idAgenda, idProfissional: ag.idProfissional, idPaciente: ag.idPaciente, dataRef: dref2, ordem: ordemCalc, observacoes: "", sala: "" },
          { idAgenda: ag.idAgenda, idProfissional: ag.idProfissional, idPaciente: ag.idPaciente, dataRef: dref2, status: ATENDIMENTO_STATUS.AGUARDANDO }
        );
        dto.criadoEm = nowIso;
        dto.atualizadoEm = nowIso;
        Repo_insert_(ATENDIMENTO_ENTITY, dto);
        created++;
        continue;
      }

      var patch = {};
      var needUpdate = false;

      if (!exists.idPaciente && ag.idPaciente) {
        patch.idPaciente = ag.idPaciente;
        needUpdate = true;
      }

      if (resetOrdem) {
        var st2 = _atdNormalizeStatus_(exists.status);
        if (
          st2 !== ATENDIMENTO_STATUS.EM_ATENDIMENTO &&
          st2 !== ATENDIMENTO_STATUS.ATENDIDO &&
          st2 !== ATENDIMENTO_STATUS.CANCELADO &&
          st2 !== ATENDIMENTO_STATUS.FALTOU &&
          st2 !== ATENDIMENTO_STATUS.REMARCADO
        ) {
          patch.ordem = ordemCalc;
          needUpdate = true;
        }
      }

      if (needUpdate) {
        patch.atualizadoEm = nowIso;
        Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, exists.idAtendimento, patch);
        updated++;
      } else {
        skipped++;
      }
    }
  }

  return { dataRefInicio: dataRefInicio, dias: dias, created: created, updated: updated, skipped: skipped, totalAgenda: totalAgenda };
}

/**
 * Atendimento.ListarFilaAPartirDeHoje
 * ✅ Correção principal aqui: nomePaciente agora vem de nomeCompleto/nomeSocial/nome
 */
function Atendimento_Action_ListarFilaAPartirDeHoje_(ctx, payload) {
  payload = payload || {};
  var dias = Number(payload.dias || 30);
  if (isNaN(dias) || dias <= 0) dias = 30;
  if (dias > 365) dias = 365;

  var dataRefInicio = _atdNormalizeDateRef_(payload.dataRefInicio);
  var incluirConcluidos = payload.incluirConcluidos === true;
  var incluirCancelados = payload.incluirCancelados === true;

  var start = _atdBuildDayStart_(dataRefInicio);
  var end = new Date(start.getTime() + (dias * 24 * 60 * 60 * 1000) - 1);

  var all = Repo_list_(ATENDIMENTO_ENTITY) || [];
  var out = [];

  var agendaCache = {};
  var pacienteCache = {};

  for (var i = 0; i < all.length; i++) {
    var a = _atdNormalizeRowToDto_(all[i]);
    if (!a.ativo) continue;

    if (!a.dataRef) continue;
    var d0 = _atdBuildDayStart_(String(a.dataRef));
    if (d0.getTime() < start.getTime() || d0.getTime() > end.getTime()) continue;

    var st = _atdNormalizeStatus_(a.status);
    a.status = st;

    if (!incluirCancelados && st === ATENDIMENTO_STATUS.CANCELADO) continue;
    if (!incluirConcluidos && st === ATENDIMENTO_STATUS.ATENDIDO) continue;

    // Enriquecimento via Agenda (hora/tipo)
    if (a.idAgenda) {
      var ag = agendaCache[a.idAgenda];
      if (ag === undefined) {
        try { ag = Repo_getById_(AGENDA_SHEET_NAME, "idAgenda", a.idAgenda); } catch (_) { ag = null; }
        agendaCache[a.idAgenda] = ag || null;
      }
      if (ag) {
        var ini = _atdParseDate_(ag.inicio);
        if (ini) a.hora = _atdFormatHHMM_(ini);
        a.tipo = ag.tipo || a.tipo || "";
      }
    }

    // ✅ Enriquecimento via Pacientes (NOME CORRETO)
    if (a.idPaciente) {
      var p = pacienteCache[a.idPaciente];
      if (p === undefined) {
        try { p = Repo_getById_(PACIENTES_ENTITY, PACIENTES_ID_FIELD, a.idPaciente); } catch (_) { p = null; }
        pacienteCache[a.idPaciente] = p || null;
      }

      if (p) {
        // ✅ cobre variações do seu projeto
        var nome =
          String(p.nomeCompleto || p.nomeSocial || p.nome || p.NomeCompleto || p.Nome || "").trim();

        if (nome) a.nomePaciente = nome;
      }
    }

    out.push(a);
  }

  out.sort(function (x, y) {
    var dx = String(x.dataRef || "");
    var dy = String(y.dataRef || "");
    if (dx !== dy) return dx < dy ? -1 : 1;

    var ox = (typeof x.ordem === "number") ? x.ordem : 999999;
    var oy = (typeof y.ordem === "number") ? y.ordem : 999999;
    if (ox !== oy) return ox - oy;

    var hx = String(x.hora || "");
    var hy = String(y.hora || "");
    return hx.localeCompare(hy);
  });

  return { items: out, count: out.length, dataRefInicio: dataRefInicio, dias: dias };
}

/* ============================================================
 * Helpers
 * ============================================================ */

function _atdResolveTarget_(payload) {
  payload = payload || {};

  var idAtendimento = payload.idAtendimento ? String(payload.idAtendimento) : "";
  if (idAtendimento) {
    var a1 = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, idAtendimento);
    return a1 ? _atdNormalizeRowToDto_(a1) : null;
  }

  var idAgenda = payload.idAgenda ? String(payload.idAgenda) : "";
  if (!idAgenda) return null;

  var dataRef = _atdNormalizeDateRef_(payload.dataRef);
  return _atdFindByAgendaAndDate_(idAgenda, dataRef);
}

function _atdFindByAgendaAndDate_(idAgenda, dataRef) {
  var all = Repo_list_(ATENDIMENTO_ENTITY) || [];
  for (var i = 0; i < all.length; i++) {
    var a = _atdNormalizeRowToDto_(all[i]);
    if (!a.ativo) continue;
    if (String(a.idAgenda || "") !== String(idAgenda || "")) continue;
    if (String(a.dataRef || "") !== String(dataRef || "")) continue;
    return a;
  }
  return null;
}

function _atdBuildNew_(payload, overrides) {
  payload = payload || {};
  overrides = overrides || {};

  var nowIso = new Date().toISOString();
  var idAtendimento = Ids_nextId_("ATENDIMENTO");

  var dto = {
    idAtendimento: idAtendimento,
    idAgenda: overrides.idAgenda || (payload.idAgenda ? String(payload.idAgenda) : ""),
    idProfissional: overrides.idProfissional || (payload.idProfissional ? String(payload.idProfissional) : ""),
    idPaciente: overrides.idPaciente || (payload.idPaciente ? String(payload.idPaciente) : ""),
    dataRef: overrides.dataRef || _atdNormalizeDateRef_(payload.dataRef),
    status: overrides.status || ATENDIMENTO_STATUS.AGUARDANDO,
    ordem: (overrides.ordem !== undefined) ? _atdNormalizeNumberOrBlank_(overrides.ordem) : _atdNormalizeNumberOrBlank_(payload.ordem),

    confirmadoEm: overrides.confirmadoEm || "",
    chegadaEm: overrides.chegadaEm || "",
    chamadoEm: overrides.chamadoEm || "",
    inicioAtendimentoEm: overrides.inicioAtendimentoEm || "",
    atendidoEm: overrides.atendidoEm || "",
    faltouEm: overrides.faltouEm || "",
    canceladoEm: overrides.canceladoEm || "",
    remarcadoEm: overrides.remarcadoEm || "",

    // compat legado
    concluidoEm: overrides.concluidoEm || "",

    sala: (overrides.sala !== undefined) ? String(overrides.sala || "") : (payload.sala ? String(payload.sala) : ""),
    observacoes: (overrides.observacoes !== undefined) ? String(overrides.observacoes || "") : (payload.observacoes ? String(payload.observacoes) : ""),

    hora: "",
    tipo: "",
    nomePaciente: "",

    criadoEm: nowIso,
    atualizadoEm: nowIso,
    ativo: true
  };

  dto.status = _atdNormalizeStatus_(dto.status);
  return dto;
}

function _atdNormalizeRowToDto_(rowObj) {
  rowObj = rowObj || {};

  // ✅ defensivo: tenta carregar nome de diferentes campos (caso já esteja gravado de formas diferentes)
  var nome =
    String(rowObj.nomePaciente || rowObj.nomeCompleto || rowObj.nomeSocial || rowObj.nome || rowObj.NomeCompleto || rowObj.Nome || "").trim();

  return {
    idAtendimento: rowObj.idAtendimento || rowObj.ID_Atendimento || "",
    idAgenda: rowObj.idAgenda || rowObj.ID_Agenda || "",
    idProfissional: rowObj.idProfissional || rowObj.ID_Profissional || "",
    idPaciente: rowObj.idPaciente || rowObj.ID_Paciente || "",
    dataRef: String(rowObj.dataRef || ""),
    status: rowObj.status || ATENDIMENTO_STATUS.AGUARDANDO,
    ordem: _atdParseNumber_(rowObj.ordem),

    confirmadoEm: rowObj.confirmadoEm || "",
    chegadaEm: rowObj.chegadaEm || "",
    chamadoEm: rowObj.chamadoEm || "",
    inicioAtendimentoEm: rowObj.inicioAtendimentoEm || "",

    atendidoEm: rowObj.atendidoEm || rowObj.concluidoEm || "",
    faltouEm: rowObj.faltouEm || "",
    canceladoEm: rowObj.canceladoEm || "",
    remarcadoEm: rowObj.remarcadoEm || "",
    concluidoEm: rowObj.concluidoEm || rowObj.atendidoEm || "",

    sala: rowObj.sala || "",
    observacoes: rowObj.observacoes || "",

    hora: rowObj.hora || "",
    tipo: rowObj.tipo || "",
    nomePaciente: nome,

    criadoEm: rowObj.criadoEm || "",
    atualizadoEm: rowObj.atualizadoEm || "",
    ativo: (rowObj.ativo === undefined ? true : rowObj.ativo === true || String(rowObj.ativo).toUpperCase() === "TRUE")
  };
}

function _atdNormalizeStatus_(status) {
  var s = String(status || "").trim().toUpperCase();
  if (!s) return ATENDIMENTO_STATUS.AGUARDANDO;

  if (s === "AGENDADO") return ATENDIMENTO_STATUS.MARCADO;
  if (s === "CHEGOU") return ATENDIMENTO_STATUS.AGUARDANDO;
  if (s === "CHAMADO") return ATENDIMENTO_STATUS.AGUARDANDO;
  if (s === "CONCLUIDO") return ATENDIMENTO_STATUS.ATENDIDO;

  if (s === "EM ATENDIMENTO" || s === "EM-ATENDIMENTO") s = "EM_ATENDIMENTO";

  if (s.indexOf("REMARC") >= 0) return ATENDIMENTO_STATUS.REMARCADO;
  if (s.indexOf("CANCEL") >= 0) return ATENDIMENTO_STATUS.CANCELADO;
  if (s.indexOf("FALT") >= 0) return ATENDIMENTO_STATUS.FALTOU;

  if (s.indexOf("ATENDID") >= 0) return ATENDIMENTO_STATUS.ATENDIDO;
  if (s.indexOf("EM_ATEND") >= 0) return ATENDIMENTO_STATUS.EM_ATENDIMENTO;

  if (s.indexOf("AGUAR") >= 0) return ATENDIMENTO_STATUS.AGUARDANDO;
  if (s.indexOf("CONFIRM") >= 0) return ATENDIMENTO_STATUS.CONFIRMADO;
  if (s.indexOf("MARC") >= 0) return ATENDIMENTO_STATUS.MARCADO;

  return ATENDIMENTO_STATUS.AGUARDANDO;
}

function _atdNormalizeDateRef_(dateRef) {
  var d = null;

  if (dateRef instanceof Date) d = dateRef;
  else if (typeof dateRef === "number") d = new Date(dateRef);
  else if (typeof dateRef === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateRef)) {
    var parts = dateRef.split("-");
    d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
  } else {
    d = new Date();
  }

  if (isNaN(d.getTime())) d = new Date();

  var y = d.getFullYear();
  var m = ("0" + (d.getMonth() + 1)).slice(-2);
  var dd = ("0" + d.getDate()).slice(-2);
  return y + "-" + m + "-" + dd;
}

function _atdBuildDayStart_(dataRef) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataRef || ""))) {
    _atdThrow_("VALIDATION_ERROR", "dataRef inválida (esperado YYYY-MM-DD).", { dataRef: dataRef });
  }
  var p = String(dataRef).split("-");
  var y = Number(p[0]);
  var m = Number(p[1]) - 1;
  var d = Number(p[2]);
  var dt = new Date(y, m, d, 0, 0, 0, 0);
  if (isNaN(dt.getTime())) _atdThrow_("VALIDATION_ERROR", "dataRef inválida.", { dataRef: dataRef });
  return dt;
}

function _atdParseDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    var dNum = new Date(v);
    return isNaN(dNum.getTime()) ? null : dNum;
  }
  if (typeof v === "string") {
    var dStr = new Date(v);
    return isNaN(dStr.getTime()) ? null : dStr;
  }
  return null;
}

function _atdCompareFila_(x, y) {
  var ox = (typeof x.ordem === "number") ? x.ordem : 999999;
  var oy = (typeof y.ordem === "number") ? y.ordem : 999999;
  if (ox !== oy) return ox - oy;

  var tx = _atdSortTime_(x.chegadaEm) || _atdSortTime_(x.criadoEm) || 0;
  var ty = _atdSortTime_(y.chegadaEm) || _atdSortTime_(y.criadoEm) || 0;
  return tx - ty;
}

function _atdSortTime_(iso) {
  if (!iso) return 0;
  try {
    var d = new Date(String(iso));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch (_) {
    return 0;
  }
}

function _atdParseNumber_(v) {
  if (v === undefined || v === null || v === "") return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

function _atdNormalizeNumberOrBlank_(v) {
  if (v === undefined || v === null || v === "") return "";
  var n = Number(v);
  return isNaN(n) ? "" : n;
}

function _atdFormatHHMM_(d) {
  try {
    var hh = ("0" + d.getHours()).slice(-2);
    var mm = ("0" + d.getMinutes()).slice(-2);
    return hh + ":" + mm;
  } catch (_) {
    return "";
  }
}

function _atdThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
}
