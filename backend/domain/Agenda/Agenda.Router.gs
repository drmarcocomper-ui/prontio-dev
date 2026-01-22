function handleAgendaAction_(action, payload) {
  payload = payload || {};

  var ctx = {
    action: String(action || "").trim(),
    user: null, // preenchido pelo Api.gs / Auth
    env: (typeof PRONTIO_ENV !== "undefined" ? PRONTIO_ENV : "DEV"),
    apiVersion: (typeof PRONTIO_API_VERSION !== "undefined"
      ? PRONTIO_API_VERSION
      : "1.0.0-DEV")
  };

  var a = ctx.action;

  /* ======================================================
   * ACTIONS NOVAS (PADRÃO OFICIAL)
   * ====================================================== */

  switch (a) {

    case "agenda.listarPorPeriodo":
      return Agenda_Action_ListarPorPeriodo_(ctx, payload);

    case "agenda.criar":
      return Agenda_Action_Criar_(ctx, payload);

    case "agenda.atualizar":
      return Agenda_Action_Atualizar_(ctx, payload);

    case "agenda.cancelar":
      return Agenda_Action_Cancelar_(ctx, payload);

    case "agenda.validarConflito":
      return Agenda_Action_ValidarConflito_(ctx, payload);
  }

  /* ======================================================
   * ACTIONS LEGACY (COMPATIBILIDADE CONTROLADA)
   * ⚠️ NÃO USAR EM CÓDIGO NOVO
   * ====================================================== */

  switch (a) {

    case "Agenda_ListarDia":
      return Agenda_Legacy_ListarDia_(ctx, payload);

    case "Agenda_ListarSemana":
      return Agenda_Legacy_ListarSemana_(ctx, payload);

    case "Agenda_Criar":
      return Agenda_Legacy_Criar_(ctx, payload);

    case "Agenda_Atualizar":
      return Agenda_Legacy_Atualizar_(ctx, payload);

    case "Agenda_BloquearHorario":
      return Agenda_Legacy_BloquearHorario_(ctx, payload);

    case "Agenda_MudarStatus":
      return Agenda_Legacy_MudarStatus_(ctx, payload);

    case "Agenda_RemoverBloqueio":
      return Agenda_Legacy_RemoverBloqueio_(ctx, payload);
  }

  /* ======================================================
   * ADAPTER LEGACY (USO INTERNO / TRANSIÇÃO)
   * ====================================================== */

  if (a === "Agenda_ListarEventosDiaParaValidacao") {
    var ds = payload && payload.data ? String(payload.data) : "";
    return {
      items: Agenda_ListarEventosDiaParaValidacao_(ds)
    };
  }

  /* ======================================================
   * ACTION NÃO RECONHECIDA
   * ====================================================== */

  _agendaThrow_("NOT_FOUND", "Action de Agenda não reconhecida.", {
    action: a
  });
}
