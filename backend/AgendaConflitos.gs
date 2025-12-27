/**
 * PRONTIO - AgendaConflitos.gs
 * Helper isolado para validar sobreposição de horários na Agenda.
 *
 * Observação importante:
 * - Este helper NÃO conhece planilhas/abas/colunas.
 *
 * ✅ UPDATE (maturação, sem quebrar):
 * - Agora a action Agenda_Action_ValidarConflito(payload) tenta usar a MESMA regra do Agenda.gs:
 *     _agendaAssertSemConflitos_(ctx,args,params)
 *   para garantir que "validou" == "salvou".
 * - Se essa integração não estiver disponível no deploy (ex.: arquivo não carregado),
 *   faz fallback para o validador legado por dia:
 *     Agenda_ListarEventosDiaParaValidacao_(dataStr)
 *
 * API exposta:
 * - Agenda_ValidarConflitos_(args) -> { ok, conflitos, intervalo, erro }
 * - Agenda_AssertSemConflitos_(args) -> retorna { ok:true,... } ou lança Error(code/message/details)
 * - Agenda_Action_ValidarConflito(payload) -> para uso via API (Registry)
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
// API interna de validação (LEGADO POR DIA)
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

// =======================
// NOVO: validação usando a regra real do Agenda.gs
// =======================

function _Agenda_ValidarConflito_UsandoAgendaGs_(payload) {
  payload = payload || {};

  var dataStr = String(payload.data || "").trim();
  var horaStr = String(payload.hora_inicio || "").trim();
  var dur = Number(payload.duracao_minutos || 0);
  var ignoreId = String(payload.ignoreIdAgenda || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    return { ok: false, conflitos: [], intervalo: null, erro: '"data" inválida (YYYY-MM-DD).' };
  }
  if (!/^\d{2}:\d{2}$/.test(horaStr)) {
    return { ok: false, conflitos: [], intervalo: null, erro: '"hora_inicio" inválida (HH:MM).' };
  }
  if (!dur || isNaN(dur) || dur <= 0) {
    return { ok: false, conflitos: [], intervalo: null, erro: '"duracao_minutos" inválida.' };
  }

  // Precisamos do builder do Agenda.gs para garantir consistência de timezone/Date
  if (typeof _agendaBuildDateTime_ !== "function" || typeof _agendaAssertSemConflitos_ !== "function") {
    return null; // sinaliza: não disponível -> fallback legado
  }

  var ini = _agendaBuildDateTime_(dataStr, horaStr);
  var fim = new Date(ini.getTime() + dur * 60000);

  var params = (typeof Config_getAgendaParams_ === "function") ? Config_getAgendaParams_() : {
    duracaoPadraoMin: 30,
    slotMin: 10,
    permiteSobreposicao: false
  };

  var intervalo = {
    data: dataStr,
    hora_inicio: horaStr,
    duracao_minutos: dur
  };

  try {
    // ctx não é usado pela regra atual, mas mantemos a assinatura
    var ctx = { action: "Agenda_ValidarConflito", user: null };

    _agendaAssertSemConflitos_(ctx, {
      inicio: ini,
      fim: fim,
      permitirEncaixe: false,
      modoBloqueio: false,
      ignoreIdAgenda: ignoreId || null
    }, params);

    return { ok: true, conflitos: [], intervalo: intervalo, erro: "" };
  } catch (err) {
    // Converte para o formato do front
    var conflitos = [];

    // Quando Agenda.gs acusa conflito, ele inclui err.details.conflito
    try {
      var det = err && err.details ? err.details : null;
      var c = det && det.conflito ? det.conflito : null;
      if (c) {
        var ci = (typeof _agendaParseDate_ === "function") ? _agendaParseDate_(c.inicio) : new Date(c.inicio);
        var cf = (typeof _agendaParseDate_ === "function") ? _agendaParseDate_(c.fim) : new Date(c.fim);

        var hi = (ci && !isNaN(ci.getTime()) && typeof _agendaFormatHHMM_ === "function") ? _agendaFormatHHMM_(ci) : "";
        var hf = (cf && !isNaN(cf.getTime()) && typeof _agendaFormatHHMM_ === "function") ? _agendaFormatHHMM_(cf) : "";

        var tipoRaw = String(c.tipo || "");
        conflitos.push({
          ID_Agenda: String(c.idAgenda || ""),
          bloqueio: tipoRaw.toUpperCase().indexOf("BLOQ") >= 0,
          data: dataStr,
          hora_inicio: hi,
          hora_fim: hf,
          duracao_minutos: (hi && hf) ? dur : dur // mantém compat
        });
      }
    } catch (_) {}

    return {
      ok: false,
      conflitos: conflitos,
      intervalo: intervalo,
      erro: (err && err.message) ? String(err.message) : "Conflito de horário."
    };
  }
}

/**
 * Action para a API (útil no front validar antes de salvar).
 * Retorna sempre um objeto { ok, conflitos, intervalo, erro } (não lança).
 *
 * ✅ UPDATE:
 * - Tenta usar a regra real do Agenda.gs.
 * - Se indisponível, faz fallback para o validador legado por dia (Agenda_ListarEventosDiaParaValidacao_).
 */
function Agenda_Action_ValidarConflito(payload) {
  payload = payload || {};

  // 1) Preferência: mesma regra do salvar (Agenda.gs)
  try {
    var rNew = _Agenda_ValidarConflito_UsandoAgendaGs_(payload);
    if (rNew && typeof rNew === "object") return rNew;
  } catch (_) {
    // se der qualquer problema, não quebra: cai no legado
  }

  // 2) Fallback legado (por dia)
  return Agenda_ValidarConflitos_({
    data: payload.data,
    inicio: payload.hora_inicio,
    duracaoMin: payload.duracao_minutos,
    ignoreIdAgenda: payload.ignoreIdAgenda || ""
  });
}
