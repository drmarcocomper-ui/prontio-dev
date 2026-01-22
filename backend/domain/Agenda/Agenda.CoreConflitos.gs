/**
 * PRONTIO - Agenda.CoreConflitos.gs
 * Regra oficial (fonte da verdade) de conflito.
 * Escopo: POR PROFISSIONAL
 */
function _agendaAssertSemConflitos_(ctx, args, params) {
  params = params || {};
  args = args || {};

  var inicio = args.inicio;
  var fim = args.fim;
  var idProfissional = args.idProfissional ? String(args.idProfissional) : "";

  if (!idProfissional) {
    _agendaThrow_("VALIDATION_ERROR", '"idProfissional" é obrigatório para validação de conflito.', {});
  }

  if (!(inicio instanceof Date) || isNaN(inicio.getTime())) {
    _agendaThrow_("VALIDATION_ERROR", "inicio inválido.", {});
  }

  if (!(fim instanceof Date) || isNaN(fim.getTime())) {
    _agendaThrow_("VALIDATION_ERROR", "fim inválido.", {});
  }

  var ignoreId = args.ignoreIdAgenda ? String(args.ignoreIdAgenda) : null;
  var isBloqueioNovo = args.modoBloqueio === true;

  var cfgPermiteSobreposicao = params.permiteSobreposicao === true;
  var permitirEncaixe = args.permitirEncaixe === true;

  var all = Repo_list_(AGENDA_ENTITY);

  for (var i = 0; i < all.length; i++) {
    var e = _agendaNormalizeRowToDto_(all[i]);

    if (ignoreId && String(e.idAgenda || "") === ignoreId) continue;
    if (String(e.idProfissional || "") !== idProfissional) continue;

    var evIni = _agendaParseDate_(e.inicio);
    var evFim = _agendaParseDate_(e.fim);
    if (!evIni || !evFim) continue;

    var overlaps = (inicio.getTime() < evFim.getTime()) &&
                   (fim.getTime() > evIni.getTime());
    if (!overlaps) continue;

    var evTipo = _agendaNormalizeTipo_(e.tipo || AGENDA_TIPO.CONSULTA);
    var evStatus = _agendaNormalizeStatus_(e.status || AGENDA_STATUS.MARCADO);

    if (evStatus === AGENDA_STATUS.CANCELADO) continue;

    var evIsBloqueio = (evTipo === AGENDA_TIPO.BLOQUEIO);

    if (evIsBloqueio) {
      _agendaThrow_("CONFLICT", "Horário bloqueado para este profissional.", {
        conflitos: [{
          idAgenda: e.idAgenda,
          idProfissional: e.idProfissional,
          inicio: e.inicio,
          fim: e.fim,
          tipo: e.tipo,
          status: e.status
        }]
      });
    }

    if (isBloqueioNovo) {
      _agendaThrow_("CONFLICT", "Não é possível bloquear: existe agendamento no intervalo.", {
        conflitos: [{
          idAgenda: e.idAgenda,
          idProfissional: e.idProfissional,
          inicio: e.inicio,
          fim: e.fim,
          tipo: e.tipo,
          status: e.status
        }]
      });
    }

    if (cfgPermiteSobreposicao) continue;
    if (permitirEncaixe) continue;

    _agendaThrow_("CONFLICT", "Já existe agendamento para este profissional no intervalo.", {
      conflitos: [{
        idAgenda: e.idAgenda,
        idProfissional: e.idProfissional,
        inicio: e.inicio,
        fim: e.fim,
        tipo: e.tipo,
        status: e.status
      }]
    });
  }

  return true;
}
