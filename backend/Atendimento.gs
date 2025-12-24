/**
 * ============================================================
 * PRONTIO - Atendimento.gs (MÓDULO NOVO)
 * ============================================================
 * Domínio: Atendimento = fluxo operacional do dia (fila, chegada, chamado, início, conclusão).
 * NÃO substitui Agenda.gs (calendário/compromissos).
 *
 * IMPORTANTE:
 * - NÃO usa SpreadsheetApp (Sheets só via Repository).
 * - IDs: Ids_nextId_("ATENDIMENTO")
 * - Locks: aplicados no Api.gs via entry.requiresLock (este módulo NÃO trava aqui).
 *
 * Entidade (backend-only):
 * - sheet/entity: "Atendimento"
 * - idField: "idAtendimento"
 *
 * Actions:
 * - Atendimento.SyncHoje              ✅ NOVO
 * - Atendimento.ListarFilaHoje
 * - Atendimento.MarcarChegada
 * - Atendimento.ChamarProximo
 * - Atendimento.Iniciar
 * - Atendimento.Concluir
 * - Atendimento.Cancelar
 */

var ATENDIMENTO_ENTITY = "Atendimento";
var ATENDIMENTO_ID_FIELD = "idAtendimento";

// Entidade da agenda (mesma usada no Migrations/Repository)
var AGENDA_SHEET_NAME = "Agenda";

var ATENDIMENTO_STATUS = {
  AGUARDANDO: "AGUARDANDO",
  CHEGOU: "CHEGOU",
  CHAMADO: "CHAMADO",
  EM_ATENDIMENTO: "EM_ATENDIMENTO",
  CONCLUIDO: "CONCLUIDO",
  CANCELADO: "CANCELADO"
};

/**
 * ============================================================
 * ✅ NOVO: Atendimento.SyncHoje
 * ============================================================
 * Cria registros na aba Atendimento a partir dos agendamentos do dia (aba Agenda),
 * sem duplicar (idempotente por idAgenda + dataRef).
 *
 * payload:
 * {
 *   dataRef?: "YYYY-MM-DD" // default hoje
 *   incluirBloqueios?: boolean (default false)
 *   incluirCancelados?: boolean (default false)
 *   resetOrdem?: boolean (default false) // se true, recalcula ordem baseado no horário
 * }
 *
 * Retorno:
 * { dataRef, created, updated, skipped, totalAgendaDia }
 */
function Atendimento_Action_SyncHoje_(ctx, payload) {
  payload = payload || {};

  var dataRef = _atdNormalizeDateRef_(payload.dataRef);
  var incluirBloqueios = payload.incluirBloqueios === true;
  var incluirCancelados = payload.incluirCancelados === true;
  var resetOrdem = payload.resetOrdem === true;

  // intervalo [00:00, 23:59:59] do dia local (Date em timezone do script)
  var dayStart = _atdBuildDayStart_(dataRef);
  var dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Carrega agenda do dia (Repo_list_)
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

    // se datas inválidas, ignora
    if (!ini || !fim) continue;

    // evento do dia: overlap com o dia
    var overlaps = (ini.getTime() <= dayEnd.getTime()) && (fim.getTime() >= dayStart.getTime());
    if (!overlaps) continue;

    agendaDia.push({
      idAgenda: String(idAgenda),
      idPaciente: String(e.idPaciente || e.ID_Paciente || ""),
      inicio: ini,
      fim: fim,
      tipo: String(e.tipo || ""),
      status: String(e.status || "")
    });
  }

  // Ordena agendaDia por horário de início (para definir ordem)
  agendaDia.sort(function (a, b) {
    return a.inicio.getTime() - b.inicio.getTime();
  });

  // Indexa atendimentos existentes do dia por idAgenda
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

    // Se não existe, cria
    if (!exists) {
      var dto = _atdBuildNew_(
        {
          idAgenda: ag.idAgenda,
          idPaciente: ag.idPaciente,
          dataRef: dataRef,
          ordem: ordemCalc,
          observacoes: "",
          sala: ""
        },
        {
          idAgenda: ag.idAgenda,
          idPaciente: ag.idPaciente,
          dataRef: dataRef,
          status: ATENDIMENTO_STATUS.AGUARDANDO,
          chegadaEm: "",
          chamadoEm: "",
          inicioAtendimentoEm: "",
          concluidoEm: ""
        }
      );

      // Ajuste final: timestamps coerentes
      dto.criadoEm = nowIso;
      dto.atualizadoEm = nowIso;

      Repo_insert_(ATENDIMENTO_ENTITY, dto);
      created++;
      continue;
    }

    // Existe: atualiza idPaciente se veio vazio; e ordem se resetOrdem
    var patch = {};
    var needUpdate = false;

    if (!exists.idPaciente && ag.idPaciente) {
      patch.idPaciente = ag.idPaciente;
      needUpdate = true;
    }

    if (resetOrdem) {
      // só atualiza ordem se não estiver em atendimento/concluído/cancelado
      var st = _atdNormalizeStatus_(exists.status);
      if (st !== ATENDIMENTO_STATUS.EM_ATENDIMENTO && st !== ATENDIMENTO_STATUS.CONCLUIDO && st !== ATENDIMENTO_STATUS.CANCELADO) {
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

  return {
    dataRef: dataRef,
    created: created,
    updated: updated,
    skipped: skipped,
    totalAgendaDia: agendaDia.length
  };
}

/**
 * Atendimento.ListarFilaHoje
 * payload: { dataRef?: "YYYY-MM-DD", incluirConcluidos?: boolean, incluirCancelados?: boolean }
 */
function Atendimento_Action_ListarFilaHoje_(ctx, payload) {
  payload = payload || {};

  var dataRef = _atdNormalizeDateRef_(payload.dataRef);
  var incluirConcluidos = payload.incluirConcluidos === true;
  var incluirCancelados = payload.incluirCancelados === true;

  var all = Repo_list_(ATENDIMENTO_ENTITY) || [];
  var out = [];

  for (var i = 0; i < all.length; i++) {
    var a = _atdNormalizeRowToDto_(all[i]);
    if (!a.ativo) continue;
    if (String(a.dataRef || "") !== dataRef) continue;

    var st = _atdNormalizeStatus_(a.status);
    a.status = st;

    if (!incluirCancelados && st === ATENDIMENTO_STATUS.CANCELADO) continue;
    if (!incluirConcluidos && st === ATENDIMENTO_STATUS.CONCLUIDO) continue;

    out.push(a);
  }

  out.sort(_atdCompareFila_);
  return { items: out, count: out.length, dataRef: dataRef };
}

/**
 * Atendimento.MarcarChegada
 * payload: { idAgenda: string, idPaciente?: string, dataRef?: "YYYY-MM-DD", sala?: string, observacoes?: string, ordem?: number }
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
      status: ATENDIMENTO_STATUS.CHEGOU,
      chegadaEm: nowIso
    });
    Repo_insert_(ATENDIMENTO_ENTITY, dto);
    return { item: dto };
  }

  var st = _atdNormalizeStatus_(existing.status);
  var patch = {
    status: (st === ATENDIMENTO_STATUS.AGUARDANDO) ? ATENDIMENTO_STATUS.CHEGOU : st,
    atualizadoEm: nowIso
  };

  if (!existing.chegadaEm) patch.chegadaEm = nowIso;
  if (payload.sala !== undefined) patch.sala = String(payload.sala || "");
  if (payload.observacoes !== undefined) patch.observacoes = String(payload.observacoes || "");
  if (payload.ordem !== undefined) patch.ordem = _atdNormalizeNumberOrBlank_(payload.ordem);

  Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, existing.idAtendimento, patch);
  var after = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, existing.idAtendimento);
  return { item: _atdNormalizeRowToDto_(after) };
}

/**
 * Atendimento.ChamarProximo
 * payload: { dataRef?: "YYYY-MM-DD" }
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

    if (a.status === ATENDIMENTO_STATUS.CONCLUIDO) continue;
    if (a.status === ATENDIMENTO_STATUS.CANCELADO) continue;
    if (a.status === ATENDIMENTO_STATUS.EM_ATENDIMENTO) continue;
    if (a.status === ATENDIMENTO_STATUS.CHAMADO) continue;

    if (a.status === ATENDIMENTO_STATUS.CHEGOU || a.status === ATENDIMENTO_STATUS.AGUARDANDO) {
      candidates.push(a);
    }
  }

  candidates.sort(_atdCompareFila_);

  if (!candidates.length) {
    return { item: null, dataRef: dataRef, message: "Fila vazia." };
  }

  // Prefer CHEGOU antes de AGUARDANDO
  candidates.sort(function (x, y) {
    var px = (x.status === ATENDIMENTO_STATUS.CHEGOU) ? 0 : 1;
    var py = (y.status === ATENDIMENTO_STATUS.CHEGOU) ? 0 : 1;
    if (px !== py) return px - py;
    return _atdCompareFila_(x, y);
  });

  var next = candidates[0];
  var patch = {
    status: ATENDIMENTO_STATUS.CHAMADO,
    chamadoEm: next.chamadoEm || nowIso,
    atualizadoEm: nowIso
  };

  Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, next.idAtendimento, patch);
  var after = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, next.idAtendimento);
  return { item: _atdNormalizeRowToDto_(after), dataRef: dataRef };
}

/**
 * Atendimento.Iniciar
 * payload: { idAtendimento?: string, idAgenda?: string, dataRef?: "YYYY-MM-DD" }
 */
function Atendimento_Action_Iniciar_(ctx, payload) {
  payload = payload || {};
  var nowIso = new Date().toISOString();

  var a = _atdResolveTarget_(payload);
  if (!a) _atdThrow_("NOT_FOUND", "Atendimento não encontrado.", { payload: payload });

  var st = _atdNormalizeStatus_(a.status);

  if (st === ATENDIMENTO_STATUS.CANCELADO) {
    _atdThrow_("VALIDATION_ERROR", "Atendimento cancelado não pode iniciar.", { idAtendimento: a.idAtendimento });
  }
  if (st === ATENDIMENTO_STATUS.CONCLUIDO) return { item: a };

  var patch = {
    status: ATENDIMENTO_STATUS.EM_ATENDIMENTO,
    inicioAtendimentoEm: a.inicioAtendimentoEm || nowIso,
    atualizadoEm: nowIso
  };

  Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento, patch);
  var after = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento);
  return { item: _atdNormalizeRowToDto_(after) };
}

/**
 * Atendimento.Concluir
 * payload: { idAtendimento?: string, idAgenda?: string, dataRef?: "YYYY-MM-DD", observacoes?: string }
 */
function Atendimento_Action_Concluir_(ctx, payload) {
  payload = payload || {};
  var nowIso = new Date().toISOString();

  var a = _atdResolveTarget_(payload);
  if (!a) _atdThrow_("NOT_FOUND", "Atendimento não encontrado.", { payload: payload });

  var st = _atdNormalizeStatus_(a.status);
  if (st === ATENDIMENTO_STATUS.CANCELADO) {
    _atdThrow_("VALIDATION_ERROR", "Atendimento cancelado não pode concluir.", { idAtendimento: a.idAtendimento });
  }

  var patch = {
    status: ATENDIMENTO_STATUS.CONCLUIDO,
    concluidoEm: a.concluidoEm || nowIso,
    atualizadoEm: nowIso
  };

  if (payload.observacoes !== undefined) patch.observacoes = String(payload.observacoes || "");

  Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento, patch);
  var after = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento);
  return { item: _atdNormalizeRowToDto_(after) };
}

/**
 * Atendimento.Cancelar
 * payload: { idAtendimento?: string, idAgenda?: string, dataRef?: "YYYY-MM-DD", motivo?: string }
 */
function Atendimento_Action_Cancelar_(ctx, payload) {
  payload = payload || {};
  var nowIso = new Date().toISOString();

  var a = _atdResolveTarget_(payload);
  if (!a) _atdThrow_("NOT_FOUND", "Atendimento não encontrado.", { payload: payload });

  var patch = {
    status: ATENDIMENTO_STATUS.CANCELADO,
    atualizadoEm: nowIso
  };

  if (payload.motivo !== undefined) patch.observacoes = String(payload.motivo || "");

  Repo_update_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento, patch);
  var after = Repo_getById_(ATENDIMENTO_ENTITY, ATENDIMENTO_ID_FIELD, a.idAtendimento);
  return { item: _atdNormalizeRowToDto_(after) };
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
    idPaciente: overrides.idPaciente || (payload.idPaciente ? String(payload.idPaciente) : ""),
    dataRef: overrides.dataRef || _atdNormalizeDateRef_(payload.dataRef),
    status: overrides.status || ATENDIMENTO_STATUS.AGUARDANDO,
    ordem: (overrides.ordem !== undefined) ? _atdNormalizeNumberOrBlank_(overrides.ordem) : _atdNormalizeNumberOrBlank_(payload.ordem),

    chegadaEm: overrides.chegadaEm || "",
    chamadoEm: overrides.chamadoEm || "",
    inicioAtendimentoEm: overrides.inicioAtendimentoEm || "",
    concluidoEm: overrides.concluidoEm || "",

    sala: (overrides.sala !== undefined) ? String(overrides.sala || "") : (payload.sala ? String(payload.sala) : ""),
    observacoes: (overrides.observacoes !== undefined) ? String(overrides.observacoes || "") : (payload.observacoes ? String(payload.observacoes) : ""),

    criadoEm: nowIso,
    atualizadoEm: nowIso,
    ativo: true
  };

  dto.status = _atdNormalizeStatus_(dto.status);
  return dto;
}

function _atdNormalizeRowToDto_(rowObj) {
  rowObj = rowObj || {};

  return {
    idAtendimento: rowObj.idAtendimento || rowObj.ID_Atendimento || "",
    idAgenda: rowObj.idAgenda || rowObj.ID_Agenda || "",
    idPaciente: rowObj.idPaciente || rowObj.ID_Paciente || "",
    dataRef: String(rowObj.dataRef || ""),
    status: rowObj.status || ATENDIMENTO_STATUS.AGUARDANDO,
    ordem: _atdParseNumber_(rowObj.ordem),

    chegadaEm: rowObj.chegadaEm || "",
    chamadoEm: rowObj.chamadoEm || "",
    inicioAtendimentoEm: rowObj.inicioAtendimentoEm || "",
    concluidoEm: rowObj.concluidoEm || "",

    sala: rowObj.sala || "",
    observacoes: rowObj.observacoes || "",

    criadoEm: rowObj.criadoEm || "",
    atualizadoEm: rowObj.atualizadoEm || "",
    ativo: (rowObj.ativo === undefined ? true : rowObj.ativo === true || String(rowObj.ativo).toUpperCase() === "TRUE")
  };
}

function _atdNormalizeStatus_(status) {
  var s = String(status || "").trim().toUpperCase();
  if (!s) return ATENDIMENTO_STATUS.AGUARDANDO;

  if (s === "EM ATENDIMENTO" || s === "EM-ATENDIMENTO") s = "EM_ATENDIMENTO";

  if (s.indexOf("CONCLU") >= 0) return ATENDIMENTO_STATUS.CONCLUIDO;
  if (s.indexOf("CANCEL") >= 0) return ATENDIMENTO_STATUS.CANCELADO;
  if (s.indexOf("ATEND") >= 0 && s.indexOf("EM") >= 0) return ATENDIMENTO_STATUS.EM_ATENDIMENTO;
  if (s.indexOf("CHAM") >= 0) return ATENDIMENTO_STATUS.CHAMADO;
  if (s.indexOf("CHEG") >= 0) return ATENDIMENTO_STATUS.CHEGOU;
  if (s.indexOf("AGUAR") >= 0) return ATENDIMENTO_STATUS.AGUARDANDO;

  if (s === ATENDIMENTO_STATUS.AGUARDANDO) return s;
  if (s === ATENDIMENTO_STATUS.CHEGOU) return s;
  if (s === ATENDIMENTO_STATUS.CHAMADO) return s;
  if (s === ATENDIMENTO_STATUS.EM_ATENDIMENTO) return s;
  if (s === ATENDIMENTO_STATUS.CONCLUIDO) return s;
  if (s === ATENDIMENTO_STATUS.CANCELADO) return s;

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

function _atdThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
}
