/**
 * PRONTIO - Agenda.CoreConflitos.gs
 * Regra oficial (fonte da verdade) de conflito.
 * Usado por: Agenda_Action_Criar_, Agenda_Action_Atualizar_, Agenda_Action_ValidarConflito_
 */
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
