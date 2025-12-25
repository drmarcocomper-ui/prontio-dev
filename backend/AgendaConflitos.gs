/**
 * PRONTIO - AgendaConflitos.gs
 * Helper isolado para validar sobreposição de horários na Agenda.
 *
 * Observação importante:
 * - Este helper NÃO conhece planilhas/abas/colunas.
 * - Ele depende da função no Agenda.gs:
 *     Agenda_ListarEventosDiaParaValidacao_(dataStr)
 *   que retorne os eventos do dia no formato:
 * {
 *   ID_Agenda: "AG...",
 *   data: "YYYY-MM-DD",
 *   hora_inicio: "HH:MM",
 *   duracao_minutos: 30,
 *   // opcional: hora_fim: "HH:MM"
 *   bloqueio: true|false
 * }
 *
 * API exposta:
 * - Agenda_ValidarConflitos_(args) -> { ok, conflitos, intervalo, erro }
 * - Agenda_AssertSemConflitos_(args) -> retorna { ok:true,... } ou lança Error(code/message/details)
 * - Agenda_Action_ValidarConflito(payload) -> para uso via API (handleAgendaAction/Registry)
 *
 * Ajuste retrocompatível:
 * - Substitui "throw { ... }" por Error com err.code/err.details.
 */

// =======================
// Utilitários de horário
// =======================

function Agenda_TimeToMin_(hhmm) {
  if (!hhmm && hhmm !== 0) return null;

  // Date
  if (hhmm instanceof Date) {
    return hhmm.getHours() * 60 + hhmm.getMinutes();
  }

  var s = String(hhmm).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;

  var h = parseInt(m[1], 10);
  var min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min)) return null;

  if (h < 0 || h > 23 || min < 0 || min > 59) return null;

  return h * 60 + min;
}

function Agenda_MinToTime_(mins) {
  mins = parseInt(mins || 0, 10) || 0;
  // normaliza 0..1439
  mins = ((mins % 1440) + 1440) % 1440;

  var h = Math.floor(mins / 60);
  var m = mins % 60;
  var hh = (h < 10 ? "0" : "") + h;
  var mm = (m < 10 ? "0" : "") + m;
  return hh + ":" + mm;
}

// Intervalos: [inicio, fim) em minutos
function Agenda_IntervalsOverlap_(aStart, aEnd, bStart, bEnd) {
  return (aStart < bEnd) && (bStart < aEnd);
}

function Agenda_NormalizeEvento_(ev) {
  if (!ev) return null;

  var inicioMin = Agenda_TimeToMin_(ev.hora_inicio);
  if (inicioMin == null) return null;

  // Preferência: duracao_minutos
  var dur = parseInt(ev.duracao_minutos || "0", 10);

  // Fallback: hora_fim
  if ((!dur || dur <= 0) && ev.hora_fim) {
    var fimMin = Agenda_TimeToMin_(ev.hora_fim);
    if (fimMin != null && fimMin > inicioMin) {
      dur = fimMin - inicioMin;
    }
  }

  if (!dur || dur <= 0) return null;

  // Nota: não tratamos virar dia (>=1440) como válido aqui.
  var fimMinCalc = inicioMin + dur;

  return {
    ID_Agenda: ev.ID_Agenda || "",
    data: ev.data || "",
    bloqueio: !!ev.bloqueio,
    inicioMin: inicioMin,
    fimMin: fimMinCalc,
    duracao_minutos: dur
  };
}

// =======================
// API interna de validação
// =======================

function Agenda_ValidarConflitos_(args) {
  args = args || {};
  var data = args.data ? String(args.data) : "";
  var inicio = args.inicio ? String(args.inicio) : "";
  var duracaoMin = parseInt(args.duracaoMin || "0", 10);
  var ignoreIdAgenda = args.ignoreIdAgenda ? String(args.ignoreIdAgenda) : "";

  if (!data || !inicio || !duracaoMin || duracaoMin <= 0) {
    return {
      ok: false,
      conflitos: [],
      intervalo: null,
      erro: "Parâmetros inválidos para validação de conflito (data/inicio/duração)."
    };
  }

  var inicioMin = Agenda_TimeToMin_(inicio);
  if (inicioMin == null) {
    return {
      ok: false,
      conflitos: [],
      intervalo: null,
      erro: "Hora início inválida: " + inicio
    };
  }

  var intervalo = {
    data: data,
    inicio: inicio,
    inicioMin: inicioMin,
    fimMin: inicioMin + duracaoMin,
    duracao_minutos: duracaoMin
  };

  if (typeof Agenda_ListarEventosDiaParaValidacao_ !== "function") {
    return {
      ok: false,
      conflitos: [],
      intervalo: intervalo,
      erro:
        "Integração pendente: crie Agenda_ListarEventosDiaParaValidacao_(data) no Agenda.gs para retornar os eventos do dia."
    };
  }

  var eventos = Agenda_ListarEventosDiaParaValidacao_(data) || [];
  var conflitos = [];

  for (var i = 0; i < eventos.length; i++) {
    var ev = eventos[i];
    if (!ev) continue;

    if (ignoreIdAgenda && String(ev.ID_Agenda || "") === ignoreIdAgenda) continue;

    var norm = Agenda_NormalizeEvento_(ev);
    if (!norm) continue;

    if (Agenda_IntervalsOverlap_(intervalo.inicioMin, intervalo.fimMin, norm.inicioMin, norm.fimMin)) {
      conflitos.push({
        ID_Agenda: norm.ID_Agenda,
        bloqueio: norm.bloqueio,
        data: norm.data,
        hora_inicio: Agenda_MinToTime_(norm.inicioMin),
        hora_fim: Agenda_MinToTime_(norm.fimMin),
        duracao_minutos: norm.duracao_minutos
      });
    }
  }

  return {
    ok: conflitos.length === 0,
    conflitos: conflitos,
    intervalo: intervalo,
    erro: ""
  };
}

/**
 * Lança erro padronizado se houver conflito.
 * Assim o Api.gs consegue transformar em JSON com code/message/details.
 */
function Agenda_AssertSemConflitos_(args) {
  var r = Agenda_ValidarConflitos_(args);
  if (r.ok) return r;

  // Se falhou por integração/parâmetro inválido: erro de validação
  if (r.erro && (!r.conflitos || !r.conflitos.length)) {
    var e1 = new Error(r.erro);
    e1.code = "AGENDA_CONFLITOS_INVALID_ARGS";
    e1.details = { intervalo: r.intervalo || null };
    throw e1;
  }

  // Conflito real
  var c = (r.conflitos && r.conflitos.length) ? r.conflitos[0] : null;
  var tipo = c && c.bloqueio ? "bloqueio" : "agendamento";

  var msg =
    "Conflito de horário detectado" +
    (c ? (": conflito com " + tipo + " (" + c.hora_inicio + "–" + c.hora_fim + ").") : ".");

  var e2 = new Error(msg);
  e2.code = "AGENDA_CONFLITO_HORARIO";
  e2.details = {
    intervalo: r.intervalo || null,
    conflitos: r.conflitos || []
  };
  throw e2;
}

/**
 * Action para a API (útil no front validar antes de salvar).
 * Retorna sempre um objeto { ok, conflitos, intervalo, erro } (não lança).
 */
function Agenda_Action_ValidarConflito(payload) {
  payload = payload || {};
  return Agenda_ValidarConflitos_({
    data: payload.data,
    inicio: payload.hora_inicio,
    duracaoMin: payload.duracao_minutos,
    ignoreIdAgenda: payload.ignoreIdAgenda || ""
  });
}
