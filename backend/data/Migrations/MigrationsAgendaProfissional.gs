/**
 * ============================================================
 * PRONTIO - MigrationsAgendaProfissional.gs
 * ============================================================
 * Backfill de idProfissional (e opcionalmente idClinica) em dados legados.
 *
 * Alvos:
 * - Agenda (legado)  -> preencher idProfissional quando vazio
 * - Atendimento      -> preencher idProfissional quando vazio
 *
 * Estratégia de preenchimento (ordem):
 * 1) Derivar por vínculo Agenda<->Atendimento:
 *    - Para Agenda: se existir Atendimento com mesmo idAgenda e ele tiver idProfissional, usar.
 *    - Para Atendimento: se existir Agenda com mesmo idAgenda e ela tiver idProfissional, usar.
 * 2) Fallback: defaultIdProfissional (OBRIGATÓRIO na migração).
 *
 * Obs:
 * - NÃO altera horários/status/etc.
 * - Pode rodar em modo dryRun para auditoria.
 * ============================================================
 */

/**
 * Executa backfill.
 *
 * @param {Object} opts
 * @param {string} opts.defaultIdProfissional  Obrigatório (fallback)
 * @param {string=} opts.defaultIdClinica      Opcional
 * @param {boolean=} opts.dryRun               Se true, não grava (apenas reporta)
 * @param {number=} opts.maxUpdates            Limite de updates por entidade (proteção), default 5000
 * @returns {{success:boolean, data:Object, errors:Array}}
 */
function Migrations_Backfill_IdProfissional_Agenda_Atendimento_(opts) {
  opts = opts || {};

  var defaultIdProfissional = opts.defaultIdProfissional ? String(opts.defaultIdProfissional).trim() : "";
  if (!defaultIdProfissional) {
    return {
      success: false,
      data: null,
      errors: [{ code: "VALIDATION_ERROR", message: '"defaultIdProfissional" é obrigatório na migração.' }]
    };
  }

  var defaultIdClinica = opts.defaultIdClinica ? String(opts.defaultIdClinica).trim() : "";
  var dryRun = opts.dryRun === true;
  var maxUpdates = (typeof opts.maxUpdates === "number" && opts.maxUpdates > 0) ? Math.floor(opts.maxUpdates) : 5000;

  // Resolve nomes de entidade (compatível com constantes ou string)
  var AGENDA = (typeof AGENDA_ENTITY !== "undefined" && AGENDA_ENTITY) ? AGENDA_ENTITY : "Agenda";
  var ATD = (typeof ATENDIMENTO_ENTITY !== "undefined" && ATENDIMENTO_ENTITY) ? ATENDIMENTO_ENTITY : "Atendimento";

  // Resolve idFields (compatível com constantes ou fallback)
  var AGENDA_ID = (typeof AGENDA_ID_FIELD !== "undefined" && AGENDA_ID_FIELD) ? AGENDA_ID_FIELD : "idAgenda";
  var ATD_ID = (typeof ATENDIMENTO_ID_FIELD !== "undefined" && ATENDIMENTO_ID_FIELD) ? ATENDIMENTO_ID_FIELD : "idAtendimento";

  // 1) Carrega listas
  var agendaAll = Repo_list_(AGENDA) || [];
  var atdAll = Repo_list_(ATD) || [];

  // 2) Indexa Atendimento por idAgenda -> idProfissional (primeiro encontrado)
  var atdByIdAgendaProf = {};
  for (var i = 0; i < atdAll.length; i++) {
    var a = atdAll[i] || {};
    var idAgenda = a.idAgenda ? String(a.idAgenda) : "";
    var idProf = a.idProfissional ? String(a.idProfissional) : "";
    if (!idAgenda || !idProf) continue;
    if (!atdByIdAgendaProf[idAgenda]) atdByIdAgendaProf[idAgenda] = idProf;
  }

  // 3) Indexa Agenda por idAgenda -> idProfissional (primeiro encontrado)
  var agendaByIdAgendaProf = {};
  for (var j = 0; j < agendaAll.length; j++) {
    var g = agendaAll[j] || {};
    var gIdAgenda = g.idAgenda ? String(g.idAgenda) : "";
    var gIdProf = g.idProfissional ? String(g.idProfissional) : "";
    if (!gIdAgenda || !gIdProf) continue;
    if (!agendaByIdAgendaProf[gIdAgenda]) agendaByIdAgendaProf[gIdAgenda] = gIdProf;
  }

  // 4) Atualiza Agenda sem idProfissional
  var agendaUpdates = 0;
  var agendaCandidates = 0;
  var agendaFilledFromAtd = 0;
  var agendaFilledFromDefault = 0;

  for (var k = 0; k < agendaAll.length; k++) {
    if (agendaUpdates >= maxUpdates) break;

    var row = agendaAll[k] || {};
    var idAgendaRow = row.idAgenda ? String(row.idAgenda) : "";
    var idProfRow = row.idProfissional ? String(row.idProfissional).trim() : "";

    if (!idAgendaRow) continue;
    if (idProfRow) continue;

    agendaCandidates++;

    var fillProf = atdByIdAgendaProf[idAgendaRow] ? String(atdByIdAgendaProf[idAgendaRow]) : "";
    if (fillProf) agendaFilledFromAtd++;
    if (!fillProf) {
      fillProf = defaultIdProfissional;
      agendaFilledFromDefault++;
    }

    var patch = { idProfissional: fillProf };
    if (defaultIdClinica && (!row.idClinica || !String(row.idClinica).trim())) {
      patch.idClinica = defaultIdClinica;
    }

    if (!dryRun) {
      Repo_update_(AGENDA, AGENDA_ID, idAgendaRow, patch);
    }

    agendaUpdates++;
  }

  // 5) Atualiza Atendimento sem idProfissional
  var atdUpdates = 0;
  var atdCandidates = 0;
  var atdFilledFromAgenda = 0;
  var atdFilledFromDefault = 0;

  for (var m = 0; m < atdAll.length; m++) {
    if (atdUpdates >= maxUpdates) break;

    var r = atdAll[m] || {};
    var idAtd = r.idAtendimento ? String(r.idAtendimento) : (r[ATD_ID] ? String(r[ATD_ID]) : "");
    var idAgenda2 = r.idAgenda ? String(r.idAgenda) : "";
    var idProf2 = r.idProfissional ? String(r.idProfissional).trim() : "";

    if (!idAtd) continue;
    if (idProf2) continue;

    atdCandidates++;

    var fill2 = (idAgenda2 && agendaByIdAgendaProf[idAgenda2]) ? String(agendaByIdAgendaProf[idAgenda2]) : "";
    if (fill2) atdFilledFromAgenda++;
    if (!fill2) {
      fill2 = defaultIdProfissional;
      atdFilledFromDefault++;
    }

    var patch2 = { idProfissional: fill2 };
    if (defaultIdClinica && (!r.idClinica || !String(r.idClinica).trim())) {
      patch2.idClinica = defaultIdClinica;
    }

    if (!dryRun) {
      Repo_update_(ATD, ATD_ID, idAtd, patch2);
    }

    atdUpdates++;
  }

  return {
    success: true,
    data: {
      dryRun: dryRun,
      maxUpdates: maxUpdates,
      defaultIdProfissional: defaultIdProfissional,
      defaultIdClinica: defaultIdClinica || "",
      agenda: {
        entity: AGENDA,
        scanned: agendaAll.length,
        candidatesMissingIdProfissional: agendaCandidates,
        updatesAppliedOrPlanned: agendaUpdates,
        filledFromAtendimento: agendaFilledFromAtd,
        filledFromDefault: agendaFilledFromDefault
      },
      atendimento: {
        entity: ATD,
        scanned: atdAll.length,
        candidatesMissingIdProfissional: atdCandidates,
        updatesAppliedOrPlanned: atdUpdates,
        filledFromAgenda: atdFilledFromAgenda,
        filledFromDefault: atdFilledFromDefault
      }
    },
    errors: []
  };
}

/**
 * Runner para executar a migração (grava de verdade).
 * Se quiser apenas simular, use dryRun: true.
 */
function RUN_MIGRACAO_AGENDA_EXECUTAR() {
  var res = Migrations_Backfill_IdProfissional_Agenda_Atendimento_({
    defaultIdProfissional: "PROF_0001",
    dryRun: false,
    maxUpdates: 5000
  });

  Logger.log(JSON.stringify(res, null, 2));
}

function CHECK_BACKFILL_AGENDA_ATENDIMENTO() {
  var AGENDA = (typeof AGENDA_ENTITY !== "undefined" && AGENDA_ENTITY) ? AGENDA_ENTITY : "Agenda";
  var ATD = (typeof ATENDIMENTO_ENTITY !== "undefined" && ATENDIMENTO_ENTITY) ? ATENDIMENTO_ENTITY : "Atendimento";

  var agendaAll = Repo_list_(AGENDA) || [];
  var atdAll = Repo_list_(ATD) || [];

  var missAgenda = 0;
  for (var i = 0; i < agendaAll.length; i++) {
    var r = agendaAll[i] || {};
    if (!r.idProfissional || !String(r.idProfissional).trim()) missAgenda++;
  }

  var missAtd = 0;
  for (var j = 0; j < atdAll.length; j++) {
    var a = atdAll[j] || {};
    if (!a.idProfissional || !String(a.idProfissional).trim()) missAtd++;
  }

  Logger.log(JSON.stringify({
    agenda: { scanned: agendaAll.length, missingIdProfissional: missAgenda },
    atendimento: { scanned: atdAll.length, missingIdProfissional: missAtd }
  }, null, 2));
}
