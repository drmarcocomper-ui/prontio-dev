/**
 * PRONTIO - AgendaConflitos.gs
 * Helper isolado para validar sobreposição de horários na Agenda.
 *
 * ✅ PASSO 1 (Agenda) - Regra ÚNICA:
 * - Este arquivo NÃO deve conter regra paralela que diverge do Agenda.gs.
 * - Ele existe apenas como ADAPTER/COMPAT para instalações antigas e callers legados.
 *
 * Estratégia:
 * 1) Preferência: delega para Agenda.gs (handleAgendaAction("Agenda_ValidarConflito", payload)
 *    ou Agenda_Action_ValidarConflito_(ctx,payload) quando disponível).
 * 2) Fallback: validação legada por dia usando Agenda_ListarEventosDiaParaValidacao_(dataStr)
 *    (somente se Agenda.gs não estiver disponível).
 *
 * API exposta (mantida):
 * - Agenda_ValidarConflitos_(args) -> { ok, conflitos, intervalo, erro }
 * - Agenda_AssertSemConflitos_(args) -> retorna { ok:true,... } ou lança Error(code/message/details)
 * - Agenda_Action_ValidarConflito(payload) -> para uso via API (Registry/legado)
 */

// =======================
// Utilitários de horário (LEGADO)
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
// Fallback LEGADO por dia (somente quando Agenda.gs não está disponível)
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
      erro: "Parâmetros inválidos para validação de conflito (data/inicio/duração).",
      code: "VALIDATION_ERROR"
    };
  }

  var inicioMin = Agenda_TimeToMin_(inicio);
  if (inicioMin == null) {
    return {
      ok: false,
      conflitos: [],
      intervalo: null,
      erro: "Hora início inválida: " + inicio,
      code: "VALIDATION_ERROR"
    };
  }

  var intervalo = {
    data: data,
    hora_inicio: inicio,
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
        "Integração pendente: crie Agenda_ListarEventosDiaParaValidacao_(data) no Agenda.gs para retornar os eventos do dia.",
      code: "INTERNAL_ERROR"
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
    erro: conflitos.length ? "Conflito de horário." : "",
    code: conflitos.length ? "CONFLICT" : ""
  };
}

/**
 * Lança erro padronizado se houver conflito.
 * ✅ PASSO 1.3: code por comportamento (CONFLICT / VALIDATION_ERROR)
 */
function Agenda_AssertSemConflitos_(args) {
  var r = Agenda_ValidarConflitos_(args);
  if (r.ok) return r;

  // Erro de validação/integração
  if (r.code && r.code !== "CONFLICT") {
    var e1 = new Error(r.erro || "Erro de validação.");
    e1.code = String(r.code || "VALIDATION_ERROR");
    e1.details = { intervalo: r.intervalo || null, conflitos: r.conflitos || [] };
    throw e1;
  }

  // Conflito real
  var e2 = new Error(r.erro || "Conflito de horário.");
  e2.code = "CONFLICT";
  e2.details = { intervalo: r.intervalo || null, conflitos: r.conflitos || [] };
  throw e2;
}

// =======================
// NOVO: delegação para a regra real do Agenda.gs (fonte da verdade)
// =======================

function _Agenda_Action_ValidarConflito_DelegarAgendaGs_(payload) {
  payload = payload || {};

  // Preferência máxima: roteador do módulo Agenda (mantém assinatura padrão)
  if (typeof handleAgendaAction === "function") {
    // Agenda.gs já decide validar == salvar
    return handleAgendaAction("Agenda_ValidarConflito", payload);
  }

  // Alternativa: se o handler oficial existir exposto (dependendo da ordem de load)
  if (typeof Agenda_Action_ValidarConflito_ === "function") {
    // ctx mínimo; a regra não depende dele
    return Agenda_Action_ValidarConflito_({ action: "Agenda_ValidarConflito", user: null }, payload);
  }

  return null; // sinaliza indisponível
}

/**
 * Action para a API (útil no front validar antes de salvar).
 * Retorna sempre um objeto { ok, conflitos, intervalo, erro, code? } (não lança).
 *
 * ✅ PASSO 1:
 * - Delegar para Agenda.gs sempre que possível (regra única).
 * - Se indisponível, fallback legado por dia.
 */
function Agenda_Action_ValidarConflito(payload) {
  payload = payload || {};

  // Normaliza compat de encaixe para o novo handler (se ele usar)
  // (front pode mandar permite_encaixe ou permitirEncaixe)
  if (payload && typeof payload === "object") {
    if (payload.permitirEncaixe === undefined && payload.permite_encaixe === true) payload.permitirEncaixe = true;
    if (payload.permite_encaixe === undefined && payload.permitirEncaixe === true) payload.permite_encaixe = true;
  }

  // 1) Preferência: mesma regra do salvar (Agenda.gs)
  try {
    var rNew = _Agenda_Action_ValidarConflito_DelegarAgendaGs_(payload);

    // O handler oficial (Agenda_Action_ValidarConflito_) retorna:
    // { ok, conflitos, intervalo, erro, code }
    // Mantemos isso.
    if (rNew && typeof rNew === "object") return rNew;
  } catch (err) {
    // Se o handler do Agenda.gs lançar, convertemos para o formato estável
    var code = (err && err.code) ? String(err.code) : "INTERNAL_ERROR";
    var message = (err && err.message) ? String(err.message) : "Erro ao validar conflito.";

    // Conflitos do padrão novo: err.details.conflitos[]
    var conflitos = [];
    try {
      var det = err && err.details ? err.details : null;
      var arr = det && det.conflitos ? det.conflitos : null;
      if (Array.isArray(arr)) {
        for (var i = 0; i < arr.length; i++) {
          var c = arr[i] || {};
          // Mantém shape compat com front legado
          conflitos.push({
            ID_Agenda: String(c.idAgenda || ""),
            bloqueio: String(c.tipo || "").toUpperCase().indexOf("BLOQ") >= 0,
            data: "", // opcional; front não depende disso
            hora_inicio: "",
            hora_fim: "",
            duracao_minutos: 0
          });
        }
      }
    } catch (_) {}

    return {
      ok: false,
      conflitos: conflitos,
      intervalo: payload ? { data: payload.data, hora_inicio: payload.hora_inicio, duracao_minutos: payload.duracao_minutos } : null,
      erro: message,
      code: code
    };
  }

  // 2) Fallback legado (por dia)
  return Agenda_ValidarConflitos_({
    data: payload.data,
    inicio: payload.hora_inicio,
    duracaoMin: payload.duracao_minutos,
    ignoreIdAgenda: payload.ignoreIdAgenda || ""
  });
}
